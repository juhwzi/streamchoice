import "server-only";
import { admin } from "../supabase/admin";

export interface SyncedStreamerChannel {
  id: string;
  kick_channel_slug: string;
  is_active: boolean;
}

/**
 * Mantém a regra de negócio em um único lugar:
 * uma conta só possui uma sala e ela fica ativa enquanto o usuário está
 * verificado na Kick. O upsert usa a restrição única de channels(owner_id).
 */
export async function syncStreamerChannel(
  userId: string,
  kickChannelSlug: string | null,
  kickVerified: boolean,
): Promise<SyncedStreamerChannel | null> {
  const db = admin();

  if (!kickVerified || !kickChannelSlug) {
    // Mantém os dados históricos, mas desativa a sala enquanto a conta
    // não estiver verificada. Quando voltar a ser verificada, a sala é reativada.
    const { error } = await db
      .from("channels")
      .update({ is_active: false })
      .eq("owner_id", userId);

    if (error) throw new Error(`Falha ao sincronizar status do canal: ${error.message}`);
    return null;
  }

  const { data, error } = await db
    .from("channels")
    .upsert(
      {
        owner_id: userId,
        kick_channel_slug: kickChannelSlug,
        is_active: true,
      },
      { onConflict: "owner_id" },
    )
    .select("id, kick_channel_slug, is_active")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Falha ao criar/sincronizar o canal.");
  }

  return data as SyncedStreamerChannel;
}
