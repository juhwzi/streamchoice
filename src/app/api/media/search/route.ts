import { NextResponse } from "next/server";
import { z } from "zod";
import { fail } from "@/lib/api";
import { requireSession } from "@/lib/auth/guard";
import { searchMedia } from "@/lib/media/search";
import { admin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Q = z.object({ poll: z.string().uuid(), q: z.string().trim().min(2).max(80) });

/** Busca em tempo real (TMDB/IGDB) já marcando o que foi sugerido nesta rodada (RF07). */
export async function GET(req: Request) {
  const s = await requireSession(req);
  if (!s.ok) return s.res;

  const parsed = Q.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return fail(400, "bad_request", "Informe ao menos 2 caracteres.");
  const { poll: pollId, q } = parsed.data;

  const db = admin();
  const { data: poll } = await db.from("polls").select("id, category_type").eq("id", pollId).maybeSingle();
  if (!poll) return fail(404, "poll_not_found", "Rodada não encontrada.");

  let results;
  try {
    results = await searchMedia(q, poll.category_type);
  } catch (e) {
    console.error("[media] busca falhou", e);
    return fail(502, "media_unavailable", "Não foi possível consultar TMDB/IGDB agora.");
  }

  const ids = results.map((r) => r.externalId);
  const { data: existing } = ids.length
    ? await db.from("suggestions").select("id, external_media_id, status").eq("poll_id", pollId).in("external_media_id", ids)
    : { data: [] as { id: string; external_media_id: string; status: string }[] };
  const byId = new Map((existing ?? []).map((e) => [e.external_media_id, e]));

  return NextResponse.json({
    results: results.map((r) => {
      const e = byId.get(r.externalId);
      return { ...r, existing: e ? { suggestionId: e.id, status: e.status } : null };
    }),
  });
}
