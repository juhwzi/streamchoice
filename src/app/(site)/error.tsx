"use client";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <p className="font-display text-7xl font-extrabold leading-none text-line" aria-hidden>!</p>
      <h1 className="mt-3 font-display text-4xl font-extrabold">Algo deu errado</h1>
      <p className="mt-2 text-mute">Não foi possível carregar esta página. Tente novamente.</p>
      <button onClick={reset} className="mt-6 rounded-lg bg-kick px-6 py-3 font-bold text-ink">Tentar de novo</button>
    </main>
  );
}
