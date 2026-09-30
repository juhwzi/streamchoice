import "server-only";
import type { NextResponse } from "next/server";
import { admin } from "../supabase/admin";
import { getSession } from "../session";
import { fail, sameOrigin } from "../api";
import type { Role, SessionPayload } from "../types";

export interface ChannelRow {
  id: string;
  owner_id: string;
  kick_channel_slug: string;
  livepix_url: string | null;
  is_active: boolean;
}

/** RBAC por canal: dono → STREAMER; presente em channel_moderators → MODERATOR; senão VIEWER. */
export async function resolveRole(userId: string, channel: Pick<ChannelRow, "id" | "owner_id">): Promise<Role> {
  if (channel.owner_id === userId) return "STREAMER";
  const { data } = await admin()
    .from("channel_moderators")
    .select("id")
    .eq("channel_id", channel.id)
    .eq("user_id", userId)
    .maybeSingle();
  return data ? "MODERATOR" : "VIEWER";
}

type Denied = { ok: false; res: NextResponse };

export async function requireSession(req: Request): Promise<{ ok: true; session: SessionPayload } | Denied> {
  if (!sameOrigin(req)) return { ok: false, res: fail(403, "bad_origin", "Origem inválida.") };
  const session = await getSession();
  if (!session) return { ok: false, res: fail(401, "unauthenticated", "Faça login com a Kick.") };
  return { ok: true, session };
}

/** Carrega a rodada + canal e exige o papel mínimo. */
export async function authorizePoll(req: Request, pollId: string, need: "STAFF" | "VIEWER") {
  const s = await requireSession(req);
  if (!s.ok) return s;
  const db = admin();
  const { data: poll } = await db.from("polls").select("*").eq("id", pollId).maybeSingle();
  if (!poll) return { ok: false as const, res: fail(404, "poll_not_found", "Rodada não encontrada.") };
  const { data: channel } = await db
    .from("channels")
    .select("id, owner_id, kick_channel_slug, livepix_url, is_active")
    .eq("id", poll.channel_id)
    .single();
  const role = await resolveRole(s.session.uid, channel as ChannelRow);
  if (need === "STAFF" && role === "VIEWER") {
    return { ok: false as const, res: fail(403, "forbidden", "Apenas streamer ou moderadores.") };
  }
  return { ok: true as const, session: s.session, poll, channel: channel as ChannelRow, role };
}
