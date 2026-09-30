import { notFound } from "next/navigation";
import { OverlayBoard } from "@/components/OverlayBoard";
import { getLatestSnapshot } from "@/lib/data";
import { admin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** OBS: Browser Source → {APP_URL}/overlay/<obs_token>[?scale=1.25]. O token só identifica o canal. */
export default async function OverlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ scale?: string }>;
}) {
  const { token } = await params;
  const { scale } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();

  const { data: channel } = await admin()
    .from("channels")
    .select("id, kick_channel_slug")
    .eq("obs_token", token)
    .eq("is_active", true)
    .maybeSingle();
  if (!channel) notFound();

  const s = Math.min(2.5, Math.max(0.5, Number(scale) || 1));
  return <OverlayBoard channelId={channel.id} slug={channel.kick_channel_slug} initial={await getLatestSnapshot(channel.id)} scale={s} />;
}
