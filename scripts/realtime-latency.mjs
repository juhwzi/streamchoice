// Mede RNF01: tempo entre o commit do voto no banco e o evento chegar a um cliente via WebSocket.
//   node --env-file=.env.local scripts/realtime-latency.mjs [BASE_URL]
// Requer load/fixtures.json (gerado por seed-load.mjs). Rode ANTES do spike, ou com usuários não usados.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const fx = JSON.parse(readFileSync("load/fixtures.json", "utf8"));
const BASE = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3000";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const VOTES = Math.min(60, fx.latencyTokens.length);

let waiter = null;
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("timeout ao assinar o canal")), 10_000);
  sb.channel("lat").on("postgres_changes", { event: "*", schema: "public", table: "poll_snapshots", filter: `channel_id=eq.${fx.channelId}` },
    (p) => waiter?.(p)).subscribe((s) => { if (s === "SUBSCRIBED") { clearTimeout(t); resolve(); } });
});

const e2e = [], commit = [];
let target = null;
for (let i = 0; i < VOTES; i++) {
  const got = new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error(`sem evento para o voto ${i}`)), 4000);
    waiter = (p) => { const recv = Date.now(); clearTimeout(to); res({ recv, commitTs: Date.parse(p.commit_timestamp), total: p.new?.data?.free_votes_total }); };
  });
  const sent = Date.now();
  const r = await fetch(`${BASE}/api/votes`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: `sc_session=${fx.latencyTokens[i]}` },
    body: JSON.stringify({ pollId: fx.pollId, suggestionId: fx.suggestionIds[i % fx.suggestionIds.length] }),
  });
  if (!r.ok) throw new Error(`voto ${i} falhou: ${r.status} ${await r.text()}`);
  const ev = await got;
  e2e.push(ev.recv - sent);
  if (!Number.isNaN(ev.commitTs)) commit.push(ev.recv - ev.commitTs);
  await new Promise((r) => setTimeout(r, 150));
}
const q = (a, p) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];
const line = (n, a) => `${n.padEnd(34)} p50=${q(a, .5)}ms  p95=${q(a, .95)}ms  p99=${q(a, .99)}ms  max=${Math.max(...a)}ms`;
console.log(line("clique → tela (HTTP + DB + WS)", e2e));
if (commit.length) console.log(line("commit no banco → tela (RNF01)", commit));
const p95 = commit.length ? q(commit, .95) : q(e2e, .95);
console.log(p95 < 300 ? `✔ RNF01 atendido (p95 ${p95}ms < 300ms)` : `✘ RNF01 NÃO atendido (p95 ${p95}ms)`);
console.log("Obs.: commit→tela depende de relógios sincronizados (NTP) entre esta máquina e o Supabase.");
process.exit(p95 < 300 ? 0 : 1);
