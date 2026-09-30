import Link from "next/link";
import { redirect } from "next/navigation";
import { appUrl } from "@/lib/env";
import { getAccountAccess } from "@/lib/auth/guard";
import { getSession } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) {
    redirect("/entrar?next=/admin");
    return null;
  }

  const access = await getAccountAccess(session.uid);
  if (!access.is_admin) redirect("/");

  const db = admin();
  const [users, verified, channels, polls, activePolls, follows, activities] = await Promise.all([
    db.from("users").select("id", { count: "exact", head: true }),
    db.from("users").select("id", { count: "exact", head: true }).eq("kick_verified", true),
    db.from("channels").select("id", { count: "exact", head: true }).eq("is_active", true),
    db.from("polls").select("id", { count: "exact", head: true }),
    db.from("polls").select("id", { count: "exact", head: true }).neq("status", "completed"),
    db.from("channel_follows").select("id", { count: "exact", head: true }),
    db.from("stream_activities").select("id", { count: "exact", head: true }),
  ]);

  const checks = [
    { label: "Banco Supabase", ok: !users.error, detail: users.error ? "Falha ao consultar users" : "Consultas respondendo" },
    { label: "Perfis verificados", ok: !verified.error, detail: verified.error ? "Migration/coluna kick_verified" : `${verified.count ?? 0} contas verificadas` },
    { label: "Feed social", ok: !activities.error, detail: activities.error ? "stream_activities indisponível" : `${activities.count ?? 0} atividades registradas` },
    { label: "Seguidores", ok: !follows.error, detail: follows.error ? "channel_follows indisponível" : `${follows.count ?? 0} relações` },
    { label: "URL pública", ok: !!process.env.NEXT_PUBLIC_APP_URL, detail: appUrl() },
    { label: "Session secret", ok: !!process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16, detail: "Segredo presente" },
  ];

  const { data: recentActivities } = await db
    .from("stream_activities")
    .select("id, channel_id, activity_type, title, body, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="relative overflow-hidden rounded-[2rem] border border-line bg-panel p-6 shadow-2xl shadow-black/10 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Administração</p>
            <h1 className="mt-2 font-display text-5xl font-extrabold leading-none">Dev control center</h1>
            <p className="mt-3 max-w-2xl text-mute">Área interna para validar saúde da aplicação, dados sociais e fluxos de teste sem expor ferramentas administrativas ao público.</p>
          </div>
          <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs font-bold text-gold">ADMIN</span>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Usuários" value={users.count ?? 0} />
        <Metric label="Verificados" value={verified.count ?? 0} />
        <Metric label="Canais" value={channels.count ?? 0} />
        <Metric label="Rodadas" value={polls.count ?? 0} />
        <Metric label="Ativas" value={activePolls.count ?? 0} />
        <Metric label="Seguimentos" value={follows.count ?? 0} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-kick">Observabilidade</p>
              <h2 className="font-display text-3xl font-extrabold">Checks rápidos</h2>
            </div>
            <span className="text-sm text-mute">{checks.filter((check) => check.ok).length}/{checks.length}</span>
          </div>
          <div className="mt-4 space-y-2">
            {checks.map((check) => (
              <div key={check.label} className="flex items-center justify-between gap-4 rounded-xl border border-line bg-ink px-4 py-3">
                <div className="min-w-0"><p className="font-semibold">{check.label}</p><p className="truncate text-xs text-mute">{check.detail}</p></div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${check.ok ? "bg-kick/10 text-kick" : "bg-red-500/10 text-red-300"}`}>{check.ok ? "OK" : "ERRO"}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-kick">Acesso rápido</p>
          <h2 className="font-display text-3xl font-extrabold">Rotas de teste</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <QuickLink href="/">Home pública</QuickLink>
            <QuickLink href="/feed">Feed social</QuickLink>
            <QuickLink href="/u/me">Seu perfil</QuickLink>
            <QuickLink href="/dashboard">Painel streamer</QuickLink>
          </div>
          <p className="mt-4 text-xs text-mute">Para testar uma sala, use o slug de um canal ativo e abra <code>/c/&lt;slug&gt;</code>.</p>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-kick">Feed interno</p>
            <h2 className="font-display text-3xl font-extrabold">Últimas atividades</h2>
          </div>
          <span className="text-sm text-mute">Sem valores financeiros</span>
        </div>
        <div className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-ink">
          {(recentActivities ?? []).map((activity) => (
            <div key={activity.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0"><p className="truncate font-semibold">{activity.title}</p><p className="text-xs text-mute">{activity.body} · canal {activity.channel_id.slice(0, 8)}</p></div>
              <time className="text-xs text-mute">{new Date(activity.created_at).toLocaleString("pt-BR")}</time>
            </div>
          ))}
          {!recentActivities?.length && <p className="p-6 text-center text-sm text-mute">Nenhuma atividade registrada.</p>}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-line bg-panel p-4"><p className="font-display text-3xl font-extrabold text-kick">{value}</p><p className="mt-1 text-xs text-mute">{label}</p></div>;
}

function QuickLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="flex items-center justify-between rounded-xl border border-line bg-ink px-4 py-3 font-semibold transition hover:border-kick hover:text-kick"><span>{children}</span><span>→</span></Link>;
}
