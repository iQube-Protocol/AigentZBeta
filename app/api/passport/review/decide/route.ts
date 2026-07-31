/**
 * POST /api/passport/review/decide — steward review decision + issuance.
 *
 * PRD §10 steps 7–9, §14. Gate: spine cartridge-admin (operator decision 3).
 * Body: { applicationId, decision: 'approve'|'deny'|'needs_more_information',
 *         notes?, participantIssueStatus? }
 *
 * Approval issues the passport via the status-machine-driven issuance
 * service: record row + (citizen) privilege standing + transition audit +
 * receipt. The deciding steward's persona is recorded as the actor.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  applyReviewDecision,
  PASSPORT_BUREAU_CARTRIDGE_SLUG,
  type ReviewDecision,
} from '@/services/passport/issuanceService';

export const dynamic = 'force-dynamic';

const DECISIONS: ReadonlyArray<ReviewDecision> = ['approve', 'deny', 'needs_more_information'];

export async function POST(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    const isSteward =
      persona.cartridgeFlags.isAdmin ||
      persona.cartridgeFlags.adminCartridges.includes(PASSPORT_BUREAU_CARTRIDGE_SLUG);
    if (!isSteward) {
      return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const applicationId = typeof body.applicationId === 'string' ? body.applicationId : '';
    const decision = body.decision as ReviewDecision;
    if (!applicationId || !DECISIONS.includes(decision)) {
      return NextResponse.json(
        { ok: false, error: `applicationId and decision (${DECISIONS.join(' | ')}) are required` },
        { status: 400 },
      );
    }
    const participantIssueStatus =
      body.participantIssueStatus === 'provisionally_issued' ? 'provisionally_issued' : 'approved';

    const result = await applyReviewDecision({
      applicationId,
      decision,
      stewardPersonaId: persona.personaId,
      notes: typeof body.notes === 'string' ? body.notes : null,
      participantIssueStatus,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      applicationStatus: result.applicationStatus,
      passportId: result.passportId ?? null,
      receiptId: result.receiptId ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Decision failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
