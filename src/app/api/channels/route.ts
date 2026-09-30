import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { requireStreamer } from "@/lib/auth/guard";
import { admin } from "@/lib/supabase/admin";
import { syncStreamerChannel } from "@/lib/auth/streamer-channel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Onboarding: só usuários verificados na Kick (ou admin) podem criar um canal. */
export async function POST(req: Request) {
  const s = await requireStreamer(req);
  if (!s.ok) return s.res;

  const slug = s.session.slug;
  if (!slug) return fail(422, "no_kick_channel", "Não conseguimos ler seu canal na Kick. Saia e entre novamente.");

  try {
    const account = await admin()
      .from("users")
      .select("kick_verified")
      .eq("id", s.session.uid)
      .maybeSingle();

    if (!account.data?.kick_verified && s.role !== "ADMIN") {
      return fail(403, "streamer_unverified", "O acesso de streamer exige o selo de verificado da Kick.");
    }

    const channel = await syncStreamerChannel(s.session.uid, slug, true);
    if (!channel) return fail(422, "channel_sync_failed", "Não foi possível sincronizar sua sala.");

    return NextResponse.json({ slug: channel.kick_channel_slug, created: true });
  } catch (error) {
    console.error("[channels] sync falhou", error);
    return fail(500, "internal", "Falha ao criar/sincronizar a sala.");
  }
}
