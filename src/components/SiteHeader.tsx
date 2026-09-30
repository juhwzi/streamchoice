import Link from "next/link";
import { getSession } from "@/lib/session";

export async function SiteHeader() {
  const s = await getSession();
  const profileHref = s ? `/u/${encodeURIComponent(s.name)}` : "/entrar";
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="font-display text-2xl font-extrabold tracking-tight">Stream<span className="text-kick">Choice</span></Link>
        <nav className="flex items-center gap-2 text-sm">
          {s ? <>
            <Link href="/feed" className="hidden rounded-md px-3 py-2 text-mute hover:bg-panel hover:text-white sm:inline-flex">Meu feed</Link>
            <Link href="/dashboard" className="hidden rounded-md px-3 py-2 text-mute hover:bg-panel hover:text-white sm:inline-flex">Painel</Link>
            <Link href={profileHref} className="flex items-center gap-2 rounded-full border border-line bg-panel px-2.5 py-1.5 hover:border-kick"><span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-raise text-xs font-bold">{s.avatar ? <img src={s.avatar} alt="" className="h-full w-full object-cover" /> : s.name.slice(0, 1).toUpperCase()}</span><span className="hidden max-w-32 truncate font-semibold sm:block">{s.name}</span></Link>
            <form action="/api/auth/logout" method="post"><button className="rounded-md px-3 py-2 text-mute hover:text-white">Sair</button></form>
          </> : <Link href="/entrar" className="rounded-md bg-kick px-4 py-2 font-semibold text-ink hover:brightness-110">Entrar com a Kick</Link>}
        </nav>
      </div>
    </header>
  );
}
