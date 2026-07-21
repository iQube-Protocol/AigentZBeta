/**
 * /api/constitutional/agreement — the Constitutional Agreement primitive
 * (CRP-003a Increment 1 / N1; CFI-002, canonical-service-pattern step 3).
 *
 * GET  — the caller's own agreements (admins: all). T2-safe (commitments + refs
 *        + receipt ids only). `?gate=1&capabilityRef=…&agentRef=…` runs the 409
 *        gate check for the caller instead of listing.
 * POST — four actions, spine-authenticated (the caller is the requesting
 *        operator):
 *        { action: 'form',      agreementId, displayLabel, capabilityRef, selectedAgentRef, delegatedAuthority, … }
 *        { action: 'accept',    agreementId, acceptorType, acceptorId, provider? }  → agreement_formed receipt
 *        { action: 'authorize', agreementId }                                       → agreement_authorized receipt (opens the 409 gate)
 *        { action: 'gate',      capabilityRef, selectedAgentRef }                   → 200 if authorized, 409 if not
 *
 * Gating: 503 on spine timeout, 401 unauthenticated. NOT admin-only — an
 * operator forms/accepts/authorizes their OWN agreements; `authorize` re-checks
 * owner-commitment match server-side. No personaId is stored anywhere; the
 * requesting operator is a one-way commitment.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  resolvePersonaOrTimeout,
  PERSONA_TIMEOUT_MESSAGE,
} from '@/app/api/dev-command-center/_lib/persona';
import {
  formAgreement,
  acceptAgreement,
  authorizeAgreement,
  requireAuthorizedAgreement,
  listAgreements,
  agreementOwnerCommitment,
  type DelegatedAuthority,
} from '@/services/constitutional/constitutionalAgreement';

export const dynamic = 'force-dynamic';

async function gate(request: NextRequest) {
  const pr = await resolvePersonaOrTimeout(request);
  if (pr.status === 'timeout') {
    return { error: NextResponse.json({ ok: false, error: PERSONA_TIMEOUT_MESSAGE }, { status: 503 }) };
  }
  if (pr.status === 'unauthenticated') {
    return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  }
  return { persona: pr.persona };
}

function parseDelegatedAuthority(raw: unknown): DelegatedAuthority | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return {
    band: typeof r.band === 'string' ? r.band : 'L2',
    allowedActions: strArr(r.allowedActions),
    forbiddenActions: strArr(r.forbiddenActions),
    allowedSurfaces: strArr(r.allowedSurfaces),
    ttlHours: typeof r.ttlHours === 'number' ? r.ttlHours : 8,
    maxActions: typeof r.maxActions === 'number' ? r.maxActions : 1,
    valueCeiling: typeof r.valueCeiling === 'number' ? r.valueCeiling : null,
  };
}

export async function GET(request: NextRequest) {
  const g = await gate(request);
  if ('error' in g) return g.error;

  const url = new URL(request.url);
  if (url.searchParams.get('gate') === '1') {
    const capabilityRef = url.searchParams.get('capabilityRef') ?? '';
    const selectedAgentRef = url.searchParams.get('agentRef') ?? '';
    if (!capabilityRef || !selectedAgentRef) {
      return NextResponse.json({ ok: false, error: 'capabilityRef + agentRef required for a gate check' }, { status: 400 });
    }
    const result = await requireAuthorizedAgreement({
      capabilityRef,
      selectedAgentRef,
      requestingPersonaId: g.persona.personaId,
    });
    if (!result.ok) return NextResponse.json({ ok: false, ...result }, { status: 409 });
    return NextResponse.json({ ok: true, agreementId: result.agreementId, status: result.status });
  }

  const all = await listAgreements();
  const isAdmin = g.persona.cartridgeFlags?.isAdmin === true;
  const mine = agreementOwnerCommitment(g.persona.personaId);
  const agreements = isAdmin ? all : all.filter((a) => a.object.ownership.ownerCommitment === mine);
  return NextResponse.json({ ok: true, agreements, viewer: { isAdmin } });
}

export async function POST(request: NextRequest) {
  const g = await gate(request);
  if ('error' in g) return g.error;
  const personaId = g.persona.personaId;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== 'string') {
    return NextResponse.json({ ok: false, error: 'action required: form | accept | authorize | gate' }, { status: 400 });
  }

  if (body.action === 'form') {
    const delegatedAuthority = parseDelegatedAuthority(body.delegatedAuthority);
    if (!delegatedAuthority) {
      return NextResponse.json({ ok: false, error: 'delegatedAuthority required (band, allowedActions, forbiddenActions, allowedSurfaces, ttlHours, maxActions)' }, { status: 400 });
    }
    const result = await formAgreement(personaId, {
      agreementId: String(body.agreementId ?? ''),
      displayLabel: String(body.displayLabel ?? ''),
      capabilityRef: String(body.capabilityRef ?? ''),
      selectedAgentRef: String(body.selectedAgentRef ?? ''),
      delegatedAuthority,
      constraints: Array.isArray(body.constraints) ? body.constraints.filter((x): x is string => typeof x === 'string') : undefined,
      verificationRequirements: Array.isArray(body.verificationRequirements) ? body.verificationRequirements.filter((x): x is string => typeof x === 'string') : undefined,
      settlementTerms: body.settlementTerms && typeof body.settlementTerms === 'object' ? (body.settlementTerms as Record<string, unknown>) : null,
      governingInvariants: Array.isArray(body.governingInvariants) ? body.governingInvariants.filter((x): x is string => typeof x === 'string') : undefined,
    });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
    return NextResponse.json({ ok: true, alreadyFormed: result.alreadyFormed, agreement: result.agreement });
  }

  if (body.action === 'accept') {
    const acceptorType = body.acceptorType === 'agent' ? 'agent' : 'operator';
    const result = await acceptAgreement(personaId, {
      agreementId: String(body.agreementId ?? ''),
      acceptorType,
      // Default operator acceptor = the calling persona (server-computed commitment).
      acceptorId: String(body.acceptorId ?? (acceptorType === 'operator' ? personaId : '')),
      provider: typeof body.provider === 'string' ? body.provider : undefined,
    });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
    return NextResponse.json({ ok: true, alreadyAccepted: result.alreadyAccepted, receiptId: result.receiptId, agreement: result.agreement });
  }

  if (body.action === 'authorize') {
    const result = await authorizeAgreement(personaId, { agreementId: String(body.agreementId ?? '') });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
    return NextResponse.json({ ok: true, alreadyAuthorized: result.alreadyAuthorized, receiptId: result.receiptId, agreement: result.agreement });
  }

  if (body.action === 'gate') {
    const result = await requireAuthorizedAgreement({
      capabilityRef: String(body.capabilityRef ?? ''),
      selectedAgentRef: String(body.selectedAgentRef ?? ''),
      requestingPersonaId: personaId,
    });
    if (!result.ok) return NextResponse.json({ ok: false, ...result }, { status: 409 });
    return NextResponse.json({ ok: true, agreementId: result.agreementId, status: result.status });
  }

  return NextResponse.json({ ok: false, error: `unknown action "${String(body.action)}"` }, { status: 400 });
}
