import Link from "next/link";
import { notFound } from "next/navigation";
import { ProfileEditor } from "@/components/ProfileEditor";
import { getSession } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const db = admin();
  const { data: user } = await db.from("users").select("id, username, display_name, avatar_url, bio, created_at").eq("username", username).limit(1).maybeSingle();
  if (!user) notFound();

  const session = await getSession();
  const own = session?.uid === user.id;
  const [{ count: followingCount }, { count: votesCount }, { count: suggestionsCount }, { data: follows }] = await Promise.all([
    db.from("channel_follows").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    db.from("votes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    db.from("suggestions").select("id", { count: "exact", head: true }).eq("suggested_by", user.id),
    db.from("channel_follows").select("channels!inner(kick_channel_slug, owner_id)").eq("user_id", user.id).eq("channels.is_active", true).limit(12),
  ]);

  const ownerIds = (follows ?? []).map((f) => { const c = Array.isArray(f.channels) ? f.channels[0] : f.channels; return c.owner_id as string; });
  const { data: owners } = ownerIds.length ? await db.from("users").select("id, username, display_name, avatar_url").in("id", ownerIds) : { data: [] as { id: string; username: string; display_name: string | null; avatar_url: string | null }[] };
  const ownerMap = new Map((owners ?? []).map((o) => [o.id, o]));

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <section className="overflow-hidden rounded-2xl border border-line bg-panel">
        <div className="h-32 bg-[radial-gradient(circle_at_20%_0%,rgba(83,252,24,.18),transparent_50%),linear-gradient(135deg,#121619,#0B0E0F)]" />
        <div className="px-6 pb-7 sm:px-8">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              {user.avatar_url ? <img src={user.avatar_url} alt="" className="h-24 w-24 rounded-2xl border-4 border-panel object-cover" /> : <div className="grid h-24 w-24 place-items-center rounded-2xl border-4 border-panel bg-raise text-3xl font-bold">{user.username.slice(0, 1).toUpperCase()}</div>}
              <div className="pb-1"><p className="text-sm text-mute">Perfil</p><h1 className="font-display text-4xl font-extrabold">{user.display_name || user.username}</h1><p className="text-sm text-mute">@{user.username}</p></div>
            </div>
            {own && <Link href="/feed" className="rounded-lg border border-line px-4 py-2.5 font-semibold">Meu feed</Link>}
          </div>
          <p className="mt-5 max-w-2xl text-mute">{user.bio || "Ainda não adicionou uma bio."}</p>
          <div className="mt-5 grid grid-cols-3 gap-3"><Metric label="Seguindo" value={String(followingCount ?? 0)} /><Metric label="Votos" value={String(votesCount ?? 0)} /><Metric label="Sugestões" value={String(suggestionsCount ?? 0)} /></div>
        </div>
      </section>

      {own && <section className="mt-6"><ProfileEditor displayName={user.display_name || user.username} bio={user.bio || ""} /></section>}

      <section className="mt-6 rounded-2xl border border-line bg-panel p-6">
        <h2 className="font-display text-3xl font-extrabold">Streamers que segue</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(follows ?? []).map((f) => {
            const c = (Array.isArray(f.channels) ? f.channels[0] : f.channels) as { kick_channel_slug: string; owner_id: string };
            const o = ownerMap.get(c.owner_id);
            return <Link key={c.kick_channel_slug} href={`/streamer/${c.kick_channel_slug}`} className="flex items-center gap-3 rounded-xl bg-ink p-3 hover:border-kick"><>{o?.avatar_url ? <img src={o.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover" /> : <div className="grid h-11 w-11 place-items-center rounded-full bg-raise font-bold">{(o?.username || c.kick_channel_slug).slice(0, 1).toUpperCase()}</div>}</><div><p className="font-semibold">{o?.display_name || o?.username || c.kick_channel_slug}</p><p className="text-sm text-mute">@{o?.username || c.kick_channel_slug}</p></div></Link>;
          })}
          {!follows?.length && <p className="text-mute">Ainda não segue nenhum streamer.</p>}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-line bg-ink p-3"><p className="font-display text-2xl font-extrabold">{value}</p><p className="text-xs text-mute">{label}</p></div>;
}
