/**
 * /api/public/irl/agreement — the EXTERNAL side of the x409 Constitutional
 * Agreement handshake (CFS-042 Phase 2 / CFS-043a step 4).
 *
 *   GET  ?agreementId=<id>                       → safe status view
 *   POST { action:'accept', agreementId, acceptorId } → the DELEGATE AGENT's
 *         acceptance of the terms it will operate under (x409 idiom).
 *
 * Trust model (capability-URL, honestly stated):
 *   - The agreementId is an UNGUESSABLE slug shared privately with the external
 *     party (a capability reference). Knowing it grants: reading the agreement
 *     status, and binding the acceptance of THE PRE-NAMED AGENT.
 *   - Acceptance can ONLY bind to the agreement's own selectedAgentRef — the
 *     acceptorId MUST equal it. A caller cannot accept as anyone else, cannot
 *     alter terms, and cannot open the gate: acceptance ≠ authorization.
 *   - AUTHORIZATION stays operator-only on the gated route
 *     (POST /api/constitutional/agreement, owner-commitment match) — the
 *     Principal–Delegate Separation safeguard (CFS-043 §2) is untouched.
 *   - The status view exposes only T2-safe fields: status, refs, bounded
 *     authority terms, acceptance provider + commitment hash. Never the owner
 *     commitment, never any persona identifier.
 *
 * The receipt persona for the acceptance record is the Institute's steward of
 * record (RESULTS_STEWARD_PERSONA_ID env) — the external agent has no persona
 * (that is the point); the receipt records the Institute witnessing the
 * acceptance. If unset, the acceptance still stands (receipt fail-soft, the
 * same posture as the service layer).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgreement, acceptAgreement } from '@/services/constitutional/constitutionalAgreement';

export const dynamic = 'force-dynamic';

/** T2-safe projection of an agreement row for the external party. */
function safeView(row: NonNullable<Awaited<ReturnType<typeof getAgreement>>>) {
  return {
    agreementId: row.agreementId,
    displayLabel: row.displayLabel,
    status: row.status,
    capabilityRef: row.capabilityRef,
    selectedAgentRef: row.selectedAgentRef,
    delegatedAuthority: row.object?.payload?.delegatedAuthority ?? null,
    constraints: row.object?.payload?.constraints ?? [],
    verificationRequirements: row.object?.payload?.verificationRequirements ?? [],
    termsCommitment: row.object?.payload?.termsCommitment ?? null,
    acceptance: row.acceptance
      ? { provider: row.acceptance.provider, acceptorType: row.acceptance.acceptorType, commitmentHash: row.acceptance.commitmentHash, acceptedAt: row.acceptance.acceptedAt ?? null }
      : null,
    createdAt: row.createdAt,
  };
}

export async function GET(request: NextRequest) {
  const agreementId = (request.nextUrl.searchParams.get('agreementId') || '').trim();
  if (!agreementId) return NextResponse.json({ ok: false, error: 'agreementId required' }, { status: 400 });
  const row = await getAgreement(agreementId);
  if (!row) return NextResponse.json({ ok: false, error: 'agreement not found' }, { status: 404 });
  return NextResponse.json({ ok: true, agreement: safeView(row) });
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  if (body.action !== 'accept') {
    return NextResponse.json({ ok: false, error: "action must be 'accept' (authorization is operator-only, on the gated route)" }, { status: 400 });
  }
  const agreementId = String(body.agreementId ?? '').trim();
  const acceptorId = String(body.acceptorId ?? '').trim();
  if (!agreementId || !acceptorId) {
    return NextResponse.json({ ok: false, error: 'agreementId and acceptorId required' }, { status: 400 });
  }

  const row = await getAgreement(agreementId);
  if (!row) return NextResponse.json({ ok: false, error: 'agreement not found' }, { status: 404 });

  // The external route can ONLY bind acceptance to the pre-named delegate.
  if (!row.selectedAgentRef || acceptorId !== row.selectedAgentRef) {
    return NextResponse.json(
      { ok: false, error: `acceptorId must equal the agreement's selectedAgentRef ("${row.selectedAgentRef ?? 'unset'}")` },
      { status: 403 },
    );
  }

  const stewardPersonaId = process.env.RESULTS_STEWARD_PERSONA_ID || '';
  const result = await acceptAgreement(stewardPersonaId, {
    agreementId,
    acceptorType: 'agent',
    acceptorId,
    provider: typeof body.provider === 'string' ? body.provider : undefined,
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
  return NextResponse.json({
    ok: true,
    alreadyAccepted: result.alreadyAccepted,
    agreement: safeView(result.agreement),
    next: 'The Institute operator now authorizes (owner-only). Poll GET ?agreementId= until status is authorized, then submit results.',
  });
}
