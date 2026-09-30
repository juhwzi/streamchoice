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

export interface AccountAccess {
  kick_verified: boolean;
  is_admin: boolean;
}

export async function getAccountAccess(userId: string): Promise<AccountAccess> {
  const { data } = await admin()
    .from("users")
    .select("kick_verified, is_admin")
    .eq("id", userId)
    .maybeSingle();
  return {
    kick_verified: data?.kick_verified === true,
    is_admin: data?.is_admin === true,
  };
}

/**
 * Regra do produto:
 * - ADMIN: acesso administrativo global.
 * - STREAMER: dono do canal + selo de verificado na Kick.
 * - MODERATOR: moderador cadastrado naquele canal.
 * - VIEWER: todo o restante.
 */
export async function resolveRole(userId: string, channel: Pick<ChannelRow, "id" | "owner_id">): Promise<Role> {
  const account = await getAccountAccess(userId);
  if (account.is_admin) return "ADMIN";

  if (channel.owner_id === userId) {
    return account.kick_verified ? "STREAMER" : "VIEWER";
  }

  const { data } = await admin()
    .from("channel_moderators")
    .select("id")
    .eq("channel_id", channel.id)
    .eq("user_id", userId)
    .maybeSingle();
  return data ? "MODERATOR" : "VIEWER";
}

export async function canUseStreamerFeatures(userId: string): Promise<boolean> {
  const account = await getAccountAccess(userId);
  return account.kick_verified || account.is_admin;
}

type Denied = { ok: false; res: NextResponse };

export async function requireSession(req: Request): Promise<{ ok: true; session: SessionPayload } | Denied> {
  if (!sameOrigin(req)) return { ok: false, res: fail(403, "bad_origin", "Origem inválida.") };
  const session = await getSession();
  if (!session) return { ok: false, res: fail(401, "unauthenticated", "Faça login com a Kick.") };
  return { ok: true, session };
}

export async function requireStreamer(req: Request): Promise<{ ok: true; session: SessionPayload; role: "STREAMER" | "ADMIN" } | Denied> {
  const auth = await requireSession(req);
  if (!auth.ok) return auth;
  const account = await getAccountAccess(auth.session.uid);
  if (!account.kick_verified && !account.is_admin) {
    return { ok: false, res: fail(403, "streamer_unverified", "O acesso de streamer exige o selo de verificado da Kick.") };
  }
  return { ok: true, session: auth.session, role: account.is_admin ? "ADMIN" : "STREAMER" };
}

export async function requireAdmin(req: Request): Promise<{ ok: true; session: SessionPayload } | Denied> {
  const auth = await requireSession(req);
  if (!auth.ok) return auth;
  const account = await getAccountAccess(auth.session.uid);
  if (!account.is_admin) return { ok: false, res: fail(403, "admin_only", "Apenas administradores.") };
  return { ok: true, session: auth.session };
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
    return { ok: false as const, res: fail(403, "forbidden", "Apenas streamer, moderadores ou administrador.") };
  }
  return { ok: true as const, session: s.session, poll, channel: channel as ChannelRow, role };
}
