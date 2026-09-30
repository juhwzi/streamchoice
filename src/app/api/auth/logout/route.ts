import { NextResponse } from "next/server";
import { appUrl } from "@/lib/env";
import { SESSION_COOKIE } from "@/lib/session-token";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.redirect(new URL("/", appUrl()), 303);
  res.cookies.delete({ name: SESSION_COOKIE, path: "/" });
  return res;
}
