import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, readJson } from "@/lib/api";
import { requireSession, resolveRole } from "@/lib/auth/guard";
import { allowedTypes } from "@/lib/media/types";
import { resolveMedia } from "@/lib/media/search";
import { admin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  pollId: z.string().uuid(),
  externalId: z.string().min(3).max(60),
  justification: z.string().trim().max(140).optional(),
});

export async function POST(req: Request) {
  const s = await requireSession(req);
  if (!s.ok) return s.res;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail(400, "bad_request", "Dados inválidos.");
  const { pollId, externalId, justification } = parsed.data;

  const db = admin();
  const { data: poll } = await db.from("polls").select("*").eq("id", pollId).maybeSingle();
  if (!poll) return fail(404, "poll_not_found", "Rodada não encontrada.");
  if (poll.status !== "collecting") return fail(409, "not_collecting", "Esta rodada não está recebendo sugestões.");

  // Dados canônicos vindos do TMDB/IGDB — nunca do cliente.
  const media = await resolveMedia(externalId).catch(() => null);
  if (!media) return fail(422, "media_not_found", "Título não encontrado.");
  if (!allowedTypes(poll.category_type).includes(media.mediaType)) {
    return fail(422, "wrong_category", "Este tipo de mídia não faz parte desta rodada.");
  }

  // Limite por usuário (não se aplica à equipe).
  const { data: channel } = await db.from("channels").select("id, owner_id").eq("id", poll.channel_id).single();
  const role = await resolveRole(s.session.uid, channel!);
  if (role === "VIEWER") {
    const { count } = await db
      .from("suggestions")
      .select("id", { count: "exact", head: true })
      .eq("poll_id", pollId)
      .eq("suggested_by", s.session.uid);
    if ((count ?? 0) >= poll.max_suggestions_per_user) {
      return fail(429, "limit_reached", `Você já enviou ${poll.max_suggestions_per_user} sugestões nesta rodada.`);
    }
  }

  const { data, error } = await db
    .from("suggestions")
    .insert({
      poll_id: pollId,
      suggested_by: s.session.uid,
      external_media_id: media.externalId,
      media_type: media.mediaType,
      title: media.title,
      poster_url: media.posterUrl,
      release_year: media.year,
      justification: justification || null,
    })
    .select("id, vote_tag")
    .single();

  if (error) {
    // RF07: a UNIQUE(poll_id, external_media_id) é a barreira final contra duplicatas (mesmo sob corrida).
    if (error.code === "23505") return fail(409, "duplicate", "Esse título já foi sugerido nesta rodada. Apoie o item existente!");
    console.error("[suggestions] insert", error);
    return fail(500, "internal", "Não foi possível salvar a sugestão.");
  }
  return NextResponse.json({ id: data.id, tag: data.vote_tag }, { status: 201 });
}
