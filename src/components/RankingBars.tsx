"use client";
import type { ReactNode } from "react";
import { barPercent, barSegments, scoreLabel } from "@/lib/scoring";
import type { PollInfo, RankingRow } from "@/lib/types";

interface Props {
  ranking: RankingRow[];
  poll: PollInfo;
  variant: "overlay" | "room";
  flashId?: string | null;
  highlightId?: string | null; // voto do próprio usuário
  renderAction?: (row: RankingRow) => ReactNode;
}

/** Barras dinâmicas: verde Kick = votos gratuitos, dourado/esmeralda = dinheiro (UI/UX §1). */
export function RankingBars({ ranking, poll, variant, flashId, highlightId, renderAction }: Props) {
  const rows = [...ranking].sort((a, b) => b.total_score - a.total_score || a.title.localeCompare(b.title));
  const segs = new Map(rows.map((r) => [r.suggestion_id, barSegments(r, poll)]));
  const max = Math.max(0, ...[...segs.values()].map((s) => s.total));
  const big = variant === "overlay";

  return (
    <ul className={big ? "space-y-3" : "space-y-3"}>
      {rows.map((r, i) => {
        const sg = segs.get(r.suggestion_id)!;
        const pct = barPercent(sg.total, max);
        const freeShare = sg.total > 0 ? (sg.free / sg.total) * 100 : 0;
        const paidColor = poll.paid_mode === "hybrid" ? "bg-gold" : "bg-emerald";
        return (
          <li
            key={r.suggestion_id}
            className={`rounded-lg border bg-panel/90 p-2 ${flashId === r.suggestion_id ? "lead-flash" : ""} ${
              highlightId === r.suggestion_id ? "border-kick" : "border-line"
            }`}
          >
            <div className="flex items-center gap-3">
              {r.poster_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.poster_url}
                  alt=""
                  className={`${big ? "h-20 w-14" : "h-16 w-11"} shrink-0 rounded object-cover`}
                  loading="lazy"
                />
              ) : (
                <div className={`${big ? "h-20 w-14" : "h-16 w-11"} shrink-0 rounded bg-raise`} />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className={`truncate font-display font-extrabold leading-none ${big ? "text-[2rem]" : "text-2xl"}`}>
                    <span className="mr-2 text-mute">{i + 1}</span>
                    {r.title}
                    {r.release_year && <span className="ml-2 text-base font-semibold text-mute">{r.release_year}</span>}
                  </p>
                  <p className={`shrink-0 font-display font-extrabold tabular-nums ${big ? "text-[1.75rem]" : "text-xl"} ${sg.paid > 0 && sg.free === 0 ? (poll.paid_mode === "hybrid" ? "text-gold" : "text-emerald") : "text-kick"}`}>
                    {scoreLabel(r, poll)}
                  </p>
                </div>
                <div className={`mt-2 overflow-hidden rounded-full bg-raise ${big ? "h-5" : "h-3"}`} role="img" aria-label={`${r.title}: ${scoreLabel(r, poll)}`}>
                  <div className="bar-fill flex h-full" style={{ width: `${pct}%` }}>
                    <div className="bar-fill h-full bg-kick" style={{ width: `${freeShare}%` }} />
                    <div className={`bar-fill h-full ${paidColor}`} style={{ width: `${100 - freeShare}%` }} />
                  </div>
                </div>
                {!big && <p className="mt-1 text-xs text-mute">{r.vote_tag}</p>}
              </div>
              {renderAction && <div className="shrink-0">{renderAction(r)}</div>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
