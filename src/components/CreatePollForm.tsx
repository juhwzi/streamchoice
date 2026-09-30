"use client";
import { useState } from "react";

export function CreatePollForm({ slug, pixReady, onCreated }: { slug: string; pixReady: boolean; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [cat, setCat] = useState<"movie" | "game" | "mixed">("movie");
  const [paid, setPaid] = useState(false);
  const [paidMode, setPaidMode] = useState<"accumulated_value" | "fixed_ticket" | "hybrid">("hybrid");
  const [min, setMin] = useState("5");
  const [maxSug, setMaxSug] = useState("3");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelSlug: slug, title, categoryType: cat, isPaidVoting: paid, paidMode,
        minDonationAmount: Number(min.replace(",", ".")) || 1, maxSuggestionsPerUser: Number(maxSug) || 3,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(json.error?.message ?? "Erro ao criar.");
    onCreated();
  }

  const field = "mt-1 w-full rounded-lg border border-line bg-ink px-3 py-2 outline-none focus:border-kick";
  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-line bg-panel p-5">
      <h2 className="font-display text-3xl font-extrabold">Nova rodada</h2>
      <label className="block text-sm text-mute">Título
        <input required minLength={3} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="O que vamos assistir hoje?" className={field} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm text-mute">Categoria
          <select value={cat} onChange={(e) => setCat(e.target.value as typeof cat)} className={field}>
            <option value="movie">Filmes e séries</option><option value="game">Jogos</option><option value="mixed">Misto</option>
          </select>
        </label>
        <label className="block text-sm text-mute">Modo
          <select className={field} defaultValue="multiple_choice"><option value="multiple_choice">Múltipla escolha</option><option disabled>Mata-mata (em breve)</option></select>
        </label>
      </div>
      <label className="block text-sm text-mute">Sugestões por pessoa
        <input type="number" min={1} max={20} value={maxSug} onChange={(e) => setMaxSug(e.target.value)} className={field} />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={paid} disabled={!pixReady} onChange={(e) => setPaid(e.target.checked)} />
        <span>Habilitar votos por Pix {!pixReady && <span className="text-sm text-gold">(o streamer precisa configurar o Livepix)</span>}</span>
      </label>
      {paid && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm text-mute">Formato
            <select value={paidMode} onChange={(e) => setPaidMode(e.target.value as typeof paidMode)} className={field}>
              <option value="hybrid">Híbrido (grátis + Pix Boost)</option>
              <option value="accumulated_value">Pote acumulado (R$ 1 = 1 ponto)</option>
              <option value="fixed_ticket">Ticket fixo</option>
            </select>
          </label>
          <label className="block text-sm text-mute">Valor mínimo (R$)
            <input value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" className={field} />
          </label>
        </div>
      )}
      {err && <p className="text-red-400">{err}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-kick py-3 font-bold text-ink disabled:opacity-60">{busy ? "Criando…" : "Criar rodada"}</button>
    </form>
  );
}
