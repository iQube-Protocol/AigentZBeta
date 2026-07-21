/**
 * /api/constitutional/capability-registry — Constitutional Acceptance
 * (CFS-032 §4/§5, built 2026-07-16).
 *
 * GET  — list the accepted capabilities (the constitutional ledger of
 *        capability, newest first). Admin-gated.
 * POST — two actions, admin-gated, both receipted + DVN-anchorable:
 *        { action: 'register', capabilityId, displayLabel, ... }
 *          → Constitutional Acceptance: admit a SHIPPED capability into the
 *            registry as a governed ConstitutionalObject. Idempotent.
 *        { action: 'operational-validation', capabilityId, evidence }
 *          → the Standing accrual trigger. REFUSED (409) when the capability
 *            is not registered — registration is the eligibility gate.
 *
 * Gating mirrors /api/constitutional/canonical-assets exactly: 503 on
 * identity-spine timeout, 401 unauthenticated, 403 non-admin. T2-safe:
 * responses carry capability ids, refs (one-way commitments), standing,
 * bands, receipt ids — never a persona identifier.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  resolvePersonaOrTimeout,
  PERSONA_TIMEOUT_MESSAGE,
} from '@/app/api/dev-command-center/_lib/persona';
import {
  listRegisteredCapabilities,
  registerCapability,
  recordOperationalValidation,
} from '@/services/constitutional/capabilityRegistry';

export const dynamic = 'force-dynamic';

async function gate(request: NextRequest) {
  const pr = await resolvePersonaOrTimeout(request);
  if (pr.status === 'timeout') {
    return { error: NextResponse.json({ ok: false, error: PERSONA_TIMEOUT_MESSAGE }, { status: 503 }) };
  }
  if (pr.status === 'unauthenticated') {
    return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  }
  if (!pr.persona.cartridgeFlags?.isAdmin) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { persona: pr.persona };
}

export async function GET(request: NextRequest) {
  const g = await gate(request);
  if ('error' in g) return g.error;
  const capabilities = await listRegisteredCapabilities();
  return NextResponse.json({ ok: true, capabilities });
}

export async function POST(request: NextRequest) {
  const g = await gate(request);
  if ('error' in g) return g.error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== 'string') {
    return NextResponse.json({ ok: false, error: 'action required: register | operational-validation' }, { status: 400 });
  }

  if (body.action === 'register') {
    const result = await registerCapability(g.persona.personaId, {
      capabilityId: String(body.capabilityId ?? ''),
      displayLabel: String(body.displayLabel ?? ''),
      description: typeof body.description === 'string' ? body.description : undefined,
      packId: typeof body.packId === 'string' ? body.packId : undefined,
      prNumber: typeof body.prNumber === 'number' ? body.prNumber : undefined,
      mergeCommit: typeof body.mergeCommit === 'string' ? body.mergeCommit : undefined,
      validationReceiptIds: Array.isArray(body.validationReceiptIds)
        ? body.validationReceiptIds.filter((x): x is string => typeof x === 'string')
        : undefined,
      deploymentReceiptId: typeof body.deploymentReceiptId === 'string' ? body.deploymentReceiptId : undefined,
      governingInvariants: Array.isArray(body.governingInvariants)
        ? body.governingInvariants.filter((x): x is string => typeof x === 'string')
        : undefined,
      reuseDisposition: typeof body.reuseDisposition === 'string' ? body.reuseDisposition : undefined,
    });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
    return NextResponse.json({
      ok: true,
      alreadyRegistered: result.alreadyRegistered,
      receiptId: result.receiptId,
      capability: result.capability,
    });
  }

  if (body.action === 'operational-validation') {
    const result = await recordOperationalValidation(g.persona.personaId, {
      capabilityId: String(body.capabilityId ?? ''),
      evidence: String(body.evidence ?? ''),
    });
    if (!result.ok) {
      // The eligibility-gate refusal is a 409 (a valid, resolved outcome —
      // the run-lifecycle honest-refusal pattern), other failures 400.
      const gateRefusal = result.reason.includes('not registered');
      return NextResponse.json({ ok: false, error: result.reason }, { status: gateRefusal ? 409 : 400 });
    }
    return NextResponse.json({
      ok: true,
      receiptId: result.receiptId,
      standingBefore: result.standingBefore,
      standingAfter: result.standingAfter,
      capability: result.capability,
    });
  }

  return NextResponse.json({ ok: false, error: `unknown action "${String(body.action)}"` }, { status: 400 });
}
