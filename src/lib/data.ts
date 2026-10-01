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

/** Snapshot de uma rodada específica. Útil para abrir uma votação a partir do feed. */
export async function getSnapshotByPollId(channelId: string, pollId: string): Promise<SnapshotRow | null> {
  const { data } = await admin()
    .from("poll_snapshots")
    .select(SNAP_COLS)
    .eq("channel_id", channelId)
    .eq("poll_id", pollId)
    .maybeSingle();
  return (data as SnapshotRow | null) ?? null;
}

/** Retorna o snapshot da rodada ativa mais recente, opcionalmente filtrando por categoria. */
export async function getLatestActiveSnapshot(channelId: string, category?: "movie" | "game" | "mixed"): Promise<SnapshotRow | null> {
  let query = admin()
    .from("polls")
    .select("id")
    .eq("channel_id", channelId)
    .neq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1);

  if (category) query = query.eq("category_type", category);

  const { data: poll } = await query.maybeSingle();
  if (!poll?.id) return null;
  return getSnapshotByPollId(channelId, poll.id);
}

export async function getActivePolls(channelId: string) {
  const { data } = await admin()
    .from("polls")
    .select("id, title, category_type, status, created_at")
    .eq("channel_id", channelId)
    .neq("status", "completed")
    .order("created_at", { ascending: false });
  return data ?? [];
}
