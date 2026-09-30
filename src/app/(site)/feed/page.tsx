import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";
import type { SnapshotData } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const session = await getSession();
  if (!session) redirect("/entrar?next=/feed");

  const db = admin();
  const { data: follows } = await db
    .from("channel_follows")
    .select("channel_id, channels!inner(id, kick_channel_slug, owner_id, is_active)")
    .eq("user_id", session.uid)
    .eq("channels.is_active", true)
    .order("created_at", { ascending: false });

  const followedChannels = (follows ?? []).map((f) => {
    const raw = Array.isArray(f.channels) ? f.channels[0] : f.channels;
    return raw as { id: string; kick_channel_slug: string; owner_id: string; is_active: boolean };
  });

  const ids = followedChannels.map((c) => c.id);
  const { data: snapshots } = ids.length
    ? await db.from("poll_snapshots").select("poll_id, channel_id, poll_created_at, data, updated_at").in("channel_id", ids).order("poll_created_at", { ascending: false }).limit(30)
    : { data: [] as { poll_id: string; channel_id: string; poll_created_at: string; data: SnapshotData; updated_at: string }[] };

  const ownerIds = [...new Set(followedChannels.map((c) => c.owner_id))];
  const { data: owners } = ownerIds.length
    ? await db.from("users").select("id, username, display_name, avatar_url, bio").in("id", ownerIds)
    : { data: [] as { id: string; username: string; display_name: string | null; avatar_url: string | null; bio: string | null }[] };
  const ownerMap = new Map((owners ?? []).map((o) => [o.id, o]));

  const channelMap = new Map(followedChannels.map((c) => [c.id, c]));
  const feed = (snapshots ?? []).map((s) => ({ snap: s, channel: channelMap.get(s.channel_id)!, owner: ownerMap.get(channelMap.get(s.channel_id)?.owner_id ?? "") })).filter((x) => x.channel && x.owner);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="rounded-2xl border border-line bg-panel p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-kick">Seu StreamChoice</p>
        <h1 className="mt-2 font-display text-5xl font-extrabold leading-none">Seu feed de votações.</h1>
        <p className="mt-3 max-w-2xl text-mute">Acompanhe as rodadas dos streamers que você segue e entre na votação sem precisar ficar procurando salas.</p>
      </div>

      {!followedChannels.length ? (
        <section className="mt-6 rounded-2xl border border-dashed border-line bg-ink p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-raise text-2xl">♡</div>
          <h2 className="mt-4 font-display text-3xl font-extrabold">Seu feed ainda está vazio</h2>
          <p className="mx-auto mt-2 max-w-lg text-mute">Abra a página de um streamer, siga o canal e as próximas votações aparecem aqui automaticamente.</p>
          <Link href="/" className="mt-5 inline-flex rounded-lg bg-kick px-5 py-3 font-bold text-ink">Conhecer o StreamChoice</Link>
        </section>
      ) : (
        <section className="mt-6 space-y-4">
          {feed.length ? feed.map(({ snap, channel, owner }) => {
            const d = snap.data as SnapshotData;
            const top = d.ranking?.[0];
            const live = ["collecting", "voting", "paused"].includes(d.poll.status);
            return (
              <article key={snap.poll_id} className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    {owner?.avatar_url ? <img src={owner.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-full bg-raise font-bold">{owner?.username?.slice(0, 1).toUpperCase()}</div>}
                    <div className="min-w-0">
                      <Link href={`/streamer/${channel.kick_channel_slug}`} className="font-semibold hover:text-kick">{owner?.display_name || owner?.username}</Link>
                      <p className="text-sm text-mute">@{owner?.username} · /{channel.kick_channel_slug}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${live ? "bg-kick text-ink" : "bg-raise text-mute"}`}>{live ? "AO VIVO" : "ENCERRADA"}</span>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_240px]">
                  <div>
                    <h2 className="font-display text-3xl font-extrabold">{d.poll.title}</h2>
                    <p className="mt-1 text-sm text-mute">{d.ranking?.length ?? 0} opções · {d.free_votes_total ?? 0} votos grátis · {d.paid_count ?? 0} contribuições</p>
                    {top && (
                      <div className="mt-4 rounded-xl bg-ink p-4">
                        <p className="text-xs uppercase tracking-widest text-mute">Liderando</p>
                        <div className="mt-1 flex items-center gap-3">
                          {top.poster_url && <img src={top.poster_url} alt="" className="h-12 w-9 rounded object-cover" />}
                          <div><p className="font-semibold">{top.title}</p><p className="text-sm text-kick">{top.total_score} pontos</p></div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-end lg:justify-end">
                    <Link href={`/c/${channel.kick_channel_slug}`} className="w-full rounded-lg bg-kick px-5 py-3 text-center font-bold text-ink">{live ? "Participar da votação" : "Ver resultado"}</Link>
                  </div>
                </div>
              </article>
            );
          }) : <p className="rounded-2xl border border-line bg-panel p-8 text-center text-mute">Seus streamers ainda não têm votações registradas.</p>}
        </section>
      )}
    </main>
  );
}
