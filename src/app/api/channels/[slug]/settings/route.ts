import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, readJson } from "@/lib/api";
import { requireSession, resolveRole } from "@/lib/auth/guard";
import { admin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  livepixUrl: z.string().url().max(300).refine((u) => u.startsWith("https://"), "Use https").nullable().optional(),
  webhookSecret: z.string().min(16).max(200).nullable().optional(),
  regenerateObsToken: z.boolean().optional(),
});

/** Somente o STREAMER (dono) altera Pix/webhook/token do OBS. */
export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await requireSession(req);
  if (!s.ok) return s.res;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail(400, "bad_request", "Dados inválidos (segredo: mínimo 16 caracteres; URL: https).");

  const { data: channelForRole } = await admin().from("channels").select("id, owner_id").eq("kick_channel_slug", slug).maybeSingle();
  if (!channelForRole) return fail(404, "channel_not_found", "Canal não encontrado.");
  const role = await resolveRole(s.session.uid, channelForRole);
  if (role !== "STREAMER" && role !== "ADMIN") return fail(403, "forbidden", "Apenas um streamer verificado ou administrador pode alterar as configurações.");

  const update: Record<string, unknown> = {};
  if (parsed.data.livepixUrl !== undefined) update.livepix_url = parsed.data.livepixUrl;
  if (parsed.data.webhookSecret !== undefined) update.livepix_webhook_secret = parsed.data.webhookSecret;
  if (parsed.data.regenerateObsToken) update.obs_token = crypto.randomUUID();
  if (!Object.keys(update).length) return fail(400, "bad_request", "Nada para atualizar.");

  let query = admin()
    .from("channels")
    .update(update)
    .eq("kick_channel_slug", slug);
  if (role !== "ADMIN") query = query.eq("owner_id", s.session.uid);

  const { data, error } = await query.select("id").maybeSingle();
  if (error) return fail(500, "internal", "Falha ao salvar.");
  if (!data) return fail(403, "forbidden", "Não foi possível alterar as configurações deste canal.");
  return NextResponse.json({ ok: true });
}
