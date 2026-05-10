/**
 * GET /api/referral/resolve-code?ref=<code>
 *
 * Closes the Bring-a-Knight + Herald loop: a freshly-signed-up persona
 * (or a signup form) calls this with the `ref` query the inviter shared,
 * the route returns the matching persona's public attribution surface,
 * and the signup flow then calls /api/referral/process with the
 * resolved referrer.
 *
 * Public — no auth needed. The code itself is the bearer of attribution
 * intent; matching against referral_codes returns ONLY the referrer's
 * persona id + the source (which task chain) + the epoch the code was
 * minted under. T0 fields (fioHandle, rootDid, authProfileId) are
 * NEVER in the response.
 *
 * Note: the referrer's persona id IS T0 by tier definition, but in this
 * narrow context it's the only resolvable attribution handle the
 * downstream /api/referral/process accepts. Phase F follow-up: extend
 * /api/referral/process to accept a refCode directly so this endpoint
 * doesn't need to surface personaId at all.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function supabaseSr() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function GET(request: NextRequest) {
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
    .select('persona_id, source, epoch, created_at')
    .eq('code', code)
    .maybeSingle();

  if (error) {
    console.error('[resolve-code] lookup error:', error);
    return NextResponse.json({ matched: false, reason: 'lookup-error' }, { status: 200 });
  }
  if (!data) {
    return NextResponse.json({ matched: false }, { status: 200 });
  }

  return NextResponse.json({
    matched: true,
    referrerPersonaId: data.persona_id,
    source: data.source,
    epoch: data.epoch,
  });
}
