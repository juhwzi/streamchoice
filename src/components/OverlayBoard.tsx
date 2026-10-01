"use client";

import { useEffect } from "react";
import { useCountdown, useLiveSnapshot } from "@/lib/hooks/useLiveSnapshot";
import { formatClock } from "@/lib/poll-state";
import type { RankingRow, SnapshotRow } from "@/lib/types";

export function OverlayBoard({
  channelId,
  initial,
  scale,
  pinnedPollId = null,
}: {
  channelId: string;
  initial: SnapshotRow | null;
  scale: number;
  pinnedPollId?: string | null;
}) {
  const { snap } = useLiveSnapshot(channelId, initial, pinnedPollId);
  const poll = snap?.data.poll ?? null;
  const remaining = useCountdown(poll);

  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * scale}px`;
    return () => {
      document.documentElement.style.fontSize = "16px";
    };
  }, [scale]);

  if (!snap || !poll) return null;

  const ranking = [...(snap.data.ranking ?? [])]
    .sort((a, b) => b.total_score - a.total_score || a.title.localeCompare(b.title))
    .slice(0, 3);
  const max = Math.max(1, ...ranking.map((row) => Number(row.total_score ?? 0)));
  const winner = poll.status === "completed" ? ranking[0] : null;

  return (
    <div className="w-[18rem] max-w-[calc(100vw-1rem)] p-1.5 text-white" style={{ textShadow: "0 1px 4px rgba(0,0,0,.75)" }}>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0B0E0F]/90 shadow-xl shadow-black/40 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-kick shadow-[0_0_10px_rgba(83,252,24,.9)]" />
            <span className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-white/60">StreamChoice</span>
          </div>
          {poll.status === "voting" || poll.status === "paused" ? (
            <span className={`font-display text-base font-extrabold tabular-nums ${poll.status === "paused" ? "text-white/50" : remaining !== null && remaining <= 10 ? "text-gold" : "text-kick"}`}>
              {formatClock(remaining)}
            </span>
          ) : null}
        </div>

        <div className="px-3 pb-2.5 pt-2">
          <p className="truncate font-display text-[0.98rem] font-extrabold leading-tight">{poll.title}</p>

          {winner && winner.total_score > 0 ? (
            <WinnerCard winner={winner} />
          ) : ranking.length ? (
            <div className="mt-2.5 space-y-1.5">
              {ranking.map((row, index) => (
                <CompactRow key={row.suggestion_id} row={row} position={index + 1} max={max} />
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-[0.68rem] text-white/60">Aguardando opções aprovadas.</p>
          )}

          <div className="mt-2.5 flex items-center justify-between text-[0.6rem] text-white/45">
            <span>{poll.status === "collecting" ? "Sugestões abertas" : poll.status === "paused" ? "Votação pausada" : poll.status === "completed" ? "Resultado final" : "Votação em andamento"}</span>
            {snap.data.free_votes_total > 0 && <span>{snap.data.free_votes_total} votos</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function CompactRow({ row, position, max }: { row: RankingRow; position: number; max: number }) {
  const percent = Math.max(3, Math.min(100, (Number(row.total_score ?? 0) / max) * 100));
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.045] px-2.5 py-2">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/5 font-display text-sm font-extrabold text-white/55">{position}</span>
      {row.poster_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.poster_url} alt="" className="h-9 w-6 shrink-0 rounded object-cover" />
      ) : <div className="h-9 w-6 shrink-0 rounded bg-white/5" />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[0.78rem] font-semibold">{row.title}</span>
          <span className="shrink-0 text-[0.62rem] font-bold text-white/55">{Math.round(percent)}%</span>
        </div>
        <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-white/5">
          <div className="bar-fill h-full rounded-full bg-kick" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
}

function WinnerCard({ winner }: { winner: RankingRow }) {
  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl border border-kick/30 bg-kick/5 p-2.5">
      {winner.poster_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={winner.poster_url} alt="" className="h-12 w-8 shrink-0 rounded object-cover" />
      ) : <div className="h-12 w-8 shrink-0 rounded bg-white/5" />}
      <div className="min-w-0">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.15em] text-kick">Vencedor</p>
        <p className="truncate font-display text-base font-extrabold">{winner.title}</p>
      </div>
    </div>
  );
}
