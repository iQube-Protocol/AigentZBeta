import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-only client factory. Do NOT import this in client components.
let cachedClient: SupabaseClient | null = null;

export function getSupabaseServer(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase configuration missing. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
      return null;
    }
    
    cachedClient = createClient(supabaseUrl, supabaseKey);
    return cachedClient;
  } catch (error) {
    console.warn('Failed to create Supabase client:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      env: process.env.NODE_ENV,
    });
    return null;
  }
}
