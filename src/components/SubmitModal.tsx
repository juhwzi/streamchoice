"use client";
import { useEffect, useRef, useState } from "react";

interface Result {
  externalId: string;
  mediaType: "movie" | "tv" | "game";
  title: string;
  year: string | null;
  posterUrl: string | null;
  overview: string | null;
  rating: number | null;
  extra: string | null;
  existing: { suggestionId: string; status: "pending" | "approved" | "rejected" } | null;
}

const LABEL = { movie: "Filme", tv: "Série", game: "Jogo" } as const;
const EXISTING_MSG = {
  pending: "Já sugerido · aguardando aprovação",
  approved: "Já aprovado · apoie votando nele!",
  rejected: "Já foi analisado e recusado nesta rodada",
} as const;

export function SubmitModal({ pollId, onClose, onDone }: { pollId: string; onClose: () => void; onDone: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Result | null>(null);
  const [why, setWhy] = useState("");
  const [sending, setSending] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Busca em tempo real com debounce e cancelamento da requisição anterior (RF05/RF06).
  useEffect(() => {
    if (picked) return;
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    const t = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/media/search?poll=${pollId}&q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? "Erro na busca");
        setResults(json.results);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, pollId, picked]);

  async function submit() {
    if (!picked) return;
    setSending(true);
    setError(null);
    const res = await fetch("/api/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pollId, externalId: picked.externalId, justification: why.trim() || undefined }),
    });
    const json = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) return setError(json.error?.message ?? "Não foi possível enviar.");
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sugerir título"
        className="flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-line bg-panel sm:max-w-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="font-display text-2xl font-extrabold">{picked ? "Confirmar sugestão" : "Sugerir um título"}</h2>
          <button onClick={onClose} className="rounded p-2 text-mute hover:text-white" aria-label="Fechar">✕</button>
        </div>

        {!picked ? (
          <div className="flex min-h-0 flex-1 flex-col p-4">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Busque um filme, série ou jogo…"
              className="w-full rounded-lg border border-line bg-ink px-4 py-3 text-lg outline-none focus:border-kick"
            />
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto" aria-live="polite">
              {loading && <p className="p-2 text-mute">Buscando…</p>}
              {error && <p className="p-2 text-red-400">{error}</p>}
              {!loading && q.trim().length >= 2 && !results.length && !error && <p className="p-2 text-mute">Nada encontrado.</p>}
              <ul className="space-y-2">
                {results.map((r) => {
                  const blocked = r.existing !== null;
                  return (
                    <li key={r.externalId}>
                      <button
                        disabled={blocked}
                        onClick={() => setPicked(r)}
                        className="flex w-full gap-3 rounded-lg border border-line bg-ink p-2 text-left enabled:hover:border-kick disabled:opacity-60"
                      >
                        {r.posterUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.posterUrl} alt="" className="h-24 w-16 shrink-0 rounded object-cover" />
                        ) : (
                          <div className="h-24 w-16 shrink-0 rounded bg-raise" />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold">{r.title} <span className="font-normal text-mute">{r.year}</span></p>
                          <p className="text-xs text-mute">
                            {LABEL[r.mediaType]}{r.rating ? ` · ★ ${r.rating}` : ""}{r.extra ? ` · ${r.extra}` : ""}
                          </p>
                          {r.overview && <p className="mt-1 line-clamp-2 text-sm text-mute">{r.overview}</p>}
                          {r.existing && <p className="mt-1 text-sm font-semibold text-gold">{EXISTING_MSG[r.existing.status]}</p>}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            <div className="flex gap-3">
              {picked.posterUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={picked.posterUrl} alt="" className="h-36 w-24 rounded object-cover" />
              )}
              <div>
                <p className="font-display text-2xl font-extrabold">{picked.title}</p>
                <p className="text-mute">{LABEL[picked.mediaType]} · {picked.year ?? "s/d"}</p>
              </div>
            </div>
            <label className="block">
              <span className="text-sm text-mute">Por que escolher este? (opcional)</span>
              <textarea
                value={why}
                maxLength={140}
                onChange={(e) => setWhy(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-line bg-ink p-3 outline-none focus:border-kick"
              />
              <span className="block text-right text-xs text-mute">{why.length}/140</span>
            </label>
            {error && <p className="text-red-400">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setPicked(null); setError(null); }} className="flex-1 rounded-lg border border-line py-3 font-semibold text-mute hover:text-white">
                Voltar
              </button>
              <button onClick={submit} disabled={sending} className="flex-1 rounded-lg bg-kick py-3 font-bold text-ink disabled:opacity-60">
                {sending ? "Enviando…" : "Enviar sugestão"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
