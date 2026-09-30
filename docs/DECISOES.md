# Decisões técnicas e desvios do PRD

## Correções no modelo de dados
1. **Bug na view `poll_live_rankings` (PRD §6).** O DDL original faz `LEFT JOIN votes` e `LEFT JOIN paid_votes` na mesma consulta. Com 2 votos grátis e 1 Pix de R$ 10, o `SUM(amount_paid)` retorna R$ 20 (produto cartesiano). Agora a agregação é feita em subconsultas separadas na função `poll_ranking()`, e a view é só um invólucro. Há teste de regressão em `supabase/tests/rls_and_ranking.sql`.
2. **`external_media_id` com namespace** (`tmdb:movie:550`, `tmdb:tv:550`, `igdb:1942`). No TMDB, filme e série podem ter o mesmo número; sem o prefixo, `UNIQUE(poll_id, external_media_id)` bloquearia sugestões legítimas.
3. **Uma rodada ativa por canal** (índice único parcial). Elimina ambiguidade na conciliação do Pix (a tag é procurada na única rodada em votação do canal).
4. **`vote_tag` atribuída por trigger** com contador por rodada (`#VOTO-100`, `#VOTO-101`…), única por rodada.
5. **Colunas novas:** `polls.max_suggestions_per_user` (RF08 "limites configurados"), `polls.paused_remaining_seconds` (pausar/retomar sem perder o tempo), tabela `webhook_events` (auditoria de tudo que o gateway enviou, inclusive o que foi ignorado e por quê).

## Segurança
- **Identidade é a da Kick, não a do Supabase Auth.** O app emite um JWT próprio (cookie `httpOnly`, `SameSite=Lax`, 7 dias). O `access_token` da Kick **não é armazenado**; usamos só para ler a identidade no login.
- **RLS nega tudo por padrão.** O navegador/OBS (chave `anon`) só lê: `poll_snapshots`, `polls`, `suggestions` aprovadas, `users` (id/username/avatar) e colunas públicas de `channels`. **`obs_token` e `livepix_webhook_secret` não são legíveis** (privilégio por coluna). `votes`, `paid_votes`, `webhook_events` e `channel_moderators` não têm policy. Toda escrita passa por rotas do Next.js (service role) **depois** de checar o papel no servidor. As funções de negócio só são executáveis pela `service_role`.
- **Papéis são resolvidos por canal a cada requisição** (dono → STREAMER; linha em `channel_moderators` → MODERATOR; senão VIEWER). Não há papel "congelado" na sessão, então remover um moderador vale na hora.
- **O servidor nunca confia em título/pôster vindos do cliente:** ao sugerir, ele rebusca o item no TMDB/IGDB pelo ID.
- **Webhook:** HMAC-SHA256 sobre o corpo bruto, comparação em tempo constante, limite de 64 KB, mesma resposta (401) para canal inexistente e assinatura inválida. Idempotência por `paid_votes.transaction_id UNIQUE` (`<provider>:<id>`).
- Proteções extras: checagem de `Origin` nas rotas mutáveis, `state` + PKCE S256 no OAuth, `next` sanitizado (sem open redirect).

## Tempo real
- **Por que `poll_snapshots` e não assinar `votes`/`paid_votes`:** assinar essas tabelas exigiria expô-las ao navegador (quem votou em quê). Em vez disso, triggers recalculam **uma linha por rodada** com ranking, contagens, total arrecadado e "baleia"; o cliente assina só ela e recebe tudo pronto no payload (sem segundo `SELECT`). Isso também serve a fila do moderador (`pending_count` muda → o painel recarrega a fila).
- **Contagem regressiva sincronizada (RF12):** `ends_at` é definido com o relógio do banco; cada cliente estima o offset via `/api/time` (amostra de menor RTT). Ao chegar a zero, qualquer cliente chama `finalize` (idempotente; só encerra se o relógio **do banco** passou de `ends_at`). O servidor também recusa votos após `ends_at`.
- **Ponto de atenção (hot row):** todo voto atualiza a mesma linha de snapshot da rodada. É simples e correto, mas serializa escritas. O teste de carga (`load/spike.k6.js`) existe para validar isso. Se aparecer contenção, o caminho é atualizar o snapshot em lote (statement-level/job a cada ~100 ms) ou rodar a agregação numa fila.

## Limitações conhecidas
| Item | Situação | Caminho |
|---|---|---|
| **RF03: detectar moderadores pela API da Kick** | **Não implementado.** A API pública oficial não tem endpoint para listar moderadores (só rotas internas não documentadas, que evitei). | RF04 (cadastro manual) está completo. `src/lib/kick/moderators.ts` é o ponto de extensão: ao receber eventos de chat da Kick (Events API) com o badge de moderador, chame `markModeratorFromBadge`. |
| Formato do webhook Livepix/PixGG | `payload.ts` e `verify.ts` são **tolerantes** (vários nomes de campo; assinatura hex/`sha256=`/base64; vários nomes de header). | Validar com a documentação/payload real e fixar o formato; se o gateway exigir "buscar a transação por ID" para confirmar, acrescentar essa chamada no handler. |
| Modo **mata-mata** (RF10) | Fora das fases do roadmap; a UI o mostra desabilitado e a API recusa. | Exige tabela de confrontos/rounds. |
| **Animação de sniping** (RF20) | Só um destaque visual quando a liderança muda. Tela de vencedor e "Baleia da Rodada" estão prontas. | Animação dedicada pode ser feita em `RankingBars`/`OverlayBoard`. |
| Reembolso de Pix | A coluna `status='refunded'` já é ignorada no ranking, mas não há rota para marcar. | Ajuste manual no banco ou nova rota. |
| Rate limit | Não há limitação por IP/usuário na aplicação (o voto já é protegido por UNIQUE). | Usar Vercel WAF/Firewall ou Upstash Ratelimit em `/api/media/search` e `/api/suggestions`. |
| Pix fora da janela | Pix com tag válida mas com a rodada pausada/encerrada é **registrado como ignorado** (`poll_not_open`/`poll_ended`); o dinheiro já está com o streamer. | O painel do streamer lista esses eventos. |
| Doação abaixo do mínimo | Ignorada (RF17, opção "ignorar"). Proporcionalidade não implementada. | Alterar `record_paid_vote`. |
