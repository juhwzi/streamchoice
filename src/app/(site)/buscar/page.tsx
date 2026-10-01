import Link from "next/link";
import { searchPublicProfiles } from "@/lib/search";
import { VerifiedBadge } from "@/components/VerifiedBadge";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params?.q?.trim() ?? "";
  const results = query.length >= 2 ? await searchPublicProfiles(query, 24) : { query, users: [], channels: [] };
  const total = results.channels.length + results.users.length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <section className="rounded-[2rem] border border-line bg-panel p-6 shadow-2xl shadow-black/10 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-kick">Explorar</p>
        <h1 className="mt-2 font-display text-5xl font-extrabold">Buscar canais e usuários</h1>
        <p className="mt-3 max-w-2xl text-mute">Encontre streamers para acompanhar ou qualquer perfil da comunidade.</p>

        <form action="/buscar" className="mt-6 flex max-w-2xl gap-2">
          <input
            name="q"
            defaultValue={query}
            minLength={2}
            placeholder="Digite um nome, @username ou canal"
            className="min-w-0 flex-1 rounded-xl border border-line bg-ink px-4 py-3 outline-none transition focus:border-kick/60"
          />
          <button className="rounded-xl bg-kick px-5 py-3 font-bold text-ink transition hover:brightness-110">Buscar</button>
        </form>
      </section>

      <div className="mt-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-mute">{query ? `Resultados para “${query}”` : "Comece uma busca"}</p>
          {query.length >= 2 && <p className="mt-1 text-xs text-mute">{total} resultado{total === 1 ? "" : "s"}</p>}
        </div>
      </div>

      {query.length < 2 ? (
        <Empty title="O que você está procurando?" text="Use pelo menos 2 caracteres para pesquisar um canal ou usuário." />
      ) : total === 0 ? (
        <Empty title="Nenhum resultado encontrado" text="Tente outro nome, @username ou slug do canal." />
      ) : (
        <div className="mt-5 grid gap-8 lg:grid-cols-2">
          <section>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-kick">Streamers</p>
                <h2 className="mt-1 font-display text-3xl font-extrabold">Canais</h2>
              </div>
              <span className="text-sm text-mute">{results.channels.length}</span>
            </div>
            <div className="space-y-2">
              {results.channels.length ? results.channels.map((channel) => (
                <Link key={channel.id} href={`/streamer/${channel.kick_channel_slug}`} className="flex items-center gap-4 rounded-2xl border border-line bg-panel p-4 transition hover:border-kick/50 hover:bg-raise">
                  <Avatar src={channel.owner.avatar_url} fallback={channel.owner.username} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{channel.owner.display_name || channel.owner.username}</p>
                      <VerifiedBadge />
                    </div>
                    <p className="mt-1 truncate text-sm text-mute">@{channel.kick_channel_slug}</p>
                  </div>
                  <span className="text-sm font-semibold text-kick">Ver canal →</span>
                </Link>
              )) : <Empty title="Nenhum canal" text="Não encontramos streamers com esse termo." compact />}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-kick">Comunidade</p>
                <h2 className="mt-1 font-display text-3xl font-extrabold">Usuários</h2>
              </div>
              <span className="text-sm text-mute">{results.users.length}</span>
            </div>
            <div className="space-y-2">
              {results.users.length ? results.users.map((user) => (
                <Link key={user.id} href={`/u/${user.username}`} className="flex items-center gap-4 rounded-2xl border border-line bg-panel p-4 transition hover:border-kick/50 hover:bg-raise">
                  <Avatar src={user.avatar_url} fallback={user.username} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{user.display_name || user.username}</p>
                      {user.kick_verified && <VerifiedBadge />}
                    </div>
                    <p className="mt-1 truncate text-sm text-mute">@{user.username}{user.kick_verified ? " · Streamer" : " · Usuário"}</p>
                  </div>
                  <span className="text-sm font-semibold text-kick">Ver perfil →</span>
                </Link>
              )) : <Empty title="Nenhum usuário" text="Não encontramos usuários com esse termo." compact />}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function Avatar({ src, fallback }: { src: string | null; fallback: string }) {
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-raise font-bold">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        fallback.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

function Empty({ title, text, compact = false }: { title: string; text: string; compact?: boolean }) {
  return (
    <section className={`rounded-2xl border border-dashed border-line bg-panel text-center ${compact ? "p-7" : "mt-6 p-10"}`}>
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-raise text-xl">⌕</div>
      <h2 className="mt-3 font-display text-2xl font-extrabold">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-mute">{text}</p>
    </section>
  );
}
