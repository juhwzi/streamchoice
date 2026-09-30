import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Idempotente e seguro de expor: só encerra se o relógio DO BANCO já passou de ends_at. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ finalized: false }, { status: 400 });
  const { data } = await admin().rpc("finalize_poll_if_due", { p_poll_id: id });
  return NextResponse.json({ finalized: data === true });
}
