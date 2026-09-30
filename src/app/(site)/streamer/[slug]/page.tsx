import Link from "next/link";
import { notFound } from "next/navigation";
import { FollowButton } from "@/components/FollowButton";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { getSession } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";
import type { LibraryItem, SnapshotData } from "@/lib/types";

export const dynamic = "force-dynamic";

type Tab = "feed" | "games" | "movies";

function normalizeTab(value: string | undefined): Tab {
  return value === "games" || value === "movies" ? value : "feed";
}

export default async function StreamerFeed({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const tab = normalizeTab(query?.tab);
  const db = admin();

  const { data: channel } = await db
    .from("channels")
    .select("id, owner_id, kick_channel_slug, is_active")
    .eq("kick_channel_slug", slug)
    .maybeSingle();

  if (!channel || !channel.is_active) notFound();

  const [{ data: owner }, { count: followers }, { data: snapshots }, { data: library }, session] = await Promise.all([
    db.from("users").select("id, username, display_name, avatar_url, bio, kick_verified").eq("id", channel.owner_id).maybeSingle(),
    db.from("channel_follows").select("id", { count: "exact", head: true }).eq("channel_id", channel.id),
    db.from("poll_snapshots").select("poll_id, channel_id, poll_created_at, data, updated_at").eq("channel_id", channel.id).order("poll_created_at", { ascending: false }).limit(30),
    db.from("streamer_media_library").select("id, channel_id, source_poll_id, external_media_id, media_type, title, poster_url, release_year, status, started_at, completed_at, created_at, updated_at").eq("channel_id", channel.id).eq("status", "completed").order("completed_at", { ascending: false }).limit(60),
    getSession(),
  ]);

  let following = false;
  const isOwner = session?.uid === channel.owner_id;
  if (session && !isOwner) {
    const { data } = await db.from("channel_follows").select("id").eq("channel_id", channel.id).eq("user_id", session.uid).maybeSingle();
    following = !!data;
  }

  const completed = (library ?? []) as LibraryItem[];
  const games = completed.filter((item) => item.media_type === "game");
  const movies = completed.filter((item) => item.media_type !== "game");

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <section className="overflow-hidden rounded-[1.75rem] border border-line bg-panel shadow-2xl shadow-black/20">
        <div className="relative h-40 bg-[radial-gradient(circle_at_15%_10%,rgba(83,252,24,.22),transparent_42%),radial-gradient(circle_at_90%_0%,rgba(34,211,238,.10),transparent_34%),linear-gradient(135deg,#121719,#0B0E0F)]">
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-kick/50 to-transparent" />
        </div>

        <div className="px-5 pb-7 sm:px-8">
          <div className="-mt-12 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-end gap-4">
              {owner?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={owner.avatar_url} alt="" className="h-24 w-24 rounded-2xl border-4 border-panel object-cover shadow-xl" />
              ) : (
                <div className="grid h-24 w-24 place-items-center rounded-2xl border-4 border-panel bg-raise text-3xl font-bold">{owner?.username?.slice(0, 1).toUpperCase()}</div>
              )}
              <div className="pb-1">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-kick">Streamer</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-4xl font-extrabold">{owner?.display_name || owner?.username}</h1>
                  {owner?.kick_verified && <VerifiedBadge />}
                </div>
                <p className="mt-1 text-sm font-semibold text-kick">@{owner?.username}</p>
                <p className="text-sm text-mute">{followers ?? 0} seguidores · {games.length} jogos concluídos · {movies.length} filmes concluídos</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {owner?.bio && <span className="hidden max-w-md rounded-xl border border-line bg-ink px-4 py-2.5 text-sm text-mute lg:inline-block">{owner.bio}</span>}
              {!isOwner && <FollowButton slug={slug} initialFollowing={following} initialFollowers={followers ?? 0} loggedIn={!!session} />}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <ProfileStat icon="◉" label="Seguidores" value={String(followers ?? 0)} />
            <ProfileStat icon="◷" label="Jogos finalizados" value={String(games.length)} />
            <ProfileStat icon="▣" label="Filmes finalizados" value={String(movies.length)} />
          </div>
        </div>
      </section>

      <nav className="mt-7 flex gap-2 overflow-x-auto border-b border-line pb-2">
        <TabLink active={tab === "feed"} href={`/streamer/${slug}`}>Feed</TabLink>
        <TabLink active={tab === "games"} href={`/streamer/${slug}?tab=games`}>Jogos finalizados <span>{games.length}</span></TabLink>
        <TabLink active={tab === "movies"} href={`/streamer/${slug}?tab=movies`}>Filmes finalizados <span>{movies.length}</span></TabLink>
      </nav>

      {tab === "feed" ? (
        <PollFeed snapshots={(snapshots ?? []) as Array<{ poll_id: string; data: unknown }>} slug={slug} />
      ) : (
        <LibraryGrid title={tab === "games" ? "Jogos finalizados" : "Filmes finalizados"} items={tab === "games" ? games : movies} emptyMessage={tab === "games" ? "Este streamer ainda não marcou nenhum jogo como concluído." : "Este streamer ainda não marcou nenhum filme ou série como concluído."} />
      )}
    </main>
  );
}

function PollFeed({ snapshots, slug }: { snapshots: Array<{ poll_id: string; data: unknown }>; slug: string }) {
  return (
    <section className="mt-7 space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-kick">Feed</p>
          <h2 className="font-display text-4xl font-extrabold">Votações de /{slug}</h2>
          <p className="mt-1 text-sm text-mute">Todas as rodadas recentes deste streamer. Valores arrecadados não são exibidos publicamente.</p>
        </div>
        <span className="text-sm text-mute">{snapshots.length} registros</span>
      </div>

      {!snapshots.length ? (
        <EmptyState title="Ainda não há votações" text="Este streamer ainda não publicou nenhuma rodada no StreamChoice." />
      ) : (
        snapshots.map((snapshot) => {
          const data = snapshot.data as SnapshotData;
          const live = ["collecting", "voting", "paused"].includes(data.poll.status);
          const top = data.ranking?.[0];
          return (
            <article key={snapshot.poll_id} className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-mute">{data.poll.category_type === "game" ? "JOGOS" : data.poll.category_type === "movie" ? "FILMES" : "MISTO"}</p>
                  <h3 className="mt-1 font-display text-2xl font-extrabold">{data.poll.title}</h3>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${live ? "bg-kick text-ink" : "bg-raise text-mute"}`}>{live ? "EM ANDAMENTO" : "ENCERRADA"}</span>
              </div>

              {top ? (
                <div className="mt-5 flex items-center gap-4 rounded-2xl bg-ink p-4">
                  {top.poster_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={top.poster_url} alt="" className="h-20 w-14 rounded-lg object-cover" />
                  ) : <div className="grid h-20 w-14 place-items-center rounded-lg bg-raise">▣</div>}
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-widest text-mute">{live ? "Líder atual" : "Resultado"}</p>
                    <p className="truncate font-display text-2xl font-extrabold">{top.title}</p>
                    <p className="text-sm text-kick">{Number(top.total_score ?? 0)} pontos</p>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <PublicStat label="Opções" value={String(data.ranking?.length ?? 0)} />
                <PublicStat label="Votos grátis" value={String(data.free_votes_total ?? 0)} />
                <PublicStat label="Contribuições" value={String(data.paid_count ?? 0)} />
              </div>

              <Link href={`/c/${slug}`} className="mt-4 inline-flex rounded-lg border border-line px-4 py-2.5 text-sm font-semibold transition hover:border-kick hover:text-kick">Abrir sala</Link>
            </article>
          );
        })
      )}
    </section>
  );
}

function LibraryGrid({ title, items, emptyMessage }: { title: string; items: LibraryItem[]; emptyMessage: string }) {
  return (
    <section className="mt-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-kick">Biblioteca</p>
          <h2 className="font-display text-4xl font-extrabold">{title}</h2>
          <p className="mt-1 text-sm text-mute">Conteúdos que o streamer marcou como concluídos.</p>
        </div>
        <span className="text-sm text-mute">{items.length} itens</span>
      </div>

      {!items.length ? (
        <div className="mt-5"><EmptyState title={title} text={emptyMessage} /></div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((item) => <LibraryCard key={item.id} item={item} />)}
        </div>
      )}
    </section>
  );
}

function LibraryCard({ item }: { item: LibraryItem }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-line bg-panel transition hover:-translate-y-0.5 hover:border-kick/40">
      <div className="aspect-[2/3] overflow-hidden bg-ink">
        {item.poster_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.poster_url} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        ) : <div className="grid h-full place-items-center text-4xl">{item.media_type === "game" ? "🎮" : "🎬"}</div>}
      </div>
      <div className="p-3">
        <p className="truncate font-semibold">{item.title}</p>
        <p className="mt-1 text-xs text-mute">{item.release_year || ""}{item.completed_at ? ` · ${new Date(item.completed_at).toLocaleDateString("pt-BR")}` : ""}</p>
      </div>
    </article>
  );
}

function TabLink({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return <Link href={href} className={`whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold transition ${active ? "bg-kick text-ink" : "border border-line text-mute hover:border-kick hover:text-white"}`}>{children}</Link>;
}

function ProfileStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <div className="rounded-2xl border border-line bg-ink p-4"><div className="flex items-center justify-between gap-3"><span className="text-xl text-kick">{icon}</span><span className="font-display text-2xl font-extrabold">{value}</span></div><p className="mt-2 text-xs text-mute">{label}</p></div>;
}

function PublicStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-line bg-ink p-3"><p className="font-display text-2xl font-extrabold">{value}</p><p className="mt-1 text-xs text-mute">{label}</p></div>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="rounded-2xl border border-dashed border-line bg-panel p-10 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-raise text-2xl">◷</div><h3 className="mt-4 font-display text-2xl font-extrabold">{title}</h3><p className="mx-auto mt-2 max-w-lg text-mute">{text}</p></div>;
}
