import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { requireSession } from "@/lib/auth/guard";
import { admin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Onboarding do streamer: cria a sala usando o slug confirmado pela Kick no login (não enviado pelo cliente). */
export async function POST(req: Request) {
  const s = await requireSession(req);
  if (!s.ok) return s.res;
  const slug = s.session.slug;
  if (!slug) return fail(422, "no_kick_channel", "Não conseguimos ler seu canal na Kick. Saia e entre novamente.");

  const { data, error } = await admin()
    .from("channels")
    .insert({ owner_id: s.session.uid, kick_channel_slug: slug })
    .select("kick_channel_slug")
    .single();
  if (error) {
    if (error.code === "23505") return fail(409, "already_exists", "Sua sala já existe.");
    return fail(500, "internal", "Falha ao criar a sala.");
  }
  return NextResponse.json({ slug: data.kick_channel_slug }, { status: 201 });
}
