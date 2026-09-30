"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const field = "mt-1 w-full rounded-lg border border-line bg-ink px-3 py-2 outline-none focus:border-kick";

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, msg: json.error?.message as string | undefined };
}

export function CreateChannelButton({ slug }: { slug: string | null | undefined }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="rounded-xl border border-line bg-panel p-6">
      <h2 className="font-display text-3xl font-extrabold">Criar minha sala</h2>
      <p className="mt-2 text-mute">{slug ? <>Sua sala usará o canal da Kick <b className="text-white">/{slug}</b>.</> : "Não conseguimos ler seu canal na Kick. Saia e entre novamente."}</p>
      {err && <p className="mt-2 text-red-400">{err}</p>}
      <button disabled={!slug} onClick={async () => { const r = await call("/api/channels", "POST"); r.ok ? router.refresh() : setErr(r.msg ?? "Erro"); }} className="mt-4 rounded-lg bg-kick px-6 py-3 font-bold text-ink disabled:opacity-50">
        Criar sala
      </button>
    </div>
  );
}

export function PixSettings({ slug, livepixUrl, hasSecret, webhookUrl }: { slug: string; livepixUrl: string | null; hasSecret: boolean; webhookUrl: string }) {
  const router = useRouter();
  const [url, setUrl] = useState(livepixUrl ?? "");
  const [secret, setSecret] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { livepixUrl: url.trim() || null };
    if (secret) body.webhookSecret = secret;
    const r = await call(`/api/channels/${slug}/settings`, "PATCH", body);
    setMsg(r.ok ? "Salvo." : r.msg ?? "Erro");
    if (r.ok) { setSecret(""); router.refresh(); }
  }
  const gen = () => setSecret(Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join(""));

  return (
    <form onSubmit={save} className="space-y-3 rounded-xl border border-line bg-panel p-5">
      <h2 className="font-display text-2xl font-extrabold">Pix (Livepix / PixGG)</h2>
      <label className="block text-sm text-mute">Link público da sua página
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://livepix.gg/seucanal" className={field} />
      </label>
      <label className="block text-sm text-mute">Segredo do webhook (HMAC) {hasSecret && <span className="text-emerald">· já configurado</span>}
        <div className="flex gap-2">
          <input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={hasSecret ? "preencha só para trocar" : "mín. 16 caracteres"} className={field} autoComplete="off" />
          <button type="button" onClick={gen} className="mt-1 rounded-lg border border-line px-3 text-sm">Gerar</button>
        </div>
      </label>
      <div className="text-sm text-mute">URL do webhook para cadastrar no gateway:
        <code className="mt-1 block break-all rounded bg-ink p-2 text-gold">{webhookUrl}</code>
      </div>
      <div className="flex items-center gap-3">
        <button className="rounded-lg bg-kick px-5 py-2 font-bold text-ink">Salvar</button>
        {msg && <span role="status" className="text-sm text-gold">{msg}</span>}
      </div>
    </form>
  );
}

export function ObsCard({ slug, overlayUrl }: { slug: string; overlayUrl: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3 rounded-xl border border-line bg-panel p-5">
      <h2 className="font-display text-2xl font-extrabold">Overlay do OBS</h2>
      <p className="text-sm text-mute">No OBS: Fontes → + → Navegador → cole a URL (1920×1080, sem “Desligar fonte quando não visível”). Use <code>?scale=1.25</code> para ampliar.</p>
      <code className="block break-all rounded bg-ink p-2 text-sm text-kick">{overlayUrl}</code>
      <div className="flex gap-2">
        <button onClick={async () => { await navigator.clipboard.writeText(overlayUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="rounded-lg bg-kick px-4 py-2 font-bold text-ink">{copied ? "Copiado ✓" : "Copiar URL"}</button>
        <button onClick={async () => { if (!confirm("Gerar novo token? A URL antiga para de funcionar.")) return; const r = await call(`/api/channels/${slug}/settings`, "PATCH", { regenerateObsToken: true }); if (r.ok) router.refresh(); }} className="rounded-lg border border-line px-4 py-2">Regenerar token</button>
      </div>
    </div>
  );
}

export function Moderators({ slug, mods }: { slug: string; mods: { user_id: string; username: string; auto: boolean }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="space-y-3 rounded-xl border border-line bg-panel p-5">
      <h2 className="font-display text-2xl font-extrabold">Moderadores</h2>
      <ul className="space-y-1">
        {mods.map((m) => (
          <li key={m.user_id} className="flex items-center justify-between rounded bg-ink px-3 py-2">
            <span>{m.username} {m.auto && <span className="text-xs text-mute">(auto)</span>}</span>
            <button onClick={async () => { await call(`/api/channels/${slug}/moderators?userId=${m.user_id}`, "DELETE"); router.refresh(); }} className="text-sm text-red-300">Remover</button>
          </li>
        ))}
        {!mods.length && <li className="text-sm text-mute">Nenhum moderador cadastrado.</li>}
      </ul>
      <form onSubmit={async (e) => { e.preventDefault(); setErr(null); const r = await call(`/api/channels/${slug}/moderators`, "POST", { username: name }); if (r.ok) { setName(""); router.refresh(); } else setErr(r.msg ?? "Erro"); }} className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="username na Kick" className={field} />
        <button className="mt-1 rounded-lg bg-kick px-4 font-bold text-ink">Adicionar</button>
      </form>
      {err && <p className="text-sm text-red-400">{err}</p>}
      <p className="text-xs text-mute">A pessoa precisa ter entrado no StreamChoice ao menos uma vez.</p>
    </div>
  );
}

export function DeleteChannel({ slug }: { slug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function remove() {
    if (busy) return;
    const first = confirm(`Excluir a sala /${slug}?`);
    if (!first) return;
    const second = confirm("Essa ação é permanente e apaga rodadas, votos, snapshots, contribuições e seguidores desta sala. Continuar?");
    if (!second) return;
    setBusy(true);
    setErr(null);
    const r = await call(`/api/channels/${slug}`, "DELETE");
    if (r.ok) router.push("/");
    else { setBusy(false); setErr(r.msg ?? "Não foi possível excluir a sala."); }
  }

  return (
    <section className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-300">Zona de perigo</p>
      <h2 className="mt-1 font-display text-2xl font-extrabold">Excluir sala</h2>
      <p className="mt-1 text-sm text-mute">Remove permanentemente esta sala e todos os dados vinculados.</p>
      <button onClick={() => void remove()} disabled={busy} className="mt-4 rounded-lg border border-red-500/60 px-4 py-2.5 font-semibold text-red-300 disabled:opacity-60">{busy ? "Excluindo…" : "Excluir /"}{slug}</button>
      {err && <p className="mt-2 text-sm text-red-300">{err}</p>}
    </section>
  );
}
