/**
 * POST /api/constitutional/deployment-proposal — D1 of the deployment
 * authority ladder (CFS-016 v1.0, D1 RATIFIED 2026-07-06).
 *
 * D1 semantics, exactly: the PROPOSAL becomes constitutional (a
 * `deployment_proposed` receipt assembling the provenance chain — pack id,
 * commit range, validation evidence, protected-file flag); the EXECUTION
 * stays human. This route moves no credentials and pushes nothing — the
 * operator reviews the receipt chain and pushes manually, exactly as at D0.
 *
 * The protected-file flag is operator self-declaration in v1 (stated
 * honestly); CFS-016's rule applies: flagged proposals require the specific
 * diffs individually operator-reviewed, and any future D2 auto-execution
 * refuses them.
 *
 * Admin-gated (spine).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: {
    packId?: string;
    goal?: string;
    commitRange?: string;
    validationNotes?: string;
    touchesProtectedFiles?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  if (typeof body.packId !== 'string' || !body.packId.trim()) {
    return NextResponse.json({ ok: false, error: 'packId required' }, { status: 400 });
  }
  if (typeof body.commitRange !== 'string' || !body.commitRange.trim()) {
    return NextResponse.json({ ok: false, error: 'commitRange required' }, { status: 400 });
  }
  const validationNotes =
    typeof body.validationNotes === 'string' && body.validationNotes.trim()
      ? body.validationNotes
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
      : [];
  const flagged = body.touchesProtectedFiles === true;

  // T2-safe summary: pack id (a random UUID, not an identifier), commit
  // range, validation evidence count, protected-file flag. No persona data.
  const receipt = await createActivityReceipt({
    personaId: persona.personaId,
    actionType: 'deployment_proposed',
    summary: `deployment proposed (D1) — pack=${body.packId.trim()} commits=${body.commitRange.trim().slice(0, 60)} validation=${validationNotes.length} note(s) protectedFiles=${flagged}${typeof body.goal === 'string' && body.goal ? ` goal="${body.goal.slice(0, 100)}"` : ''}`,
    activeCartridge: 'agentiq',
    artifactsCreated: [body.packId.trim()],
    contextShared: flagged ? ['protected-file-diff-flag'] : [],
  }).catch((err) => {
    console.error('[deployment-proposal] receipt creation failed', err);
    return null;
  });

  if (!receipt) {
    return NextResponse.json(
      { ok: false, error: 'receipt creation failed — the proposal is not recorded; do not treat as proposed' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    receiptId: receipt.id,
    d1Semantics:
      'Proposal recorded and DVN-anchorable. Execution stays human (D1): review the chain, then push manually exactly as today.' +
      (flagged ? ' Protected-file diffs flagged — review those diffs individually before pushing (CFS-016 hard boundary 2).' : ''),
  });
}
