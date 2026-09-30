import type { ReactNode } from "react";
import { VerifiedBadge } from "@/components/VerifiedBadge";

export function ProfileHero({
  displayName,
  username,
  avatarUrl,
  bio,
  verified,
  eyebrow,
  badgeLabel,
  actions,
  stats,
}: {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  verified: boolean;
  eyebrow: string;
  badgeLabel: string;
  actions?: ReactNode;
  stats?: ReactNode;
}) {
  return (
    <section className="overflow-visible rounded-[2rem] border border-line bg-panel shadow-2xl shadow-black/20">
      <div className="relative h-52 overflow-visible rounded-t-[2rem] bg-[radial-gradient(circle_at_12%_0%,rgba(83,252,24,.24),transparent_38%),radial-gradient(circle_at_90%_0%,rgba(34,211,238,.10),transparent_34%),linear-gradient(135deg,#121719,#090D0E)]">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-kick/70 to-transparent" />
        <div className="absolute bottom-0 left-5 z-10 translate-y-1/2 sm:left-8">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={`Avatar de ${username}`}
              className="h-28 w-28 rounded-3xl border-[6px] border-panel bg-panel object-cover shadow-2xl sm:h-32 sm:w-32"
            />
          ) : (
            <div className="grid h-28 w-28 place-items-center rounded-3xl border-[6px] border-panel bg-raise font-display text-4xl font-extrabold shadow-2xl sm:h-32 sm:w-32">
              {username.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pb-7 pt-20 sm:px-8 sm:pt-24">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-kick">{eyebrow}</p>
              {verified && <VerifiedBadge />}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="truncate font-display text-4xl font-extrabold leading-tight sm:text-5xl">{displayName}</h1>
            </div>
            <p className="mt-1 text-base font-semibold text-kick">@{username}</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-mute">{bio || "Ainda não adicionou uma bio."}</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-line bg-ink px-3 py-1.5 text-xs font-semibold text-mute">
              {verified && <span className="h-1.5 w-1.5 rounded-full bg-kick shadow-[0_0_8px_rgba(83,252,24,.8)]" />}
              {badgeLabel}
            </div>
          </div>

          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>

        {stats ? <div className="mt-7">{stats}</div> : null}
      </div>
    </section>
  );
}
