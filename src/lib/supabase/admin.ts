import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";

let client: SupabaseClient | null = null;

/** Service role: ignora RLS. Só deve ser usado em rotas/Server Components, nunca no navegador. */
export function admin(): SupabaseClient {
  if (!client) {
    client = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
