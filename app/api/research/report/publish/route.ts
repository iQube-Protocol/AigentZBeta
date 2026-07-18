/**
 * POST /api/research/report/publish — stage 3 of the report lifecycle
 * (live draft → canonical → PUBLISHED). Admin-gated + spine-guarded, the
 * same gate as regeneration.
 *
 * Body: { scope?: string; version: number; publish?: boolean }
 *   publish defaults to true; false unpublishes (withdraws from the public
 *   surface without touching the canonical record or its receipt).
 *
 * Publishing requires the version to be minted (receipt_id present) — the
 * public Publications → Reports tab presents reports as receipt-anchored
 * records, so an unminted version cannot go public.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { setReportVersionPublished } from '@/services/research/reportComposition';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { scope?: string; version?: number; publish?: boolean };
  const scope = (body.scope || 'all').trim();
  const version = Number(body.version);
  if (!Number.isInteger(version) || version < 1) {
    return NextResponse.json({ ok: false, error: 'version (integer ≥ 1) is required' }, { status: 400 });
  }

  const result = await setReportVersionPublished(scope, version, body.publish !== false);
  if (!result.ok) {
    return NextResponse.json(result, { status: result.code === 'migration_pending' ? 503 : 400 });
  }
  return NextResponse.json({ ok: true, scope, version, publishedAt: result.publishedAt });
}
