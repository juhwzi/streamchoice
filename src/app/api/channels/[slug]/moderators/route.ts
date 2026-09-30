import { NextResponse } from "next/server";
import { z } from "zod";
import { escapeLike, fail, readJson } from "@/lib/api";
import { requireSession } from "@/lib/auth/guard";
import { admin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ username: z.string().trim().min(1).max(40) });

async function ownerChannel(slug: string, uid: string) {
  const { data } = await admin().from("channels").select("id").eq("kick_channel_slug", slug).eq("owner_id", uid).maybeSingle();
  return data;
}

/** RF04: o streamer adiciona moderadores manualmente pelo username da Kick. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await requireSession(req);
  if (!s.ok) return s.res;
  const channel = await ownerChannel(slug, s.session.uid);
  if (!channel) return fail(403, "forbidden", "Apenas o dono do canal.");
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
  const channel = await ownerChannel(slug, s.session.uid);
  if (!channel) return fail(403, "forbidden", "Apenas o dono do canal.");
  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) return fail(400, "bad_request", "userId ausente.");
  await admin().from("channel_moderators").delete().eq("channel_id", channel.id).eq("user_id", userId);
  return NextResponse.json({ ok: true });
}
