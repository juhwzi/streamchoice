import { notFound } from "next/navigation";
import { ViewerRoom } from "@/components/ViewerRoom";
import { getChannelBySlug, getLatestSnapshot } from "@/lib/data";
import { getSession } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ChannelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const channel = await getChannelBySlug(slug);
  if (!channel || !channel.is_active) notFound();

  const [session, snapshot, owner, followerCount] = await Promise.all([
    getSession(),
    getLatestSnapshot(channel.id),
    admin().from("users").select("username, display_name, avatar_url, bio, kick_verified").eq("id", channel.owner_id).maybeSingle().then((r) => r.data),
    admin().from("channel_follows").select("id", { count: "exact", head: true }).eq("channel_id", channel.id).then((r) => r.count ?? 0),
  ]);

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
    />
  );
}
