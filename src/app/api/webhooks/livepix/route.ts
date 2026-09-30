import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase/admin";
import { extractVoteTag, normalizePayload } from "@/lib/webhook/payload";
import { pickSignatureHeader, verifySignature } from "@/lib/webhook/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 64 * 1024;

/**
 * Webhook do Livepix/PixGG. URL por canal: /api/webhooks/livepix?channel=<slug>
 *  1. valida HMAC-SHA256 sobre o corpo bruto (RNF02)
 *  2. extrai a tag (#VOTO-N) da mensagem (RF15)
 *  3. valida mínimo e rodada aberta, grava com idempotência por transaction_id (RF16/RF17)
 * Toda requisição autenticada é registrada em webhook_events e respondida com 200 (evita
 * tempestade de retentativas); só erros de infraestrutura retornam 5xx para o gateway reenviar.
 */
export async function POST(req: Request) {
  const slug = new URL(req.url).searchParams.get("channel");
  if (!slug) return NextResponse.json({ error: "channel ausente" }, { status: 400 });

  const raw = await req.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "payload grande demais" }, { status: 413 });

  const db = admin();
  const { data: channel } = await db
    .from("channels")
    .select("id, livepix_webhook_secret")
    .eq("kick_channel_slug", slug)
    .maybeSingle();
  // Mesma resposta para canal inexistente e sem segredo: não revela quais canais existem.
  if (!channel?.livepix_webhook_secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sig = pickSignatureHeader((n) => req.headers.get(n), process.env.WEBHOOK_SIGNATURE_HEADER);
  if (!verifySignature(raw, sig, channel.livepix_webhook_secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ outcome: "invalid_json" });
  }

  const pix = normalizePayload(json);
  const log = (outcome: string, extra: Record<string, unknown> = {}) =>
    db.from("webhook_events").insert({ channel_id: channel.id, provider: "livepix", outcome, ...extra });

  if (!pix) {
    await log("invalid_payload");
    return NextResponse.json({ outcome: "invalid_payload" });
  }

  const tag = extractVoteTag(pix.message);
  if (!tag) {
    await log("no_tag", { transaction_id: pix.externalId, amount: pix.amount, donor: pix.donor });
    return NextResponse.json({ outcome: "no_tag" });
  }

  const { data: outcome, error } = await db.rpc("record_paid_vote", {
    p_channel_id: channel.id,
    p_provider: "livepix",
    p_external_tx: pix.externalId,
    p_tag: tag,
    p_amount: pix.amount,
    p_donor: pix.donor,
    p_donor_kick_id: null,
  });
  if (error) {
    console.error("[webhook] rpc", error);
    return NextResponse.json({ error: "internal" }, { status: 500 }); // gateway tentará de novo
  }

  await log(String(outcome), { transaction_id: pix.externalId, amount: pix.amount, donor: pix.donor });
  return NextResponse.json({ outcome });
}
