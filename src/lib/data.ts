import "server-only";
import { admin } from "./supabase/admin";
import type { SnapshotRow } from "./types";

const SNAP_COLS = "poll_id, channel_id, poll_created_at, updated_at, data";

export async function getChannelBySlug(slug: string) {
  const { data } = await admin()
    .from("channels")
    .select("id, owner_id, kick_channel_slug, livepix_url, is_active")
    .eq("kick_channel_slug", slug)
    .maybeSingle();
  return data;
}

/** Snapshot da rodada mais recente do canal (a "atual"). */
export async function getLatestSnapshot(channelId: string): Promise<SnapshotRow | null> {
  const { data } = await admin()
    .from("poll_snapshots")
    .select(SNAP_COLS)
    .eq("channel_id", channelId)
    .order("poll_created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as SnapshotRow | null) ?? null;
}
