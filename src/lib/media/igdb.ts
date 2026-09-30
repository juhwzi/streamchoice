import { env } from "../env";
import { makeExternalId, type MediaResult } from "./types";

interface IgdbGame {
  id: number;
  name: string;
  summary?: string;
  first_release_date?: number;
  total_rating?: number;
  cover?: { image_id: string };
  genres?: { name: string }[];
  platforms?: { abbreviation?: string; name?: string }[];
}

let token: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const u = new URL("https://id.twitch.tv/oauth2/token");
  u.searchParams.set("client_id", env("TWITCH_CLIENT_ID"));
  u.searchParams.set("client_secret", env("TWITCH_CLIENT_SECRET"));
  u.searchParams.set("grant_type", "client_credentials");
  const res = await fetch(u, { method: "POST", cache: "no-store" });
  if (!res.ok) throw new Error(`Twitch OAuth respondeu ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return token.value;
}

const FIELDS =
  "name,summary,first_release_date,total_rating,cover.image_id,genres.name,platforms.abbreviation,platforms.name";

async function query(body: string): Promise<IgdbGame[]> {
  const res = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: { "Client-ID": env("TWITCH_CLIENT_ID"), Authorization: `Bearer ${await getToken()}`, Accept: "application/json" },
    body,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`IGDB respondeu ${res.status}`);
  return (await res.json()) as IgdbGame[];
}

function map(g: IgdbGame): MediaResult {
  const summary = g.summary?.trim() || null;
  const plats = (g.platforms ?? []).map((p) => p.abbreviation ?? p.name).filter(Boolean).slice(0, 4).join(", ");
  const genres = (g.genres ?? []).map((x) => x.name).slice(0, 2).join(", ");
  return {
    externalId: makeExternalId("igdb", "game", g.id),
    mediaType: "game",
    title: g.name,
    year: g.first_release_date ? String(new Date(g.first_release_date * 1000).getUTCFullYear()) : null,
    posterUrl: g.cover ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg` : null,
    overview: summary && summary.length > 180 ? `${summary.slice(0, 177)}…` : summary,
    rating: g.total_rating ? Math.round(g.total_rating) / 10 : null,
    extra: [genres, plats].filter(Boolean).join(" · ") || null,
  };
}

const esc = (s: string) => s.replace(/["\\]/g, " ").trim();

export async function searchIgdb(q: string): Promise<MediaResult[]> {
  const games = await query(`search "${esc(q)}"; fields ${FIELDS}; where version_parent = null; limit 8;`);
  return games.map(map);
}

export async function getIgdbById(id: string): Promise<MediaResult | null> {
  if (!/^\d+$/.test(id)) return null;
  const games = await query(`fields ${FIELDS}; where id = ${id}; limit 1;`);
  return games[0] ? map(games[0]) : null;
}
