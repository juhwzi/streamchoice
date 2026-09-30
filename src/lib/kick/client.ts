import { appUrl, env } from "../env";

const ID_BASE = "https://id.kick.com";
const API_BASE = "https://api.kick.com/public/v1";
export const KICK_SCOPES = "user:read channel:read";
export const redirectUri = () => `${appUrl()}/api/auth/kick/callback`;

export function buildAuthorizeUrl(p: { state: string; challenge: string }): string {
  const u = new URL(`${ID_BASE}/oauth/authorize`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", env("KICK_CLIENT_ID"));
  u.searchParams.set("redirect_uri", redirectUri());
  u.searchParams.set("scope", KICK_SCOPES);
  u.searchParams.set("code_challenge", p.challenge);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("state", p.state);
  return u.toString();
}

export async function exchangeCode(code: string, verifier: string): Promise<{ access_token: string }> {
  const res = await fetch(`${ID_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: env("KICK_CLIENT_ID"),
      client_secret: env("KICK_CLIENT_SECRET"),
      redirect_uri: redirectUri(),
      code_verifier: verifier,
      code,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Kick token endpoint respondeu ${res.status}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Resposta da Kick sem access_token");
  return { access_token: json.access_token };
}

export interface KickUser {
  id: string;
  name: string;
  avatar: string | null;
}

/** GET /public/v1/users (sem parâmetros = usuário dono do token). */
export async function fetchKickUser(accessToken: string): Promise<KickUser> {
  const res = await fetch(`${API_BASE}/users`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Kick /users respondeu ${res.status}`);
  const json = (await res.json()) as { data?: { user_id: number | string; name: string; profile_picture?: string }[] };
  const u = json.data?.[0];
  if (!u) throw new Error("Kick /users sem dados");
  return { id: String(u.user_id), name: u.name, avatar: u.profile_picture ?? null };
}

/** GET /public/v1/channels (sem parâmetros = canal do dono do token). Falha é não-fatal. */
export async function fetchOwnChannelSlug(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/channels`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { slug?: string }[] };
    return json.data?.[0]?.slug ?? null;
  } catch {
    return null;
  }
}
