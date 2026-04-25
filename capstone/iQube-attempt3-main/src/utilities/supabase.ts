import { createClient } from "@supabase/supabase-js";

// Vite exposes only env vars prefixed with VITE_
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

/** Quick connectivity test - call from console or on mount to verify Supabase is reachable */
export async function testSupabaseConnection(): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Supabase not configured" };
  try {
    const { error } = await supabase.from("iqube_wrapped_keys").select("token_id").limit(1);
    return { ok: !error, error: error?.message };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
