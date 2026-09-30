# Operação

## 1. Supabase
1. Crie o projeto. Em **SQL Editor**, rode `0001_schema.sql` e depois `0002_rls.sql`.
2. Confirme em *Database → Replication* que `poll_snapshots` está na publicação `supabase_realtime` (a migration tenta adicionar sozinha).
3. Rode `supabase/tests/rls_and_ranking.sql`. Deve terminar em `TODOS OS TESTES PASSARAM`.
4. Copie URL, `anon` e `service_role` para `.env.local`. **A service role nunca vai para o navegador.**

## 2. Kick
Crie um app em <https://dev.kick.com> com o redirect `{NEXT_PUBLIC_APP_URL}/api/auth/kick/callback` (exato) e os escopos `user:read` e `channel:read`. Preencha `KICK_CLIENT_ID/SECRET`.

## 3. TMDB / IGDB
- TMDB: use o *API Read Access Token* (v4) em `TMDB_READ_TOKEN`.
- IGDB: crie um app em <https://dev.twitch.tv/console> e use `TWITCH_CLIENT_ID/SECRET` (o token é renovado automaticamente).

## 4. Primeiro uso
1. O streamer entra com a Kick → **Meu painel → Criar sala** (o slug vem da Kick).
2. Em **Pix**, informe o link público do Livepix/PixGG e gere um **segredo**; cadastre no gateway a URL de webhook exibida (`/api/webhooks/livepix?channel=<slug>`) com o mesmo segredo.
3. Em **Moderadores**, adicione quem for ajudar (a pessoa precisa ter feito login uma vez).
4. **Operar a live** → criar rodada → os espectadores sugerem em `/c/<slug>` → aprovar (`A`) / rejeitar (`R`) → **Abrir votação** (`Espaço`).

## 5. OBS Studio
Fontes → **+** → Navegador. URL: a exibida em *Overlay do OBS* (`/overlay/<token>`; opcional `?scale=1.25`). Largura/altura: 1920×1080. **Desmarque** "Desligar fonte quando não estiver visível" e "Atualizar navegador quando a cena ficar ativa" (assim a contagem não reinicia). Se o token vazar, use **Regenerar token**.

## 6. Testes de carga (staging!)
```bash
# usuários e rodada de teste (gera load/fixtures.json)
N_USERS=5000 npm run seed:load

# 1) latência do Realtime (RNF01: p95 < 300 ms do commit até a tela)
npm run load:realtime -- https://seu-staging.vercel.app

# 2) pico de votos + Pix assinados (k6: https://k6.io)
k6 run -e BASE_URL=https://seu-staging.vercel.app load/spike.k6.js

# limpar
node --env-file=.env.local scripts/seed-load.mjs --cleanup
```
O cenário sobe de 20 → 500 votos/s (raid), sustenta 30 s e desce, com 5 Pix/s assinados em paralelo (incluindo reentrega e assinatura forjada). Critérios: p95 < 800 ms, 99% de checks, e `votes` com exatamente 1 linha por usuário. Após o pico, compare `free_votes_total` do snapshot com `select count(*) from votes where poll_id = …` — devem ser iguais.

## 7. Diagnóstico
- *Pix não contou?* **Meu painel → Últimos eventos**: `no_tag`, `tag_not_found`, `below_minimum`, `poll_not_open`, `duplicate`.
- *Overlay em branco?* É esperado quando não há rodada. Verifique o token e se o Realtime está ativo no projeto.
- *Tempo dessincronizado?* Confira se `/api/time` responde rápido (roda em Edge).
