import Link from "next/link";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const FEATURES = [
  ["01", "Sugestões", "A comunidade encontra filmes e jogos no catálogo e envia ideias para a rodada."],
  ["02", "Curadoria", "Streamer e mods organizam a disputa antes de colocar as opções para o chat."],
  ["03", "Votação ao vivo", "O ranking muda em tempo real e fica pronto para aparecer no OBS."],
];

export default async function Home() {
  const session = await getSession();

  return (
    <main className="overflow-hidden">
      <section className="relative border-b border-line">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(83,252,24,.14),transparent_32%),radial-gradient(circle_at_85%_10%,rgba(245,158,11,.08),transparent_28%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:py-24 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:py-28">
          <div>
            <span className="inline-flex rounded-full border border-kick/30 bg-kick/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-kick">Social de votações para streamers</span>
            <h1 className="mt-5 max-w-3xl font-display text-6xl font-extrabold leading-[.88] sm:text-8xl">A comunidade escolhe.<br /><span className="text-kick">A live acontece.</span></h1>
            <p className="mt-6 max-w-2xl text-lg leading-7 text-mute sm:text-xl">Siga seus streamers favoritos, descubra as próximas votações e participe das escolhas que realmente entram na live.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {session ? <Link href="/feed" className="rounded-lg bg-kick px-6 py-3.5 font-bold text-ink hover:brightness-110">Abrir meu feed</Link> : <Link href="/entrar" className="rounded-lg bg-kick px-6 py-3.5 font-bold text-ink hover:brightness-110">Entrar com a Kick</Link>}
              <Link href={session ? "/dashboard" : "/entrar"} className="rounded-lg border border-line bg-panel px-6 py-3.5 font-semibold hover:border-kick">{session ? "Gerenciar meu canal" : "Sou streamer"}</Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-mute"><span>● Feed personalizado</span><span>● Realtime</span><span>● Overlay para OBS</span><span>● Votos por Pix</span></div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-3 rounded-[2rem] bg-kick/10 blur-2xl" />
            <div className="relative rounded-[2rem] border border-line bg-panel p-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-line pb-4"><div><p className="text-xs uppercase tracking-widest text-mute">Votação em destaque</p><p className="mt-1 font-display text-2xl font-extrabold">O que vai entrar na live?</p></div><span className="rounded-full bg-kick px-2.5 py-1 text-xs font-bold text-ink">AO VIVO</span></div>
              {[
                ["01", "Hollow Knight", "48"],
                ["02", "Elden Ring", "31"],
                ["03", "Hades II", "21"],
              ].map(([n, title, pct], i) => <div key={title} className="mt-4 rounded-xl bg-ink p-3"><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-raise font-display font-extrabold text-kick">{n}</span><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><span className="truncate font-semibold">{title}</span><span className="text-sm text-mute">{pct}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-raise"><div className="bar-fill h-full rounded-full bg-kick" style={{ width: `${pct}%` }} /></div></div></div></div>)}
              <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl border border-line p-3"><p className="text-xs text-mute">Votos grátis</p><p className="mt-1 font-display text-2xl font-extrabold">127</p></div><div className="rounded-xl border border-line p-3"><p className="text-xs text-mute">Contribuições</p><p className="mt-1 font-display text-2xl font-extrabold text-gold">R$ 86</p></div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[0.2em] text-kick">Feito para a cultura de live</p><h2 className="mt-2 font-display text-4xl font-extrabold sm:text-5xl">Menos link perdido. Mais participação.</h2><p className="mt-3 text-mute">O StreamChoice transforma a escolha do próximo conteúdo em uma experiência contínua entre streamer e comunidade.</p></div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">{FEATURES.map(([n, t, d]) => <article key={n} className="rounded-2xl border border-line bg-panel p-6 transition hover:-translate-y-0.5 hover:border-kick/50"><span className="text-sm font-bold text-kick">{n}</span><h3 className="mt-5 font-display text-3xl font-extrabold">{t}</h3><p className="mt-2 leading-6 text-mute">{d}</p></article>)}</div>
      </section>

      <section className="border-y border-line bg-panel/60">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-18"><div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-sm font-bold uppercase tracking-[0.2em] text-kick">Seu feed</p><h2 className="mt-2 font-display text-4xl font-extrabold">Siga um streamer e pare de procurar a próxima votação.</h2><p className="mt-3 max-w-2xl text-mute">Cada streamer tem uma página própria com perfil, seguidores, votação atual e histórico. O seu feed reúne as novidades de quem você acompanha.</p></div><Link href={session ? "/feed" : "/entrar"} className="rounded-lg bg-kick px-6 py-3 text-center font-bold text-ink">{session ? "Ir para meu feed" : "Começar agora"}</Link></div></div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 py-10"><div className="flex flex-wrap items-center justify-between gap-3 text-sm text-mute"><span>Stream<span className="text-kick">Choice</span></span><span>O chat decide. A live assiste.</span></div></footer>
    </main>
  );
}
