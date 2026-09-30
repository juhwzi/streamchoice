import Link from "next/link";
import { redirect } from "next/navigation";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { getSession } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";
import type { LibraryItem, SnapshotData } from "@/lib/types";

export const dynamic = "force-dynamic";

type Tab = "polls" | "games" | "movies";

function normalizeTab(value: string | undefined): Tab {
  return value === "games" || value === "movies" ? value : "polls";
}

export default async function FeedPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/entrar?next=/feed");

  const params = await searchParams;
  const tab = normalizeTab(params?.tab);
  const db = admin();

  const { data: follows } = await db
    .from("channel_follows")
    .select("channel_id, created_at, channels!inner(id, kick_channel_slug, owner_id, is_active)")
    .eq("user_id", session.uid)
    .eq("channels.is_active", true)
    .order("created_at", { ascending: false });

  const followRows = (follows ?? []) as Array<{ channel_id: string; created_at: string; channels: unknown }>;
  const followedChannels = followRows.map((row) => {
    const channel = Array.isArray(row.channels) ? row.channels[0] : row.channels;
    return channel as { id: string; kick_channel_slug: string; owner_id: string; is_active: boolean };
  }).filter(Boolean);

  const channelIds = followedChannels.map((channel) => channel.id);
  const ownerIds = [...new Set(followedChannels.map((channel) => channel.owner_id))];
  const channelMap = new Map(followedChannels.map((channel) => [channel.id, channel]));

  const [{ data: owners }, { data: snapshots }, { data: library }] = await Promise.all([
    ownerIds.length
      ? db.from("users").select("id, username, display_name, avatar_url, kick_verified").in("id", ownerIds)
      : Promise.resolve({ data: [] as Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null; kick_verified: boolean }> }),
    tab === "polls" && channelIds.length
      ? db.from("poll_snapshots").select("poll_id, channel_id, poll_created_at, data, updated_at").in("channel_id", channelIds).order("poll_created_at", { ascending: false }).limit(40)
      : Promise.resolve({ data: [] as Array<{ poll_id: string; channel_id: string; poll_created_at: string; data: SnapshotData; updated_at: string }> }),
    tab !== "polls" && channelIds.length
      ? db.from("streamer_media_library").select("id, channel_id, source_poll_id, external_media_id, media_type, title, poster_url, release_year, status, started_at, completed_at, created_at, updated_at").in("channel_id", channelIds).eq("status", "completed").order("completed_at", { ascending: false }).limit(80)
      : Promise.resolve({ data: [] as LibraryItem[] }),
  ]);

  const ownerRows = (owners ?? []) as Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null; kick_verified: boolean }>;
  const ownerMap = new Map(ownerRows.map((owner) => [owner.id, owner]));
  const completedItems = ((library ?? []) as LibraryItem[]).filter((item) => tab === "games" ? item.media_type === "game" : item.media_type !== "game");

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="rounded-[1.75rem] border border-line bg-panel p-6 shadow-2xl shadow-black/10 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-kick">Seu espaço</p>
            <h1 className="mt-2 font-display text-5xl font-extrabold leading-none">Meu feed.</h1>
            <p className="mt-3 max-w-2xl text-mute">Acompanhe as votações e descubra o que os streamers que você segue já concluíram.</p>
          </div>
          <div className="rounded-2xl border border-line bg-ink px-4 py-3 text-right">
            <p className="text-xs text-mute">Seguindo</p>
            <p className="font-display text-3xl font-extrabold text-kick">{followedChannels.length}</p>
            <p className="text-xs text-mute">streamers</p>
          </div>
        </div>
      </header>

      <nav className="mt-7 flex gap-2 overflow-x-auto border-b border-line pb-2">
        <FeedTab active={tab === "polls"} href="/feed">Votações</FeedTab>
        <FeedTab active={tab === "games"} href="/feed?tab=games">Jogos finalizados</FeedTab>
        <FeedTab active={tab === "movies"} href="/feed?tab=movies">Filmes finalizados</FeedTab>
      </nav>

      {!followedChannels.length ? (
        <section className="mt-6 rounded-2xl border border-dashed border-line bg-ink p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-raise text-2xl">♡</div>
          <h2 className="mt-4 font-display text-3xl font-extrabold">Seu feed ainda está vazio</h2>
          <p className="mx-auto mt-2 max-w-lg text-mute">Abra a página de um streamer, siga o canal e as próximas votações e títulos concluídos aparecem aqui.</p>
          <Link href="/" className="mt-5 inline-flex rounded-lg bg-kick px-5 py-3 font-bold text-ink">Conhecer o StreamChoice</Link>
        </section>
      ) : tab === "polls" ? (
        <PollFeed snapshots={snapshots ?? []} channelMap={channelMap} ownerMap={ownerMap} />
      ) : (
        <LibraryFeed items={completedItems} channelMap={channelMap} ownerMap={ownerMap} emptyMessage={tab === "games" ? "Nenhum dos streamers que você segue marcou jogos como concluídos ainda." : "Nenhum dos streamers que você segue marcou filmes ou séries como concluídos ainda."} />
      )}
    </main>
  );
}

function PollFeed({ snapshots, channelMap, ownerMap }: { snapshots: Array<{ poll_id: string; channel_id: string; data: unknown }>; channelMap: Map<string, { id: string; kick_channel_slug: string; owner_id: string }>; ownerMap: Map<string, { id: string; username: string; display_name: string | null; avatar_url: string | null; kick_verified: boolean }> }) {
  if (!snapshots.length) return <section className="mt-6"><EmptyState title="Nada novo por aqui" text="Os streamers que você segue ainda não têm votações registradas." /></section>;

  return (
    <section className="mt-6 space-y-4">
      {snapshots.map((snapshot) => {
        const channel = channelMap.get(snapshot.channel_id);
        const owner = channel ? ownerMap.get(channel.owner_id) : undefined;
        if (!channel || !owner) return null;
        const data = snapshot.data as SnapshotData;
        const live = ["collecting", "voting", "paused"].includes(data.poll.status);
        const top = data.ranking?.[0];

        return (
          <article key={snapshot.poll_id} className="rounded-2xl border border-line bg-panel p-5 transition hover:border-kick/30 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <Link href={`/streamer/${channel.kick_channel_slug}`} className="flex min-w-0 items-center gap-3">
                {owner.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={owner.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : <div className="grid h-12 w-12 place-items-center rounded-full bg-raise font-bold">{owner.username.slice(0, 1).toUpperCase()}</div>}
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><p className="truncate font-semibold">{owner.display_name || owner.username}</p>{owner.kick_verified && <VerifiedBadge />}</div>
                  <p className="text-sm text-kick">@{owner.username}</p>
                </div>
              </Link>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${live ? "bg-kick text-ink" : "bg-raise text-mute"}`}>{live ? "AO VIVO" : "ENCERRADA"}</span>
            </div>

            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-mute">{data.poll.category_type === "game" ? "JOGOS" : data.poll.category_type === "movie" ? "FILMES" : "MISTO"}</p>
              <h2 className="mt-1 font-display text-3xl font-extrabold">{data.poll.title}</h2>
              {top && <div className="mt-4 flex items-center gap-4 rounded-2xl bg-ink p-4">{top.poster_url ? <img src={top.poster_url} alt="" className="h-16 w-12 rounded-lg object-cover" /> : <div className="grid h-16 w-12 place-items-center rounded-lg bg-raise">▣</div>}<div><p className="text-xs uppercase tracking-widest text-mute">{live ? "Líder atual" : "Resultado"}</p><p className="font-semibold">{top.title}</p><p className="text-sm text-kick">{Number(top.total_score ?? 0)} pontos</p></div></div>}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <PublicStat label="Opções" value={String(data.ranking?.length ?? 0)} />
              <PublicStat label="Votos grátis" value={String(data.free_votes_total ?? 0)} />
              <PublicStat label="Contribuições" value={String(data.paid_count ?? 0)} />
            </div>

            <Link href={`/c/${channel.kick_channel_slug}`} className="mt-4 inline-flex rounded-lg border border-line px-4 py-2.5 text-sm font-semibold transition hover:border-kick hover:text-kick">Abrir votação</Link>
          </article>
        );
      })}
    </section>
  );
}

function LibraryFeed({ items, channelMap, ownerMap, emptyMessage }: { items: LibraryItem[]; channelMap: Map<string, { id: string; kick_channel_slug: string; owner_id: string }>; ownerMap: Map<string, { id: string; username: string; display_name: string | null; avatar_url: string | null; kick_verified: boolean }>; emptyMessage: string }) {
  if (!items.length) return <section className="mt-6"><EmptyState title="Ainda sem títulos concluídos" text={emptyMessage} /></section>;

  return (
    <section className="mt-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item) => {
          const channel = channelMap.get(item.channel_id);
          const owner = channel ? ownerMap.get(channel.owner_id) : undefined;
          return (
            <article key={item.id} className="group overflow-hidden rounded-2xl border border-line bg-panel transition hover:-translate-y-0.5 hover:border-kick/40">
              <div className="aspect-[2/3] overflow-hidden bg-ink">
                {item.poster_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.poster_url} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                ) : <div className="grid h-full place-items-center text-4xl">{item.media_type === "game" ? "🎮" : "🎬"}</div>}
              </div>
              <div className="p-3">
                <p className="truncate font-semibold">{item.title}</p>
                <Link href={channel ? `/streamer/${channel.kick_channel_slug}` : "#"} className="mt-1 block truncate text-xs text-kick">@{owner?.username || "streamer"}</Link>
                <p className="mt-1 text-xs text-mute">{item.completed_at ? new Date(item.completed_at).toLocaleDateString("pt-BR") : "Concluído"}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function FeedTab({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return <Link href={href} className={`whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold transition ${active ? "bg-kick text-ink" : "border border-line text-mute hover:border-kick hover:text-white"}`}>{children}</Link>;
}

function PublicStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-line bg-ink p-3"><p className="font-display text-2xl font-extrabold">{value}</p><p className="mt-1 text-xs text-mute">{label}</p></div>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="rounded-2xl border border-dashed border-line bg-panel p-10 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-raise text-2xl">◷</div><h2 className="mt-4 font-display text-3xl font-extrabold">{title}</h2><p className="mx-auto mt-2 max-w-lg text-mute">{text}</p></div>;
}
