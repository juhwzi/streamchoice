import { NextResponse } from "next/server";
import { appUrl, isConfiguredAdmin } from "@/lib/env";
import { exchangeCode, fetchKickUser, fetchOwnChannel } from "@/lib/kick/client";
import { sanitizeNext } from "@/lib/kick/pkce";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifyOauthState } from "@/lib/session-token";
import { admin } from "@/lib/supabase/admin";
import { syncStreamerChannel } from "@/lib/auth/streamer-channel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function back(path: string, error?: string) {
  const u = new URL(path, appUrl());
  if (error) u.searchParams.set("erro", error);
  const res = NextResponse.redirect(u);
  res.cookies.delete({ name: "sc_oauth", path: "/api/auth/kick" });
  return res;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("error")) return back("/entrar", "login_negado");

  const cookie = req.headers.get("cookie")?.match(/(?:^|;\s*)sc_oauth=([^;]+)/)?.[1];
  const saved = await verifyOauthState(cookie);
  const code = url.searchParams.get("code");
  if (!saved || !code || url.searchParams.get("state") !== saved.state) return back("/entrar", "estado_invalido");

  try {
    const { access_token } = await exchangeCode(code, saved.verifier);
    const [kick, ownChannel] = await Promise.all([
      fetchKickUser(access_token),
      fetchOwnChannel(access_token),
    ]);

    const adminConfigured = isConfiguredAdmin(kick.id, kick.name);
    const adminAllowlistConfigured = Boolean(process.env.ADMIN_KICK_USER_IDS || process.env.ADMIN_KICK_USERNAMES);
    const userPayload: Record<string, unknown> = {
      kick_user_id: kick.id,
      username: kick.name,
      avatar_url: kick.avatar,
      kick_verified: ownChannel.isVerified,
      updated_at: new Date().toISOString(),
    };
    if (adminAllowlistConfigured) userPayload.is_admin = adminConfigured;

    const { data: user, error } = await admin()
      .from("users")
      .upsert(userPayload, { onConflict: "kick_user_id" })
      .select("id")
      .single();

    if (error || !user) throw new Error(error?.message ?? "upsert de usuário falhou");

    // A verificação da Kick é a única fonte do papel de streamer.
    // Ao fazer login, uma conta recém-verificada recebe/reativa automaticamente
    // sua sala; uma conta que perdeu o selo fica com a sala desativada.
    await syncStreamerChannel(user.id, ownChannel.slug, ownChannel.isVerified);

    const session = await signSession({
      uid: user.id,
      kid: kick.id,
      name: kick.name,
      avatar: kick.avatar,
      slug: ownChannel.slug,
    });

    const res = back(sanitizeNext(saved.next));
    res.cookies.set(SESSION_COOKIE, session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return res;
  } catch (e) {
    console.error("[auth] callback falhou", e);
    return back("/entrar", "falha_login");
  }
}
