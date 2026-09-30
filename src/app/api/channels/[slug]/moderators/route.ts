import { NextResponse } from "next/server";
import { z } from "zod";
import { escapeLike, fail, readJson } from "@/lib/api";
import { requireSession, resolveRole } from "@/lib/auth/guard";
import { admin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ username: z.string().trim().min(1).max(40) });


/** RF04: o streamer adiciona moderadores manualmente pelo username da Kick. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await requireSession(req);
  if (!s.ok) return s.res;
  const { data: channelMeta } = await admin().from("channels").select("id, owner_id").eq("kick_channel_slug", slug).maybeSingle();
  if (!channelMeta) return fail(404, "channel_not_found", "Canal não encontrado.");
  const ownerRole = await resolveRole(s.session.uid, channelMeta);
  if (ownerRole !== "STREAMER" && ownerRole !== "ADMIN") return fail(403, "forbidden", "O gerenciamento do canal exige verificação na Kick.");
  const channel = channelMeta;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail(400, "bad_request", "Informe o username.");

  const db = admin();
  const { data: user } = await db.from("users").select("id").ilike("username", escapeLike(parsed.data.username)).maybeSingle();
  if (!user) return fail(404, "user_not_found", "Essa pessoa ainda não entrou no StreamChoice. Peça para ela fazer login uma vez.");
  if (user.id === s.session.uid) return fail(422, "self", "Você já é o streamer.");

  const { error } = await db
    .from("channel_moderators")
    .upsert({ channel_id: channel.id, user_id: user.id, is_auto_synced: false }, { onConflict: "channel_id,user_id" });
  if (error) return fail(500, "internal", "Falha ao adicionar.");
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await requireSession(req);
  if (!s.ok) return s.res;
  const { data: channelMeta } = await admin().from("channels").select("id, owner_id").eq("kick_channel_slug", slug).maybeSingle();
  if (!channelMeta) return fail(404, "channel_not_found", "Canal não encontrado.");
  const ownerRole = await resolveRole(s.session.uid, channelMeta);
  if (ownerRole !== "STREAMER" && ownerRole !== "ADMIN") return fail(403, "forbidden", "O gerenciamento do canal exige verificação na Kick.");
  const channel = channelMeta;
  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) return fail(400, "bad_request", "userId ausente.");
  await admin().from("channel_moderators").delete().eq("channel_id", channel.id).eq("user_id", userId);
  return NextResponse.json({ ok: true });
}
