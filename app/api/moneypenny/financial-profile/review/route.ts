/**
 * POST /api/moneypenny/financial-profile/review — MoneyPenny Turn E
 * (2026-09-02, operator directive: "'real aggregates exist' establishes
 * data availability, while prepared evidence reflects the required user
 * review. A successful extraction alone must not silently count as a
 * reviewed profile.")
 *
 * The ONLY route that marks the persona's current FinancialProfileQube
 * reviewed. Called by an explicit, deliberate button click (never fired on
 * panel mount/view) — see markFinancialProfileReviewed's own header for why
 * that distinction is load-bearing (this is the same "not navigation"
 * discipline hasPreparedFinancialProfile already enforces, extended one
 * step further: not even a successful compute pass, only a real
 * acknowledgment).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  markFinancialProfileReviewed,
  NoFinancialProfileToReviewError,
  FinancialProfileTableMissingError,
} from '@/services/iqube/financialProfileQube';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const record = await markFinancialProfileReviewed(persona.personaId);
    return NextResponse.json({ ok: true, reviewedAt: record.meta.reviewedAt });
  } catch (err) {
    if (err instanceof NoFinancialProfileToReviewError) {
      return NextResponse.json({ ok: false, error: 'no-profile-to-review', detail: err.message }, { status: 409 });
    }
    if (err instanceof FinancialProfileTableMissingError) {
      return NextResponse.json({ ok: false, error: 'financial-profile-unavailable' }, { status: 503 });
    }
    return NextResponse.json(
      { ok: false, error: `This request threw before it could answer: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}.` },
      { status: 500 },
    );
  }
}
