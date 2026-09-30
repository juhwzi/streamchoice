import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, readJson } from "@/lib/api";
import { authorizePoll } from "@/lib/auth/guard";
import { admin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  action: z.enum(["start_voting", "pause", "resume", "extend", "complete"]),
  seconds: z.number().int().min(10).max(3600).optional(),
});

const MESSAGES: Record<string, [number, string]> = {
  invalid_state: [409, "Ação indisponível no estado atual da rodada."],
  need_two_approved: [422, "Aprove ao menos 2 títulos antes de abrir a votação."],
  invalid_seconds: [422, "Duração inválida."],
  poll_not_found: [404, "Rodada não encontrada."],
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await authorizePoll(req, id, "STAFF");
  if (!a.ok) return a.res;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail(400, "bad_request", "Ação inválida.");

  const { data, error } = await admin().rpc("poll_action", {
    p_poll_id: id,
    p_action: parsed.data.action,
    p_seconds: parsed.data.seconds ?? null,
  });
  if (error) return fail(500, "internal", "Falha ao executar a ação.");
  if (data !== "ok") {
    const [status, msg] = MESSAGES[data as string] ?? [400, "Ação recusada."];
    return fail(status, data as string, msg);
  }
  return NextResponse.json({ ok: true });
}
