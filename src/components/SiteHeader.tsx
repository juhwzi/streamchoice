import Link from "next/link";
import { getSession } from "@/lib/session";

export async function SiteHeader() {
  const s = await getSession();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="font-display text-2xl font-extrabold tracking-tight">
          Stream<span className="text-kick">Choice</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {s ? (
            <>
              <Link href="/dashboard" className="text-mute hover:text-white">Meu painel</Link>
              <span className="rounded-full bg-raise px-3 py-1 text-[#E8EEF0]">{s.name}</span>
              <form action="/api/auth/logout" method="post">
                <button className="text-mute hover:text-white">Sair</button>
              </form>
            </>
          ) : (
            <a href="/entrar" className="rounded-md bg-kick px-4 py-2 font-semibold text-ink hover:brightness-110">
              Entrar com a Kick
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
