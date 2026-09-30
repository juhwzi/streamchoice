import Link from "next/link";
import { admin } from "@/lib/supabase/admin";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const STEPS = [
  ["Sugira", "Busque no TMDB ou IGDB e envie até o limite da rodada."],
  ["A equipe cura", "Moderadores aprovam ou rejeitam com atalhos de teclado."],
  ["O chat vota", "1 voto grátis por conta, ou Pix para dar um empurrão."],
];

export default async function Home() {
  const s = await getSession();
  const { data: channels } = await admin()
    .from("channels").select("kick_channel_slug").eq("is_active", true)
    .order("created_at", { ascending: false }).limit(24);

  return (
    <main className="mx-auto max-w-5xl px-4 py-14">
      <h1 className="font-display text-6xl font-extrabold leading-[0.92] sm:text-8xl">
        O chat decide.<br /><span className="text-kick">A live assiste.</span>
      </h1>
      <p className="mt-5 max-w-lg text-xl text-mute">
        Sugira filmes e jogos, vote com a conta da Kick e veja a disputa ao vivo no overlay do streamer.
      </p>
      <div className="mt-8">
        {s ? (
          <Link href="/dashboard" className="rounded-lg bg-kick px-6 py-3.5 font-bold text-ink">Abrir meu painel</Link>
        ) : (
          <Link href="/entrar" className="rounded-lg bg-kick px-6 py-3.5 font-bold text-ink">Entrar com a Kick</Link>
        )}
      </div>

      <ol className="mt-14 grid gap-4 sm:grid-cols-3">
        {STEPS.map(([t, d], i) => (
          <li key={t} className="rounded-xl border border-line bg-panel p-4">
            <span className="mb-3 grid h-8 w-8 place-items-center rounded-full bg-kick font-display text-lg font-extrabold text-ink">{i + 1}</span>
            <h2 className="font-display text-2xl font-extrabold">{t}</h2>
            <p className="mt-1 text-mute">{d}</p>
          </li>
        ))}
      </ol>

      {!!channels?.length && (
        <section className="mt-14">
          <h2 className="font-display text-3xl font-extrabold">Salas abertas</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {channels.map((c) => (
              <li key={c.kick_channel_slug}>
                <Link href={`/c/${c.kick_channel_slug}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-4 py-2 hover:border-kick">
                  <i className="h-2 w-2 rounded-full bg-kick" />{c.kick_channel_slug}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
