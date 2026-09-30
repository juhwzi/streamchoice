"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Chave anon: só enxerga a projeção pública definida nas policies de RLS. */
export function getBrowserSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }
  return client;
}
