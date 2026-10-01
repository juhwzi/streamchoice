-- StreamChoice · 0005 · Uma rodada ativa por categoria + tags de voto por canal
-- Permite 1 rodada de filmes e 1 rodada de jogos simultaneamente no mesmo canal.

begin;

-- Remove a regra antiga: apenas uma rodada não concluída por canal.
drop index if exists public.uq_polls_one_active_per_channel;

-- Nova regra: no máximo uma rodada não concluída por categoria em cada canal.
create unique index if not exists uq_polls_one_active_per_channel_category
  on public.polls(channel_id, category_type)
  where status <> 'completed';

create index if not exists idx_polls_channel_category_created
  on public.polls(channel_id, category_type, created_at desc);

-- Contador por canal para que #VOTO-N seja único entre as duas categorias.
create table if not exists public.channel_vote_tag_counters (
  channel_id uuid primary key references public.channels(id) on delete cascade,
  seq int not null default 99
);

alter table public.channel_vote_tag_counters enable row level security;
revoke all on table public.channel_vote_tag_counters from anon, authenticated;

-- Inicializa o contador a partir das tags numéricas já existentes.
insert into public.channel_vote_tag_counters(channel_id, seq)
select
  c.id,
  greatest(99, coalesce(max(nullif(regexp_replace(s.vote_tag, '\D', '', 'g'), '')::int), 99))
from public.channels c
left join public.polls p on p.channel_id = c.id
left join public.suggestions s on s.poll_id = p.id
group by c.id
on conflict (channel_id) do update
set seq = greatest(public.channel_vote_tag_counters.seq, excluded.seq);

-- Garante tags novas globalmente únicas dentro do canal.
create or replace function public.trg_assign_vote_tag() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_channel_id uuid;
  v_seq int;
begin
  select channel_id into v_channel_id
  from public.polls
  where id = new.poll_id;

  if v_channel_id is null then
    raise exception 'poll_not_found_for_vote_tag';
  end if;

  insert into public.channel_vote_tag_counters(channel_id, seq)
  values (v_channel_id, 99)
  on conflict (channel_id) do update
    set seq = public.channel_vote_tag_counters.seq + 1
  returning seq into v_seq;

  new.vote_tag := '#VOTO-' || v_seq;
  return new;
end $$;

-- Mantém o mesmo nome do trigger; apenas altera a função usada por ele.
drop trigger if exists suggestions_assign_tag on public.suggestions;
create trigger suggestions_assign_tag
before insert on public.suggestions
for each row execute function public.trg_assign_vote_tag();

-- Com duas rodadas ativas, a conciliação do Pix precisa localizar a sugestão pelo tag
-- sem escolher arbitrariamente uma rodada. Tags novas são únicas por canal; dados legados
-- ambíguos retornam explicitamente tag_ambiguous.
create or replace function public.record_paid_vote(
  p_channel_id uuid, p_provider text, p_external_tx text, p_tag text,
  p_amount numeric, p_donor text, p_donor_kick_id text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_poll polls%rowtype;
  v_sug suggestions%rowtype;
  v_count int;
  v_id uuid;
begin
  select count(*) into v_count
  from public.suggestions s
  join public.polls p on p.id = s.poll_id
  where p.channel_id = p_channel_id
    and p.status = 'voting'
    and (p.ends_at is null or p.ends_at > now())
    and s.vote_tag = upper(p_tag)
    and s.status = 'approved';

  if v_count = 0 then return 'tag_not_found'; end if;
  if v_count > 1 then return 'tag_ambiguous'; end if;

  select p.* into v_poll
  from public.polls p
  join public.suggestions s on s.poll_id = p.id
  where p.channel_id = p_channel_id
    and p.status = 'voting'
    and (p.ends_at is null or p.ends_at > now())
    and s.vote_tag = upper(p_tag)
    and s.status = 'approved'
  limit 1;

  select s.* into v_sug
  from public.suggestions s
  where s.poll_id = v_poll.id
    and s.vote_tag = upper(p_tag)
    and s.status = 'approved'
  limit 1;

  if not v_poll.is_paid_voting then return 'paid_voting_disabled'; end if;
  if p_amount < v_poll.min_donation_amount then return 'below_minimum'; end if;

  insert into public.paid_votes(poll_id, suggestion_id, donor_kick_id, donor_display_name,
                                amount_paid, provider, transaction_id)
  values (v_poll.id, v_sug.id, p_donor_kick_id, left(p_donor, 60), p_amount, p_provider,
          p_provider || ':' || p_external_tx)
  on conflict (transaction_id) do nothing
  returning id into v_id;

  if v_id is null then return 'duplicate'; end if;
  return 'ok';
end $$;

commit;
