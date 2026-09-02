/**
 * GET /api/moneypenny/financial-profile — MoneyPenny MPY2-2 (SPEC-MPY-002
 * §5). Owner self-view of the persona's Financial Profile.
 *
 * Returns the full derived aggregates/envelope (T0, "BlakQube" tier) to the
 * AUTHENTICATED OWNER ONLY — the same "Owner self-view exception" pattern
 * CLAUDE.md's Identity & Access Spine section documents for
 * `/api/wallet/persona`: the client is the sovereign surface where an owner
 * decrypts and sees their own BlakQube-secured data. This is never the
 * shape returned to any other caller, never forwarded to an external AEE/
 * rendering provider, and never rides a receipt or chain-bound payload.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getFinancialProfileQube } from '@/services/iqube/financialProfileQube';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  const record = await getFinancialProfileQube(persona.personaId);
  if (!record) {
    return NextResponse.json({
      ok: true,
      meta: { hasProfile: false, lastComputedAt: null, sourceUploadCount: 0, unreadableUploadCount: 0 },
      aggregates: null,
      envelope: null,
      riskAssessment: null,
      riskLimits: null,
      computedFromMonths: [],
      inputSource: null,
    });
  }

  return NextResponse.json({
    ok: true,
    meta: record.meta,
    aggregates: record.blak.aggregates ?? null,
    envelope: record.blak.envelope ?? null,
    // MPY2-3 — Risk Envelope. Same owner-self-view discipline as
    // aggregates/envelope above.
    riskAssessment: record.blak.riskAssessment ?? null,
    riskLimits: record.blak.riskLimits ?? null,
    computedFromMonths: record.blak.computedFromMonths ?? [],
    // MPY2-2c — absent on rows computed before this field existed; those
    // are all upload-derived (manual entry didn't exist yet), so the same
    // fallback the compute route uses applies here.
    inputSource: record.blak.aggregates ? (record.blak.inputSource ?? 'uploaded_statements') : null,
  });
}
