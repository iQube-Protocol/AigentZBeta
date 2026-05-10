/**
 * POST /api/wallet/tasks/track-click
 *
 * Records an outbound share-link click for the Bring-a-Knight + Herald
 * task chains. Body: { refCode, source } (both optional). Public — the
 * click is happening from the destination page (no session) and we
 * route attribution via the refCode.
 *
 * Writes to referral_clicks (created on first call). T0-safe: persona
 * id is RESOLVED from the refCode via the referral_codes index; the
 * raw refCode + source are public, and we store the referrer persona
 * id in the row for analytics aggregation server-side. The wallet UI
 * never reads this table directly — analytics consumes it.
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const refCode = typeof body.refCode === 'string' ? body.refCode : null;
    const source = typeof body.source === 'string' ? body.source : null;
    const userAgent = request.headers.get('user-agent') ?? null;
    const referer = request.headers.get('referer') ?? null;

    if (!refCode || !/^[a-f0-9]{16}$/.test(refCode)) {
      return NextResponse.json({ error: 'valid refCode required' }, { status: 400 });
    }

    const sb = supabaseSr();

    // Resolve refCode → referrer persona id (best-effort).
    const { data: codeRow } = await sb
      .from('referral_codes')
      .select('persona_id, source')
      .eq('code', refCode)
      .maybeSingle();

    // Best-effort insert. The table is created on first migration; if the
    // operator hasn't run it yet we silently swallow and return success
    // so the destination page isn't blocked on analytics plumbing.
    try {
      await sb.from('referral_clicks').insert({
        ref_code: refCode,
        referrer_persona_id: codeRow?.persona_id ?? null,
        source: source ?? codeRow?.source ?? null,
        user_agent: userAgent,
        referer,
      });
    } catch (err) {
      console.warn('[track-click] insert failed (table may not exist yet):', err);
    }

    return NextResponse.json({
      success: true,
      matched: !!codeRow,
    });
  } catch (err) {
    console.error('[track-click] error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null);
}
