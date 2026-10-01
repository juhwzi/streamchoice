import { notFound } from "next/navigation";
import { ViewerRoom } from "@/components/ViewerRoom";
import { getActivePolls, getChannelBySlug, getLatestActiveSnapshot, getLatestSnapshot, getSnapshotByPollId } from "@/lib/data";
import { getSession } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ChannelPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ poll?: string; category?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const channel = await getChannelBySlug(slug);
  if (!channel || !channel.is_active) notFound();

  const selectedPollId = query?.poll?.trim() || null;
  const selectedCategory = query?.category === "movie" || query?.category === "game" ? query.category : null;

  const snapshotPromise = selectedPollId
    ? getSnapshotByPollId(channel.id, selectedPollId)
    : selectedCategory
      ? getLatestActiveSnapshot(channel.id, selectedCategory)
      : getLatestActiveSnapshot(channel.id).then((active) => active ?? getLatestSnapshot(channel.id));

  const [session, snapshot, owner, followerCount, activePolls] = await Promise.all([
    getSession(),
    snapshotPromise,
    admin().from("users").select("username, display_name, avatar_url, bio, kick_verified").eq("id", channel.owner_id).maybeSingle().then((r) => r.data),
    admin().from("channel_follows").select("id", { count: "exact", head: true }).eq("channel_id", channel.id).then((r) => r.count ?? 0),
    getActivePolls(channel.id),
  ]);

  // Um canal só é uma sala de streamer se o dono estiver verificado na Kick.
  if (!owner?.kick_verified) notFound();

  let myVote: string | null = null;
  let following = false;
  if (session && snapshot) {
    const { data } = await admin()
      .from("votes")
      .select("suggestion_id")
      .eq("poll_id", snapshot.poll_id)
      .eq("user_id", session.uid)
      .maybeSingle();
    myVote = data?.suggestion_id ?? null;
  }
  if (session && session.uid !== channel.owner_id) {
    const { data } = await admin().from("channel_follows").select("id").eq("channel_id", channel.id).eq("user_id", session.uid).maybeSingle();
    following = !!data;
  }

  return (
    <ViewerRoom
      channel={{ id: channel.id, slug: channel.kick_channel_slug, livepixUrl: channel.livepix_url, ownerName: owner?.display_name || owner?.username || channel.kick_channel_slug, ownerUsername: owner?.username || channel.kick_channel_slug, ownerAvatar: owner?.avatar_url || null, ownerVerified: !!owner?.kick_verified, followerCount, following }}
      initial={snapshot}
      loggedIn={!!session}
      myVote={myVote}
      pinnedPollId={selectedPollId ?? (selectedCategory ? snapshot?.poll_id ?? null : null)}
      activePolls={activePolls as Array<{ id: string; title: string; category_type: "movie" | "game" | "mixed"; status: string; created_at: string }>}
    />
  );
}
