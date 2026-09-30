-- StreamChoice · 0001 · Schema, índices, funções de negócio e snapshots em tempo real
-- Baseado na seção 6 do PRD, com as correções descritas em docs/DECISOES.md.

-- ───────────────────────── Tabelas ─────────────────────────

create table users (
  id            uuid primary key default gen_random_uuid(),
  kick_user_id  text unique not null,
  username      text not null,
  avatar_url    text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table channels (
  id                     uuid primary key default gen_random_uuid(),
  owner_id               uuid not null references users(id) on delete cascade,
  kick_channel_slug      text not null unique,
  obs_token              uuid not null unique default gen_random_uuid(),
  livepix_url            text,
  livepix_webhook_secret text,
  is_active              boolean default true,
  created_at             timestamptz default now()
);
-- Um streamer tem no máximo uma sala.
create unique index uq_channels_owner on channels(owner_id);

create table channel_moderators (
  id             uuid primary key default gen_random_uuid(),
  channel_id     uuid not null references channels(id) on delete cascade,
  user_id        uuid not null references users(id) on delete cascade,
  is_auto_synced boolean default true,
  created_at     timestamptz default now(),
  unique (channel_id, user_id)
);

create table polls (
  id                         uuid primary key default gen_random_uuid(),
  channel_id                 uuid not null references channels(id) on delete cascade,
  title                      text not null check (char_length(title) between 3 and 80),
  category_type              text not null check (category_type in ('movie','game','mixed')),
  status                     text not null default 'collecting'
                               check (status in ('collecting','voting','paused','completed')),
  poll_mode                  text default 'multiple_choice'
                               check (poll_mode in ('multiple_choice','bracket')),
  is_paid_voting             boolean default false,
  paid_mode                  text default 'accumulated_value'
                               check (paid_mode in ('accumulated_value','fixed_ticket','hybrid')),
  min_donation_amount        numeric(10,2) default 1.00 check (min_donation_amount > 0),
  max_suggestions_per_user   int not null default 3 check (max_suggestions_per_user between 1 and 20),
  paused_remaining_seconds   int,
  ends_at                    timestamptz,
  created_at                 timestamptz default now()
);
-- Uma rodada em andamento por canal (evita ambiguidade na conciliação de Pix).
create unique index uq_polls_one_active_per_channel on polls(channel_id) where status <> 'completed';
create index idx_polls_channel_created on polls(channel_id, created_at desc);

create table suggestions (
  id                uuid primary key default gen_random_uuid(),
  poll_id           uuid not null references polls(id) on delete cascade,
  suggested_by      uuid not null references users(id),
  -- Namespaced para evitar colisão TMDB movie/tv: 'tmdb:movie:550', 'tmdb:tv:1399', 'igdb:1942'
  external_media_id text not null,
  media_type        text not null check (media_type in ('movie','tv','game')),
  title             text not null,
  poster_url        text,
  release_year      text,
  justification     varchar(140),
  status            text default 'pending' check (status in ('pending','approved','rejected')),
  curated_by        uuid references users(id),
  vote_tag          text not null,             -- '#VOTO-104' (atribuída por trigger)
  created_at        timestamptz default now(),
  unique (poll_id, external_media_id),
  unique (poll_id, vote_tag)
);

create table votes (
  id            uuid primary key default gen_random_uuid(),
  poll_id       uuid not null references polls(id) on delete cascade,
  suggestion_id uuid not null references suggestions(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  created_at    timestamptz default now(),
  unique (poll_id, user_id)                   -- RF11: 1 voto por usuário
);

create table paid_votes (
  id                 uuid primary key default gen_random_uuid(),
  poll_id            uuid not null references polls(id) on delete cascade,
  suggestion_id      uuid not null references suggestions(id) on delete cascade,
  donor_kick_id      text,
  donor_display_name text not null,
  amount_paid        numeric(10,2) not null check (amount_paid > 0),
  provider           text not null default 'livepix',
  transaction_id     text unique not null,    -- '<provider>:<id do gateway>' (idempotência)
  status             text default 'confirmed' check (status in ('confirmed','refunded')),
  created_at         timestamptz default now()
);

-- Auditoria de tudo que chega no webhook (inclusive o que foi ignorado e por quê).
create table webhook_events (
  id             bigserial primary key,
  channel_id     uuid references channels(id) on delete cascade,
  provider       text not null,
  transaction_id text,
  outcome        text not null,               -- ok | duplicate | tag_not_found | below_minimum | ...
  amount         numeric(10,2),
  donor          text,
  created_at     timestamptz default now()
);
create index idx_webhook_events_channel on webhook_events(channel_id, created_at desc);

create table poll_tag_counters (
  poll_id uuid primary key references polls(id) on delete cascade,
  seq     int not null
);

-- ───────────────────────── Índices ─────────────────────────
create index idx_channel_moderators_lookup on channel_moderators(channel_id, user_id);
create index idx_suggestions_poll_status   on suggestions(poll_id, status);
create index idx_suggestions_author        on suggestions(poll_id, suggested_by);
create index idx_votes_poll                on votes(poll_id);
create index idx_votes_suggestion          on votes(suggestion_id);
create index idx_paid_votes_poll           on paid_votes(poll_id, status);
create index idx_paid_votes_suggestion     on paid_votes(suggestion_id);

-- ───────────────────────── Tag de voto (#VOTO-N) ─────────────────────────
create or replace function trg_assign_vote_tag() returns trigger
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  insert into poll_tag_counters(poll_id, seq) values (new.poll_id, 100)
  on conflict (poll_id) do update set seq = poll_tag_counters.seq + 1
  returning seq into v;
  new.vote_tag := '#VOTO-' || v;
  return new;
end $$;

create trigger suggestions_assign_tag before insert on suggestions
for each row execute function trg_assign_vote_tag();

-- ───────────────────────── Ranking (fonte única de verdade) ─────────────────────────
-- CORREÇÃO: agrega votos e doações em subconsultas separadas. O DDL original fazia
-- LEFT JOIN de votes e paid_votes juntos, multiplicando SUM(amount_paid) pelo nº de votos.
create or replace function poll_ranking(p_poll_id uuid)
returns table (
  suggestion_id uuid, poll_id uuid, title text, poster_url text, media_type text,
  vote_tag text, release_year text, free_votes_count int,
  total_amount_raised numeric, total_donations_count int, total_score numeric
)
language sql stable as $$
  select s.id, s.poll_id, s.title, s.poster_url, s.media_type, s.vote_tag, s.release_year,
         coalesce(fv.n, 0),
         coalesce(pv.amt, 0.00),
         coalesce(pv.n, 0),
         case
           when p.is_paid_voting and p.paid_mode = 'accumulated_value' then coalesce(pv.amt, 0.00)
           when p.is_paid_voting and p.paid_mode = 'fixed_ticket'      then coalesce(pv.n, 0)::numeric
           when p.is_paid_voting and p.paid_mode = 'hybrid'            then coalesce(fv.n, 0) + coalesce(pv.amt, 0.00)
           else coalesce(fv.n, 0)::numeric
         end
  from suggestions s
  join polls p on p.id = s.poll_id
  left join (select v.suggestion_id, count(*)::int as n
             from votes v where v.poll_id = p_poll_id group by v.suggestion_id) fv
         on fv.suggestion_id = s.id
  left join (select x.suggestion_id, sum(x.amount_paid) as amt, count(*)::int as n
             from paid_votes x where x.poll_id = p_poll_id and x.status = 'confirmed'
             group by x.suggestion_id) pv
         on pv.suggestion_id = s.id
  where s.poll_id = p_poll_id and s.status = 'approved'
$$;

-- View compatível com o PRD (uso administrativo; o app usa poll_ranking/snapshots).
create or replace view poll_live_rankings as
  select r.* from polls p cross join lateral poll_ranking(p.id) r;

-- ───────────────────────── Snapshots + Realtime ─────────────────────────
-- Uma linha por enquete com TUDO que web e OBS precisam. O navegador assina apenas
-- esta tabela (pública, sem dados sensíveis) e recebe o ranking pronto no payload.
create table poll_snapshots (
  poll_id         uuid primary key references polls(id) on delete cascade,
  channel_id      uuid not null references channels(id) on delete cascade,
  poll_created_at timestamptz not null,
  data            jsonb not null,
  updated_at      timestamptz not null default now()
);
create index idx_snapshots_channel on poll_snapshots(channel_id, poll_created_at desc);

create or replace function refresh_poll_snapshot(p_poll_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_poll polls%rowtype;
  v_ranking jsonb; v_pending int; v_free int; v_paid_total numeric; v_paid_count int; v_whale jsonb;
begin
  select * into v_poll from polls where id = p_poll_id;
  if not found then return; end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.total_score desc, r.title), '[]'::jsonb)
    into v_ranking from poll_ranking(p_poll_id) r;
  select count(*) into v_pending from suggestions where poll_id = p_poll_id and status = 'pending';
  select count(*) into v_free from votes where poll_id = p_poll_id;
  select coalesce(sum(amount_paid), 0), count(*) into v_paid_total, v_paid_count
    from paid_votes where poll_id = p_poll_id and status = 'confirmed';
  select to_jsonb(w) into v_whale from (
    select donor_display_name as name, sum(amount_paid) as amount
    from paid_votes where poll_id = p_poll_id and status = 'confirmed'
    group by donor_display_name order by sum(amount_paid) desc limit 1) w;

  insert into poll_snapshots(poll_id, channel_id, poll_created_at, data, updated_at)
  values (p_poll_id, v_poll.channel_id, v_poll.created_at, jsonb_build_object(
    'poll', jsonb_build_object(
      'id', v_poll.id, 'title', v_poll.title, 'category_type', v_poll.category_type,
      'status', v_poll.status, 'poll_mode', v_poll.poll_mode,
      'is_paid_voting', v_poll.is_paid_voting, 'paid_mode', v_poll.paid_mode,
      'min_donation_amount', v_poll.min_donation_amount, 'ends_at', v_poll.ends_at,
      'paused_remaining_seconds', v_poll.paused_remaining_seconds, 'created_at', v_poll.created_at),
    'ranking', v_ranking, 'pending_count', v_pending, 'free_votes_total', v_free,
    'paid_total', v_paid_total, 'paid_count', v_paid_count, 'whale', v_whale,
    'server_time', now()), now())
  on conflict (poll_id) do update
    set data = excluded.data, updated_at = excluded.updated_at, poll_created_at = excluded.poll_created_at;
end $$;

create or replace function trg_refresh_snapshot() returns trigger
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if tg_table_name = 'polls' then
    v := case when tg_op = 'DELETE' then old.id else new.id end;
  else
    v := case when tg_op = 'DELETE' then old.poll_id else new.poll_id end;
  end if;
  perform refresh_poll_snapshot(v);
  return null;
end $$;

create trigger polls_snapshot        after insert or update on polls
  for each row execute function trg_refresh_snapshot();
create trigger suggestions_snapshot  after insert or update or delete on suggestions
  for each row execute function trg_refresh_snapshot();
create trigger votes_snapshot        after insert or delete on votes
  for each row execute function trg_refresh_snapshot();
create trigger paid_votes_snapshot   after insert or update or delete on paid_votes
  for each row execute function trg_refresh_snapshot();

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table poll_snapshots;
  end if;
end $$;

-- ───────────────────────── Regras de negócio atômicas (RPC) ─────────────────────────

-- Voto gratuito. Retorna um código textual; a API traduz para HTTP.
create or replace function cast_vote(p_poll_id uuid, p_suggestion_id uuid, p_user_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_poll polls%rowtype;
begin
  select * into v_poll from polls where id = p_poll_id;
  if not found then return 'poll_not_found'; end if;
  if v_poll.status <> 'voting' then return 'poll_not_open'; end if;
  if v_poll.ends_at is not null and v_poll.ends_at <= now() then return 'poll_ended'; end if;
  if v_poll.is_paid_voting and v_poll.paid_mode <> 'hybrid' then return 'free_voting_disabled'; end if;
  if not exists (select 1 from suggestions
                 where id = p_suggestion_id and poll_id = p_poll_id and status = 'approved') then
    return 'invalid_suggestion';
  end if;
  insert into votes(poll_id, suggestion_id, user_id) values (p_poll_id, p_suggestion_id, p_user_id);
  return 'ok';
exception when unique_violation then
  return 'already_voted';
end $$;

-- Transições de estado da rodada, com lock de linha e relógio do banco.
create or replace function poll_action(p_poll_id uuid, p_action text, p_seconds int default null)
returns text language plpgsql security definer set search_path = public as $$
declare v polls%rowtype; v_approved int;
begin
  select * into v from polls where id = p_poll_id for update;
  if not found then return 'poll_not_found'; end if;

  if p_action = 'start_voting' then
    if v.status <> 'collecting' then return 'invalid_state'; end if;
    select count(*) into v_approved from suggestions where poll_id = p_poll_id and status = 'approved';
    if v_approved < 2 then return 'need_two_approved'; end if;
    update polls set status = 'voting',
      ends_at = now() + make_interval(secs => coalesce(p_seconds, 300)) where id = p_poll_id;

  elsif p_action = 'pause' then
    if v.status <> 'voting' then return 'invalid_state'; end if;
    update polls set status = 'paused',
      paused_remaining_seconds = greatest(0, ceil(extract(epoch from (ends_at - now())))::int),
      ends_at = null where id = p_poll_id;

  elsif p_action = 'resume' then
    if v.status <> 'paused' then return 'invalid_state'; end if;
    update polls set status = 'voting',
      ends_at = now() + make_interval(secs => coalesce(v.paused_remaining_seconds, 0)),
      paused_remaining_seconds = null where id = p_poll_id;

  elsif p_action = 'extend' then
    if v.status not in ('voting','paused') then return 'invalid_state'; end if;
    if p_seconds is null or p_seconds <= 0 or p_seconds > 3600 then return 'invalid_seconds'; end if;
    if v.status = 'voting' then
      update polls set ends_at = greatest(ends_at, now()) + make_interval(secs => p_seconds) where id = p_poll_id;
    else
      update polls set paused_remaining_seconds = coalesce(paused_remaining_seconds, 0) + p_seconds where id = p_poll_id;
    end if;

  elsif p_action = 'complete' then
    if v.status = 'completed' then return 'invalid_state'; end if;
    update polls set status = 'completed', ends_at = now(), paused_remaining_seconds = null where id = p_poll_id;

  else
    return 'invalid_action';
  end if;
  return 'ok';
end $$;

-- Encerramento automático quando a contagem chega a zero (idempotente; qualquer cliente pode disparar).
create or replace function finalize_poll_if_due(p_poll_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update polls set status = 'completed'
   where id = p_poll_id and status = 'voting' and ends_at is not null and ends_at <= now();
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Conciliação de Pix (Fase 4): valida rodada/tag/mínimo e grava com idempotência.
create or replace function record_paid_vote(
  p_channel_id uuid, p_provider text, p_external_tx text, p_tag text,
  p_amount numeric, p_donor text, p_donor_kick_id text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_poll polls%rowtype; v_sug suggestions%rowtype; v_id uuid;
begin
  select * into v_poll from polls where channel_id = p_channel_id and status <> 'completed' limit 1;
  if not found or v_poll.status <> 'voting' then return 'poll_not_open'; end if;
  if not v_poll.is_paid_voting then return 'paid_voting_disabled'; end if;
  if v_poll.ends_at is not null and v_poll.ends_at <= now() then return 'poll_ended'; end if;

  select * into v_sug from suggestions
   where poll_id = v_poll.id and vote_tag = upper(p_tag) and status = 'approved';
  if not found then return 'tag_not_found'; end if;

  if p_amount < v_poll.min_donation_amount then return 'below_minimum'; end if;  -- RF17

  insert into paid_votes(poll_id, suggestion_id, donor_kick_id, donor_display_name,
                         amount_paid, provider, transaction_id)
  values (v_poll.id, v_sug.id, p_donor_kick_id, left(p_donor, 60), p_amount, p_provider,
          p_provider || ':' || p_external_tx)
  on conflict (transaction_id) do nothing
  returning id into v_id;

  if v_id is null then return 'duplicate'; end if;
  return 'ok';
end $$;
