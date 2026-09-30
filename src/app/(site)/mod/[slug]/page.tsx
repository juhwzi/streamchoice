import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StateCard } from "@/components/StateCard";
import { ModPanel } from "@/components/ModPanel";
import { resolveRole } from "@/lib/auth/guard";
import { getChannelBySlug, getLatestSnapshot } from "@/lib/data";
import { getSession } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ModPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) redirect(`/entrar?next=${encodeURIComponent(`/mod/${slug}`)}`);

  const channel = await getChannelBySlug(slug);
  if (!channel) notFound();
  const role = await resolveRole(session.uid, channel);
  if (role === "VIEWER") {
    return <StateCard icon="🔒" title="Acesso restrito" text={`Somente o streamer e os moderadores de /${slug} operam este painel.`} href={`/c/${slug}`} cta="Ir para a sala" />;
  }

  const [snapshot, { data: secrets }] = await Promise.all([
    getLatestSnapshot(channel.id),
    admin().from("channels").select("livepix_webhook_secret").eq("id", channel.id).single(),
  ]);
  const pixReady = !!channel.livepix_url && !!secrets?.livepix_webhook_secret;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-3xl font-extrabold">Operação · /{slug}</h1>
        <Link href={`/c/${slug}`} className="text-sm text-mute hover:text-white">Ver como espectador</Link>
      </div>
      <ModPanel channel={{ id: channel.id, slug }} initial={snapshot} role={role} pixReady={pixReady} />
    </main>
  );
}
