-- StreamChoice · 0003 · Perfis, seguidores e métricas sociais
-- Adiciona uma camada social sem alterar o modelo de votação existente.

alter table users
  add column if not exists display_name text,
  add column if not exists bio varchar(180);

create table if not exists channel_follows (
  id         uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (channel_id, user_id)
);

create index if not exists idx_channel_follows_user on channel_follows(user_id, created_at desc);
create index if not exists idx_channel_follows_channel on channel_follows(channel_id, created_at desc);

alter table channel_follows enable row level security;

revoke all on channel_follows from anon, authenticated;

-- Ranking financeiro por streamer. O agrupamento case-insensitive evita duplicidade
-- quando o gateway retorna variações de maiúsculas/minúsculas no nome do doador.
create or replace function channel_top_contributors(p_channel_id uuid, p_limit int default 10)
returns table (
  donor_display_name text,
  total_amount numeric,
  donation_count int,
  last_contribution_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    max(pv.donor_display_name) as donor_display_name,
    sum(pv.amount_paid) as total_amount,
    count(*)::int as donation_count,
    max(pv.created_at) as last_contribution_at
  from paid_votes pv
  join polls p on p.id = pv.poll_id
  where p.channel_id = p_channel_id
    and pv.status = 'confirmed'
  group by lower(trim(pv.donor_display_name))
  order by sum(pv.amount_paid) desc, max(pv.created_at) desc
  limit least(greatest(coalesce(p_limit, 10), 1), 50)
$$;

grant execute on function channel_top_contributors(uuid, int) to service_role;

grant select (id, username, avatar_url, display_name, bio) on users to anon, authenticated;
