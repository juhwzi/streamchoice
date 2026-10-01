import "server-only";
import { admin } from "@/lib/supabase/admin";
import type { SearchChannelResult, SearchResults, SearchUserResult } from "@/lib/types";

function normalizeQuery(value: string): string {
  return value
    .replace(/^@+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

/**
 * Busca usuários e canais públicos usando apenas dados já existentes.
 * Canais públicos são limitados a canais ativos cujo dono esteja verificado na Kick.
 */
export async function searchPublicProfiles(rawQuery: string, limit = 8): Promise<SearchResults> {
  const query = normalizeQuery(rawQuery);
  if (query.length < 2) return { query, users: [], channels: [] };

  const pattern = `${query}%`;
  const db = admin();

  const [usernameResult, displayNameResult, channelResult] = await Promise.all([
    db
      .from("users")
      .select("id, username, display_name, avatar_url, kick_verified")
      .ilike("username", pattern)
      .order("kick_verified", { ascending: false })
      .order("username", { ascending: true })
      .limit(limit),
    db
      .from("users")
      .select("id, username, display_name, avatar_url, kick_verified")
      .ilike("display_name", pattern)
      .order("kick_verified", { ascending: false })
      .order("username", { ascending: true })
      .limit(limit),
    db
      .from("channels")
      .select("id, kick_channel_slug, owner_id, is_active")
      .eq("is_active", true)
      .ilike("kick_channel_slug", pattern)
      .limit(limit),
  ]);

  const userMap = new Map<string, SearchUserResult>();
  for (const user of [
    ...((usernameResult.data ?? []) as SearchUserResult[]),
    ...((displayNameResult.data ?? []) as SearchUserResult[]),
  ]) {
    userMap.set(user.id, user);
  }

  const directChannelRows = (channelResult.data ?? []) as Array<{
    id: string;
    kick_channel_slug: string;
    owner_id: string;
    is_active: boolean;
  }>;

  // Permite encontrar um canal pelo nome público do streamer, não apenas pelo slug.
  const matchingUserIds = [...userMap.values()]
    .filter((user) => user.kick_verified)
    .map((user) => user.id);

  const ownerChannelsResult = matchingUserIds.length
    ? await db
        .from("channels")
        .select("id, kick_channel_slug, owner_id, is_active")
        .eq("is_active", true)
        .in("owner_id", matchingUserIds)
        .limit(limit)
    : { data: [] as Array<{ id: string; kick_channel_slug: string; owner_id: string; is_active: boolean }> };

  const channelMap = new Map<string, typeof directChannelRows[number]>();
  for (const channel of [
    ...directChannelRows,
    ...((ownerChannelsResult.data ?? []) as typeof directChannelRows),
  ]) {
    channelMap.set(channel.id, channel);
  }

  const ownerIds = [...new Set([...channelMap.values()].map((channel) => channel.owner_id))];
  if (ownerIds.length) {
    const missingOwnerIds = ownerIds.filter((id) => !userMap.has(id));
    if (missingOwnerIds.length) {
      const { data: owners } = await db
        .from("users")
        .select("id, username, display_name, avatar_url, kick_verified")
        .in("id", missingOwnerIds)
        .eq("kick_verified", true);

      for (const owner of (owners ?? []) as SearchUserResult[]) {
        userMap.set(owner.id, owner);
      }
    }
  }

  const channels = [...channelMap.values()]
    .map((channel) => {
      const owner = userMap.get(channel.owner_id);
      if (!owner?.kick_verified) return null;
      return { ...channel, owner } satisfies SearchChannelResult;
    })
    .filter((channel): channel is SearchChannelResult => channel !== null)
    .slice(0, limit);

  // Streamers também aparecem em Usuários, mas nunca duplicamos um perfil.
  const users = [...userMap.values()]
    .sort((a, b) => Number(b.kick_verified) - Number(a.kick_verified) || a.username.localeCompare(b.username))
    .slice(0, limit);

  return { query, users, channels };
}
