import Link from "next/link";
import { getSession } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";
import { VerifiedBadge } from "@/components/VerifiedBadge";

export async function SiteHeader() {
  const session = await getSession();
  let profile: { username: string; avatar: string | null; verified: boolean; isAdmin: boolean } | null = null;

  if (session) {
    const { data: user } = await admin()
      .from("users")
      .select("username, avatar_url, kick_verified, is_admin")
      .eq("id", session.uid)
      .maybeSingle();

    if (user) {
      profile = {
        username: user.username,
        avatar: user.avatar_url,
        verified: user.kick_verified === true,
        isAdmin: user.is_admin === true,
      };
    }
  }

  const canOpenDashboard = !!profile && (profile.verified || profile.isAdmin);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-ink/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="font-display text-2xl font-extrabold tracking-tight">
          Stream<span className="text-kick">Choice</span>
        </Link>

        <nav className="flex items-center gap-1.5 text-sm">
          {session && profile ? (
            <>
              <Link href="/feed" className="hidden rounded-lg px-3 py-2 text-mute transition hover:bg-panel hover:text-white sm:inline-flex">
                Meu feed
              </Link>
              {canOpenDashboard && (
                <Link href="/dashboard" className="hidden rounded-lg px-3 py-2 text-mute transition hover:bg-panel hover:text-white sm:inline-flex">
                  Painel
                </Link>
              )}
              {profile.isAdmin && (
                <Link href="/admin" className="hidden rounded-lg px-3 py-2 text-gold transition hover:bg-panel sm:inline-flex">
                  Admin
                </Link>
              )}

              <Link
                href="/u/me"
                aria-label={`Abrir perfil de @${profile.username}`}
                className="flex items-center gap-2 rounded-full border border-line bg-panel px-2.5 py-1.5 transition hover:border-kick"
              >
                <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-raise text-xs font-bold">
                  {profile.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    profile.username.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="hidden max-w-28 truncate font-semibold sm:block">@{profile.username}</span>
                {profile.verified && <VerifiedBadge />}
              </Link>

              <form action="/api/auth/logout" method="post">
                <button className="rounded-lg px-3 py-2 text-mute transition hover:text-white">Sair</button>
              </form>
            </>
          ) : (
            <Link href="/entrar" className="rounded-lg bg-kick px-4 py-2 font-semibold text-ink transition hover:brightness-110">
              Entrar com a Kick
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
