"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LibraryStatus } from "@/lib/types";

const LABELS: Record<LibraryStatus, string> = {
  up_next: "A seguir",
  in_progress: "Em andamento",
  completed: "Concluído",
};

const DESCRIPTIONS: Record<LibraryStatus, string> = {
  up_next: "Planejado para depois",
  in_progress: "Você está jogando ou assistindo",
  completed: "Finalizado",
};

export type LibraryCandidate = {
  pollId: string;
  pollTitle: string;
  title: string;
  posterUrl: string | null;
  mediaType: "movie" | "tv" | "game";
  releaseYear: string | null;
  status: LibraryStatus | null;
};

export function LibraryManager({ items }: { items: LibraryCandidate[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function updateStatus(pollId: string, status: LibraryStatus) {
    if (busy) return;
    setBusy(pollId);
    setMessage(null);

    try {
      const response = await fetch("/api/library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId, status }),
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(json.error?.message ?? "Não foi possível atualizar a biblioteca.");
        return;
      }

      setMessage("Biblioteca atualizada.");
      router.refresh();
    } catch {
      setMessage("Falha de conexão. Tente novamente.");
    } finally {
      setBusy(null);
    }
  }

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-ink/60 p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-raise text-2xl">▣</div>
        <h3 className="mt-4 font-display text-2xl font-extrabold">Sua biblioteca começa aqui</h3>
        <p className="mx-auto mt-2 max-w-lg text-sm text-mute">
          Quando uma votação terminar com um vencedor, escolha entre <b className="text-white">A seguir</b>, <b className="text-white">Em andamento</b> ou <b className="text-white">Concluído</b>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article key={item.pollId} className="flex flex-col gap-4 rounded-2xl border border-line bg-ink p-4 sm:flex-row sm:items-center">
          {item.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.posterUrl} alt="" className="h-28 w-20 shrink-0 rounded-xl object-cover" />
          ) : (
            <div className="grid h-28 w-20 shrink-0 place-items-center rounded-xl bg-raise text-2xl">🎬</div>
          )}

          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-kick">Vencedor da votação</p>
            <h3 className="mt-1 truncate font-display text-2xl font-extrabold">{item.title}</h3>
            <p className="text-sm text-mute">
              {item.mediaType === "game" ? "Jogo" : "Filme / série"}
              {item.releaseYear ? ` · ${item.releaseYear}` : ""} · {item.pollTitle}
            </p>
            <p className="mt-2 text-xs text-mute">{item.status ? `${LABELS[item.status]} · ${DESCRIPTIONS[item.status]}` : "Ainda não categorizado"}</p>
          </div>

          <label className="sm:w-48">
            <span className="sr-only">Status de {item.title}</span>
            <select
              value={item.status ?? "up_next"}
              disabled={busy === item.pollId}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) => void updateStatus(item.pollId, event.target.value as LibraryStatus)}
              className="w-full rounded-xl border border-line bg-panel px-3 py-3 font-semibold outline-none focus:border-kick disabled:opacity-60"
            >
              {Object.entries(LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </article>
      ))}
      {message && <p className="text-sm text-mute" role="status">{message}</p>}
    </div>
  );
}
