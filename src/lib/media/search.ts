import { allowedTypes, parseExternalId, type MediaResult } from "./types";
import { searchTmdb, getTmdbById } from "./tmdb";
import { searchIgdb, getIgdbById } from "./igdb";

export async function searchMedia(q: string, category: "movie" | "game" | "mixed"): Promise<MediaResult[]> {
  const types = allowedTypes(category);
  const tmdbTypes = types.filter((t): t is "movie" | "tv" => t !== "game");
  const jobs: Promise<MediaResult[]>[] = [];
  if (tmdbTypes.length) jobs.push(searchTmdb(q, tmdbTypes));
  if (types.includes("game")) jobs.push(searchIgdb(q));
  // Falha de um provedor não derruba o outro.
  const settled = await Promise.allSettled(jobs);
  const ok = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
  if (!ok.length && settled.every((s) => s.status === "rejected")) throw new Error("Provedores de mídia indisponíveis");
  return ok;
}

export async function resolveMedia(externalId: string): Promise<MediaResult | null> {
  const p = parseExternalId(externalId);
  if (!p) return null;
  return p.source === "tmdb" ? getTmdbById(p.type, p.id) : getIgdbById(p.id);
}
