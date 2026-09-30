# StreamChoice 🎮🎬

> Plataforma de votação para streams: a comunidade sugere filmes e jogos, a moderação faz a curadoria e o chat decide o próximo conteúdo por votação. O resultado pode ser exibido em tempo real no OBS Studio, com suporte opcional a votos pagos via Pix.

**StreamChoice** foi desenvolvido para reduzir a fricção entre streamer, moderadores e comunidade na escolha do próximo conteúdo da live.

O projeto combina **Next.js 15**, **Supabase/PostgreSQL**, **Realtime**, **Kick OAuth 2.1 + PKCE**, **TMDB**, **IGDB** e um webhook opcional para **Livepix/PixGG**.

## ✨ Visão geral

```text
Streamer entra com a Kick
        ↓
Cria/abre uma sala
        ↓
Comunidade sugere filmes e jogos
        ↓
Streamer/moderadores fazem a curadoria
        ↓
Títulos aprovados entram na votação
        ↓
Chat vota gratuitamente ou via Pix (opcional)
        ↓
Ranking atualiza em tempo real
        ↓
Vencedor é definido ao final da rodada
        ↓
Resultado pode ser exibido no OBS
```

## 🚀 Funcionalidades

### 👥 Comunidade

* Login usando a conta da **Kick**.
* Sala pública por canal: `/c/<slug>`.
* Busca de conteúdo em fontes externas.
* Sugestão de filmes, séries e jogos conforme a categoria da rodada.
* Exibição do ranking atual da votação.
* 1 voto gratuito por usuário em cada rodada.

### 🧑‍💻 Streamer e moderação

* Dashboard do canal.
* Criação e gerenciamento de rodadas.
* Curadoria de sugestões.
* Aprovação/rejeição de títulos.
* Gerenciamento manual de moderadores.
* Configuração de votação gratuita/paga.
* Configuração do webhook do Pix.
* Regeneração do token do overlay do OBS.
* Visualização de métricas e eventos recebidos.

### 📊 Votação

Estados suportados:

```text
collecting → collecting sugestões
voting     → votação aberta
paused     → votação pausada
completed  → rodada finalizada
```

### 💰 Votos pagos

Suporta:

* `accumulated_value`
* `fixed_ticket`
* `hybrid`

O webhook utiliza HMAC-SHA256, validação de assinatura, limite de payload, idempotência e auditoria.

### 📺 Overlay para OBS

Rota:

```text
/overlay/<token>
```

Pode mostrar ranking, barras de votação, countdown, votos, valor arrecadado, líder, vencedor e maior contribuição.

## 🧱 Stack

| Tecnologia            | Uso                        |
| --------------------- | -------------------------- |
| Next.js 15            | Aplicação web e API        |
| React 19              | Interface                  |
| TypeScript            | Tipagem                    |
| Tailwind CSS          | Estilização                |
| Supabase              | PostgreSQL, RLS e Realtime |
| Kick OAuth 2.1 + PKCE | Autenticação               |
| TMDB                  | Filmes e séries            |
| IGDB                  | Jogos                      |
| Livepix/PixGG         | Votos pagos                |
| Node.js 22.6+         | Runtime                    |
| k6                    | Testes de carga            |

## 📁 Estrutura

```text
streamchoice/
├── src/
│   ├── app/
│   │   ├── (site)/
│   │   │   ├── entrar/
│   │   │   ├── c/[slug]/
│   │   │   ├── mod/[slug]/
│   │   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── (overlay)/
│   │   │   └── overlay/[token]/
│   │   └── api/
│   │       ├── auth/kick/
│   │       ├── channels/
│   │       ├── media/search/
│   │       ├── polls/
│   │       ├── suggestions/
│   │       ├── votes/
│   │       ├── time/
│   │       └── webhooks/livepix/
│   ├── components/
│   └── lib/
├── supabase/
├── scripts/
├── load/
├── tests/
├── docs/
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## 📌 Pré-requisitos

* Node.js 22.6+
* npm
* Conta no Supabase
* Aplicação de desenvolvedor na Kick
* Token do TMDB
* Aplicação Twitch/IGDB
* Livepix/PixGG, caso queira votação paga
* k6 para testes de carga

# 🛠️ Instalação

```bash
git clone https://github.com/SEU_USUARIO/streamchoice.git
cd streamchoice
npm install
cp .env.example .env.local
npm run dev
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

## 🔐 Variáveis de ambiente

| Variável                        | Obrigatória | Descrição            |
| ------------------------------- | :---------: | -------------------- |
| `NEXT_PUBLIC_APP_URL`           |      ✅      | URL pública          |
| `NEXT_PUBLIC_SUPABASE_URL`      |      ✅      | URL Supabase         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` |      ✅      | Chave pública        |
| `SUPABASE_SERVICE_ROLE_KEY`     |      ✅      | Chave administrativa |
| `SESSION_SECRET`                |      ✅      | Segredo da sessão    |
| `KICK_CLIENT_ID`                |      ✅      | Client ID Kick       |
| `KICK_CLIENT_SECRET`            |      ✅      | Client Secret Kick   |
| `TMDB_READ_TOKEN`               |      ✅      | Token TMDB v4        |
| `TWITCH_CLIENT_ID`              |      ✅      | Client ID Twitch     |
| `TWITCH_CLIENT_SECRET`          |      ✅      | Client Secret Twitch |
| `WEBHOOK_SIGNATURE_HEADER`      |      ❌      | Header da assinatura |

Gere o segredo da sessão:

```bash
openssl rand -base64 32
```

> Nunca publique `.env.local` ou chaves privadas no GitHub.

# 🗄️ Supabase

Execute no SQL Editor, nesta ordem:

```text
supabase/migrations/0001_schema.sql
supabase/migrations/0002_rls.sql
```

Depois valide:

```text
supabase/tests/rls_and_ranking.sql
```

O teste deve terminar em:

```text
TODOS OS TESTES PASSARAM
```

A tabela `poll_snapshots` deve estar habilitada para `supabase_realtime`.

# 🟢 Kick

Configure o redirect:

```text
http://localhost:3000/api/auth/kick/callback
```

Em produção:

```text
https://SEU-DOMINIO/api/auth/kick/callback
```

Scopes utilizados:

```text
user:read
channel:read
```

# 🎬 TMDB

Configure:

```env
TMDB_READ_TOKEN=SEU_TOKEN
```

O servidor usa o token para buscas e resolução canônica dos títulos.

# 🎮 IGDB

Configure:

```env
TWITCH_CLIENT_ID=SEU_CLIENT_ID
TWITCH_CLIENT_SECRET=SEU_CLIENT_SECRET
```

O projeto renova automaticamente o token OAuth usado nas consultas ao IGDB.

# 💸 Pix

Endpoint:

```text
https://SEU-DOMINIO/api/webhooks/livepix?channel=SEU_SLUG
```

O webhook valida assinatura, identifica a tag do voto, verifica a rodada e registra o evento de forma idempotente.

Outcomes registrados incluem:

```text
no_tag
tag_not_found
below_minimum
poll_not_open
poll_ended
duplicate
```

# 📺 OBS Studio

Adicione uma fonte **Navegador**:

```text
https://SEU-DOMINIO/overlay/SEU_TOKEN
```

Configuração sugerida:

```text
Largura: 1920
Altura: 1080
```

Escala opcional:

```text
/overlay/SEU_TOKEN?scale=1.25
```

Recomenda-se desativar:

* Desligar fonte quando não estiver visível
* Atualizar navegador quando a cena ficar ativa

# 🔌 API

| Método | Endpoint                         | Função             |
| ------ | -------------------------------- | ------------------ |
| GET    | `/api/auth/kick/login`           | Inicia OAuth       |
| GET    | `/api/auth/kick/callback`        | Finaliza OAuth     |
| POST   | `/api/auth/logout`               | Logout             |
| POST   | `/api/channels`                  | Cria canal         |
| POST   | `/api/channels/:slug/moderators` | Adiciona moderador |
| DELETE | `/api/channels/:slug/moderators` | Remove moderador   |
| PATCH  | `/api/channels/:slug/settings`   | Configura canal    |
| GET    | `/api/media/search`              | Busca mídia        |
| POST   | `/api/suggestions`               | Cria sugestão      |
| PATCH  | `/api/suggestions/:id`           | Aprova/rejeita     |
| POST   | `/api/polls`                     | Cria rodada        |
| POST   | `/api/polls/:id/action`          | Controla rodada    |
| GET    | `/api/polls/:id/pending`         | Pendências         |
| POST   | `/api/polls/:id/finalize`        | Finaliza rodada    |
| POST   | `/api/votes`                     | Voto gratuito      |
| GET    | `/api/time`                      | Hora do servidor   |
| POST   | `/api/webhooks/livepix`          | Webhook Pix        |

# 🔒 Segurança

O projeto utiliza:

* cookie `httpOnly`;
* `SameSite=Lax`;
* sessão de 7 dias;
* OAuth com `state` + PKCE S256;
* autorização por canal;
* RLS no Supabase;
* validação com Zod;
* controle de duplicidade de votos;
* HMAC-SHA256 nos webhooks;
* idempotência por transação;
* proteção contra open redirect;
* separação entre dados públicos e segredos administrativos.

Papéis:

```text
STREAMER
MODERATOR
VIEWER
```

# ⚡ Realtime

O ranking público não depende da exposição direta das tabelas individuais de votos.

Os dados são consolidados em:

```text
poll_snapshots
```

O snapshot contém ranking, contadores, arrecadação, maior contribuição, pendências, dados da rodada e horário do servidor.

# 🧮 Pontuação

### Gratuito

```text
score = quantidade de votos
```

### Valor acumulado

```text
score = valor arrecadado
```

### Ticket fixo

```text
score = número de contribuições
```

### Híbrido

```text
score = votos grátis + valor arrecadado
```

# 🧪 Testes

```bash
npm test
npm run typecheck
npm run build
```

Testes cobrem principalmente:

* PKCE;
* HMAC;
* parsing de webhook;
* pontuação;
* relógio;
* IDs externos.

# 📈 Testes de carga

Seed:

```bash
N_USERS=5000 npm run seed:load
```

Realtime:

```bash
npm run load:realtime -- https://seu-staging.vercel.app
```

k6:

```bash
k6 run -e BASE_URL=https://seu-staging.vercel.app load/spike.k6.js
```

Limpeza:

```bash
node --env-file=.env.local s
```
