import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StateCard } from "@/components/StateCard";
import { ModPanel } from "@/components/ModPanel";
import { resolveRole } from "@/lib/auth/guard";
import { getActivePolls, getChannelBySlug, getLatestActiveSnapshot, getLatestSnapshot } from "@/lib/data";
import { getSession } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ModPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams?: Promise<{ category?: string }> }) {
  const { slug } = await params;
  const query = await searchParams;
  const category = query?.category === "movie" || query?.category === "game" ? query.category : null;
  const session = await getSession();
  if (!session) {
    redirect(`/entrar?next=${encodeURIComponent(`/mod/${slug}`)}`);
    return null;
  }

  const channel = await getChannelBySlug(slug);
  if (!channel) notFound();
  const role = await resolveRole(session.uid, channel);
  if (role === "VIEWER") {
    return <StateCard icon="🔒" title="Acesso restrito" text={`Somente o streamer verificado, moderadores ou um administrador podem operar este painel.`} href={`/c/${slug}`} cta="Ir para a sala" />;
  }

  const [snapshot, activePolls, { data: secrets }] = await Promise.all([
    category ? getLatestActiveSnapshot(channel.id, category) : getLatestActiveSnapshot(channel.id).then((active) => active ?? getLatestSnapshot(channel.id)),
    getActivePolls(channel.id),
    admin().from("channels").select("livepix_webhook_secret").eq("id", channel.id).single(),
  ]);
  const pixReady = !!channel.livepix_url && !!secrets?.livepix_webhook_secret;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-3xl font-extrabold">Operação · {slug}</h1>
        <Link href={`/c/${slug}`} className="text-sm text-mute hover:text-white">Ver como espectador</Link>
      </div>
      {activePolls.length > 1 && (
        <nav className="mb-4 flex flex-wrap gap-2 rounded-xl border border-line bg-panel p-2" aria-label="Rodadas ativas">
          {activePolls.map((active) => {
            const label = active.category_type === "movie" ? "Filmes" : active.category_type === "game" ? "Jogos" : "Misto";
            const activeHere = snapshot?.poll_id === active.id;
            return <Link key={active.id} href={`/mod/${slug}?category=${active.category_type}`} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeHere ? "bg-kick text-ink" : "text-mute hover:bg-raise hover:text-white"}`}>{label}</Link>;
          })}
        </nav>
      )}
      <ModPanel channel={{ id: channel.id, slug }} initial={snapshot} role={role} pixReady={pixReady} pinnedPollId={category ? snapshot?.poll_id ?? null : null} />
    </main>
  );
}
