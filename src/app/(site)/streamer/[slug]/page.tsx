import Link from "next/link";
import { notFound } from "next/navigation";
import { FollowButton } from "@/components/FollowButton";
import { getSession } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";
import type { SnapshotData } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StreamerFeed({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = admin();
  const { data: channel } = await db.from("channels").select("id, owner_id, kick_channel_slug, is_active, livepix_url").eq("kick_channel_slug", slug).maybeSingle();
  if (!channel || !channel.is_active) notFound();

  const [{ data: owner }, { count: followers }, { data: snapshots }, session] = await Promise.all([
    db.from("users").select("id, username, display_name, avatar_url, bio").eq("id", channel.owner_id).maybeSingle(),
    db.from("channel_follows").select("id", { count: "exact", head: true }).eq("channel_id", channel.id),
    db.from("poll_snapshots").select("poll_id, channel_id, poll_created_at, data, updated_at").eq("channel_id", channel.id).order("poll_created_at", { ascending: false }).limit(20),
    getSession(),
  ]);

  let following = false;
  const isOwner = session?.uid === channel.owner_id;
  if (session && !isOwner) {
    const { data } = await db.from("channel_follows").select("id").eq("channel_id", channel.id).eq("user_id", session.uid).maybeSingle();
    following = !!data;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <section className="overflow-hidden rounded-2xl border border-line bg-panel">
        <div className="h-28 bg-[radial-gradient(circle_at_18%_0%,rgba(83,252,24,.24),transparent_45%),linear-gradient(135deg,#121619,#0B0E0F)]" />
        <div className="px-5 pb-6 sm:px-8">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              {owner?.avatar_url ? <img src={owner.avatar_url} alt="" className="h-20 w-20 rounded-2xl border-4 border-panel object-cover" /> : <div className="grid h-20 w-20 place-items-center rounded-2xl border-4 border-panel bg-raise text-2xl font-bold">{owner?.username?.slice(0, 1).toUpperCase()}</div>}
              <div className="pb-1">
                <p className="text-sm text-mute">Perfil do streamer</p>
                <h1 className="font-display text-4xl font-extrabold">{owner?.display_name || owner?.username}</h1>
                <p className="text-sm text-mute">@{owner?.username} · {followers ?? 0} seguidores</p>
              </div>
            </div>
            {!isOwner && <FollowButton slug={slug} initialFollowing={following} initialFollowers={followers ?? 0} loggedIn={!!session} />}
          </div>
          {owner?.bio && <p className="mt-5 max-w-2xl text-mute">{owner.bio}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={`/u/${encodeURIComponent(owner?.username || slug)}`} className="rounded-lg border border-line px-4 py-2.5 font-semibold">Ver perfil</Link><Link href={`/c/${slug}`} className="rounded-lg bg-kick px-4 py-2.5 font-bold text-ink">Ver sala atual</Link>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-4">
          <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-kick">Feed</p><h2 className="font-display text-4xl font-extrabold">Votações de /{slug}</h2></div>
          <span className="text-sm text-mute">{snapshots?.length ?? 0} registros recentes</span>
        </div>
        <div className="mt-4 space-y-4">
          {(snapshots ?? []).map((s) => {
            const d = s.data as SnapshotData;
            const live = ["collecting", "voting", "paused"].includes(d.poll.status);
            const top = d.ranking?.[0];
            return (
              <article key={s.poll_id} className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h3 className="font-display text-2xl font-extrabold">{d.poll.title}</h3><p className="text-sm text-mute">{d.poll.category_type === "game" ? "Jogos" : d.poll.category_type === "movie" ? "Filmes e séries" : "Misto"}</p></div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${live ? "bg-kick text-ink" : "bg-raise text-mute"}`}>{live ? "EM ANDAMENTO" : "ENCERRADA"}</span>
                </div>
                {top && <div className="mt-4 flex items-center gap-3 rounded-xl bg-ink p-4">{top.poster_url && <img src={top.poster_url} alt="" className="h-16 w-12 rounded object-cover" />}<div><p className="text-xs uppercase tracking-widest text-mute">{live ? "Líder atual" : "Resultado"}</p><p className="font-semibold">{top.title}</p><p className="text-sm text-kick">{top.total_score} pontos</p></div></div>}
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Opções" value={String(d.ranking?.length ?? 0)} /><Stat label="Votos grátis" value={String(d.free_votes_total ?? 0)} /><Stat label="Contribuições" value={String(d.paid_count ?? 0)} /><Stat label="Arrecadado" value={`R$ ${Number(d.paid_total ?? 0).toFixed(2).replace('.', ',')}`} /></div>
              </article>
            );
          })}
          {!snapshots?.length && <div className="rounded-2xl border border-dashed border-line bg-panel p-10 text-center text-mute">Este streamer ainda não publicou nenhuma votação.</div>}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-line bg-ink p-3"><p className="font-display text-2xl font-extrabold">{value}</p><p className="text-xs text-mute">{label}</p></div>;
}
