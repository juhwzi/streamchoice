-- StreamChoice · 0002 · Segurança (RLS + privilégios)
--
-- Modelo: a identidade dos usuários vem da Kick (sessão própria do app), não do Supabase Auth.
-- Portanto TODA escrita e toda leitura sensível passam por rotas do Next.js usando a service role
-- (que ignora RLS) depois de checar o papel (STREAMER/MODERATOR/VIEWER) no servidor.
-- O navegador/OBS usam a chave anon e só enxergam a projeção pública abaixo.

alter table users              enable row level security;
alter table channels           enable row level security;
alter table channel_moderators enable row level security;
alter table polls              enable row level security;
alter table suggestions        enable row level security;
alter table votes              enable row level security;
alter table paid_votes         enable row level security;
alter table webhook_events     enable row level security;
alter table poll_tag_counters  enable row level security;
alter table poll_snapshots     enable row level security;

-- Nega tudo por padrão para os papéis públicos…
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- …e libera só a projeção pública (segurança em colunas + linhas).
grant select (id, username, avatar_url)                                          on users     to anon, authenticated;
grant select (id, owner_id, kick_channel_slug, livepix_url, is_active, created_at) on channels to anon, authenticated;
grant select on polls           to anon, authenticated;
grant select on suggestions     to anon, authenticated;
grant select on poll_snapshots  to anon, authenticated;
-- obs_token e livepix_webhook_secret NÃO estão na lista: o navegador não consegue lê-los.

create policy users_public_read      on users          for select using (true);
create policy channels_public_read   on channels       for select using (is_active);
create policy polls_public_read      on polls          for select using (true);
create policy suggestions_public_read on suggestions   for select using (status = 'approved');
create policy snapshots_public_read  on poll_snapshots for select using (true);
-- votes, paid_votes, channel_moderators, webhook_events, poll_tag_counters: sem policy = inacessíveis.

-- Somente a service role executa as regras de negócio.
grant execute on function cast_vote(uuid, uuid, uuid)                                   to service_role;
grant execute on function poll_action(uuid, text, int)                                  to service_role;
grant execute on function finalize_poll_if_due(uuid)                                    to service_role;
grant execute on function record_paid_vote(uuid, text, text, text, numeric, text, text) to service_role;
grant execute on function poll_ranking(uuid)                                            to service_role;
