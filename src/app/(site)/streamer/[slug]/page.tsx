import Link from "next/link";
import { notFound } from "next/navigation";
import { FollowButton } from "@/components/FollowButton";
import { ProfileHero } from "@/components/ProfileHero";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { getSession } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";
import type { LibraryItem, StreamActivity } from "@/lib/types";

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

  const [{ data: owner }, { count: followers }, { data: activities }, { data: library }, session] = await Promise.all([
    db.from("users").select("id, username, display_name, avatar_url, bio, kick_verified").eq("id", channel.owner_id).maybeSingle(),
    db.from("channel_follows").select("id", { count: "exact", head: true }).eq("channel_id", channel.id),
    db.from("stream_activities").select("id, channel_id, poll_id, library_id, activity_type, title, body, category_type, media_type, poster_url, status, created_at").eq("channel_id", channel.id).order("created_at", { ascending: false }).limit(50),
    db.from("streamer_media_library").select("id, channel_id, source_poll_id, external_media_id, media_type, title, poster_url, release_year, status, started_at, completed_at, created_at, updated_at").eq("channel_id", channel.id).eq("status", "completed").order("completed_at", { ascending: false }).limit(60),
    getSession(),
  ]);

  const completed = (library ?? []) as LibraryItem[];
  const games = completed.filter((item) => item.media_type === "game");
  const movies = completed.filter((item) => item.media_type !== "game");
  const ownerUser = owner as { id: string; username: string; display_name: string | null; avatar_url: string | null; bio: string | null; kick_verified: boolean } | null;
  if (!ownerUser?.kick_verified) notFound();

  let following = false;
  if (session && session.uid !== channel.owner_id) {
    const { data: follow } = await db.from("channel_follows").select("id").eq("channel_id", channel.id).eq("user_id", session.uid).maybeSingle();
    following = !!follow;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <ProfileHero
        displayName={ownerUser?.display_name || ownerUser?.username || slug}
        username={ownerUser?.username || slug}
        avatarUrl={ownerUser?.avatar_url ?? null}
        bio={ownerUser?.bio ?? null}
        verified={!!ownerUser?.kick_verified}
        eyebrow="Streamer"
        badgeLabel="Streamer verificado na Kick"
        actions={(!session || session.uid === channel.owner_id) ? null : <FollowButton slug={slug} initialFollowing={following} initialFollowers={followers ?? 0} loggedIn />}
        stats={
          <div className="grid gap-3 sm:grid-cols-3">
            <ProfileStat icon="◎" label="Seguidores" value={String(followers ?? 0)} />
            <ProfileStat icon="◈" label="Jogos concluídos" value={String(games.length)} />
            <ProfileStat icon="◆" label="Filmes concluídos" value={String(movies.length)} />
          </div>
        }
      />

      <nav className="mt-7 flex gap-2 overflow-x-auto border-b border-line pb-2">
        <TabLink active={tab === "feed"} href={`/streamer/${slug}`}>Feed</TabLink>
        <TabLink active={tab === "games"} href={`/streamer/${slug}?tab=games`}>Jogos finalizados <span>{games.length}</span></TabLink>
        <TabLink active={tab === "movies"} href={`/streamer/${slug}?tab=movies`}>Filmes finalizados <span>{movies.length}</span></TabLink>
      </nav>

      {tab === "feed" ? (
        <ActivityFeed activities={(activities ?? []) as StreamActivity[]} slug={slug} />
      ) : (
        <LibraryGrid
          title={tab === "games" ? "Jogos finalizados" : "Filmes finalizados"}
          items={tab === "games" ? games : movies}
          emptyMessage={tab === "games" ? "Este streamer ainda não marcou nenhum jogo como concluído." : "Este streamer ainda não marcou nenhum filme ou série como concluído."}
        />
      )}
    </main>
  );
}

function ActivityFeed({ activities, slug }: { activities: StreamActivity[]; slug: string }) {
  if (!activities.length) {
    return <section className="mt-7"><EmptyState title="Ainda não há atualizações" text="As novas votações e mudanças da biblioteca aparecerão aqui." /></section>;
  }

  return (
    <section className="mt-7">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-kick">Atividade</p>
          <h2 className="font-display text-4xl font-extrabold">Atualizações recentes</h2>
        </div>
        <span className="text-sm text-mute">{activities.length} atualizações</span>
      </div>
      <div className="relative space-y-3 before:absolute before:bottom-0 before:left-5 before:top-0 before:w-px before:bg-line">
        {activities.map((activity) => <ActivityCard key={activity.id} activity={activity} slug={slug} />)}
      </div>
    </section>
  );
}

function ActivityCard({ activity, slug }: { activity: StreamActivity; slug: string }) {
  const label = activity.activity_type === "library_status" ? "BIBLIOTECA" : "VOTAÇÃO";
  const icon = activity.activity_type === "library_status" ? (activity.media_type === "game" ? "🎮" : "🎬") : "◉";

  return (
    <article className="relative pl-12">
      <div className="absolute left-2 top-5 grid h-7 w-7 place-items-center rounded-full border border-line bg-panel text-sm text-kick shadow-lg">
        {icon}
      </div>
      <div className="rounded-2xl border border-line bg-panel p-4 transition hover:border-kick/30 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-kick">{label}</p>
            <h3 className="mt-1 font-display text-2xl font-extrabold">{activity.title}</h3>
          </div>
          <time className="shrink-0 text-xs text-mute">{new Date(activity.created_at).toLocaleDateString("pt-BR")}</time>
        </div>
        <p className="mt-2 text-sm text-mute">{activity.body}</p>
        {activity.poll_id && (activity.activity_type === "poll_created" || activity.activity_type === "poll_status") && (
          <Link
            href={`/c/${slug}?poll=${activity.poll_id}`}
            className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-kick px-4 py-2.5 text-sm font-bold text-ink transition hover:brightness-95"
          >
            Abrir votação →
          </Link>
        )}
      </div>
    </article>
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

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="rounded-2xl border border-dashed border-line bg-panel p-10 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-raise text-2xl">◷</div><h3 className="mt-4 font-display text-2xl font-extrabold">{title}</h3><p className="mx-auto mt-2 max-w-lg text-mute">{text}</p></div>;
}
