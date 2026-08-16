/**
 * POST /api/polity-passport/repair-legacy-linkage — legacy Passport/
 * personhood linkage reconciliation, operator-directed 2026-08-15.
 *
 * For a Passport issued before its `kybe_identity_id` / `root_identity_id`
 * anchors were written — see services/passport/legacyPassportLinkageRepair.ts
 * for the full model and every guarantee (never reissues or supersedes the
 * Passport, never transitions citizen_status/participant_status, never
 * touches persona_id/passport_id/issued_at, never overwrites a conflicting
 * non-null anchor, never invokes §A.5 Passport consolidation).
 *
 * Body: { passportId: string } — the Passport's PUBLIC passport_id.
 * Admin-gated.
 *
 * Response carries everything needed to verify the repair in one call:
 * before/after linkage state and the reconciliation receipt id (or null if
 * nothing was written / already linked).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { repairLegacyPassportLinkage } from '@/services/passport/legacyPassportLinkageRepair';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });

  let body: { passportId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const passportId = body.passportId;
  if (!passportId || typeof passportId !== 'string') {
    return NextResponse.json({ ok: false, error: 'passportId is required' }, { status: 400 });
  }

  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });

  const result = await repairLegacyPassportLinkage(admin, passportId, persona.personaId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, passportId, error: result.reason, detail: result.detail }, { status: 422 });
  }

  return NextResponse.json({
    ok: true,
    passportId: result.passportId,
    alreadyLinked: result.alreadyLinked,
    rootIdentityId: result.rootIdentityId,
    kybeIdentityId: result.kybeIdentityId,
    rootAnchorFilledThisCall: result.rootAnchorFilledThisCall,
    kybeAnchorFilledThisCall: result.kybeAnchorFilledThisCall,
    receiptId: result.receiptId,
    note: result.alreadyLinked
      ? 'Both linkage fields were already set — no write performed (idempotent).'
      : 'Linkage repair written. persona_id, passport_id, issued_at, and all status fields are untouched.',
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    note:
      'POST { passportId } (admin) to reconcile a legacy Passport\'s root_identity_id/kybe_identity_id ' +
      'via the holder\'s persona-cluster principal walk. Never reissues, never transitions status, never §A.5 consolidation.',
  });
}
