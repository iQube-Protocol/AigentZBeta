export const dynamic = "force-dynamic";

/**
 * Debug endpoint to check environment variables (v2)
 * DELETE THIS FILE after debugging!
 */

export async function GET() {
  try {
    const envCheck = {
      version: 'v2-with-next-public-support',
      SUPABASE_URL: process.env.SUPABASE_URL ? 
        `${process.env.SUPABASE_URL.substring(0, 30)}...` : 'MISSING',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 
        `${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30)}...` : 'MISSING',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 
        `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...` : 'MISSING',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 
        `${process.env.SUPABASE_ANON_KEY.substring(0, 20)}...` : 'MISSING',
      AGENT_KEY_ENCRYPTION_SECRET: process.env.AGENT_KEY_ENCRYPTION_SECRET ? 
        `${process.env.AGENT_KEY_ENCRYPTION_SECRET.substring(0, 16)}...` : 'MISSING',
      NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ? 
        `${process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...` : 'MISSING',
      NEXT_PUBLIC_AGENT_KEY_ENCRYPTION_SECRET: process.env.NEXT_PUBLIC_AGENT_KEY_ENCRYPTION_SECRET ? 
        `${process.env.NEXT_PUBLIC_AGENT_KEY_ENCRYPTION_SECRET.substring(0, 16)}...` : 'MISSING',
      
      // Show which vars are actually set
      varsSet: {
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
        SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
        AGENT_KEY_ENCRYPTION_SECRET: !!process.env.AGENT_KEY_ENCRYPTION_SECRET,
        NEXT_PUBLIC_AGENT_KEY_ENCRYPTION_SECRET: !!process.env.NEXT_PUBLIC_AGENT_KEY_ENCRYPTION_SECRET
      },
      
      // Expected values (first 30 chars only for security)
      expected: {
        SUPABASE_URL_starts: 'https://bsjhfvctmduxhohtllly',
        ENCRYPTION_KEY_starts: 'e35c7d79651daadd',
        SERVICE_KEY_starts: 'eyJhbGciOiJIUzI1NiIs'
      }
    };

    return new Response(JSON.stringify(envCheck, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
