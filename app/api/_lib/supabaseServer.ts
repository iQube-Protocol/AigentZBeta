import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-only client factory. Do NOT import this in client components.
export function getSupabaseServer(): SupabaseClient | null {
  // Check multiple environment variable patterns for Supabase configuration
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 
              process.env.SUPABASE_URL ||
              'https://bsjhfvctmduxhohtllly.supabase.co'; // Fallback to known URL
  
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                         process.env.SUPABASE_ANON_KEY ||
                         process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
                         'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzamhmdmN0bWR1eGhvaHRsbGx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1NDgyNTgsImV4cCI6MjA3MzEyNDI1OH0.JVDp4-F6EEXqVQ8sts2Z8KQg168aZ1YdtY53RRM_s7M'; // Fallback to known anon key
  
  if (!url || !serviceRoleKey) {
    console.warn('Supabase configuration missing:', {
      url: !!url,
      serviceRoleKey: !!serviceRoleKey,
      env: process.env.NODE_ENV,
      platform: process.env.VERCEL ? 'Vercel' : process.env.NETLIFY ? 'Netlify' : 'Unknown'
    });
    return null;
  }
  
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
    global: { headers: { 'X-Client-Info': 'AigentZBeta-Registry-API' } },
  });
}
