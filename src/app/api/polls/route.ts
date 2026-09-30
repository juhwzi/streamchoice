import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, readJson } from "@/lib/api";
import { requireSession, resolveRole } from "@/lib/auth/guard";
import { admin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  channelSlug: z.string().min(1),
  title: z.string().trim().min(3).max(80),
  categoryType: z.enum(["movie", "game", "mixed"]),
  pollMode: z.enum(["multiple_choice", "bracket"]).default("multiple_choice"),
  isPaidVoting: z.boolean().default(false),
  paidMode: z.enum(["accumulated_value", "fixed_ticket", "hybrid"]).default("accumulated_value"),
  minDonationAmount: z.number().min(0.01).max(10000).default(1),
  maxSuggestionsPerUser: z.number().int().min(1).max(20).default(3),
});

export async function POST(req: Request) {
  const s = await requireSession(req);
  if (!s.ok) return s.res;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail(400, "bad_request", "Dados inválidos.");
  const b = parsed.data;

  const db = admin();
  const { data: channel } = await db
    .from("channels")
    .select("id, owner_id, livepix_url, livepix_webhook_secret")
    .eq("kick_channel_slug", b.channelSlug)
    .maybeSingle();
  if (!channel) return fail(404, "channel_not_found", "Canal não encontrado.");
  if ((await resolveRole(s.session.uid, channel)) === "VIEWER") return fail(403, "forbidden", "Apenas streamer ou moderadores.");

  if (b.pollMode === "bracket") return fail(422, "bracket_unavailable", "O modo mata-mata ainda não está disponível.");
  if (b.isPaidVoting && (!channel.livepix_url || !channel.livepix_webhook_secret)) {
    return fail(422, "pix_not_configured", "O streamer precisa configurar o Livepix/PixGG e o segredo do webhook antes.");
  }

  const { data, error } = await db
    .from("polls")
    .insert({
      channel_id: channel.id,
      title: b.title,
      category_type: b.categoryType,
      poll_mode: b.pollMode,
      is_paid_voting: b.isPaidVoting,
      paid_mode: b.paidMode,
      min_donation_amount: b.minDonationAmount,
      max_suggestions_per_user: b.maxSuggestionsPerUser,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return fail(409, "active_poll_exists", "Já existe uma rodada em andamento. Encerre-a primeiro.");
    return fail(500, "internal", "Falha ao criar a rodada.");
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}
