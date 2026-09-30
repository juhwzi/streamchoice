-- StreamChoice · 0004 · acesso de streamer/admin + feed de atividades
-- Pode ser executada depois de 0001_schema.sql + 0002_rls.sql + 0003_social_profiles.sql.
-- É idempotente para facilitar ambientes de staging/dev.

begin;

-- ============================================================
-- 1. CONTROLE DE ACESSO
-- ============================================================

alter table public.users
  add column if not exists is_admin boolean not null default false;

create index if not exists idx_users_kick_verified on public.users(kick_verified);
create index if not exists idx_users_is_admin on public.users(is_admin) where is_admin = true;

-- O perfil público pode exibir apenas esta flag; nenhuma credencial é exposta.
grant select (id, username, avatar_url, display_name, bio, kick_verified, created_at)
  on public.users to anon, authenticated;

-- ============================================================
-- 2. FEED SOCIAL / ATIVIDADES
-- ============================================================

create table if not exists public.stream_activities (
  id            uuid primary key default gen_random_uuid(),
  channel_id    uuid not null references public.channels(id) on delete cascade,
  poll_id       uuid references public.polls(id) on delete cascade,
  library_id    uuid references public.streamer_media_library(id) on delete cascade,
  activity_type text not null check (activity_type in ('poll_created', 'poll_status', 'library_status')),
  title         text not null,
  body          text not null,
  category_type text check (category_type in ('movie', 'game', 'mixed')),
  media_type    text check (media_type in ('movie', 'tv', 'game')),
  poster_url    text,
  status        text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_stream_activities_channel_created
  on public.stream_activities(channel_id, created_at desc);
create index if not exists idx_stream_activities_poll
  on public.stream_activities(poll_id, created_at desc);
create index if not exists idx_stream_activities_library
  on public.stream_activities(library_id, created_at desc);

alter table public.stream_activities enable row level security;
revoke all on public.stream_activities from anon, authenticated;

-- Relações de follow são consumidas pelo backend; não precisam ser expostas diretamente ao navegador.
revoke all on public.channel_follows from anon, authenticated;
drop policy if exists channel_follows_public_read on public.channel_follows;
grant select (
  id, channel_id, poll_id, library_id, activity_type, title, body,
  category_type, media_type, poster_url, status, created_at
) on public.stream_activities to anon, authenticated;

drop policy if exists stream_activities_public_read on public.stream_activities;
create policy stream_activities_public_read
  on public.stream_activities
  for select
  using (true);

-- ============================================================
-- 3. TRIGGERS: VOTAÇÕES
-- ============================================================

create or replace function public.trg_stream_activity_poll()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.stream_activities (
      channel_id, poll_id, activity_type, title, body,
      category_type, status, created_at
    ) values (
      new.channel_id,
      new.id,
      'poll_created',
      new.title,
      'criou uma nova votação',
      new.category_type,
      new.status,
      coalesce(new.created_at, now())
    );

    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.stream_activities (
      channel_id, poll_id, activity_type, title, body,
      category_type, status, created_at
    ) values (
      new.channel_id,
      new.id,
      'poll_status',
      new.title,
      case new.status
        when 'collecting' then 'voltou a receber sugestões'
        when 'voting' then 'abriu a votação'
        when 'paused' then 'pausou a votação'
        when 'completed' then 'encerrou a votação'
        else 'atualizou a votação'
      end,
      new.category_type,
      new.status,
      now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists polls_stream_activity on public.polls;
create trigger polls_stream_activity
after insert or update of status on public.polls
for each row execute function public.trg_stream_activity_poll();

-- ============================================================
-- 4. TRIGGERS: BIBLIOTECA
-- ============================================================

create or replace function public.trg_stream_activity_library()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.stream_activities (
      channel_id, poll_id, library_id, activity_type, title, body,
      category_type, media_type, poster_url, status, created_at
    )
    select
      new.channel_id,
      new.source_poll_id,
      new.id,
      'library_status',
      new.title,
      case new.status
        when 'up_next' then 'colocou na fila A seguir'
        when 'in_progress' then 'marcou como Em andamento'
        when 'completed' then 'marcou como Concluído'
        else 'atualizou a biblioteca'
      end,
      p.category_type,
      new.media_type,
      new.poster_url,
      new.status,
      now()
    from public.polls p
    where p.id = new.source_poll_id;
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.stream_activities (
      channel_id, poll_id, library_id, activity_type, title, body,
      category_type, media_type, poster_url, status, created_at
    )
    select
      new.channel_id, new.source_poll_id, new.id, 'library_status', new.title,
      case new.status
        when 'up_next' then 'voltou para A seguir'
        when 'in_progress' then 'marcou como Em andamento'
        when 'completed' then 'marcou como Concluído'
        else 'atualizou a biblioteca'
      end,
      p.category_type, new.media_type, new.poster_url, new.status, now()
    from public.polls p
    where p.id = new.source_poll_id;
  end if;

  return new;
end;
$$;

drop trigger if exists streamer_library_stream_activity on public.streamer_media_library;
create trigger streamer_library_stream_activity
after insert or update of status on public.streamer_media_library
for each row execute function public.trg_stream_activity_library();

-- ============================================================
-- 5. BACKFILL MÍNIMO PARA INSTÂNCIAS JÁ EXISTENTES
-- ============================================================

insert into public.stream_activities (
  channel_id, poll_id, activity_type, title, body,
  category_type, status, created_at
)
select
  p.channel_id,
  p.id,
  'poll_created',
  p.title,
  'criou uma nova votação',
  p.category_type,
  p.status,
  coalesce(p.created_at, now())
from public.polls p
where not exists (
  select 1
  from public.stream_activities a
  where a.poll_id = p.id
    and a.activity_type = 'poll_created'
);

insert into public.stream_activities (
  channel_id, poll_id, activity_type, title, body,
  category_type, status, created_at
)
select
  p.channel_id,
  p.id,
  'poll_status',
  p.title,
  'encerrou a votação',
  p.category_type,
  p.status,
  coalesce(p.created_at, now())
from public.polls p
where p.status = 'completed'
  and not exists (
    select 1
    from public.stream_activities a
    where a.poll_id = p.id
      and a.activity_type = 'poll_status'
      and a.status = 'completed'
  );

insert into public.stream_activities (
  channel_id, poll_id, library_id, activity_type, title, body,
  category_type, media_type, poster_url, status, created_at
)
select
  l.channel_id,
  l.source_poll_id,
  l.id,
  'library_status',
  l.title,
  case l.status
    when 'up_next' then 'colocou na fila A seguir'
    when 'in_progress' then 'marcou como Em andamento'
    when 'completed' then 'marcou como Concluído'
    else 'atualizou a biblioteca'
  end,
  p.category_type,
  l.media_type,
  l.poster_url,
  l.status,
  coalesce(l.updated_at, l.created_at, now())
from public.streamer_media_library l
left join public.polls p on p.id = l.source_poll_id
where not exists (
  select 1
  from public.stream_activities a
  where a.library_id = l.id
    and a.activity_type = 'library_status'
    and a.status = l.status
);

-- Não permitir inserção/alteração pública. Apenas triggers/service_role.
revoke all on function public.trg_stream_activity_poll() from public, anon, authenticated;
revoke all on function public.trg_stream_activity_library() from public, anon, authenticated;

commit;
