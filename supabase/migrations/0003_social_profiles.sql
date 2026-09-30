-- StreamChoice · 0003 · Social, perfis, verificação Kick e biblioteca
-- Esta migration é idempotente e pode ser executada depois de 0001_schema.sql + 0002_rls.sql.

begin;

-- ============================================================
-- 1. PERFIL DO USUÁRIO
-- ============================================================

alter table public.users
  add column if not exists display_name text;

alter table public.users
  add column if not exists bio text;

alter table public.users
  add column if not exists kick_verified boolean not null default false;

-- Perfis existentes passam a ter um nome de exibição útil por padrão.
update public.users
set display_name = username
where display_name is null or btrim(display_name) = '';

-- O frontend público da V3 consulta estas colunas.
grant select (
  id,
  username,
  avatar_url,
  display_name,
  bio,
  kick_verified,
  created_at
) on public.users to anon, authenticated;

-- ============================================================
-- 2. STREAMERS SEGUIDOS
-- ============================================================

create table if not exists public.channel_follows (
  id         uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (channel_id, user_id)
);

create index if not exists idx_channel_follows_channel
  on public.channel_follows(channel_id, created_at desc);

create index if not exists idx_channel_follows_user
  on public.channel_follows(user_id, created_at desc);

alter table public.channel_follows enable row level security;

revoke all on public.channel_follows from anon, authenticated;
grant select on public.channel_follows to anon, authenticated;

-- O backend usa service_role para inserir/remover follows.
-- Para leitura pública, apenas a existência do follow é exposta.

drop policy if exists channel_follows_public_read on public.channel_follows;
create policy channel_follows_public_read
  on public.channel_follows
  for select
  using (true);

-- ============================================================
-- 3. BIBLIOTECA DO STREAMER
-- ============================================================

create table if not exists public.streamer_media_library (
  id                 uuid primary key default gen_random_uuid(),
  channel_id         uuid not null references public.channels(id) on delete cascade,
  source_poll_id     uuid not null unique references public.polls(id) on delete cascade,
  external_media_id  text not null,
  media_type         text not null check (media_type in ('movie', 'tv', 'game')),
  title              text not null,
  poster_url         text,
  release_year       text,
  status             text not null default 'up_next'
                     check (status in ('up_next', 'in_progress', 'completed')),
  started_at         timestamptz,
  completed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_streamer_library_channel_status
  on public.streamer_media_library(channel_id, status, updated_at desc);

create index if not exists idx_streamer_library_channel_type_status
  on public.streamer_media_library(channel_id, media_type, status, completed_at desc);

alter table public.streamer_media_library enable row level security;

revoke all on public.streamer_media_library from anon, authenticated;
grant select on public.streamer_media_library to anon, authenticated;

drop policy if exists streamer_library_public_read on public.streamer_media_library;
create policy streamer_library_public_read
  on public.streamer_media_library
  for select
  using (status = 'completed');

-- ============================================================
-- 4. FUNÇÃO PARA REGISTRAR O RESULTADO DE UMA VOTAÇÃO
-- ============================================================

create or replace function public.upsert_streamer_library(
  p_channel_id uuid,
  p_poll_id uuid,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := coalesce(p_status, 'up_next');
  v_channel_id uuid;
  v_external_media_id text;
  v_media_type text;
  v_title text;
  v_poster_url text;
  v_release_year text;
  v_id uuid;
begin
  if v_status not in ('up_next', 'in_progress', 'completed') then
    raise exception 'invalid_library_status';
  end if;

  select p.channel_id
    into v_channel_id
  from public.polls p
  where p.id = p_poll_id
    and p.status = 'completed';

  if v_channel_id is null or v_channel_id <> p_channel_id then
    raise exception 'poll_not_completed_or_wrong_channel';
  end if;

  select
    r.title,
    r.poster_url,
    r.media_type,
    r.release_year,
    s.external_media_id
  into
    v_title,
    v_poster_url,
    v_media_type,
    v_release_year,
    v_external_media_id
  from poll_ranking(p_poll_id) r
  join public.suggestions s on s.id = r.suggestion_id
  where r.total_score > 0
  order by r.total_score desc, r.title
  limit 1;

  if v_title is null then
    raise exception 'poll_without_winner';
  end if;

  insert into public.streamer_media_library (
    channel_id,
    source_poll_id,
    external_media_id,
    media_type,
    title,
    poster_url,
    release_year,
    status,
    started_at,
    completed_at,
    updated_at
  )
  values (
    p_channel_id,
    p_poll_id,
    v_external_media_id,
    v_media_type,
    v_title,
    v_poster_url,
    v_release_year,
    v_status,
    case when v_status in ('in_progress', 'completed') then now() else null end,
    case when v_status = 'completed' then now() else null end,
    now()
  )
  on conflict (source_poll_id) do update set
    status = excluded.status,
    title = excluded.title,
    poster_url = excluded.poster_url,
    release_year = excluded.release_year,
    started_at = case
      when excluded.status = 'up_next' then null
      else coalesce(public.streamer_media_library.started_at, excluded.started_at)
    end,
    completed_at = case
      when excluded.status = 'completed' then coalesce(public.streamer_media_library.completed_at, now())
      else null
    end,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_streamer_library(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.upsert_streamer_library(uuid, uuid, text) to service_role;

commit;
