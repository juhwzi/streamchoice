import { NextResponse } from "next/server";
import { authorizePoll } from "@/lib/auth/guard";
import { admin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Fila de moderação (RF09). A equipe é avisada por Realtime (pending_count) e busca aqui. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await authorizePoll(req, id, "STAFF");
  if (!a.ok) return a.res;

  const { data } = await admin()
    .from("suggestions")
    .select("id, title, poster_url, release_year, media_type, justification, vote_tag, created_at, users!suggestions_suggested_by_fkey(username)")
    .eq("poll_id", id)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(100);

  const items = (data ?? []).map((r) => {
    const u = (r as unknown as { users: { username: string } | { username: string }[] | null }).users;
    return { ...r, suggested_by_name: (Array.isArray(u) ? u[0]?.username : u?.username) ?? "?" };
  });
  return NextResponse.json({ items });
}
