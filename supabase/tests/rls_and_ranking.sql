-- Teste de regressão do banco. Rode no SQL Editor/psql de um projeto de STAGING com 0001 e 0002 aplicadas.
-- Tudo roda dentro de uma transação que termina em ROLLBACK (não deixa dados). Qualquer falha aborta com ASSERT.
begin;

insert into users(id, kick_user_id, username) values
  ('00000000-0000-0000-0000-000000000001','t1','streamer'),
  ('00000000-0000-0000-0000-000000000002','t2','ana'),
  ('00000000-0000-0000-0000-000000000003','t3','bia');
insert into channels(id, owner_id, kick_channel_slug, livepix_url, livepix_webhook_secret)
  values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000001','teste','https://livepix.gg/t','segredo');
insert into polls(id, channel_id, title, category_type, is_paid_voting, paid_mode, min_donation_amount)
  values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000c1','Teste','movie',true,'hybrid',5);
insert into suggestions(id, poll_id, suggested_by, external_media_id, media_type, title, status) values
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002','tmdb:movie:1','movie','Alien','approved'),
  ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002','tmdb:movie:2','movie','Predator','approved'),
  ('00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000003','tmdb:tv:1','tv','Pendente','pending');

do $$
declare
  poll uuid := '00000000-0000-0000-0000-0000000000a1';
  s1 uuid := '00000000-0000-0000-0000-0000000000b1';
  s2 uuid := '00000000-0000-0000-0000-0000000000b2';
  ch uuid := '00000000-0000-0000-0000-0000000000c1';
  u2 uuid := '00000000-0000-0000-0000-000000000002';
  u3 uuid := '00000000-0000-0000-0000-000000000003';
  r record;
begin
  -- tags sequenciais
  assert (select vote_tag from suggestions where id = s1) = '#VOTO-100', 'tag 1';
  assert (select vote_tag from suggestions where id = s2) = '#VOTO-101', 'tag 2';

  -- duplicata de título bloqueada pelo banco (RF07)
  begin
    insert into suggestions(poll_id, suggested_by, external_media_id, media_type, title)
      values (poll, u2, 'tmdb:movie:1', 'movie', 'Alien de novo');
    assert false, 'duplicata deveria falhar';
  exception when unique_violation then null; end;

  -- só uma rodada ativa por canal
  begin
    insert into polls(channel_id, title, category_type) values (ch, 'Outra', 'movie');
    assert false, 'segunda rodada ativa deveria falhar';
  exception when unique_violation then null; end;

  -- ciclo da rodada
  assert poll_action(poll, 'start_voting', 300) = 'ok', 'start';
  assert poll_action(poll, 'start_voting', 300) = 'invalid_state', 'start repetido';
  assert poll_action(poll, 'pause') = 'ok', 'pause';
  assert (select paused_remaining_seconds from polls where id = poll) between 295 and 300, 'restante na pausa';
  assert poll_action(poll, 'resume') = 'ok', 'resume';
  assert poll_action(poll, 'extend', 60) = 'ok', 'extend';

  -- votos gratuitos: 1 por usuário (RF11)
  assert cast_vote(poll, s1, u2) = 'ok', 'voto 1';
  assert cast_vote(poll, s1, u3) = 'ok', 'voto 2';
  assert cast_vote(poll, s2, u2) = 'already_voted', 'voto repetido';
  assert cast_vote(poll, '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-000000000001') = 'invalid_suggestion', 'sugestão pendente não recebe voto';

  -- Pix: sucesso, idempotência, mínimo, tag inexistente / não aprovada
  assert record_paid_vote(ch, 'livepix', 'tx1', '#VOTO-100', 10.00, 'Ana') = 'ok', 'pix ok';
  assert record_paid_vote(ch, 'livepix', 'tx1', '#VOTO-100', 10.00, 'Ana') = 'duplicate', 'pix duplicado';
  assert record_paid_vote(ch, 'livepix', 'tx2', '#VOTO-100', 2.00, 'Bia') = 'below_minimum', 'abaixo do mínimo';
  assert record_paid_vote(ch, 'livepix', 'tx3', '#VOTO-999', 10.00, 'Cai') = 'tag_not_found', 'tag inexistente';
  assert record_paid_vote(ch, 'livepix', 'tx4', '#VOTO-102', 10.00, 'Cai') = 'tag_not_found', 'tag de item pendente';

  -- REGRESSÃO do bug do DDL original: 2 votos grátis + 1 Pix de R$10 NÃO pode virar R$20.
  select * into r from poll_ranking(poll) where suggestion_id = s1;
  assert r.free_votes_count = 2, 'votos grátis = 2';
  assert r.total_amount_raised = 10.00, 'arrecadado = 10,00 (sem multiplicação por JOIN)';
  assert r.total_score = 12.00, 'híbrido = 2 + 10';

  -- snapshot (alimenta Realtime/OBS) acompanha os dados
  assert (select (data->>'free_votes_total')::int from poll_snapshots where poll_id = poll) = 2, 'snapshot votos';
  assert (select (data->>'paid_total')::numeric from poll_snapshots where poll_id = poll) = 10.00, 'snapshot pago';
  assert (select data->'whale'->>'name' from poll_snapshots where poll_id = poll) = 'Ana', 'baleia';
  assert (select (data->>'pending_count')::int from poll_snapshots where poll_id = poll) = 1, 'fila pendente';

  -- encerramento
  assert finalize_poll_if_due(poll) = false, 'ainda não venceu';
  assert poll_action(poll, 'complete') = 'ok', 'complete';
  assert cast_vote(poll, s2, '00000000-0000-0000-0000-000000000001') = 'poll_not_open', 'voto após encerrar';
end $$;

-- ───── RLS: o que o navegador (anon) enxerga ─────
set local role anon;

do $$
begin
  assert (select count(*) from poll_snapshots) >= 1, 'anon lê snapshots';
  assert (select count(*) from suggestions where poll_id = '00000000-0000-0000-0000-0000000000a1') = 2, 'anon só vê aprovadas';
  perform kick_channel_slug, livepix_url from channels;           -- colunas públicas: ok

  begin perform obs_token from channels;              assert false, 'anon leu obs_token';        exception when insufficient_privilege then null; end;
  begin perform livepix_webhook_secret from channels; assert false, 'anon leu segredo';          exception when insufficient_privilege then null; end;
  begin perform 1 from votes;                          assert false, 'anon leu votes';            exception when insufficient_privilege then null; end;
  begin perform 1 from paid_votes;                     assert false, 'anon leu paid_votes';       exception when insufficient_privilege then null; end;
  begin perform 1 from webhook_events;                 assert false, 'anon leu webhook_events';   exception when insufficient_privilege then null; end;
  begin perform cast_vote(gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
                                                       assert false, 'anon executou cast_vote';   exception when insufficient_privilege then null; end;
  begin insert into users(kick_user_id, username) values ('x','x');
                                                       assert false, 'anon inseriu em users';     exception when insufficient_privilege then null; end;
end $$;

reset role;
select 'TODOS OS TESTES PASSARAM' as resultado;
rollback;
