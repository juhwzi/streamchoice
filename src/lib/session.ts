import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "./session-token";
import type { SessionPayload } from "./types";

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}
