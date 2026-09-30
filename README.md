# StreamChoice

Plataforma para transformar a escolha do próximo filme ou jogo da live em uma experiência social: a comunidade sugere, a moderação cura, o chat vota e o streamer organiza o histórico do que foi escolhido.

## Stack

- Next.js 15 + React 19 + TypeScript
- Supabase / PostgreSQL + Realtime
- Tailwind CSS
- Kick OAuth 2.1 + PKCE
- TMDB para filmes/séries
- IGDB para jogos
- Livepix/PixGG para votos pagos (opcional)

## Funcionalidades

### Social

- Perfil personalizado de usuário.
- `@username`, avatar, bio e estatísticas.
- Seguir streamers.
- Feed personalizado em `/feed`.
- Página pública do streamer em `/streamer/[slug]`.
- Selo de verificação da Kick sincronizado para streamers verificados.

### Feed e biblioteca

O feed possui abas para:

- Votações
- Jogos finalizados
- Filmes finalizados

Quando uma votação é encerrada com vencedor, o streamer pode adicionar esse conteúdo à biblioteca e definir:

```text
up_next     → A seguir
in_progress → Em andamento
completed   → Concluído
```

A área pública mostra apenas itens marcados como `completed`.

### Painel do streamer

- Votações recentes e métricas.
- Maiores contribuidores.
- Controle para esconder valores monetários na tela.
- Configuração de Pix.
- Overlay do OBS.
- Moderadores.
- Biblioteca dos vencedores.
- Exclusão permanente da sala.

### Privacidade financeira

Os valores arrecadados são exibidos somente no painel do streamer. As páginas públicas mostram contagens, votos e resultados, mas não exibem o total arrecadado.

## Estrutura

```text
src/
├── app/
│   ├── (site)/
│   │   ├── page.tsx
│   │   ├── feed/
│   │   ├── dashboard/
│   │   ├── streamer/[slug]/
│   │   ├── u/[username]/
│   │   └── u/me/
│   └── api/
│       ├── auth/kick/
│       ├── channels/
│       ├── library/
│       ├── polls/
│       ├── suggestions/
│       ├── votes/
│       └── webhooks/livepix/
├── components/
├── lib/
└── ...
supabase/
└── migrations/
    ├── 0001_schema.sql
    ├── 0002_rls.sql
    ├── 0003_social_profiles.sql
    └── 0004_library_verification.sql
```

## Configuração local

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Supabase

Execute no SQL Editor, nesta ordem:

```text
supabase/migrations/0001_schema.sql
supabase/migrations/0002_rls.sql
supabase/migrations/0003_social_profiles.sql
supabase/migrations/0004_library_verification.sql
```

A migration `0004_library_verification.sql` adiciona:

- `users.kick_verified`;
- tabela `streamer_media_library`;
- status da biblioteca;
- RPC `upsert_streamer_library`;
- leitura pública apenas dos itens concluídos.

## Kick

O login usa OAuth 2.1 + PKCE. O callback de produção deve ser:

```text
https://SEU-DOMINIO/api/auth/kick/callback
```

O projeto consulta o canal do usuário após o login e persiste o `is_verified` retornado pela API da Kick para exibir o selo no StreamChoice.

> Usuários que já possuem uma sessão antiga precisam fazer login novamente para atualizar o status de verificação.

## Environment Variables

```env
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SESSION_SECRET=
KICK_CLIENT_ID=
KICK_CLIENT_SECRET=
TMDB_READ_TOKEN=
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
WEBHOOK_SIGNATURE_HEADER=
```

Nunca publique `.env.local` nem chaves privadas no GitHub.

## Deploy na Vercel

Configuração recomendada:

```text
Framework Preset: Next.js
Root Directory: ./
Build Command: npm run build
Output Directory: vazio
Install Command: npm install
Node.js: 22.x
```

Depois de configurar as Environment Variables, faça o deploy normalmente.

## Testes locais

```bash
npm run typecheck
npm run build
npm test
```

A instalação de dependências e o build precisam ser validados no ambiente de deploy real antes de considerar a versão pronta para produção.

## 🔐 Regras de conta e acesso

- Todo login é originado pela Kick, mas **somente contas com `kick_verified = true` recebem funcionalidades de streamer**.
- Usuários sem verificação funcionam como viewers: podem seguir streamers, acompanhar o feed e votar.
- Administradores são configurados com `ADMIN_KICK_USER_IDS` (preferencial) ou `ADMIN_KICK_USERNAMES`.
- O painel `/admin` é privado e serve para validação de saúde, feed, perfis e fluxos de desenvolvimento.

## 📰 Feed

- Viewer: recebe atualizações dos streamers seguidos.
- Streamer verificado/admin: possui as abas `Seguindo` e `Minhas atualizações`.
- Jogos e filmes/séries concluídos também podem ser filtrados no feed.

## 🎛️ Overlay OBS

O overlay foi desenhado para ser compacto e discreto, mostrando apenas o título da rodada, countdown, top 3 e vencedor quando aplicável.

## 🗃️ Migrations

Para um banco que já possui as três primeiras versões, execute somente:

```sql
supabase/migrations/0004_platform_roles_feed.sql
```

A migration `0004` adiciona `is_admin`, cria o feed de atividades e os gatilhos que publicam novas votações, mudanças de status e atualizações da biblioteca.
