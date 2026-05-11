/**
 * GET /api/wallet/tasks/share-link?source=<bring-a-knight|herald>
 *
 * Mints a deterministic per-persona referral code + a copy-pasteable
 * share URL for the Bring-a-Knight and Herald-of-the-Order task chains.
 * Spine-conformant — persona resolved server-side via getActivePersona.
 *
 * Code derivation:
 *   refCode = HMAC-SHA256(REFERRAL_SHARE_SECRET, `${source}|${personaId}|${epoch}`)
 *             .substring(0, 16)
 *
 * Deterministic so the same persona always gets the same code per
 * source+epoch (operator can rotate by bumping REFERRAL_SHARE_EPOCH);
 * un-correlatable across sources because the source string is in the
 * HMAC input. Codes are NOT stored in DB — they're recomputed on
 * /signup ?ref=<code> lookup using a small known-personas window.
 *
 * URL shape:
 *   https://<host>/?ref=<code>&utm_source=<source>
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { checkAndConsumeRateLimit } from '@/services/rateLimit/rateLimitService';

export const runtime = 'nodejs';

const VALID_SOURCES = ['bring-a-knight', 'herald'] as const;
type ShareSource = typeof VALID_SOURCES[number];

function refSecret(): string {
  return (
    process.env.REFERRAL_SHARE_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'dev-fallback-secret-do-not-use-in-prod'
  );
}

function refEpoch(): string {
  return process.env.REFERRAL_SHARE_EPOCH || 'v1';
}

function publicHost(req: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const origin = req.headers.get('origin') || req.nextUrl.origin;
  return origin.replace(/\/$/, '');
}

function computeRefCode(source: ShareSource, personaId: string): string {
  return createHmac('sha256', refSecret())
    .update(`${source}|${personaId}|${refEpoch()}`)
    .digest('hex')
    .substring(0, 16);
}

function supabaseSr() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Per-persona rate limit — configured in system_rate_limits, editable
  // by the operator via the admin Tasks & Rewards tab.
  const rl = await checkAndConsumeRateLimit({
    endpointKey: 'wallet:tasks:share-link',
    scope: 'persona',
    scopeValue: persona.personaId,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate-limited', retryAfterSeconds: rl.retryAfterSeconds, limit: rl.limit },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds ?? 60) } },
    );
  }

  const sourceParam = request.nextUrl.searchParams.get('source') || 'bring-a-knight';
  if (!(VALID_SOURCES as readonly string[]).includes(sourceParam)) {
    return NextResponse.json(
      { error: `source must be one of ${VALID_SOURCES.join(', ')}` },
      { status: 400 },
    );
  }
  const source = sourceParam as ShareSource;

  const refCode = computeRefCode(source, persona.personaId);
  const epoch = refEpoch();
  const host = publicHost(request);
  const url = `${host}/?ref=${refCode}&utm_source=${source}`;

  // Upsert (code → persona_id) so /api/referral/resolve-code can do
  // the reverse lookup at signup time. PRIMARY KEY on `code` makes
  // the upsert idempotent — same persona generating the same source's
  // share link multiple times is a no-op.
  try {
    await supabaseSr()
      .from('referral_codes')
      .upsert(
        { code: refCode, persona_id: persona.personaId, source, epoch },
        { onConflict: 'code' },
      );
  } catch (err) {
    // Non-fatal: the code is still a valid HMAC; signup-side recomputation
    // can fall through to a brute-force resolver if needed. Log and move on.
    console.warn('[share-link] referral_codes upsert failed:', err);
  }

  return NextResponse.json({
    success: true,
    source,
    refCode,
    url,
    epoch,
  });
}
