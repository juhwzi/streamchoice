import { NextResponse } from "next/server";
import { appUrl } from "@/lib/env";
import { exchangeCode, fetchKickUser, fetchOwnChannel } from "@/lib/kick/client";
import { sanitizeNext } from "@/lib/kick/pkce";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifyOauthState } from "@/lib/session-token";
import { admin } from "@/lib/supabase/admin";

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

    const { data: user, error } = await admin()
      .from("users")
      .upsert(
        {
          kick_user_id: kick.id,
          username: kick.name,
          avatar_url: kick.avatar,
          kick_verified: ownChannel.isVerified,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "kick_user_id" },
      )
      .select("id")
      .single();

    if (error || !user) throw new Error(error?.message ?? "upsert de usuário falhou");


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
