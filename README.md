# StreamChoice

A comunidade da Kick sugere, o time de moderação cura e o chat vota no próximo filme/jogo da live, com overlay para o OBS e votos pagos opcionais via Pix (zero-custódia).

Next.js 15 (App Router) · Supabase (Postgres 16 + Realtime) · Tailwind · Kick OAuth 2.1 PKCE · TMDB · IGDB · Livepix/PixGG.

## Início rápido

```bash
cp .env.example .env.local          # preencha as variáveis
npm install
# No Supabase (SQL Editor ou `supabase db push`): rode, em ordem,
#   supabase/migrations/0001_schema.sql
#   supabase/migrations/0002_rls.sql
# Depois valide o banco: supabase/tests/rls_and_ranking.sql  (termina em ROLLBACK)
npm run dev
npm test                             # testes unitários (Node ≥ 22.6)
```

Detalhes de configuração (Kick, Supabase, OBS, Livepix) e o roteiro do teste de carga: **[docs/OPERACAO.md](docs/OPERACAO.md)**.
Decisões e desvios em relação ao PRD: **[docs/DECISOES.md](docs/DECISOES.md)**.

## Roadmap (seção 9 do PRD) → onde está

| Fase | Item | Implementação |
|---|---|---|
| **1** Fundação e Auth | Next.js + Supabase | `package.json`, `src/lib/supabase/*`, `src/app/(site)/layout.tsx` |
| | OAuth 2.1 PKCE com a Kick | `src/lib/kick/{pkce,client}.ts`, `src/app/api/auth/kick/{login,callback}`, sessão em `src/lib/session-token.ts` |
| | Tabelas, índices e RLS | `supabase/migrations/0001_schema.sql`, `0002_rls.sql`, RBAC em `src/lib/auth/guard.ts` |
| **2** Mídia e Curadoria | Clientes TMDB e IGDB | `src/lib/media/{tmdb,igdb,search}.ts` |
| | Modal de submissão, busca em tempo real, bloqueio de duplicatas | `src/components/SubmitModal.tsx`, `api/media/search`, `api/suggestions` (+ `UNIQUE(poll_id, external_media_id)`) |
| | Painel do moderador em tempo real | `src/components/ModPanel.tsx`, `app/(site)/mod/[slug]`, `api/suggestions/[id]`, `api/polls/[id]/pending` |
| **3** Votação e Overlays | 1 voto grátis por usuário | `api/votes` → RPC `cast_vote` (`UNIQUE(poll_id, user_id)`) |
| | Realtime (WebSocket) | tabela `poll_snapshots` + triggers; hook `src/lib/hooks/useLiveSnapshot.ts` |
| | Rota do OBS (barras + contagem regressiva) | `app/(overlay)/overlay/[token]`, `OverlayBoard.tsx`, `RankingBars.tsx`, `api/time`, `api/polls/[id]/{action,finalize}` |
| **4** Monetização e Ajustes | Webhook Livepix/PixGG (HMAC + tag) | `api/webhooks/livepix`, `src/lib/webhook/*`, RPC `record_paid_vote` |
| | Métricas financeiras (painel + overlay) | `app/(site)/dashboard`, rodapé e tela de vencedor/baleia em `OverlayBoard.tsx` |
| | Testes de carga e documentação | `load/spike.k6.js`, `scripts/seed-load.mjs`, `scripts/realtime-latency.mjs`, `supabase/tests/*.sql`, `tests/*.test.ts`, `docs/` |

## Estrutura

```
src/app/(site)/        páginas do site (landing, /c/[slug], /mod/[slug], /dashboard)
src/app/(overlay)/     layout raiz transparente p/ o OBS
src/app/api/           rotas: auth, mídia, sugestões, polls, votos, canais, webhooks
src/components/        UI (ViewerRoom, ModPanel, OverlayBoard, RankingBars, SubmitModal…)
src/lib/               regras puras (scoring, poll-state, pkce, webhook) + camada de servidor
supabase/migrations/   schema, funções de negócio, snapshots, RLS
supabase/tests/        teste SQL (ranking, idempotência, RLS)
tests/                 testes unitários (node:test)
load/ scripts/         teste de carga (k6) e medição de latência do Realtime
```

## Status de verificação (seja honesto com você mesmo antes do deploy)

- ✅ **Executado:** 16 testes unitários (PKCE contra o vetor da RFC 7636, HMAC, parser de Pix, pontuação, relógio, deduplicação de IDs); checagem de sintaxe dos scripts.
- ⚠️ **Escrito mas ainda NÃO executado** (o ambiente de geração não tinha rede, Postgres nem TypeScript): `npm run typecheck`/`build`, as migrations SQL, `supabase/tests/rls_and_ranking.sql`, o fluxo real com Kick/TMDB/IGDB e os testes de carga. Rode nesta ordem: `npm install` → `npm run typecheck` → migrations → teste SQL → `npm run dev`.
- ⚠️ **Dependem de validação com a fonte:** formato do payload/assinatura do Livepix/PixGG (`src/lib/webhook/payload.ts`) e os escopos/respostas da Kick (`src/lib/kick/client.ts`).
