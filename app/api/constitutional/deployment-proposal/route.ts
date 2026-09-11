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
import { buildDeploymentObject } from '@/services/constitutional/deploymentObject';
import { mirrorLifecycleToLinear } from '@/services/linear/lifecycleMirror';

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
    /** Whether the CDE consequence-test gate passed (informational on a proposed
     *  object; the gate governs AUTHORIZATION, not the proposal). */
    constitutionalThresholdMet?: boolean;
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

  // Emit the Deployment as a CONSTITUTIONAL OBJECT (Phase 3 — Aigent Z owns the
  // deploy lifecycle; CFS-016 + the P0 object model). The proposal is now a
  // well-formed object in the `proposed` state, composed over the receipt just
  // written — not merely a loose receipt. buildDeploymentObject is PURE and
  // executes NOTHING; a dedicated object store is the registry follow-on, so we
  // return the object's T2-safe projection (its ref is a one-way commitment,
  // never a raw id) rather than persisting it here.
  const deploymentObject = buildDeploymentObject({
    deploymentId: body.packId.trim(),
    displayLabel:
      typeof body.goal === 'string' && body.goal ? `Deploy: ${body.goal.slice(0, 80)}` : undefined,
    packId: body.packId.trim(),
    commitRange: body.commitRange.trim(),
    goal: typeof body.goal === 'string' ? body.goal : undefined,
    proposedReceiptId: receipt.id,
    constitutionalThresholdMet: body.constitutionalThresholdMet === true,
    touchesProtectedFiles: flagged,
  });

  // Linear mirror (observe-mode, soft-fail): the D1 proposal keeps the cycle's
  // issue In Progress with a review-marked comment. Keyed on the goal — when
  // the caller omits it there is no stable key, so the mirror is skipped
  // honestly rather than guessing one.
  const linear =
    typeof body.goal === 'string' && body.goal.trim()
      ? await mirrorLifecycleToLinear({
          delegate: 'operator',
          profile: 'software',
          brief: body.goal.trim(),
          phase: 'deployment_proposed',
          note: `Pack \`${body.packId.trim()}\` — commits \`${body.commitRange.trim().slice(0, 60)}\`, ${validationNotes.length} validation note(s), protectedFiles=${flagged} — receipt \`${receipt.id}\``,
        })
      : { mirrored: false, reason: 'no goal supplied — no stable issue key' };

  return NextResponse.json({
    ok: true,
    linear,
    receiptId: receipt.id,
    // T2-safe projection of the Deployment constitutional object — commitment
    // ref (one-way), lifecycle state, standing band, ladder level, and the
    // execution gate stated on the object itself. NO T0 identifier is serialised.
    deployment: {
      ref: deploymentObject.identity.ref,
      state: deploymentObject.lifecycle.state,
      standingBand: deploymentObject.standing.band,
      ladderLevel: (deploymentObject.payload as { ladderLevel: string }).ladderLevel,
      ratificationRequired: deploymentObject.authority.ratificationRequired,
      executionGate: (deploymentObject.payload as { executionGate: string }).executionGate,
    },
    d1Semantics:
      'Proposal recorded as a Deployment constitutional object (proposed) and DVN-anchorable. Execution stays human (D1): review the chain, then push manually exactly as today.' +
      (flagged ? ' Protected-file diffs flagged — review those diffs individually before pushing (CFS-016 hard boundary 2).' : ''),
  });
}
