/**
 * POST /api/constitutional/deployment-authorization — ICE-8 of the
 * Constitutional Development Environment (CFS-020 CDE), building on CFS-016 D1.
 *
 * Consequence-test-before-deploy: the caller asserts the constitutional
 * threshold is met (the consequence test passed with no unresolved high/
 * critical must-not-happen failures). This route refuses to record an
 * authorization when the caller has not asserted the threshold — the receipt
 * is the AUTHORIZATION record, and authorizing on a failed consequence test is
 * exactly what the CDE forbids.
 *
 * D1 semantics (unchanged): the AUTHORIZATION becomes constitutional (a
 * `deployment_authorized` receipt); the EXECUTION stays human. This route moves
 * no credentials and pushes nothing — the operator runs the pack in Claude Code
 * and pushes manually.
 *
 * POST { goal, constitutionalThresholdMet, validationVerdict?, blockingCount? }
 *   → { ok: true, receiptId }
 *
 * Admin-gated (spine). Summary is T2-safe: goal excerpt + verdict/counts only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let body: {
    goal?: unknown;
    constitutionalThresholdMet?: unknown;
    validationVerdict?: unknown;
    blockingCount?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  if (typeof body.goal !== 'string' || body.goal.trim().length === 0) {
    return NextResponse.json({ ok: false, error: 'goal (non-empty string) is required' }, { status: 400 });
  }
  const goal = body.goal.trim();

  // The consequence-test-before-deploy gate: refuse to authorize when the
  // caller has not asserted a passing consequence test.
  if (body.constitutionalThresholdMet !== true) {
    return NextResponse.json(
      { ok: false, error: 'constitutional threshold not met — deployment cannot be authorized until the consequence test passes' },
      { status: 409 },
    );
  }

  const verdict = typeof body.validationVerdict === 'string' ? body.validationVerdict : 'pass';
  const blockingCount =
    typeof body.blockingCount === 'number' && Number.isFinite(body.blockingCount) ? body.blockingCount : 0;

  // T2-safe summary: goal excerpt + verdict + counts only. No T0 identifiers.
  const receipt = await createActivityReceipt({
    personaId: persona.personaId,
    actionType: 'deployment_authorized',
    summary:
      `deployment authorized (D1) — thresholdMet=true validationVerdict=${verdict} blocking=${blockingCount} ` +
      `goal="${goal.slice(0, 100)}"`,
    activeCartridge: 'agentiq',
  }).catch((err) => {
    console.error('[api/constitutional/deployment-authorization] receipt creation failed', err);
    return null;
  });

  if (!receipt) {
    return NextResponse.json(
      { ok: false, error: 'receipt creation failed — the authorization is not recorded; do not treat as authorized' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    receiptId: receipt.id,
    d1Semantics:
      'Authorization recorded and DVN-anchorable. Execution stays human (D1): the consequence test passed; run the pack in Claude Code and push manually.',
  });
}
