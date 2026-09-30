import { SignJWT, jwtVerify } from "jose";
import type { SessionPayload } from "./types.ts";

const key = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET ausente ou curto demais");
  return new TextEncoder().encode(s);
};

export const SESSION_COOKIE = "sc_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export async function signSession(p: SessionPayload): Promise<string> {
  return new SignJWT({ ...p })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (typeof payload.uid !== "string" || typeof payload.kid !== "string") return null;
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** Cookie curto usado só durante o handshake OAuth (guarda verifier/state). */
export async function signOauthState(v: { verifier: string; state: string; next: string }): Promise<string> {
  return new SignJWT({ ...v }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("10m").sign(key());
}
export async function verifyOauthState(t: string | undefined) {
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, key(), { algorithms: ["HS256"] });
    return payload as unknown as { verifier: string; state: string; next: string };
  } catch {
    return null;
  }
}
