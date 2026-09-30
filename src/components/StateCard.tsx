import Link from "next/link";

/** Estado vazio/erro com um próximo passo claro (usado em 404, erro, acesso restrito). */
export function StateCard({ icon, title, text, href, cta }: { icon: string; title: string; text: string; href?: string; cta?: string }) {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <p className="font-display text-7xl font-extrabold leading-none text-line" aria-hidden>{icon}</p>
      <h1 className="mt-3 font-display text-4xl font-extrabold">{title}</h1>
      <p className="mt-2 text-mute">{text}</p>
      {href && cta && (
        <Link href={href} className="mt-6 rounded-lg bg-kick px-6 py-3 font-bold text-ink">{cta}</Link>
      )}
    </main>
  );
}
