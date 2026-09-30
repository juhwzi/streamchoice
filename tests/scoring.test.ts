import test from "node:test";
import assert from "node:assert/strict";
import { barPercent, barSegments, leaderId, pixMessage, scoreLabel } from "../src/lib/scoring.ts";
import { bestOffset, formatClock, pickNewer, remainingSeconds } from "../src/lib/poll-state.ts";
import { allowedTypes, makeExternalId, parseExternalId } from "../src/lib/media/types.ts";
import type { RankingRow, SnapshotRow } from "../src/lib/types.ts";

const row = (o: Partial<RankingRow> = {}): RankingRow => ({
  suggestion_id: "s1", poll_id: "p", title: "Alien", poster_url: null, media_type: "movie",
  vote_tag: "#VOTO-100", release_year: "1979", free_votes_count: 10, total_amount_raised: 20,
  total_donations_count: 3, total_score: 0, ...o,
});

test("segmentos da barra por modo", () => {
  assert.deepEqual(barSegments(row(), { is_paid_voting: false, paid_mode: "hybrid" }), { free: 10, paid: 0, total: 10 });
  assert.deepEqual(barSegments(row(), { is_paid_voting: true, paid_mode: "accumulated_value" }), { free: 0, paid: 20, total: 20 });
  assert.deepEqual(barSegments(row(), { is_paid_voting: true, paid_mode: "fixed_ticket" }), { free: 0, paid: 3, total: 3 });
  assert.deepEqual(barSegments(row(), { is_paid_voting: true, paid_mode: "hybrid" }), { free: 10, paid: 20, total: 30 });
});

test("barPercent: mínimo visível e teto", () => {
  assert.equal(barPercent(0, 10), 0);
  assert.equal(barPercent(1, 1000), 3);
  assert.equal(barPercent(10, 10), 100);
  assert.equal(barPercent(5, 0), 0);
});

test("scoreLabel e liderança", () => {
  assert.equal(scoreLabel(row({ free_votes_count: 1 }), { is_paid_voting: false, paid_mode: "hybrid" }), "1 voto");
  assert.match(scoreLabel(row(), { is_paid_voting: true, paid_mode: "accumulated_value" }), /R\$\s?20,00/);
  assert.equal(leaderId([row({ suggestion_id: "a", total_score: 0 })]), null);
  assert.equal(leaderId([row({ suggestion_id: "a", total_score: 1 }), row({ suggestion_id: "b", total_score: 3 })]), "b");
});

test("pixMessage trunca títulos longos e mantém a tag", () => {
  const m = pixMessage("A".repeat(100), "#VOTO-104");
  assert.ok(m.endsWith("#VOTO-104"));
  assert.ok(m.length < 70);
});

test("contagem regressiva usa o offset do servidor e respeita pausa", () => {
  const ends = new Date(10_000).toISOString();
  assert.equal(remainingSeconds({ status: "voting", ends_at: ends, paused_remaining_seconds: null }, 0, 4_000), 6);
  assert.equal(remainingSeconds({ status: "voting", ends_at: ends, paused_remaining_seconds: null }, 2_000, 4_000), 4);
  assert.equal(remainingSeconds({ status: "voting", ends_at: ends, paused_remaining_seconds: null }, 0, 99_000), 0);
  assert.equal(remainingSeconds({ status: "paused", ends_at: null, paused_remaining_seconds: 42 }, 0, 0), 42);
  assert.equal(remainingSeconds({ status: "collecting", ends_at: null, paused_remaining_seconds: null }, 0, 0), null);
  assert.equal(formatClock(65), "01:05");
  assert.equal(formatClock(3661), "1:01:01");
  assert.equal(formatClock(null), "--:--");
});

test("pickNewer: rodada mais nova vence; mesma rodada, update mais novo", () => {
  const mk = (poll_id: string, created: number, upd: number): SnapshotRow => ({
    poll_id, channel_id: "c", poll_created_at: new Date(created).toISOString(),
    updated_at: new Date(upd).toISOString(), data: {} as never,
  });
  const a = mk("A", 100, 500);
  assert.equal(pickNewer(null, a), a);
  assert.equal(pickNewer(a, mk("A", 100, 400)), a);
  assert.equal(pickNewer(a, mk("A", 100, 600)).updated_at, new Date(600).toISOString());
  assert.equal(pickNewer(a, mk("B", 200, 1)).poll_id, "B");
  assert.equal(pickNewer(a, mk("Z", 50, 9999)).poll_id, "A");
});

test("bestOffset escolhe a amostra de menor RTT", () => {
  assert.equal(bestOffset([{ offset: 10, rtt: 200 }, { offset: 3, rtt: 40 }]), 3);
  assert.equal(bestOffset([]), 0);
});

test("IDs externos não colidem entre filme e série", () => {
  assert.notEqual(makeExternalId("tmdb", "movie", 550), makeExternalId("tmdb", "tv", 550));
  assert.deepEqual(parseExternalId("tmdb:tv:1399"), { source: "tmdb", type: "tv", id: "1399" });
  assert.deepEqual(parseExternalId("igdb:1942"), { source: "igdb", type: "game", id: "1942" });
  assert.equal(parseExternalId("tmdb:person:1"), null);
  assert.equal(parseExternalId("lixo"), null);
  assert.deepEqual(allowedTypes("movie"), ["movie", "tv"]);
});
