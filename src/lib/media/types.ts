import type { MediaType } from "../types.ts";

export interface MediaResult {
  externalId: string; // namespaced: tmdb:movie:550 | tmdb:tv:1399 | igdb:1942
  mediaType: MediaType;
  title: string;
  year: string | null;
  posterUrl: string | null;
  overview: string | null;
  rating: number | null; // 0–10
  extra: string | null; // gêneros / plataformas
}

export function makeExternalId(source: "tmdb" | "igdb", type: MediaType, id: number | string): string {
  return source === "tmdb" ? `tmdb:${type}:${id}` : `igdb:${id}`;
}

export function parseExternalId(ext: string):
  | { source: "tmdb"; type: "movie" | "tv"; id: string }
  | { source: "igdb"; type: "game"; id: string }
  | null {
  const p = ext.split(":");
  if (p[0] === "tmdb" && (p[1] === "movie" || p[1] === "tv") && /^\d+$/.test(p[2] ?? "")) {
    return { source: "tmdb", type: p[1], id: p[2] };
  }
  if (p[0] === "igdb" && /^\d+$/.test(p[1] ?? "") && p.length === 2) return { source: "igdb", type: "game", id: p[1] };
  return null;
}

export function allowedTypes(category: "movie" | "game" | "mixed"): MediaType[] {
  if (category === "movie") return ["movie", "tv"];
  if (category === "game") return ["game"];
  return ["movie", "tv", "game"];
}
