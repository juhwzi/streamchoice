import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { requireSession } from "@/lib/auth/guard";
import { admin } from "@/lib/supabase/admin";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getChannel(slug: string) {
  return admin()
    .from("channels")
    .select("id, owner_id, kick_channel_slug, is_active")
    .eq("kick_channel_slug", slug)
    .eq("is_active", true)
    .maybeSingle();
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = admin();
  const { data: channel } = await getChannel(slug);
  if (!channel) return fail(404, "channel_not_found", "Streamer não encontrado.");

  const { count } = await db
    .from("channel_follows")
    .select("id", { count: "exact", head: true })
    .eq("channel_id", channel.id);

  const sessionResult = await getSession();
  let following = false;
  if (sessionResult) {
    const { data } = await db
      .from("channel_follows")
      .select("id")
      .eq("channel_id", channel.id)
      .eq("user_id", sessionResult.uid)
      .maybeSingle();
    following = !!data;
  }

  return NextResponse.json({ following, followers: count ?? 0 });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await requireSession(req);
  if (!s.ok) return s.res;

  const { data: channel } = await getChannel(slug);
  if (!channel) return fail(404, "channel_not_found", "Streamer não encontrado.");
  if (channel.owner_id === s.session.uid) return fail(409, "self_follow", "Você não precisa seguir seu próprio canal.");

  const { error } = await admin()
    .from("channel_follows")
    .insert({ channel_id: channel.id, user_id: s.session.uid });

  if (error?.code === "23505") return NextResponse.json({ ok: true, following: true });
  if (error) return fail(500, "internal", "Não foi possível seguir este streamer.");

  return NextResponse.json({ ok: true, following: true }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await requireSession(req);
  if (!s.ok) return s.res;

  const { data: channel } = await getChannel(slug);
  if (!channel) return fail(404, "channel_not_found", "Streamer não encontrado.");

  const { error } = await admin()
    .from("channel_follows")
    .delete()
    .eq("channel_id", channel.id)
    .eq("user_id", s.session.uid);

  if (error) return fail(500, "internal", "Não foi possível deixar de seguir.");
  return NextResponse.json({ ok: true, following: false });
}
