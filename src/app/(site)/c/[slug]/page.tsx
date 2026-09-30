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

  const [session, snapshot] = await Promise.all([getSession(), getLatestSnapshot(channel.id)]);

  let myVote: string | null = null;
  if (session && snapshot) {
    const { data } = await admin()
      .from("votes")
      .select("suggestion_id")
      .eq("poll_id", snapshot.poll_id)
      .eq("user_id", session.uid)
      .maybeSingle();
    myVote = data?.suggestion_id ?? null;
  }

  return (
    <ViewerRoom
      channel={{ id: channel.id, slug: channel.kick_channel_slug, livepixUrl: channel.livepix_url }}
      initial={snapshot}
      loggedIn={!!session}
      myVote={myVote}
    />
  );
}
