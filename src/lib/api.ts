import { NextResponse } from "next/server";
import { appUrl } from "./env";

export const fail = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status });

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/** Defesa extra contra CSRF (além de SameSite=Lax): se houver Origin, deve ser o do app. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(appUrl()).host || origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}

export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
