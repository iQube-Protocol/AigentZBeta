import { initAgentiqClient } from '@qriptoagentiq/core-client';
import { SupabaseClient } from '@supabase/supabase-js';

// Server-only client factory. Do NOT import this in client components.
export function getSupabaseServer(): SupabaseClient | null {
  try {
    // Use QubeBase SDK for proper connection management
    const client = initAgentiqClient({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    });
    
    return client.supabase;
  } catch (error) {
    console.warn('Supabase configuration missing. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.', {
      error: error instanceof Error ? error.message : 'Unknown error',
      env: process.env.NODE_ENV,
      platform: process.env.VERCEL ? 'Vercel' : process.env.NETLIFY ? 'Netlify' : process.env.AWS_AMPLIFY ? 'Amplify' : 'Unknown'
    });
    return null;
  }
}
