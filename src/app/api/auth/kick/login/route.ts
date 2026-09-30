import { NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@/lib/kick/client";
import { codeChallengeS256, generateCodeVerifier, generateState, sanitizeNext } from "@/lib/kick/pkce";
import { signOauthState } from "@/lib/session-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const next = sanitizeNext(new URL(req.url).searchParams.get("next"));
  const verifier = generateCodeVerifier();
  const state = generateState();
  const res = NextResponse.redirect(buildAuthorizeUrl({ state, challenge: codeChallengeS256(verifier) }));
  res.cookies.set("sc_oauth", await signOauthState({ verifier, state, next }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/kick",
    maxAge: 600,
  });
  return res;
}
