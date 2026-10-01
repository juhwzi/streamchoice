"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CreatePollForm } from "./CreatePollForm";
import { RankingBars } from "./RankingBars";
import { useCountdown, useLiveSnapshot } from "@/lib/hooks/useLiveSnapshot";
import { formatClock } from "@/lib/poll-state";
import { formatBRL } from "@/lib/scoring";
import type { SnapshotRow } from "@/lib/types";

interface Pending {
  id: string; title: string; poster_url: string | null; release_year: string | null; media_type: string;
  justification: string | null; vote_tag: string; suggested_by_name: string; created_at: string;
}

export function ModPanel({ channel, initial, role, pixReady, pinnedPollId = null }: {
  channel: { id: string; slug: string }; initial: SnapshotRow | null; role: "ADMIN" | "STREAMER" | "MODERATOR"; pixReady: boolean; pinnedPollId?: string | null;
}) {
  const { snap, connected } = useLiveSnapshot(channel.id, initial, pinnedPollId);
  const poll = snap?.data.poll ?? null;
  const remaining = useCountdown(poll);
  const [queue, setQueue] = useState<Pending[]>([]);
  const [cursor, setCursor] = useState(0);
  const [minutes, setMinutes] = useState(5);
  const [msg, setMsg] = useState<string | null>(null);
  const busy = useRef(false);

  const loadQueue = useCallback(async () => {
    if (!poll) return setQueue([]);
    const res = await fetch(`/api/polls/${poll.id}/pending`, { cache: "no-store" });
    if (res.ok) setQueue((await res.json()).items);
  }, [poll?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: qualquer mudança no snapshot (nova sugestão, etc.) atualiza a contagem; se mudou, recarrega a fila.
  const pendingCount = snap?.data.pending_count;
  useEffect(() => { void loadQueue(); }, [loadQueue, pendingCount]);
  useEffect(() => { setCursor((c) => Math.min(c, Math.max(0, queue.length - 1))); }, [queue.length]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3000); };

  const curate = useCallback(async (action: "approve" | "reject") => {
    const item = queue[cursor];
    if (!item || busy.current) return;
    busy.current = true;
    setQueue((q) => q.filter((x) => x.id !== item.id)); // otimista
    const res = await fetch(`/api/suggestions/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    busy.current = false;
    if (!res.ok) { flash((await res.json().catch(() => ({}))).error?.message ?? "Falha"); void loadQueue(); }
  }, [queue, cursor, loadQueue]);

  const act = useCallback(async (action: string, seconds?: number) => {
    if (!poll) return;
    const res = await fetch(`/api/polls/${poll.id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, seconds }) });
    if (!res.ok) flash((await res.json().catch(() => ({}))).error?.message ?? "Falha");
  }, [poll]);

  const toggle = useCallback(() => {
    if (!poll) return;
    if (poll.status === "collecting") void act("start_voting", minutes * 60);
    else if (poll.status === "voting") void act("pause");
    else if (poll.status === "paused") void act("resume");
  }, [poll, act, minutes]);

  // Atalhos: A aprovar · R rejeitar · Espaço pausar/iniciar · J/K ou setas navegam.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, button, [contenteditable]")) return;
      const k = e.key.toLowerCase();
      if (k === "a") void curate("approve");
      else if (k === "r") void curate("reject");
      else if (k === " ") { e.preventDefault(); toggle(); }
      else if (k === "j" || k === "arrowdown") setCursor((c) => Math.min(c + 1, queue.length - 1));
      else if (k === "k" || k === "arrowup") setCursor((c) => Math.max(c - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [curate, toggle, queue.length]);

  if (!poll || poll.status === "completed") {
    return (
      <div className="mx-auto max-w-xl py-8">
        {poll && <p className="mb-4 rounded-lg border border-line bg-panel p-3 text-mute">Última rodada “{poll.title}” encerrada.</p>}
        <CreatePollForm slug={channel.slug} pixReady={pixReady} onCreated={() => location.reload()} />
      </div>
    );
  }

  const d = snap!.data;
  const btn = "min-h-11 rounded-lg px-4 font-semibold";
  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel p-4">
          <div>
            <p className="font-display text-3xl font-extrabold leading-none">{poll.title}</p>
            <p className="mt-1 text-sm text-mute">{{ collecting: "Coletando", voting: "Votando", paused: "Pausada", completed: "" }[poll.status]}{connected ? " · ao vivo" : " · reconectando…"}</p>
          </div>
          <p className="font-display text-5xl font-extrabold tabular-nums text-kick">{formatClock(remaining)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel p-3">
          {poll.status === "collecting" && (
            <>
              <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="min-h-11 rounded-lg border border-line bg-ink px-3">
                {[1, 3, 5, 10, 15].map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
              <button onClick={toggle} className={`${btn} bg-kick text-ink`}>Abrir votação <kbd className="ml-1 text-xs opacity-70">Espaço</kbd></button>
            </>
          )}
          {poll.status === "voting" && <button onClick={toggle} className={`${btn} bg-gold text-ink`}>Pausar <kbd className="ml-1 text-xs opacity-70">Espaço</kbd></button>}
          {poll.status === "paused" && <button onClick={toggle} className={`${btn} bg-kick text-ink`}>Retomar <kbd className="ml-1 text-xs opacity-70">Espaço</kbd></button>}
          {(poll.status === "voting" || poll.status === "paused") && (
            <>
              <button onClick={() => act("extend", 60)} className={`${btn} border border-line`}>+1 min</button>
              <button onClick={() => act("extend", 180)} className={`${btn} border border-line`}>+3 min</button>
            </>
          )}
          <button onClick={() => confirm("Encerrar a rodada agora?") && act("complete")} className={`${btn} ml-auto border border-red-500/60 text-red-300`}>Encerrar</button>
        </div>
        {msg && <p role="status" className="rounded-lg bg-raise px-4 py-2 text-gold">{msg}</p>}

        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Votos grátis" value={String(d.free_votes_total)} tone="text-kick" />
          <Stat label="Pix" value={poll.is_paid_voting ? `${d.paid_count}` : "—"} tone="text-gold" />
          <Stat label="Arrecadado" value={poll.is_paid_voting ? formatBRL(d.paid_total) : "—"} tone="text-emerald" />
        </div>

        <RankingBars ranking={d.ranking} poll={poll} variant="room" />
      </section>

      <section className="rounded-xl border border-line bg-panel p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-extrabold">Fila de curadoria</h2>
          <span className="text-sm text-mute">{queue.length} pendente(s) · <kbd>A</kbd> aprova · <kbd>R</kbd> rejeita · <kbd>J/K</kbd> navega</span>
        </div>
        {poll.status !== "collecting" && <p className="mt-3 text-sm text-gold">A curadoria fica travada depois que a votação abre.</p>}
        <ul className="mt-3 space-y-2">
          {queue.map((it, i) => (
            <li key={it.id} onClick={() => setCursor(i)} className={`flex cursor-pointer gap-3 rounded-lg border p-2 ${i === cursor ? "border-kick bg-raise" : "border-line bg-ink"}`}>
              {it.poster_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={it.poster_url} alt="" className="h-24 w-16 shrink-0 rounded object-cover" /> : <div className="h-24 w-16 rounded bg-raise" />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{it.title} <span className="font-normal text-mute">{it.release_year}</span></p>
                <p className="text-xs text-mute">por {it.suggested_by_name} · {it.media_type}</p>
                {it.justification && <p className="mt-1 text-sm">“{it.justification}”</p>}
                {i === cursor && poll.status === "collecting" && (
                  <div className="mt-2 flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); void curate("approve"); }} className="min-h-10 rounded-md bg-kick px-4 font-bold text-ink">Aprovar</button>
                    <button onClick={(e) => { e.stopPropagation(); void curate("reject"); }} className="min-h-10 rounded-md border border-red-500/60 px-4 text-red-300">Rejeitar</button>
                  </div>
                )}
              </div>
            </li>
          ))}
          {!queue.length && <li className="rounded-lg border border-dashed border-line p-6 text-center text-mute">Fila vazia.</li>}
        </ul>
      </section>
      {role === "STREAMER" && <span className="sr-only">Streamer</span>}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-3">
      <p className={`font-display text-3xl font-extrabold tabular-nums ${tone}`}>{value}</p>
      <p className="text-xs text-mute">{label}</p>
    </div>
  );
}
