"use client";
import { useEffect } from "react";
import { RankingBars } from "./RankingBars";
import { useLeaderFlash } from "./useLeaderFlash";
import { useCountdown, useLiveSnapshot } from "@/lib/hooks/useLiveSnapshot";
import { formatClock } from "@/lib/poll-state";
import { formatBRL } from "@/lib/scoring";
import type { SnapshotRow } from "@/lib/types";

/** Overlay para Browser Source do OBS: sem chrome, fundo transparente, tipografia grossa. */
export function OverlayBoard({ channelId, slug, initial, scale }: { channelId: string; slug: string; initial: SnapshotRow | null; scale: number }) {
  const { snap } = useLiveSnapshot(channelId, initial);
  const poll = snap?.data.poll ?? null;
  const remaining = useCountdown(poll);
  const flash = useLeaderFlash(snap?.data.ranking);

  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * scale}px`; // escala todo o layout (rem)
  }, [scale]);

  if (!snap || !poll) return null; // nada na tela quando não há rodada
  const d = snap.data;
  const winner = poll.status === "completed" ? [...d.ranking].sort((a, b) => b.total_score - a.total_score)[0] : null;

  return (
    <div className="w-[34rem] max-w-full p-4 text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,.6)" }}>
      <div className="mb-3 flex items-end justify-between gap-4 rounded-lg bg-ink/85 px-4 py-2">
        <p className="truncate font-display text-[2.25rem] font-extrabold leading-none">{poll.title}</p>
        {(poll.status === "voting" || poll.status === "paused") && (
          <p className={`font-display text-[3rem] font-extrabold leading-none tabular-nums ${poll.status === "paused" ? "text-mute" : remaining !== null && remaining <= 10 ? "text-gold" : "text-kick"}`}>
            {formatClock(remaining)}
          </p>
        )}
      </div>

      {poll.status === "collecting" && (
        <div className="rounded-lg bg-ink/85 px-4 py-3 font-display text-2xl font-extrabold">
          Sugestões abertas · streamchoice/c/{slug}
          <p className="text-lg font-semibold text-mute">{d.ranking.length} aprovados · {d.pending_count} na fila</p>
        </div>
      )}

      {poll.status === "paused" && <p className="mb-3 rounded-lg bg-ink/85 px-4 py-2 font-display text-2xl font-extrabold text-gold">Votação pausada</p>}

      {winner && winner.total_score > 0 ? (
        <div className="flex gap-4 rounded-lg border-2 border-kick bg-ink/90 p-3">
          {winner.poster_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={winner.poster_url} alt="" className="h-48 w-32 rounded object-cover" />}
          <div className="min-w-0">
            <p className="font-display text-xl font-semibold text-mute">Vencedor da rodada</p>
            <p className="font-display text-[2.75rem] font-extrabold leading-none text-kick">{winner.title}</p>
            {d.whale && <p className="mt-3 font-display text-2xl font-extrabold text-gold">Baleia: {d.whale.name} · {formatBRL(d.whale.amount)}</p>}
          </div>
        </div>
      ) : (
        d.ranking.length > 0 && poll.status !== "collecting" && <RankingBars ranking={d.ranking} poll={poll} variant="overlay" flashId={flash} />
      )}

      {poll.is_paid_voting && d.paid_count > 0 && poll.status !== "completed" && (
        <p className="mt-3 inline-block rounded-lg bg-ink/85 px-4 py-2 font-display text-2xl font-extrabold text-gold">
          {formatBRL(d.paid_total)} arrecadados · {d.paid_count} {d.paid_count === 1 ? "Pix" : "Pix"}
        </p>
      )}
    </div>
  );
}
