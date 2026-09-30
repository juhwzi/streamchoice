// Prepara dados para o teste de carga: canal, rodada em votação, N usuários com cookie de sessão válido.
//   node --env-file=.env.local scripts/seed-load.mjs            → cria e grava load/fixtures.json
//   node --env-file=.env.local scripts/seed-load.mjs --cleanup  → remove tudo que começa com "load-"
// Use um projeto Supabase de STAGING. Nunca rode em produção.
import { createClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const { NEXT_PUBLIC_SUPABASE_URL: URL_, SUPABASE_SERVICE_ROLE_KEY: KEY, SESSION_SECRET } = process.env;
if (!URL_ || !KEY || !SESSION_SECRET) throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SESSION_SECRET");
const db = createClient(URL_, KEY, { auth: { persistSession: false } });
const N = Number(process.env.N_USERS ?? 5000);
const N_LAT = 100; // usuários reservados ao teste de latência do Realtime

if (process.argv.includes("--cleanup")) {
  await db.from("channels").delete().like("kick_channel_slug", "load-%"); // cascata: polls, votos, snapshots
  await db.from("users").delete().like("kick_user_id", "load-%");
  console.log("limpo");
  process.exit(0);
}

const key = new TextEncoder().encode(SESSION_SECRET);
const sign = (uid, name) =>
  new SignJWT({ uid, kid: `load-${name}`, name }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("12h").sign(key);

const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };

const streamer = must(await db.from("users").upsert({ kick_user_id: "load-streamer", username: "load-streamer" }, { onConflict: "kick_user_id" }).select("id").single(), "streamer");
const slug = `load-${Date.now().toString(36)}`;
const secret = randomBytes(24).toString("hex");
const channel = must(await db.from("channels").insert({ owner_id: streamer.id, kick_channel_slug: slug, livepix_url: "https://livepix.gg/load", livepix_webhook_secret: secret }).select("id").single(), "canal");
const poll = must(await db.from("polls").insert({ channel_id: channel.id, title: "Teste de carga", category_type: "movie", is_paid_voting: true, paid_mode: "hybrid", min_donation_amount: 1 }).select("id").single(), "rodada");

const titles = ["Alien", "Predator", "Matrix", "Blade Runner"];
const sugs = must(await db.from("suggestions").insert(
  titles.map((t, i) => ({ poll_id: poll.id, suggested_by: streamer.id, external_media_id: `tmdb:movie:${9000 + i}`, media_type: "movie", title: t, status: "approved" })),
).select("id, vote_tag"), "sugestões");

const rows = Array.from({ length: N + N_LAT }, (_, i) => ({ kick_user_id: `load-u-${i}`, username: `load-u-${i}` }));
const ids = [];
for (let i = 0; i < rows.length; i += 500) {
  ids.push(...must(await db.from("users").upsert(rows.slice(i, i + 500), { onConflict: "kick_user_id" }).select("id, username"), "usuários"));
}
ids.sort((a, b) => Number(a.username.split("-")[2]) - Number(b.username.split("-")[2]));
const tokens = await Promise.all(ids.map((u) => sign(u.id, u.username.replace("load-", ""))));

const r = await db.rpc("poll_action", { p_poll_id: poll.id, p_action: "start_voting", p_seconds: 1800 });
if (r.data !== "ok") throw new Error(`start_voting: ${r.data ?? r.error?.message}`);

writeFileSync("load/fixtures.json", JSON.stringify({
  slug, channelId: channel.id, pollId: poll.id, webhookSecret: secret,
  suggestionIds: sugs.map((s) => s.id), tags: sugs.map((s) => s.vote_tag),
  tokens: tokens.slice(0, N), latencyTokens: tokens.slice(N),
}));
console.log(`ok: ${N} usuários (+${N_LAT} p/ latência), canal ${slug}, rodada em votação por 30 min → load/fixtures.json`);
