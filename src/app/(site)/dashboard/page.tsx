import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateChannelButton, DeleteChannel, Moderators, ObsCard, PixSettings } from "@/components/DashboardForms";
import { appUrl } from "@/lib/env";
import { formatBRL } from "@/lib/scoring";
import { getSession } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";
import type { SnapshotData } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/entrar?next=/dashboard");

  const db = admin();
  const { data: channel } = await db.from("channels").select("*").eq("owner_id", session.uid).maybeSingle();

  if (!channel) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <CreateChannelButton slug={session.slug} />
        <p className="mt-6 text-sm text-mute">Você é moderador de outro canal? Peça o link <code>/mod/&lt;canal&gt;</code> ao streamer.</p>
      </main>
    );
  }

  const slug = channel.kick_channel_slug as string;
  const [{ data: mods }, { data: snaps }, { data: lastPix }, { data: events }, { data: contributors }] = await Promise.all([
    db.from("channel_moderators").select("user_id, is_auto_synced, users(username)").eq("channel_id", channel.id),
    db.from("poll_snapshots").select("poll_id, poll_created_at, data").eq("channel_id", channel.id).order("poll_created_at", { ascending: false }).limit(10),
    db.from("paid_votes").select("id, donor_display_name, amount_paid, created_at, suggestions(title), polls!inner(channel_id)").eq("polls.channel_id", channel.id).eq("status", "confirmed").order("created_at", { ascending: false }).limit(10),
    db.from("webhook_events").select("id, outcome, amount, donor, created_at").eq("channel_id", channel.id).order("created_at", { ascending: false }).limit(8),
    db.rpc("channel_top_contributors", { p_channel_id: channel.id, p_limit: 10 }),
  ]);

  const rounds = (snaps ?? []).map((s) => ({ id: s.poll_id as string, d: s.data as SnapshotData }));
  const totalRaised = rounds.reduce((a, r) => a + Number(r.d.paid_total ?? 0), 0);
  const totalPix = rounds.reduce((a, r) => a + Number(r.d.paid_count ?? 0), 0);
  const one = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl font-extrabold">Painel · /{slug}</h1>
        <div className="flex gap-3">
          <Link href={`/mod/${slug}`} className="rounded-lg bg-kick px-5 py-2 font-bold text-ink">Operar a live</Link>
          <Link href={`/c/${slug}`} className="rounded-lg border border-line px-5 py-2">Ver sala</Link>
          <Link href={`/streamer/${slug}`} className="rounded-lg border border-line px-5 py-2">Ver feed público</Link>
        </div>
      </div>

      <section className="rounded-xl border border-line bg-panel p-5">
        <h2 className="font-display text-2xl font-extrabold">Primeiros passos</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            { ok: true, t: "Sala criada" },
            { ok: !!channel.livepix_url && !!channel.livepix_webhook_secret, t: "Pix configurado" },
            { ok: !!mods?.length, t: "Adicionar um moderador" },
            { ok: rounds.length > 0, t: "Criar a primeira rodada", href: `/mod/${slug}` },
          ].map((x) => (
            <li key={x.t} className="flex items-center gap-3 rounded-lg bg-ink px-3 py-2.5">
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-extrabold ${x.ok ? "bg-kick text-ink" : "border-2 border-line"}`}>{x.ok ? "✓" : ""}</span>
              <span className={x.ok ? "text-mute line-through" : ""}>{x.t}</span>
              {!x.ok && x.href && <Link href={x.href} className="ml-auto text-sm font-semibold text-kick">Ir</Link>}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Arrecadado (últimas rodadas)" value={formatBRL(totalRaised)} tone="text-emerald" />
        <Metric label="Pix recebidos" value={String(totalPix)} tone="text-gold" />
        <Metric label="Ticket médio" value={totalPix ? formatBRL(totalRaised / totalPix) : "—"} tone="text-gold" />
        <Metric label="Rodadas" value={String(rounds.length)} tone="text-kick" />
      </section>

      <section className="overflow-x-auto rounded-xl border border-line bg-panel p-5">
        <h2 className="font-display text-2xl font-extrabold">Rodadas e receita</h2>
        <table className="mt-3 w-full min-w-[32rem] text-left text-sm">
          <thead className="text-mute"><tr><th className="py-1">Rodada</th><th>Status</th><th>Votos grátis</th><th>Pix</th><th>Arrecadado</th><th>Baleia</th></tr></thead>
          <tbody>
            {rounds.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="py-2 font-semibold">{r.d.poll.title}</td><td>{r.d.poll.status}</td><td>{r.d.free_votes_total}</td>
                <td>{r.d.paid_count}</td><td className="text-emerald">{formatBRL(Number(r.d.paid_total))}</td>
                <td>{r.d.whale ? `${r.d.whale.name} (${formatBRL(Number(r.d.whale.amount))})` : "—"}</td>
              </tr>
            ))}
            {!rounds.length && <tr><td colSpan={6} className="py-4 text-mute">Nenhuma rodada ainda.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-line bg-panel p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-gold">Comunidade</p><h2 className="font-display text-3xl font-extrabold">Maiores contribuidores</h2><p className="mt-1 text-sm text-mute">Ranking por valor total de Pix confirmado nas votações deste canal.</p></div>
          <span className="rounded-full bg-raise px-3 py-1 text-xs text-mute">Top 10</span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-mute"><tr><th className="py-2">#</th><th>Contribuidor</th><th>Contribuições</th><th>Total</th><th>Última</th></tr></thead>
            <tbody>
              {(contributors ?? []).map((c, i) => (
                <tr key={`${c.donor_display_name}-${i}`} className="border-t border-line"><td className="py-2 font-display text-lg font-extrabold text-kick">{i + 1}</td><td className="font-semibold">{c.donor_display_name}</td><td>{c.donation_count}</td><td className="font-semibold text-emerald">{formatBRL(Number(c.total_amount))}</td><td className="text-mute">{new Date(c.last_contribution_at).toLocaleDateString("pt-BR")}</td></tr>
              ))}
              {!contributors?.length && <tr><td colSpan={5} className="py-6 text-center text-mute">Ainda não há contribuições confirmadas.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <PixSettings slug={slug} livepixUrl={channel.livepix_url} hasSecret={!!channel.livepix_webhook_secret} webhookUrl={`${appUrl()}/api/webhooks/livepix?channel=${slug}`} />
        <ObsCard slug={slug} overlayUrl={`${appUrl()}/overlay/${channel.obs_token}`} />
        <Moderators slug={slug} mods={(mods ?? []).map((m) => ({ user_id: m.user_id as string, username: one<{ username: string }>(m.users as never)?.username ?? "?", auto: !!m.is_auto_synced }))} />

        <section className="rounded-xl border border-line bg-panel p-5">
          <h2 className="font-display text-2xl font-extrabold">Últimos Pix e webhooks</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {(lastPix ?? []).map((p) => (
              <li key={p.id as string} className="flex justify-between rounded bg-ink px-3 py-2">
                <span>{p.donor_display_name as string} → {one<{ title: string }>(p.suggestions as never)?.title}</span>
                <span className="text-emerald">{formatBRL(Number(p.amount_paid))}</span>
              </li>
            ))}
            {!lastPix?.length && <li className="text-mute">Nenhum Pix confirmado.</li>}
          </ul>
          <p className="mt-4 text-sm text-mute">Últimos eventos recebidos (para diagnóstico):</p>
          <ul className="mt-1 space-y-1 text-xs">
            {(events ?? []).map((e) => (
              <li key={e.id as number} className="flex justify-between rounded bg-ink px-3 py-1">
                <span className={e.outcome === "ok" ? "text-kick" : "text-gold"}>{e.outcome as string}</span>
                <span className="text-mute">{e.donor as string ?? ""} {e.amount ? formatBRL(Number(e.amount)) : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <DeleteChannel slug={slug} />
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className={`font-display text-3xl font-extrabold tabular-nums ${tone}`}>{value}</p>
      <p className="text-xs text-mute">{label}</p>
    </div>
  );
}
