import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-only client factory. Do NOT import this in client components.
export function getSupabaseServer(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
    global: { headers: { 'X-Client-Info': 'AigentZBeta-Registry-API' } },
  });
}
