import Link from "next/link";
import { redirect } from "next/navigation";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { getSession } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";
import type { LibraryItem, StreamActivity } from "@/lib/types";

export const dynamic = "force-dynamic";

type FeedTab = "following" | "mine";
type Filter = "all" | "games" | "movies";

function normalizeTab(value: string | undefined, canOwn: boolean): FeedTab {
  return canOwn && value === "mine" ? "mine" : "following";
}

function normalizeFilter(value: string | undefined): Filter {
  return value === "games" || value === "movies" ? value : "all";
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; filter?: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/entrar?next=/feed");
    return null;
  }

  const params = await searchParams;
  const db = admin();
  const { data: account } = await db.from("users").select("kick_verified, is_admin").eq("id", session.uid).maybeSingle();
  const canOwn = account?.kick_verified === true || account?.is_admin === true;
  const tab = normalizeTab(params?.tab, canOwn);
  const filter = normalizeFilter(params?.filter);

  const { data: follows } = await db
    .from("channel_follows")
    .select("channel_id, created_at, channels!inner(id, kick_channel_slug, owner_id, is_active)")
    .eq("user_id", session.uid)
    .eq("channels.is_active", true)
    .order("created_at", { ascending: false });

  const followedChannels = ((follows ?? []) as Array<{ channel_id: string; channels: unknown }>)
    .map((row) => (Array.isArray(row.channels) ? row.channels[0] : row.channels) as { id: string; kick_channel_slug: string; owner_id: string; is_active: boolean })
    .filter(Boolean);

  const channelIds = followedChannels.map((channel) => channel.id);
  const channelMap = new Map(followedChannels.map((channel) => [channel.id, channel]));

  const ownChannel = canOwn
    ? (await db.from("channels").select("id, kick_channel_slug, owner_id, is_active").eq("owner_id", session.uid).eq("is_active", true).maybeSingle()).data
    : null;

  const targetChannelIds = tab === "mine" ? (ownChannel ? [ownChannel.id] : []) : channelIds;
  const ownerIds = [...new Set(targetChannelIds.map((id) => channelMap.get(id)?.owner_id ?? (id === ownChannel?.id ? session.uid : "")).filter(Boolean))];

  const { data: owners } = ownerIds.length
    ? await db.from("users").select("id, username, display_name, avatar_url, kick_verified").in("id", ownerIds)
    : { data: [] as Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null; kick_verified: boolean }> };

  const ownerRows = (owners ?? []) as Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null; kick_verified: boolean }>;
  const ownerMap = new Map(ownerRows.map((owner) => [owner.id, owner]));

  // Apenas canais de usuários verificados participam do feed como streamers.
  const verifiedOwnerIds = new Set(ownerRows.filter((owner) => owner.kick_verified).map((owner) => owner.id));
  const verifiedChannelIds = targetChannelIds.filter((id) => {
    const channel = channelMap.get(id) ?? (id === ownChannel?.id ? ownChannel : null);
    return !!channel && verifiedOwnerIds.has(channel.owner_id);
  });

  const [{ data: activities }, { data: library }] = await Promise.all([
    verifiedChannelIds.length
      ? db.from("stream_activities")
        .select("id, channel_id, poll_id, library_id, activity_type, title, body, category_type, media_type, poster_url, status, created_at")
        .in("channel_id", verifiedChannelIds)
        .order("created_at", { ascending: false })
        .limit(80)
      : Promise.resolve({ data: [] as StreamActivity[] }),
    filter !== "all" && verifiedChannelIds.length
      ? db.from("streamer_media_library")
        .select("id, channel_id, source_poll_id, external_media_id, media_type, title, poster_url, release_year, status, started_at, completed_at, created_at, updated_at")
        .in("channel_id", verifiedChannelIds)
        .eq("status", "completed")
        .in("media_type", filter === "games" ? ["game"] : ["movie", "tv"])
        .order("completed_at", { ascending: false })
        .limit(80)
      : Promise.resolve({ data: [] as LibraryItem[] }),
  ]);

  const filteredActivities = ((activities ?? []) as StreamActivity[]).filter((activity) => {
    if (filter === "all") return true;
    if (activity.activity_type !== "library_status") return false;
    return activity.status === "completed" && (filter === "games" ? activity.media_type === "game" : activity.media_type !== "game");
  });

  const feedTitle = tab === "mine" ? "Minhas atualizações" : canOwn ? "Atualizações que sigo" : "Meu feed";
  const feedDescription = tab === "mine"
    ? "Veja tudo o que foi publicado pelo seu canal no StreamChoice."
    : "As votações e novidades dos streamers que você segue, em um só lugar.";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="overflow-hidden rounded-[2rem] border border-line bg-panel shadow-2xl shadow-black/10">
        <div className="relative p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-kick/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-kick">Seu espaço</p>
              <h1 className="mt-2 font-display text-5xl font-extrabold leading-none">{feedTitle}</h1>
              <p className="mt-3 max-w-2xl text-mute">{feedDescription}</p>
            </div>
            <div className="rounded-2xl border border-line bg-ink px-5 py-4 text-right">
              <p className="text-xs uppercase tracking-wider text-mute">Seguindo</p>
              <p className="font-display text-3xl font-extrabold text-kick">{followedChannels.length}</p>
              <p className="text-xs text-mute">streamers</p>
            </div>
          </div>
        </div>
      </header>

      <nav className="mt-7 flex flex-wrap gap-2 border-b border-line pb-2">
        {canOwn && <FeedTab active={tab === "following"} href={`/feed?tab=following&filter=${filter}`}>Seguindo</FeedTab>}
        {canOwn && <FeedTab active={tab === "mine"} href={`/feed?tab=mine&filter=${filter}`}>Minhas atualizações</FeedTab>}
        {!canOwn && <FeedTab active href={`/feed?filter=${filter}`}>Meu feed</FeedTab>}
      </nav>

      <div className="mt-4 flex flex-wrap gap-2">
        <FilterTab active={filter === "all"} href={`/feed?tab=${tab}&filter=all`}>Tudo</FilterTab>
        <FilterTab active={filter === "games"} href={`/feed?tab=${tab}&filter=games`}>Jogos concluídos</FilterTab>
        <FilterTab active={filter === "movies"} href={`/feed?tab=${tab}&filter=movies`}>Filmes concluídos</FilterTab>
      </div>

      {tab === "following" && !followedChannels.length ? (
        <section className="mt-6 rounded-2xl border border-dashed border-line bg-ink p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-raise text-2xl">♡</div>
          <h2 className="mt-4 font-display text-3xl font-extrabold">Você ainda não segue ninguém</h2>
          <p className="mx-auto mt-2 max-w-lg text-mute">Abra o perfil de um streamer, siga o canal e as novas votações aparecerão automaticamente aqui.</p>
          <Link href="/" className="mt-5 inline-flex rounded-lg bg-kick px-5 py-3 font-bold text-ink">Explorar o StreamChoice</Link>
        </section>
      ) : filter !== "all" ? (
        <LibraryFeed items={(library ?? []) as LibraryItem[]} channelMap={channelMapWithOwn(channelMap, ownChannel)} ownerMap={ownerMap} emptyMessage={filter === "games" ? "Nenhum jogo concluído ainda neste feed." : "Nenhum filme ou série concluído ainda neste feed."} />
      ) : (
        <ActivityTimeline activities={filteredActivities} channelMap={channelMapWithOwn(channelMap, ownChannel)} ownerMap={ownerMap} emptyMessage={tab === "mine" ? "Seu canal ainda não publicou atualizações." : "Os streamers que você segue ainda não publicaram atualizações."} />
      )}
    </main>
  );
}

function channelMapWithOwn(base: Map<string, { id: string; kick_channel_slug: string; owner_id: string }>, ownChannel: { id: string; kick_channel_slug: string; owner_id: string } | null) {
  const map = new Map(base);
  if (ownChannel) map.set(ownChannel.id, ownChannel);
  return map;
}

function ActivityTimeline({
  activities,
  channelMap,
  ownerMap,
  emptyMessage,
}: {
  activities: StreamActivity[];
  channelMap: Map<string, { id: string; kick_channel_slug: string; owner_id: string }>;
  ownerMap: Map<string, { id: string; username: string; display_name: string | null; avatar_url: string | null; kick_verified: boolean }>;
  emptyMessage: string;
}) {
  if (!activities.length) return <section className="mt-6"><EmptyState title="Nada novo por aqui" text={emptyMessage} /></section>;

  return (
    <section className="mt-6 space-y-3">
      {activities.map((activity) => {
        const channel = channelMap.get(activity.channel_id);
        const owner = channel ? ownerMap.get(channel.owner_id) : undefined;
        if (!channel || !owner) return null;
        return <ActivityCard key={activity.id} activity={activity} owner={owner} channel={channel} />;
      })}
    </section>
  );
}

function ActivityCard({
  activity,
  owner,
  channel,
}: {
  activity: StreamActivity;
  owner: { username: string; display_name: string | null; avatar_url: string | null; kick_verified: boolean };
  channel: { kick_channel_slug: string };
}) {
  const icon = activity.activity_type === "library_status" ? (activity.media_type === "game" ? "🎮" : "🎬") : "◉";
  const accent = activity.activity_type === "library_status" ? "Biblioteca" : "Votação";

  return (
    <article className="rounded-2xl border border-line bg-panel p-5 transition hover:border-kick/30 sm:p-6">
      <div className="flex items-start gap-4">
        {owner.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={owner.avatar_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
        ) : <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-raise font-bold">{owner.username.slice(0, 1).toUpperCase()}</div>}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link href={`/streamer/${channel.kick_channel_slug}`} className="font-semibold hover:text-kick">{owner.display_name || owner.username}</Link>
            {owner.kick_verified && <VerifiedBadge />}
            <span className="text-mute">·</span>
            <span className="text-mute">{accent}</span>
            <time className="ml-auto text-xs text-mute">{new Date(activity.created_at).toLocaleDateString("pt-BR")}</time>
          </div>

          <h2 className="mt-2 font-display text-2xl font-extrabold">{activity.title}</h2>
          <p className="mt-1 text-sm text-mute">{activity.body}</p>

          {activity.poll_id && (activity.activity_type === "poll_created" || activity.activity_type === "poll_status") && (
            <Link
              href={`/c/${channel.kick_channel_slug}?poll=${activity.poll_id}`}
              className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-kick px-4 py-2.5 text-sm font-bold text-ink transition hover:brightness-95"
            >
              Abrir votação →
            </Link>
          )}

          {activity.poster_url && (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-ink p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={activity.poster_url} alt="" className="h-14 w-10 rounded object-cover" />
              <div>
                <p className="text-xs uppercase tracking-wider text-mute">Conteúdo</p>
                <p className="font-semibold">{activity.title}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function LibraryFeed({
  items,
  channelMap,
  ownerMap,
  emptyMessage,
}: {
  items: LibraryItem[];
  channelMap: Map<string, { id: string; kick_channel_slug: string; owner_id: string }>;
  ownerMap: Map<string, { id: string; username: string; display_name: string | null; avatar_url: string | null; kick_verified: boolean }>;
  emptyMessage: string;
}) {
  if (!items.length) return <section className="mt-6"><EmptyState title="Ainda sem conteúdos concluídos" text={emptyMessage} /></section>;

  return (
    <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
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
    </section>
  );
}

function FeedTab({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return <Link href={href} className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${active ? "bg-kick text-ink" : "border border-line text-mute hover:border-kick hover:text-white"}`}>{children}</Link>;
}

function FilterTab({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return <Link href={href} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? "bg-raise text-white" : "text-mute hover:text-white"}`}>{children}</Link>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="rounded-2xl border border-dashed border-line bg-panel p-10 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-raise text-2xl">◷</div><h2 className="mt-4 font-display text-3xl font-extrabold">{title}</h2><p className="mx-auto mt-2 max-w-lg text-mute">{text}</p></div>;
}
