"use client";
import { useState } from "react";
import Link from "next/link";
import { RankingBars } from "./RankingBars";
import { FollowButton } from "./FollowButton";
import { SubmitModal } from "./SubmitModal";
import { VerifiedBadge } from "./VerifiedBadge";
import { useLeaderFlash } from "./useLeaderFlash";
import { useCountdown, useLiveSnapshot } from "@/lib/hooks/useLiveSnapshot";
import { formatBRL, pixMessage } from "@/lib/scoring";
import { formatClock } from "@/lib/poll-state";
import type { RankingRow, SnapshotRow } from "@/lib/types";

interface Props {
  channel: { id: string; slug: string; livepixUrl: string | null; ownerName: string; ownerUsername: string; ownerAvatar: string | null; ownerVerified: boolean; followerCount: number; following: boolean };
  initial: SnapshotRow | null;
  loggedIn: boolean;
  myVote: string | null;
}

export function ViewerRoom({ channel, initial, loggedIn, myVote: initialVote }: Props) {
  const { snap, connected } = useLiveSnapshot(channel.id, initial);
  const poll = snap?.data.poll ?? null;
  const remaining = useCountdown(poll);
  const flash = useLeaderFlash(snap?.data.ranking);
  const [myVote, setMyVote] = useState<string | null>(initialVote);
  const [modal, setModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pix, setPix] = useState<RankingRow | null>(null);
  const [copied, setCopied] = useState(false);

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };
  const loginHref = `/entrar?next=${encodeURIComponent(`/c/${channel.slug}`)}`;

  async function vote(r: RankingRow) {
    if (!poll) return;
    const res = await fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pollId: poll.id, suggestionId: r.suggestion_id }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) { setMyVote(r.suggestion_id); say("Voto registrado!"); }
    else {
      if (json.error?.code === "already_voted") setMyVote((v) => v ?? "?");
      say(json.error?.message ?? "Não foi possível votar.");
    }
  }

  async function copyPix(r: RankingRow) {
    try {
      await navigator.clipboard.writeText(pixMessage(r.title, r.vote_tag));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { say("Copie a mensagem manualmente."); }
  }

  if (!poll) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-panel p-4">
          <div className="flex min-w-0 items-center gap-3">
            {channel.ownerAvatar ? <img src={channel.ownerAvatar} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-full bg-raise font-bold">{channel.ownerName.slice(0, 1).toUpperCase()}</div>}
            <div className="min-w-0"><div className="flex items-center gap-2"><Link href={`/streamer/${channel.slug}`} className="font-semibold hover:text-kick">{channel.ownerName}</Link>{channel.ownerVerified && <VerifiedBadge />}</div><p className="text-sm text-mute">@{channel.ownerUsername} · {channel.followerCount} seguidores</p></div>
          </div>
          <FollowButton slug={channel.slug} initialFollowing={channel.following} initialFollowers={channel.followerCount} loggedIn={loggedIn} />
        </section>
        <section className="mt-8 rounded-2xl border border-dashed border-line bg-panel p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-raise text-2xl">◷</div>
          <h1 className="mt-4 font-display text-4xl font-extrabold">Nenhuma votação ativa</h1>
          <p className="mt-2 text-mute">Esta página atualiza sozinha quando {channel.ownerName} abrir uma nova rodada.</p>
          <Link href={`/streamer/${channel.slug}`} className="mt-5 inline-flex rounded-lg border border-line px-5 py-3 font-semibold">Ver feed do streamer</Link>
        </section>
      </main>
    );
  }

  const data = snap!.data;
  const canFreeVote = !poll.is_paid_voting || poll.paid_mode === "hybrid";
  const voting = poll.status === "voting";
  const winner = poll.status === "completed" ? [...data.ranking].sort((a, b) => b.total_score - a.total_score)[0] : null;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <section className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-panel p-4">
        <div className="flex min-w-0 items-center gap-3">
          {channel.ownerAvatar ? <img src={channel.ownerAvatar} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-full bg-raise font-bold">{channel.ownerName.slice(0, 1).toUpperCase()}</div>}
          <div className="min-w-0"><div className="flex items-center gap-2"><Link href={`/streamer/${channel.slug}`} className="font-semibold hover:text-kick">{channel.ownerName}</Link>{channel.ownerVerified && <VerifiedBadge />}</div><p className="text-sm text-mute">@{channel.ownerUsername} · {channel.followerCount} seguidores</p></div>
        </div>
        <FollowButton slug={channel.slug} initialFollowing={channel.following} initialFollowers={channel.followerCount} loggedIn={loggedIn} />
      </section>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold leading-none">{poll.title}</h1>
          <p className="mt-2 text-sm text-mute">
            {poll.status === "collecting" && "Recebendo sugestões"}
            {poll.status === "voting" && "Votação aberta"}
            {poll.status === "paused" && "Votação pausada"}
            {poll.status === "completed" && "Rodada encerrada"}
            {!connected && " · reconectando…"}
          </p>
        </div>
        {(voting || poll.status === "paused") && (
          <div className="text-right" aria-live="off">
            <p className={`font-display text-5xl font-extrabold tabular-nums ${remaining !== null && remaining <= 10 && voting ? "text-gold" : "text-kick"}`}>
              {formatClock(remaining)}
            </p>
          </div>
        )}
      </div>

      {poll.status === "collecting" && (
        <div className="mt-6 rounded-xl border border-line bg-panel p-4">
          {loggedIn ? (
            <button onClick={() => setModal(true)} className="w-full rounded-lg bg-kick py-4 text-lg font-bold text-ink">
              Sugerir um título
            </button>
          ) : (
            <a href={loginHref} className="block w-full rounded-lg bg-kick py-4 text-center text-lg font-bold text-ink">
              Entre com a Kick para sugerir
            </a>
          )}
          <p className="mt-3 text-center text-sm text-mute">A equipe aprova cada sugestão antes da votação começar.</p>
        </div>
      )}

      {winner && winner.total_score > 0 && (
        <div className="mt-6 flex gap-4 rounded-xl border border-kick bg-panel p-4">
          {winner.poster_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={winner.poster_url} alt="" className="h-40 w-28 rounded object-cover" />}
          <div>
            <p className="text-sm text-mute">Vencedor da rodada</p>
            <p className="font-display text-4xl font-extrabold text-kick">{winner.title}</p>
            {data.whale && <p className="mt-2 text-gold">Baleia da rodada: {data.whale.name} · {formatBRL(data.whale.amount)}</p>}
          </div>
        </div>
      )}

      <div className="mt-6">
        {data.ranking.length === 0 ? (
          <p className="rounded-xl border border-line bg-panel p-6 text-center text-mute">Ainda não há títulos aprovados.</p>
        ) : (
          <RankingBars
            ranking={data.ranking}
            poll={poll}
            variant="room"
            flashId={flash}
            highlightId={myVote}
            renderAction={(r) =>
              voting ? (
                <div className="flex flex-col gap-2">
                  {canFreeVote && (
                    loggedIn ? (
                      <button
                        onClick={() => vote(r)}
                        disabled={myVote !== null}
                        className="min-h-12 min-w-24 rounded-lg bg-kick px-4 font-bold text-ink disabled:bg-raise disabled:text-mute"
                      >
                        {myVote === r.suggestion_id ? "Seu voto" : "Votar"}
                      </button>
                    ) : (
                      <a href={loginHref} className="min-h-12 min-w-24 rounded-lg bg-kick px-4 py-3 text-center font-bold text-ink">Entrar</a>
                    )
                  )}
                  {poll.is_paid_voting && channel.livepixUrl && loggedIn && (
                    <button onClick={() => setPix(r)} className="min-h-12 min-w-24 rounded-lg bg-emerald px-4 font-bold text-ink">
                      Votar com Pix
                    </button>
                  )}
                </div>
              ) : null
            }
          />
        )}
        {voting && !canFreeVote && <p className="mt-3 text-sm text-mute">Esta rodada aceita apenas votos por Pix.</p>}
      </div>

      {pix && (
        <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border-t border-gold bg-panel p-4 shadow-2xl sm:mx-auto sm:max-w-2xl">
          <div className="flex items-start justify-between">
            <p className="font-display text-2xl font-extrabold text-gold">Pix para “{pix.title}”</p>
            <button onClick={() => setPix(null)} className="p-1 text-mute" aria-label="Fechar">✕</button>
          </div>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-mute">
            <li>Copie a mensagem abaixo (a tag <b className="text-white">{pix.vote_tag}</b> é o que conta o seu voto).</li>
            <li>Abra o Livepix, cole na mensagem e pague (mínimo {formatBRL(poll.min_donation_amount)}).</li>
          </ol>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-ink p-2">
            <code className="min-w-0 flex-1 truncate px-2 text-sm">{pixMessage(pix.title, pix.vote_tag)}</code>
            <button onClick={() => copyPix(pix)} className="min-h-11 rounded-md bg-gold px-4 font-bold text-ink">
              {copied ? "Copiado ✓" : "Copiar"}
            </button>
          </div>
          <a href={channel.livepixUrl!} target="_blank" rel="noopener noreferrer" className="mt-3 block rounded-lg bg-emerald py-3 text-center font-bold text-ink">
            Abrir Livepix
          </a>
        </div>
      )}

      {modal && <SubmitModal pollId={poll.id} onClose={() => setModal(false)} onDone={() => { setModal(false); say("Sugestão enviada! Aguarde a aprovação."); }} />}
      {toast && <div role="status" className="fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-full bg-raise px-5 py-2 shadow-lg">{toast}</div>}
    </main>
  );
}
