/**
 * POST /api/threshold/oauth/complete — the HUMAN crossing act (PRD-THR-001 §6).
 *
 * Called from the browser authorize page by the signed-in principal. This single
 * authenticated click performs the whole constitutional delegation on the human's
 * behalf — form → agent-accept → HUMAN-authorize a Constitutional Agreement — and
 * then mints the one-time OAuth authorization code the Companion will exchange for
 * its scoped bearer. The human is the ONLY actor here; the agent never reaches
 * this route (Principal–Delegate Separation, CFS-043 §2).
 *
 * Scope: this crossing grants a READ/PARTICIPATE delegation only (Domain 3 —
 * valueCeiling null, money movement explicitly forbidden). Money-moving delegation
 * is a separate, higher-consequence crossing (MoneyPenny / CRP-003a runtime).
 *
 * Inert until the migration is applied: form/accept/authorize and the session
 * store all soft-fail to null without their tables, so the route returns 503 and
 * mints nothing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import {
  resolvePersonaOrTimeout,
  PERSONA_TIMEOUT_MESSAGE,
} from '@/app/api/dev-command-center/_lib/persona';
import { personaPublicRef } from '@/services/identity/personaReferences';
import { formAgreement, acceptAgreement, authorizeAgreement } from '@/services/constitutional/constitutionalAgreement';
import { getHandshake, issueAuthorizationCode } from '@/services/threshold/gatewaySession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FORBIDDEN_ACTIONS = ['publish', 'commit-funds', 'move-funds', 'delegate-agent', 'disclose-identity-credentials'];

export async function POST(request: NextRequest) {
  const pr = await resolvePersonaOrTimeout(request);
  if (pr.status === 'timeout') return NextResponse.json({ ok: false, error: PERSONA_TIMEOUT_MESSAGE }, { status: 503 });
  if (pr.status === 'unauthenticated') return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  const personaId = pr.persona.personaId;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const handshakeCode = typeof body?.handshakeCode === 'string' ? body.handshakeCode.trim() : '';
  if (!handshakeCode) return NextResponse.json({ ok: false, error: 'handshakeCode required' }, { status: 400 });

  const handshake = await getHandshake(handshakeCode);
  if (!handshake) return NextResponse.json({ ok: false, error: 'handshake not found or unavailable' }, { status: 404 });
  if (handshake.status !== 'pending') {
    return NextResponse.json({ ok: false, error: `handshake is '${handshake.status}', not pending` }, { status: 409 });
  }
  if (handshake.expiresAt && new Date(handshake.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: 'handshake expired' }, { status: 410 });
  }

  const grantedScope = (handshake.requestedScope ?? []).filter((s) => !FORBIDDEN_ACTIONS.includes(s));
  // A T2 alias for the bound Companion — a per-crossing commitment, never a raw id.
  const agentAlias = 'companion_' + createHash('sha256').update('threshold-agent:' + handshakeCode).digest('hex').slice(0, 16);
  const agreementId = `thr-${handshakeCode}`;
  const capabilityRef = `threshold:crossing:${handshake.initiatingService}`;

  // 1. Form the agreement (owner = the signed-in human).
  const formed = await formAgreement(personaId, {
    agreementId,
    displayLabel: `Threshold crossing → ${handshake.initiatingService}`,
    capabilityRef,
    selectedAgentRef: agentAlias,
    delegatedAuthority: {
      band: 'L2',
      allowedActions: grantedScope,
      forbiddenActions: FORBIDDEN_ACTIONS,
      allowedSurfaces: ['threshold-gateway'],
      ttlHours: 720,
      maxActions: 1000,
      valueCeiling: null, // Domain 3 — no money movement on a Threshold crossing
    },
    constraints: ['no-redelegation', 'no-money-movement', 'no-identity-disclosure'],
    verificationRequirements: ['human-authorized'],
    settlementTerms: null,
    governingInvariants: ['PRD-THR-001', 'CFS-043'],
  });
  if (!formed.ok) return NextResponse.json({ ok: false, error: `form failed: ${formed.reason}` }, { status: 503 });

  // The whole delegation is IDEMPOTENT across retries: a prior attempt may have
  // already advanced this agreement (same agreementId = thr-<handshakeCode>) to
  // 'accepted' or 'authorized'. Only run each transition from its valid prior
  // state — re-accepting an already-authorized agreement is illegal and must be
  // skipped, not treated as a failure.
  let status = formed.agreement.status;

  // 2. The agent accepts its OWN side (acceptorType agent) — only from 'proposed'.
  if (status === 'proposed') {
    const accepted = await acceptAgreement(personaId, { agreementId, acceptorType: 'agent', acceptorId: agentAlias });
    if (!accepted.ok) return NextResponse.json({ ok: false, error: `accept failed: ${accepted.reason}` }, { status: 503 });
    status = accepted.agreement.status;
  }

  // 3. The HUMAN authorizes — this click IS the constitutional authorization act.
  //    Skip if a prior attempt already authorized it (authorizeAgreement is itself
  //    idempotent, but skipping avoids a redundant receipt).
  if (status !== 'authorized') {
    const authorized = await authorizeAgreement(personaId, { agreementId });
    if (!authorized.ok) return NextResponse.json({ ok: false, error: `authorize failed: ${authorized.reason}` }, { status: 403 });
  }

  // 4. Mint the one-time OAuth authorization code bound to the crossing (T2 only).
  const issued = await issueAuthorizationCode({
    handshakeCode,
    principalPublicRef: personaPublicRef(personaId),
    agentAlias,
    agreementId,
    grantedScope,
  });
  if ('error' in issued) {
    return NextResponse.json({ ok: false, error: `could not issue authorization code: ${issued.error}` }, { status: 503 });
  }

  const redirect = new URL(issued.redirectUri);
  redirect.searchParams.set('code', issued.code);
  if (issued.oauthState) redirect.searchParams.set('state', issued.oauthState);

  return NextResponse.json({ ok: true, redirectTo: redirect.toString(), grantedScope });
}
