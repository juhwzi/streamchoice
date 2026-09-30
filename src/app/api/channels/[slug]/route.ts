import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { requireSession } from "@/lib/auth/guard";
import { admin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Exclusão permanente da sala e de seus dados dependentes (polls, votos, snapshots, follows). */
export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await requireSession(req);
  if (!s.ok) return s.res;

  const db = admin();
  const { data: channel } = await db
    .from("channels")
    .select("id, owner_id")
    .eq("kick_channel_slug", slug)
    .maybeSingle();

  if (!channel) return fail(404, "channel_not_found", "Sala não encontrada.");
  if (channel.owner_id !== s.session.uid) return fail(403, "forbidden", "Somente o streamer pode excluir a sala.");

  const { error } = await db.from("channels").delete().eq("id", channel.id).eq("owner_id", s.session.uid);
  if (error) {
    console.error("[channels] delete", error);
    return fail(500, "internal", "Não foi possível excluir a sala.");
  }

  return NextResponse.json({ ok: true });
}
