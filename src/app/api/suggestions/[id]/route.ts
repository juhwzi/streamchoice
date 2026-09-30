import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, readJson } from "@/lib/api";
import { authorizePoll } from "@/lib/auth/guard";
import { admin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ action: z.enum(["approve", "reject"]) });

/** Curadoria (RF09): streamer/moderador aprovam ou rejeitam enquanto a rodada coleta sugestões. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = admin();
  const { data: sug } = await db.from("suggestions").select("id, poll_id, status").eq("id", id).maybeSingle();
  if (!sug) return fail(404, "not_found", "Sugestão não encontrada.");

  const a = await authorizePoll(req, sug.poll_id, "STAFF");
  if (!a.ok) return a.res;
  if (a.poll.status !== "collecting") return fail(409, "not_collecting", "A curadoria só é possível antes da votação começar.");

  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail(400, "bad_request", "Ação inválida.");

  const status = parsed.data.action === "approve" ? "approved" : "rejected";
  const { error } = await db.from("suggestions").update({ status, curated_by: a.session.uid }).eq("id", id);
  if (error) return fail(500, "internal", "Falha ao atualizar.");
  return NextResponse.json({ id, status });
}
