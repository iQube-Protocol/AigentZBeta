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
import { getActivePersona } from '@/services/identity/getActivePersona';

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
  // Fall back to the request's origin so dev / preview / prod all work
  const origin = req.headers.get('origin') || req.nextUrl.origin;
  return origin.replace(/\/$/, '');
}

function computeRefCode(source: ShareSource, personaId: string): string {
  return createHmac('sha256', refSecret())
    .update(`${source}|${personaId}|${refEpoch()}`)
    .digest('hex')
    .substring(0, 16);
}

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  const host = publicHost(request);
  const url = `${host}/?ref=${refCode}&utm_source=${source}`;

  // T1-only response: refCode + url + source. NO personaId / authProfileId
  // / rootDid in the response — the code is the persona's only public
  // referral identifier (and even that's HMAC-derived, not the raw id).
  return NextResponse.json({
    success: true,
    source,
    refCode,
    url,
    epoch: refEpoch(),
  });
}
