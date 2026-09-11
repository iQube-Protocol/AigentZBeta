/**
 * POST /api/threshold/service/complete — the incremental service crossing
 * (PRD-THR-001 §9, Increment 4b). The human authorizes an ADDITIONAL, capability-
 * specific delegation that UPGRADES their agent's existing session — "authorize
 * one more thing" — rather than minting a new bearer.
 *
 * For IRL, this forms an agreement whose capabilityRef is the CFS-042 submission
 * capability (`irl:experiment-result:submit`) — distinct from the base crossing
 * agreement — so submit_review re-passes the x409 gate under a real IRL delegation.
 * Only the human reaches this route; the agent never authorizes.
 *
 * Inert until the 4b migration is applied (applyUpgrade soft-fails).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { resolvePersonaOrTimeout, PERSONA_TIMEOUT_MESSAGE } from '@/app/api/dev-command-center/_lib/persona';
import { formAgreement, acceptAgreement, authorizeAgreement } from '@/services/constitutional/constitutionalAgreement';
import { getUpgradeHandshake, applyUpgrade } from '@/services/threshold/gatewaySession';
import { getService } from '@/services/threshold/serviceRegistry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FORBIDDEN_ACTIONS = ['publish', 'commit-funds', 'move-funds', 'delegate-agent', 'disclose-identity-credentials'];

/** Map a service to the capability its incremental delegation must carry. IRL's
 *  submission door checks exactly this capabilityRef (CFS-042). */
const SERVICE_CAPABILITY: Record<string, string> = {
  irl: 'irl:experiment-result:submit',
};

/** GET ?code=… — describe the pending upgrade so the browser page can show what
 *  the incremental crossing asks. Read-only; reveals only the request metadata. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code') ?? '';
  if (!code) return NextResponse.json({ ok: false, error: 'code required' }, { status: 400 });
  const hs = await getUpgradeHandshake(code);
  if (!hs) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
  const svc = getService(hs.service);
  return NextResponse.json({
    ok: true,
    status: hs.status,
    service: hs.service,
    serviceTitle: svc?.title ?? hs.service,
    requestedScope: hs.requestedScope,
    expiresAt: hs.expiresAt,
  });
}

export async function POST(request: NextRequest) {
  const pr = await resolvePersonaOrTimeout(request);
  if (pr.status === 'timeout') return NextResponse.json({ ok: false, error: PERSONA_TIMEOUT_MESSAGE }, { status: 503 });
  if (pr.status === 'unauthenticated') return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  const personaId = pr.persona.personaId;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const handshakeCode = typeof body?.handshakeCode === 'string' ? body.handshakeCode.trim() : '';
  if (!handshakeCode) return NextResponse.json({ ok: false, error: 'handshakeCode required' }, { status: 400 });

  const hs = await getUpgradeHandshake(handshakeCode);
  if (!hs) return NextResponse.json({ ok: false, error: 'upgrade handshake not found or unavailable' }, { status: 404 });
  if (hs.status !== 'pending') return NextResponse.json({ ok: false, error: `upgrade is '${hs.status}', not pending` }, { status: 409 });
  if (hs.expiresAt && new Date(hs.expiresAt).getTime() < Date.now()) return NextResponse.json({ ok: false, error: 'upgrade expired' }, { status: 410 });

  const svc = getService(hs.service);
  const capabilityRef = SERVICE_CAPABILITY[hs.service];
  if (!svc || !capabilityRef) return NextResponse.json({ ok: false, error: `service '${hs.service}' has no incremental delegation defined` }, { status: 400 });

  const grantedScope = (hs.requestedScope ?? []).filter((s) => !FORBIDDEN_ACTIONS.includes(s));
  const agentAlias = 'companion_' + createHash('sha256').update('threshold-agent:' + hs.parentSessionId).digest('hex').slice(0, 16);
  const agreementId = `irlsub-${handshakeCode}`;

  // 1. Form the service delegation (owner = the signed-in human). Idempotent.
  const formed = await formAgreement(personaId, {
    agreementId,
    displayLabel: `Enter ${svc.title} — result submission delegation`,
    capabilityRef,
    selectedAgentRef: agentAlias,
    delegatedAuthority: {
      band: 'L2',
      allowedActions: grantedScope,
      forbiddenActions: FORBIDDEN_ACTIONS,
      allowedSurfaces: ['threshold-gateway', 'irl'],
      ttlHours: 720,
      maxActions: 100,
      valueCeiling: null, // research submission is Domain 3 — no money movement
    },
    constraints: ['no-redelegation', 'no-money-movement', 'no-identity-disclosure'],
    verificationRequirements: ['human-authorized'],
    settlementTerms: null,
    governingInvariants: ['PRD-THR-001', 'CFS-042'],
  });
  if (!formed.ok) return NextResponse.json({ ok: false, error: `form failed: ${formed.reason}` }, { status: 503 });

  // Idempotent transitions (a re-click may have already advanced it).
  let status = formed.agreement.status;
  if (status === 'proposed') {
    const accepted = await acceptAgreement(personaId, { agreementId, acceptorType: 'agent', acceptorId: agentAlias });
    if (!accepted.ok) return NextResponse.json({ ok: false, error: `accept failed: ${accepted.reason}` }, { status: 503 });
    status = accepted.agreement.status;
  }
  if (status !== 'authorized') {
    const authorized = await authorizeAgreement(personaId, { agreementId });
    if (!authorized.ok) return NextResponse.json({ ok: false, error: `authorize failed: ${authorized.reason}` }, { status: 403 });
  }

  // 2. Upgrade the parent session: union the scope + record the service agreement.
  const upgraded = await applyUpgrade({ handshakeCode, agreementId, grantedScope });
  if (!upgraded.ok) return NextResponse.json({ ok: false, error: `upgrade failed: ${upgraded.error}` }, { status: 503 });

  return NextResponse.json({ ok: true, service: hs.service, grantedScope });
}
