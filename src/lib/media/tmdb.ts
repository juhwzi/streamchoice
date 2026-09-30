import { env } from "../env";
import { makeExternalId, type MediaResult } from "./types";

const API = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w500";

interface TmdbItem {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  overview?: string;
  vote_average?: number;
}

function map(item: TmdbItem, type: "movie" | "tv"): MediaResult {
  const date = type === "movie" ? item.release_date : item.first_air_date;
  const overview = item.overview?.trim() || null;
  return {
    externalId: makeExternalId("tmdb", type, item.id),
    mediaType: type,
    title: (type === "movie" ? item.title : item.name) ?? "Sem título",
    year: date ? date.slice(0, 4) : null,
    posterUrl: item.poster_path ? `${IMG}${item.poster_path}` : null,
    overview: overview && overview.length > 180 ? `${overview.slice(0, 177)}…` : overview,
    rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : null,
    extra: null,
  };
}

const headers = () => ({ Authorization: `Bearer ${env("TMDB_READ_TOKEN")}`, Accept: "application/json" });

export async function searchTmdb(query: string, types: ("movie" | "tv")[]): Promise<MediaResult[]> {
  const u = new URL(`${API}/search/multi`);
  u.searchParams.set("query", query);
  u.searchParams.set("language", "pt-BR");
  u.searchParams.set("include_adult", "false");
  const res = await fetch(u, { headers: headers(), next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`TMDB respondeu ${res.status}`);
  const json = (await res.json()) as { results: TmdbItem[] };
  return json.results
    .filter((r): r is TmdbItem & { media_type: "movie" | "tv" } =>
      (r.media_type === "movie" || r.media_type === "tv") && types.includes(r.media_type))
    .slice(0, 8)
    .map((r) => map(r, r.media_type));
}

/** Busca canônica por ID — o servidor nunca confia em título/pôster enviados pelo cliente. */
export async function getTmdbById(type: "movie" | "tv", id: string): Promise<MediaResult | null> {
  const res = await fetch(`${API}/${type}/${id}?language=pt-BR`, { headers: headers(), cache: "no-store" });
  if (!res.ok) return null;
  return map((await res.json()) as TmdbItem, type);
}
