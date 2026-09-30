import "server-only";
import { admin } from "../supabase/admin";

/**
 * RF03 (detecção automática de moderadores) — LIMITAÇÃO CONHECIDA:
 * a API pública oficial da Kick (api.kick.com/public/v1) não expõe endpoint para listar moderadores
 * de um canal; só rotas internas não documentadas, que não devemos usar em produção.
 *
 * Caminho suportado hoje: RF04 (cadastro manual pelo streamer, tabela channel_moderators).
 * Este módulo é o ponto de extensão para a sincronização automática: por exemplo, ao receber o
 * evento de chat da Kick (Events API / webhooks) contendo o badge "moderator" do remetente,
 * chame `markModeratorFromBadge`. Ver docs/DECISOES.md.
 */
export async function markModeratorFromBadge(channelId: string, kickUserId: string): Promise<boolean> {
  const db = admin();
  const { data: user } = await db.from("users").select("id").eq("kick_user_id", kickUserId).maybeSingle();
  if (!user) return false; // só vira moderador quem já tem conta no StreamChoice
  const { error } = await db
    .from("channel_moderators")
    .upsert({ channel_id: channelId, user_id: user.id, is_auto_synced: true }, { onConflict: "channel_id,user_id" });
  return !error;
}
