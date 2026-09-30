import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, readJson } from "@/lib/api";
import { requireSession } from "@/lib/auth/guard";
import { admin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ pollId: z.string().uuid(), suggestionId: z.string().uuid() });

const MAP: Record<string, [number, string]> = {
  poll_not_found: [404, "Rodada não encontrada."],
  poll_not_open: [409, "A votação não está aberta."],
  poll_ended: [409, "A votação já terminou."],
  free_voting_disabled: [409, "Esta rodada aceita apenas votos por Pix."],
  invalid_suggestion: [422, "Título inválido para esta rodada."],
  already_voted: [409, "Você já votou nesta rodada."],
};

/** Voto gratuito (RF11): 1 por usuário Kick, garantido por UNIQUE(poll_id, user_id) dentro da RPC. */
export async function POST(req: Request) {
  const s = await requireSession(req);
  if (!s.ok) return s.res;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail(400, "bad_request", "Dados inválidos.");

  const { data, error } = await admin().rpc("cast_vote", {
    p_poll_id: parsed.data.pollId,
    p_suggestion_id: parsed.data.suggestionId,
    p_user_id: s.session.uid,
  });
  if (error) {
    console.error("[votes] rpc", error);
    return fail(500, "internal", "Não foi possível registrar o voto.");
  }
  if (data !== "ok") {
    const [status, msg] = MAP[data as string] ?? [400, "Voto recusado."];
    return fail(status, data as string, msg);
  }
  return NextResponse.json({ ok: true });
}
