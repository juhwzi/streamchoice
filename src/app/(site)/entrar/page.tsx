import { redirect } from "next/navigation";
import { sanitizeNext } from "@/lib/kick/pkce";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  login_negado: "Você cancelou a autorização na Kick.",
  estado_invalido: "A sessão de login expirou. Tente novamente.",
  falha_login: "Não foi possível concluir o login. Tente novamente.",
};

export default async function Entrar({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const { next, erro } = await searchParams;
  const target = sanitizeNext(next);
  if (await getSession()) redirect(target);

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <section className="rounded-xl border border-[#2f3a40] bg-panel p-6">
        <h1 className="font-display text-4xl font-extrabold">Entrar</h1>
        {erro && (
          <p role="alert" className="mt-4 rounded-lg border border-red-400/50 bg-red-400/10 px-3 py-2 text-sm text-red-200">
            {ERRORS[erro] ?? ERRORS.falha_login}
          </p>
        )}
        <a
          href={`/api/auth/kick/login?next=${encodeURIComponent(target)}`}
          className="mt-5 block rounded-lg bg-kick py-3.5 text-center text-lg font-bold text-ink hover:brightness-110"
        >
          Entrar com a Kick
        </a>
        <ul className="mt-5 space-y-2 text-sm text-mute">
          {["Usamos só seu nome e foto públicos.", "Não guardamos o token de acesso da Kick.", "Streamer ou viewer: o papel é definido por canal."].map((t) => (
            <li key={t}><span className="font-bold text-kick">✓ </span>{t}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
