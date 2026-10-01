"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SearchResults } from "@/lib/types";

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" strokeLinecap="round" />
    </svg>
  );
}

function VerifiedMark() {
  return (
    <span aria-label="Verificado" className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-kick text-[9px] font-black text-ink">
      ✓
    </span>
  );
}

export function GlobalSearch() {
  const [value, setValue] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error("search_failed");
        const data = (await response.json()) as SearchResults;
        setResults(data);
        setOpen(true);
      } catch (error) {
        if ((error as DOMException)?.name !== "AbortError") setResults(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 240);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  const total = (results?.channels.length ?? 0) + (results?.users.length ?? 0);

  return (
    <div ref={rootRef} className="relative hidden min-w-0 flex-1 md:block md:max-w-md">
      <div className={`flex items-center rounded-xl border bg-panel transition ${open ? "border-kick/60" : "border-line focus-within:border-kick/50"}`}>
        <span className="pl-3.5 text-mute"><SearchIcon /></span>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => results && setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && value.trim().length >= 2) {
              window.location.assign(`/buscar?q=${encodeURIComponent(value.trim())}`);
              setOpen(false);
            }
          }}
          aria-label="Pesquisar canais e usuários"
          placeholder="Buscar canais ou usuários..."
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-white outline-none placeholder:text-mute/70"
        />
        {loading && <span className="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-line border-t-kick" aria-label="Buscando" />}
      </div>

      {open && results && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl shadow-black/30">
          {total === 0 ? (
            <div className="p-5 text-center">
              <p className="font-semibold">Nenhum resultado</p>
              <p className="mt-1 text-sm text-mute">Tente outro nome, @username ou canal.</p>
            </div>
          ) : (
            <>
              {results.channels.length > 0 && (
                <section className="p-2">
                  <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-mute">Canais</p>
                  {results.channels.map((channel) => (
                    <Link
                      key={channel.id}
                      href={`/streamer/${channel.kick_channel_slug}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-raise"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-raise">
                        {channel.owner.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={channel.owner.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          channel.kick_channel_slug.slice(0, 1).toUpperCase()
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 truncate font-semibold">
                          {channel.owner.display_name || channel.owner.username}
                          <VerifiedMark />
                        </span>
                        <span className="block truncate text-xs text-mute">@{channel.kick_channel_slug} · Canal</span>
                      </span>
                    </Link>
                  ))}
                </section>
              )}

              {results.users.length > 0 && (
                <section className="border-t border-line p-2">
                  <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-mute">Usuários</p>
                  {results.users.map((user) => (
                    <Link
                      key={user.id}
                      href={`/u/${user.username}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-raise"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-raise">
                        {user.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          user.username.slice(0, 1).toUpperCase()
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 truncate font-semibold">
                          {user.display_name || user.username}
                          {user.kick_verified && <VerifiedMark />}
                        </span>
                        <span className="block truncate text-xs text-mute">@{user.username}{user.kick_verified ? " · Streamer" : " · Usuário"}</span>
                      </span>
                    </Link>
                  ))}
                </section>
              )}

              <Link
                href={`/buscar?q=${encodeURIComponent(results.query)}`}
                onClick={() => setOpen(false)}
                className="flex items-center justify-center border-t border-line px-4 py-3 text-sm font-semibold text-kick hover:bg-raise"
              >
                Ver todos os resultados
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
