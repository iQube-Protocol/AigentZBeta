/**
 * GET /api/referral/resolve-code?ref=<code>
 *
 * Closes the Bring-a-Knight + Herald loop: a freshly-signed-up persona
 * (or a signup form) calls this with the `ref` query the inviter shared,
 * the route confirms the code is valid + which task chain it belongs to,
 * and the signup flow then calls /api/referral/process with the SAME
 * refCode. The /process route resolves the refCode → referrerPersonaId
 * server-side, so the T0 personaId NEVER touches the browser-bound JSON.
 *
 * Public — no auth needed. The code itself is the bearer of attribution
 * intent. T0 fields (personaId, authProfileId, rootDid, fioHandle,
 * kybeAttestation) are NEVER in the response.
 *
 * Rate-limited via system_rate_limits (key: 'referral:resolve-code',
 * scope: 'ip'). Operator-tunable via the admin Tasks & Rewards tab.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAndConsumeRateLimit, getClientIp } from '@/services/rateLimit/rateLimitService';

export const runtime = 'nodejs';

function supabaseSr() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function GET(request: NextRequest) {
  // Per-IP rate limit — public endpoint without auth.
  const clientIp = getClientIp(request.headers);
  const rl = await checkAndConsumeRateLimit({
    endpointKey: 'referral:resolve-code',
    scope: 'ip',
    scopeValue: clientIp,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate-limited', retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds ?? 60) } },
    );
  }

  const code = request.nextUrl.searchParams.get('ref');
  if (!code) {
    return NextResponse.json({ error: 'ref required' }, { status: 400 });
  }
  // Sanity: codes are 16-char hex
  if (!/^[a-f0-9]{16}$/.test(code)) {
    return NextResponse.json({ matched: false, reason: 'invalid-format' }, { status: 200 });
  }

  const sb = supabaseSr();
  const { data, error } = await sb
    .from('referral_codes')
    .select('source, epoch')
    .eq('code', code)
    .maybeSingle();

  if (error) {
    console.error('[resolve-code] lookup error:', error);
    return NextResponse.json({ matched: false, reason: 'lookup-error' }, { status: 200 });
  }
  if (!data) {
    return NextResponse.json({ matched: false }, { status: 200 });
  }

  // T0-safe response: only signal existence + which task chain. The
  // signup flow passes `refCode` back to /api/referral/process which
  // resolves the referrer server-side.
  return NextResponse.json({
    matched: true,
    source: data.source,
    epoch: data.epoch,
  });
}
