import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, readJson } from "@/lib/api";
import { requireSession } from "@/lib/auth/guard";
import { admin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  pollId: z.string().uuid(),
  status: z.enum(["up_next", "in_progress", "completed"]),
});

export async function PATCH(req: Request) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.res;

  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail(400, "bad_request", "Status inválido.");

  const db = admin();
  const { data: channel } = await db
    .from("channels")
    .select("id")
    .eq("owner_id", auth.session.uid)
    .maybeSingle();

  if (!channel) return fail(404, "channel_not_found", "Você ainda não tem uma sala.");

  const { data, error } = await db.rpc("upsert_streamer_library", {
    p_channel_id: channel.id,
    p_poll_id: parsed.data.pollId,
    p_status: parsed.data.status,
  });

  if (error) {
    const known = {
      invalid_library_status: "Status inválido.",
      poll_not_completed_or_wrong_channel: "A votação precisa estar encerrada e pertencer ao seu canal.",
      poll_without_winner: "Essa votação não possui um vencedor com pontuação.",
    } as Record<string, string>;

    const message = Object.entries(known).find(([key]) => error.message.includes(key))?.[1];
    return fail(400, "library_update_failed", message ?? "Não foi possível atualizar a biblioteca.");
  }

  return NextResponse.json({ ok: true, id: data });
}
