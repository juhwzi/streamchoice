import Link from "next/link";
import { notFound } from "next/navigation";
import { ProfileEditor } from "@/components/ProfileEditor";
import { ProfileHero } from "@/components/ProfileHero";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { getSession } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ProfileUser = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  kick_verified: boolean;
  created_at: string;
};

type FollowedChannel = { kick_channel_slug: string; owner_id: string };
type OwnerCard = { id: string; username: string; display_name: string | null; avatar_url: string | null; kick_verified: boolean };

export default async function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const db = admin();
  const { data: user } = await db
    .from("users")
    .select("id, username, display_name, avatar_url, bio, kick_verified, created_at")
    .eq("username", username)
    .maybeSingle();

  const profileUser = user as ProfileUser | null;
  if (!profileUser) {
    notFound();
    return null;
  }

  const session = await getSession();
  const own = session?.uid === profileUser.id;

  const [{ count: followingCount }, { count: votesCount }, { count: suggestionsCount }, { data: channel }, { data: follows }] = await Promise.all([
    db.from("channel_follows").select("id", { count: "exact", head: true }).eq("user_id", profileUser.id),
    db.from("votes").select("id", { count: "exact", head: true }).eq("user_id", profileUser.id),
    db.from("suggestions").select("id", { count: "exact", head: true }).eq("suggested_by", profileUser.id),
    db.from("channels").select("id, kick_channel_slug, is_active").eq("owner_id", profileUser.id).eq("is_active", true).maybeSingle(),
    db.from("channel_follows").select("channels!inner(kick_channel_slug, owner_id)").eq("user_id", profileUser.id).eq("channels.is_active", true).limit(12),
  ]);

  const followed = ((follows ?? []) as Array<{ channels: FollowedChannel | FollowedChannel[] }>)
    .map((row) => Array.isArray(row.channels) ? row.channels[0] : row.channels)
    .filter(Boolean) as FollowedChannel[];

  const ownerIds = [...new Set(followed.map((item) => item.owner_id))];
  const { data: owners } = ownerIds.length
    ? await db.from("users").select("id, username, display_name, avatar_url, kick_verified").in("id", ownerIds)
    : { data: [] as OwnerCard[] };
  const ownerMap = new Map(((owners ?? []) as OwnerCard[]).map((owner) => [owner.id, owner]));

  const { count: streamerFollowers } = channel
    ? await db.from("channel_follows").select("id", { count: "exact", head: true }).eq("channel_id", channel.id as string)
    : { count: 0 };

  const canUseStreamer = profileUser.kick_verified;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <ProfileHero
        displayName={profileUser.display_name || profileUser.username}
        username={profileUser.username}
        avatarUrl={profileUser.avatar_url}
        bio={profileUser.bio}
        verified={canUseStreamer}
        eyebrow="Perfil"
        badgeLabel={canUseStreamer ? "Streamer verificado na Kick" : "Membro da comunidade"}
        actions={(
          <>
            {channel && canUseStreamer && <Link href={`/streamer/${channel.kick_channel_slug}`} className="rounded-lg bg-kick px-4 py-2.5 font-bold text-ink">Ver perfil de streamer</Link>}
            {own && <Link href="/feed" className="rounded-lg border border-line px-4 py-2.5 font-semibold hover:border-kick">Meu feed</Link>}
          </>
        )}
        stats={
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Seguindo" value={String(followingCount ?? 0)} />
            <Metric label="Votos" value={String(votesCount ?? 0)} />
            <Metric label="Sugestões" value={String(suggestionsCount ?? 0)} />
            {channel && canUseStreamer ? <Metric label="Seguidores" value={String(streamerFollowers ?? 0)} /> : <Metric label="Status" value="Ativo" />}
          </div>
        }
      />

      {own && <section className="mt-6"><ProfileEditor displayName={profileUser.display_name || profileUser.username} bio={profileUser.bio || ""} /></section>}

      {channel && canUseStreamer && (
        <section className="mt-6 rounded-2xl border border-line bg-panel p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-kick">Perfil de streamer</p>
              <h2 className="mt-1 font-display text-3xl font-extrabold">@{channel.kick_channel_slug}</h2>
              <p className="mt-1 text-sm text-mute">Feed, votações e biblioteca do canal.</p>
            </div>
            <Link href={`/streamer/${channel.kick_channel_slug}`} className="rounded-lg border border-line px-4 py-2.5 font-semibold hover:border-kick">Abrir página pública</Link>
          </div>
        </section>
      )}

      <section className="mt-6 rounded-2xl border border-line bg-panel p-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-kick">Social</p>
            <h2 className="font-display text-3xl font-extrabold">Streamers que segue</h2>
          </div>
          <span className="text-sm text-mute">{followed.length} exibidos</span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {followed.map((followedChannel) => {
            const owner = ownerMap.get(followedChannel.owner_id);
            if (!owner?.kick_verified) return null;
            return (
              <Link key={followedChannel.kick_channel_slug} href={`/streamer/${followedChannel.kick_channel_slug}`} className="group flex items-center gap-3 rounded-2xl border border-line bg-ink p-3 transition hover:border-kick/50 hover:bg-raise">
                {owner.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={owner.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-raise font-bold">{owner.username.slice(0, 1).toUpperCase()}</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold group-hover:text-kick">{owner.display_name || owner.username}</p>
                    <VerifiedBadge />
                  </div>
                  <p className="text-sm text-kick">@{owner.username}</p>
                </div>
                <span className="text-mute transition group-hover:translate-x-0.5 group-hover:text-kick">→</span>
              </Link>
            );
          })}
          {!followed.some((row) => ownerMap.get(row.owner_id)?.kick_verified) && <p className="rounded-xl border border-dashed border-line p-6 text-center text-mute">Ainda não segue nenhum streamer verificado.</p>}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-line bg-ink p-4"><p className="font-display text-2xl font-extrabold">{value}</p><p className="mt-1 text-xs text-mute">{label}</p></div>;
}
