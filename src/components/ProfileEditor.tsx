"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProfileEditor({ displayName, bio }: { displayName: string; bio: string }) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [text, setText] = useState(bio);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: name, bio: text }) });
    const json = await res.json().catch(() => ({}));
    setMsg(res.ok ? "Perfil atualizado." : json.error?.message ?? "Não foi possível salvar.");
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <form onSubmit={save} className="rounded-2xl border border-line bg-panel p-6">
      <h2 className="font-display text-3xl font-extrabold">Personalize seu perfil</h2>
      <p className="mt-1 text-sm text-mute">Seu usuário da Kick continua sendo sua identidade. Aqui você controla como aparece no StreamChoice.</p>
      <div className="mt-4 grid gap-4">
        <label className="text-sm text-mute">Nome de exibição<input required minLength={2} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-ink px-3 py-3 text-white outline-none focus:border-kick" /></label>
        <label className="text-sm text-mute">Bio<textarea maxLength={180} value={text} onChange={(e) => setText(e.target.value)} rows={4} className="mt-1 w-full resize-none rounded-lg border border-line bg-ink px-3 py-3 text-white outline-none focus:border-kick" /></label>
      </div>
      <div className="mt-4 flex items-center gap-3"><button disabled={busy} className="rounded-lg bg-kick px-5 py-3 font-bold text-ink disabled:opacity-60">{busy ? "Salvando…" : "Salvar perfil"}</button>{msg && <span className="text-sm text-mute">{msg}</span>}</div>
    </form>
  );
}
