import { notFound } from "next/navigation";
import { OverlayBoard } from "@/components/OverlayBoard";
import { getLatestActiveSnapshot, getLatestSnapshot } from "@/lib/data";
import { admin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** OBS: Browser Source → {APP_URL}/overlay/<obs_token>[?scale=1.25]. O token só identifica o canal. */
export default async function OverlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ scale?: string; category?: string }>;
}) {
  const { token } = await params;
  const { scale, category } = await searchParams;
  const selectedCategory = category === "movie" || category === "game" ? category : null;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();

  const { data: channel } = await admin()
    .from("channels")
    .select("id, kick_channel_slug")
    .eq("obs_token", token)
    .eq("is_active", true)
    .maybeSingle();
  if (!channel) notFound();

  const s = Math.min(2.5, Math.max(0.5, Number(scale) || 1));
  const initial = selectedCategory
    ? await getLatestActiveSnapshot(channel.id, selectedCategory)
    : (await getLatestActiveSnapshot(channel.id)) ?? (await getLatestSnapshot(channel.id));
  return <OverlayBoard channelId={channel.id} initial={initial} scale={s} pinnedPollId={selectedCategory ? initial?.poll_id ?? null : null} />;
}
