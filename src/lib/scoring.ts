import type { PollInfo, RankingRow } from "./types.ts";

export interface Segments {
  free: number;
  paid: number;
  total: number;
}

/** Como a barra se divide entre voto gratuito (verde Kick) e pago (dourado/esmeralda). */
export function barSegments(row: RankingRow, poll: Pick<PollInfo, "is_paid_voting" | "paid_mode">): Segments {
  let free = row.free_votes_count;
  let paid = 0;
  if (poll.is_paid_voting) {
    if (poll.paid_mode === "accumulated_value") {
      free = 0;
      paid = row.total_amount_raised;
    } else if (poll.paid_mode === "fixed_ticket") {
      free = 0;
      paid = row.total_donations_count;
    } else {
      paid = row.total_amount_raised;
    }
  }
  return { free, paid, total: free + paid };
}

/** Largura (%) da barra; garante um mínimo visível para quem já pontuou. */
export function barPercent(total: number, max: number): number {
  if (max <= 0 || total <= 0) return 0;
  return Math.min(100, Math.max(3, Math.round((total / max) * 1000) / 10));
}

export function formatBRL(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

export function scoreLabel(row: RankingRow, poll: Pick<PollInfo, "is_paid_voting" | "paid_mode">): string {
  const votos = (n: number) => `${n} ${n === 1 ? "voto" : "votos"}`;
  if (!poll.is_paid_voting) return votos(row.free_votes_count);
  if (poll.paid_mode === "accumulated_value") return formatBRL(row.total_amount_raised);
  if (poll.paid_mode === "fixed_ticket") {
    const n = row.total_donations_count;
    return `${n} ${n === 1 ? "ticket" : "tickets"}`;
  }
  return `${votos(row.free_votes_count)} + ${formatBRL(row.total_amount_raised)}`;
}

export function leaderId(ranking: RankingRow[]): string | null {
  let best: RankingRow | null = null;
  for (const r of ranking) if (!best || r.total_score > best.total_score) best = r;
  return best && best.total_score > 0 ? best.suggestion_id : null;
}

/** Mensagem a ser colada no Pix (RF15). */
export function pixMessage(title: string, tag: string): string {
  const t = title.length > 40 ? `${title.slice(0, 39)}…` : title;
  return `Voto no ${t} ${tag}`;
}
