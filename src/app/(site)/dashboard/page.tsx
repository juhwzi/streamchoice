import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateChannelButton, DeleteChannel, Moderators, ObsCard, PixSettings } from "@/components/DashboardForms";
import { DashboardPrivacyProvider, PrivateValue, PrivacyToggle } from "@/components/DashboardPrivacy";
import { LibraryManager, type LibraryCandidate } from "@/components/LibraryManager";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { appUrl } from "@/lib/env";
import { formatBRL } from "@/lib/scoring";
import { getSession } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";
import type { LibraryItem, SnapshotData } from "@/lib/types";

export const dynamic = "force-dynamic";

type TopContributor = {
  donor_display_name: string;
  total_amount: number | string;
  donation_count: number;
  last_contribution_at: string;
};

type PaidVoteRow = {
  id: string;
  donor_display_name: string;
  amount_paid: number | string;
  created_at: string;
  suggestions: { title: string } | Array<{ title: string }> | null;
};

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
  const [{ data: mods }, { data: snaps }, { data: lastPix }, { data: events }, { data: contributors }, { data: library }, { data: profile }] = await Promise.all([
    db.from("channel_moderators").select("user_id, is_auto_synced, users(username)").eq("channel_id", channel.id),
    db.from("poll_snapshots").select("poll_id, poll_created_at, data").eq("channel_id", channel.id).order("poll_created_at", { ascending: false }).limit(30),
    db.from("paid_votes").select("id, donor_display_name, amount_paid, created_at, suggestions(title), polls!inner(channel_id)").eq("polls.channel_id", channel.id).eq("status", "confirmed").order("created_at", { ascending: false }).limit(10),
    db.from("webhook_events").select("id, outcome, amount, donor, created_at").eq("channel_id", channel.id).order("created_at", { ascending: false }).limit(8),
    db.rpc("channel_top_contributors", { p_channel_id: channel.id, p_limit: 10 }),
    db.from("streamer_media_library").select("id, channel_id, source_poll_id, external_media_id, media_type, title, poster_url, release_year, status, started_at, completed_at, created_at, updated_at").eq("channel_id", channel.id).order("updated_at", { ascending: false }),
    db.from("users").select("kick_verified").eq("id", session.uid).maybeSingle(),
  ]);

  const snapshotRows = (snaps ?? []) as Array<{ poll_id: string; data: SnapshotData }>;
  const rounds = snapshotRows.map((snapshot) => ({ id: snapshot.poll_id, data: snapshot.data }));
  const totalRaised = rounds.reduce((sum: number, round: { id: string; data: SnapshotData }) => sum + Number(round.data.paid_total ?? 0), 0);
  const totalPix = rounds.reduce((sum: number, round: { id: string; data: SnapshotData }) => sum + Number(round.data.paid_count ?? 0), 0);
  const contributorRows = (contributors ?? []) as unknown as TopContributor[];
  const libraryRows = (library ?? []) as unknown as LibraryItem[];
  const moderatorRows = (mods ?? []) as Array<{ user_id: string; is_auto_synced: boolean; users: unknown }>;
  const eventRows = (events ?? []) as Array<{ id: number; outcome: string; amount: number | string | null; donor: string | null }>;
  const libraryByPoll = new Map(libraryRows.map((item) => [item.source_poll_id, item]));

  const libraryCandidates: LibraryCandidate[] = rounds
    .filter((round) => round.data.poll.status === "completed" && !!round.data.ranking?.[0] && Number(round.data.ranking[0].total_score) > 0)
    .map((round) => {
      const winner = round.data.ranking[0];
      const existing = libraryByPoll.get(round.id);
      return {
        pollId: round.id,
        pollTitle: round.data.poll.title,
        title: winner.title,
        posterUrl: winner.poster_url,
        mediaType: winner.media_type,
        releaseYear: winner.release_year,
        status: existing?.status ?? null,
      };
    });

  const totalLibraryCompleted = libraryRows.filter((item) => item.status === "completed").length;
  const verified = !!profile?.kick_verified;

  return (
    <DashboardPrivacyProvider>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <section className="relative overflow-hidden rounded-[1.75rem] border border-line bg-panel p-6 shadow-2xl shadow-black/10 sm:p-8">
          <div className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full bg-kick/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-kick">Central do streamer</p>
                {verified && <div className="flex items-center gap-1.5 text-xs font-semibold text-kick"><VerifiedBadge /> Verificado</div>}
              </div>
              <h1 className="mt-2 font-display text-5xl font-extrabold leading-none">/{slug}</h1>
              <p className="mt-3 max-w-2xl text-mute">Gerencie suas votações, acompanhe a comunidade e organize a biblioteca do que foi escolhido pela live.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <PrivacyToggle />
              <Link href={`/mod/${slug}`} className="rounded-lg bg-kick px-5 py-2.5 font-bold text-ink">Operar a live</Link>
              <Link href={`/streamer/${slug}`} className="rounded-lg border border-line px-5 py-2.5 font-semibold">Ver perfil público</Link>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Arrecadado" value={<PrivateValue>{formatBRL(totalRaised)}</PrivateValue>} tone="text-emerald" hint="últimas rodadas carregadas" />
          <Metric label="Contribuições" value={<PrivateValue>{String(totalPix)}</PrivateValue>} tone="text-gold" hint="Pix confirmados" />
          <Metric label="Ticket médio" value={<PrivateValue>{totalPix ? formatBRL(totalRaised / totalPix) : "—"}</PrivateValue>} tone="text-gold" hint="por contribuição" />
          <Metric label="Rodadas" value={String(rounds.length)} tone="text-kick" hint="histórico recente" />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
          <div className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-kick">Performance</p>
                <h2 className="font-display text-3xl font-extrabold">Rodadas e receita</h2>
              </div>
              <span className="rounded-full bg-raise px-3 py-1 text-xs text-mute">{rounds.length} recentes</span>
            </div>
            <div className="mt-4 space-y-2">
              {rounds.map((round: { id: string; data: SnapshotData }) => (
                <div key={round.id} className="grid gap-3 rounded-xl bg-ink p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{round.data.poll.title}</p>
                    <p className="mt-1 text-xs text-mute">{formatStatus(round.data.poll.status)} · {new Date(round.data.poll.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <MiniMetric label="votos" value={String(round.data.free_votes_total ?? 0)} />
                  <MiniMetric label="Pix" value={<PrivateValue>{String(round.data.paid_count ?? 0)}</PrivateValue>} />
                  <div className="text-right"><p className="text-xs text-mute">Receita</p><p className="font-display text-lg font-extrabold text-emerald"><PrivateValue>{formatBRL(Number(round.data.paid_total ?? 0))}</PrivateValue></p></div>
                </div>
              ))}
              {!rounds.length && <EmptyLine text="Nenhuma rodada criada ainda." />}
            </div>
          </div>

          <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-kick">Biblioteca</p>
            <h2 className="mt-1 font-display text-3xl font-extrabold">Base de conteúdo</h2>
            <p className="mt-2 text-sm text-mute">Marque o vencedor de cada rodada como A seguir, Em andamento ou Concluído.</p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <QuickCount label="A seguir" value={String(libraryRows.filter((item) => item.status === "up_next").length)} />
              <QuickCount label="Andamento" value={String(libraryRows.filter((item) => item.status === "in_progress").length)} />
              <QuickCount label="Concluído" value={String(totalLibraryCompleted)} />
            </div>
          </section>
        </section>

        <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-kick">Biblioteca do streamer</p>
              <h2 className="font-display text-3xl font-extrabold">O que a live escolheu</h2>
              <p className="mt-1 max-w-2xl text-sm text-mute">A base é inspirada em trackers de filmes e jogos: cada vencedor pode ganhar um status de acompanhamento.</p>
            </div>
          </div>
          <div className="mt-5"><LibraryManager items={libraryCandidates} /></div>
        </section>

        <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold">Comunidade</p>
              <h2 className="font-display text-3xl font-extrabold">Maiores contribuidores</h2>
              <p className="mt-1 text-sm text-mute">Ranking por valor total de Pix confirmado. Use “Esconder valores” antes de compartilhar a tela.</p>
            </div>
            <span className="rounded-full bg-raise px-3 py-1 text-xs text-mute">Top 10</span>
          </div>

          {contributorRows.length ? (
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {contributorRows.slice(0, 3).map((contributor, index) => (
                <div key={`${contributor.donor_display_name}-${index}`} className="rounded-2xl border border-line bg-ink p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-kick font-display text-lg font-extrabold text-ink">{index + 1}</span>
                    <span className="text-xs text-mute">{contributor.donation_count} {contributor.donation_count === 1 ? "contribuição" : "contribuições"}</span>
                  </div>
                  <p className="mt-4 truncate font-semibold">{contributor.donor_display_name}</p>
                  <p className="mt-1 font-display text-3xl font-extrabold text-emerald"><PrivateValue>{formatBRL(Number(contributor.total_amount))}</PrivateValue></p>
                  <p className="mt-1 text-xs text-mute">última contribuição {new Date(contributor.last_contribution_at).toLocaleDateString("pt-BR")}</p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-mute"><tr><th className="py-2">#</th><th>Contribuidor</th><th>Contribuições</th><th>Total</th><th>Última</th></tr></thead>
              <tbody>
                {contributorRows.slice(3).map((contributor, index) => (
                  <tr key={`${contributor.donor_display_name}-${index + 3}`} className="border-t border-line">
                    <td className="py-2 font-display text-lg font-extrabold text-kick">{index + 4}</td>
                    <td className="font-semibold">{contributor.donor_display_name}</td>
                    <td>{contributor.donation_count}</td>
                    <td className="font-semibold text-emerald"><PrivateValue>{formatBRL(Number(contributor.total_amount))}</PrivateValue></td>
                    <td className="text-mute">{new Date(contributor.last_contribution_at).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
                {!contributorRows.length && <tr><td colSpan={5} className="py-8 text-center text-mute">Ainda não há contribuições confirmadas.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <PixSettings slug={slug} livepixUrl={channel.livepix_url} hasSecret={!!channel.livepix_webhook_secret} webhookUrl={`${appUrl()}/api/webhooks/livepix?channel=${slug}`} />
          <ObsCard slug={slug} overlayUrl={`${appUrl()}/overlay/${channel.obs_token}`} />
          <Moderators slug={slug} mods={moderatorRows.map((moderator) => ({ user_id: moderator.user_id as string, username: readUsername(moderator.users), auto: !!moderator.is_auto_synced }))} />

          <section className="rounded-xl border border-line bg-panel p-5">
            <h2 className="font-display text-2xl font-extrabold">Últimos Pix e webhooks</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {((lastPix ?? []) as unknown as PaidVoteRow[]).map((payment) => (
                <li key={payment.id} className="flex items-center justify-between gap-3 rounded-xl bg-ink px-3 py-2.5">
                  <span className="min-w-0 truncate">{payment.donor_display_name} → {readTitle(payment.suggestions)}</span>
                  <span className="shrink-0 font-semibold text-emerald"><PrivateValue>{formatBRL(Number(payment.amount_paid))}</PrivateValue></span>
                </li>
              ))}
              {!lastPix?.length && <li className="text-mute">Nenhum Pix confirmado.</li>}
            </ul>
            <p className="mt-5 text-sm text-mute">Últimos eventos recebidos</p>
            <ul className="mt-2 space-y-1 text-xs">
              {eventRows.map((event) => (
                <li key={event.id as number} className="flex justify-between rounded bg-ink px-3 py-1.5">
                  <span className={event.outcome === "ok" ? "text-kick" : "text-gold"}>{String(event.outcome)}</span>
                  <span className="text-mute">{String(event.donor ?? "")} {event.amount ? <PrivateValue>{formatBRL(Number(event.amount))}</PrivateValue> : ""}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <DeleteChannel slug={slug} />
      </main>
    </DashboardPrivacyProvider>
  );
}

function Metric({ label, value, tone, hint }: { label: string; value: React.ReactNode; tone: string; hint: string }) {
  return <div className="rounded-2xl border border-line bg-panel p-5 shadow-lg shadow-black/5"><p className={`font-display text-3xl font-extrabold tabular-nums ${tone}`}>{value}</p><p className="mt-1 font-semibold">{label}</p><p className="mt-1 text-xs text-mute">{hint}</p></div>;
}

function MiniMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><p className="font-display text-lg font-extrabold">{value}</p><p className="text-[11px] uppercase tracking-wider text-mute">{label}</p></div>;
}

function QuickCount({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-line bg-ink p-3"><p className="font-display text-2xl font-extrabold text-kick">{value}</p><p className="mt-1 text-[11px] text-mute">{label}</p></div>;
}

function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-line p-5 text-center text-sm text-mute">{text}</div>;
}

function formatStatus(status: string) {
  return ({ collecting: "Coletando", voting: "Em votação", paused: "Pausada", completed: "Encerrada" } as Record<string, string>)[status] ?? status;
}

function readUsername(value: unknown) {
  if (Array.isArray(value)) return String((value[0] as { username?: string } | undefined)?.username ?? "?");
  return String((value as { username?: string } | null)?.username ?? "?");
}

function readTitle(value: PaidVoteRow["suggestions"]) {
  if (Array.isArray(value)) return value[0]?.title ?? "título removido";
  return value?.title ?? "título removido";
}
