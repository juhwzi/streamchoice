import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { requireSession, resolveRole } from "@/lib/auth/guard";
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
  const role = await resolveRole(s.session.uid, channel);
  if (role !== "STREAMER" && role !== "ADMIN") return fail(403, "forbidden", "Somente um streamer verificado ou administrador pode excluir a sala.");

  let query = db.from("channels").delete().eq("id", channel.id);
  if (role !== "ADMIN") query = query.eq("owner_id", s.session.uid);
  const { error } = await query;
  if (error) {
    console.error("[channels] delete", error);
    return fail(500, "internal", "Não foi possível excluir a sala.");
  }

  return NextResponse.json({ ok: true });
}
