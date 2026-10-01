"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { bestOffset, pickNewer, remainingSeconds } from "@/lib/poll-state";
import type { PollInfo, SnapshotRow } from "@/lib/types";

const COLS = "poll_id, channel_id, poll_created_at, updated_at, data";

/**
 * Assina o canal de Realtime (WebSocket) do Supabase. Cada mudança de voto/Pix/sugestão/estado
 * regrava a linha de poll_snapshots (via trigger) e chega aqui já com o ranking pronto (RF19, RNF01).
 * Rede de segurança: se o socket cair, refaz a leitura por HTTP a cada 10s até reconectar.
 */
export function useLiveSnapshot(channelId: string, initial: SnapshotRow | null, pinnedPollId: string | null = null) {
  const [snap, setSnap] = useState<SnapshotRow | null>(initial);
  const [connected, setConnected] = useState(false);
  const connectedRef = useRef(false);

  useEffect(() => {
    setSnap(initial);
  }, [channelId, pinnedPollId, initial?.poll_id]);

  const accept = useCallback((row: SnapshotRow) => setSnap((cur) => pickNewer(cur, row)), []);

  const refetch = useCallback(async () => {
    let query = getBrowserSupabase()
      .from("poll_snapshots")
      .select(COLS)
      .eq("channel_id", channelId);

    if (pinnedPollId) {
      query = query.eq("poll_id", pinnedPollId);
    } else {
      query = query.order("poll_created_at", { ascending: false }).limit(1);
    }

    const { data } = await query.maybeSingle();
    if (data) accept(data as unknown as SnapshotRow);
  }, [channelId, accept, pinnedPollId]);

  useEffect(() => {
    const sb = getBrowserSupabase();
    const ch = sb
      .channel(`snap:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "poll_snapshots",
          filter: pinnedPollId ? `poll_id=eq.${pinnedPollId}` : `channel_id=eq.${channelId}`,
        },
        (payload) => {
          if (payload.new && "data" in payload.new) accept(payload.new as unknown as SnapshotRow);
        },
      )
      .subscribe((status) => {
        const ok = status === "SUBSCRIBED";
        connectedRef.current = ok;
        setConnected(ok);
        if (ok) void refetch(); // cobre eventos perdidos durante a (re)conexão
      });
    const timer = setInterval(() => {
      if (!connectedRef.current) void refetch();
    }, 10_000);
    return () => {
      clearInterval(timer);
      void sb.removeChannel(ch);
    };
  }, [channelId, accept, refetch, pinnedPollId]);

  return { snap, connected };
}

/** Offset relógio-servidor − relógio-cliente (RF12), estimado NTP-lite via /api/time. */
export function useServerOffset(): number {
  const [offset, setOffset] = useState(0);
  const samples = useRef<{ offset: number; rtt: number }[]>([]);

  useEffect(() => {
    let alive = true;
    const sample = async () => {
      const t0 = Date.now();
      try {
        const r = await fetch("/api/time", { cache: "no-store" });
        const { now } = (await r.json()) as { now: number };
        const t1 = Date.now();
        samples.current = [...samples.current.slice(-5), { offset: now - (t0 + t1) / 2, rtt: t1 - t0 }];
        if (alive) setOffset(bestOffset(samples.current));
      } catch {
        /* mantém a última estimativa */
      }
    };
    void sample();
    const a = setTimeout(sample, 1500);
    const b = setInterval(sample, 60_000);
    return () => {
      alive = false;
      clearTimeout(a);
      clearInterval(b);
    };
  }, []);

  return offset;
}

/** Tick de relógio para a contagem regressiva. */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Contagem regressiva + disparo idempotente do encerramento automático ao chegar em zero. */
export function useCountdown(poll: PollInfo | null) {
  const offset = useServerOffset();
  const now = useNow();
  const remaining = poll ? remainingSeconds(poll, offset, now) : null;
  const tries = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!poll || poll.status !== "voting" || remaining !== 0) return;
    const n = tries.current[poll.id] ?? 0;
    if (n >= 5) return;
    tries.current[poll.id] = n + 1;
    // jitter para não gerar rajada de finalize quando milhares de clientes zeram juntos
    const t = setTimeout(() => void fetch(`/api/polls/${poll.id}/finalize`, { method: "POST" }), Math.random() * 1200 + n * 2000);
    return () => clearTimeout(t);
  }, [poll, remaining]);

  return remaining;
}
