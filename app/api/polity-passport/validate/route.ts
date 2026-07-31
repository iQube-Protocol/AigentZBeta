/**
 * POST /api/polity-passport/validate — dry-run participant application check.
 *
 * Machine surface (PRD §10 step 3): agents validate their application body
 * before submitting. Nothing is persisted; no auth required (the body is the
 * agent's own public application material). Shares the validator with
 * /api/polity-passport/submit so the two can never drift.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateParticipantApplication } from '@/services/passport/participantApplicationValidator';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const result = validateParticipantApplication(body);
    return NextResponse.json(
      { ok: true, valid: result.valid, issues: result.issues },
      { status: 200 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Validation failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
