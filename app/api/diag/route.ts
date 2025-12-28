import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const now = new Date().toISOString();

  // IMPORTANT: Never expose secrets. Only expose booleans and non-sensitive identifiers.
  const payload = {
    now,
    env: process.env.NODE_ENV,
    // set this at build time via env or define in amplify.yml
    backendVersion: process.env.BACKEND_VERSION || 'unknown',
    // prove runtime env vars exist (boolean only)
    paypal: {
      mode: process.env.PAYPAL_MODE || null,
      hasClientId: !!process.env.PAYPAL_CLIENT_ID,
      hasClientSecret: !!process.env.PAYPAL_CLIENT_SECRET,
    },
    supabase: {
      urlHost: safeHost(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL),
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    // show what CORS headers your API will return (should be consistent)
    headersHint: {
      cacheControl: 'no-store',
    },
  };

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}

function safeHost(url?: string | null) {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
