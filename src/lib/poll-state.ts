import type { PollInfo, SnapshotRow } from "./types.ts";

/** Segundos restantes usando o relógio do servidor (offset = serverNow − clientNow). */
export function remainingSeconds(
  poll: Pick<PollInfo, "status" | "ends_at" | "paused_remaining_seconds">,
  offsetMs: number,
  nowMs: number,
): number | null {
  if (poll.status === "paused") return poll.paused_remaining_seconds ?? 0;
  if (poll.status !== "voting" || !poll.ends_at) return null;
  return Math.max(0, Math.ceil((Date.parse(poll.ends_at) - (nowMs + offsetMs)) / 1000));
}

export function formatClock(sec: number | null): string {
  if (sec === null) return "--:--";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Decide qual snapshot do canal exibir: a rodada mais nova vence; na mesma rodada, o update mais novo. */
export function pickNewer(cur: SnapshotRow | null, next: SnapshotRow): SnapshotRow {
  if (!cur) return next;
  if (cur.poll_id === next.poll_id) {
    return Date.parse(next.updated_at) >= Date.parse(cur.updated_at) ? next : cur;
  }
  return Date.parse(next.poll_created_at) > Date.parse(cur.poll_created_at) ? next : cur;
}

/** Estimativa NTP-lite: entre várias amostras (offset, rtt) usa a de menor RTT. */
export function bestOffset(samples: { offset: number; rtt: number }[]): number {
  if (!samples.length) return 0;
  return samples.reduce((a, b) => (b.rtt < a.rtt ? b : a)).offset;
}
