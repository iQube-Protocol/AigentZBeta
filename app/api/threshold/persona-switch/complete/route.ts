import { NextRequest, NextResponse } from 'next/server';
import { resolvePersonaOrTimeout, PERSONA_TIMEOUT_MESSAGE } from '@/app/api/dev-command-center/_lib/persona';
import { getPersonaSwitchHandshake, issueAuthorizationCode } from '@/services/threshold/gatewaySession';
import { resolveOwnedSwitchTarget, rootScopeForTarget, projectAvailablePersona } from '@/services/threshold/personaRecross';
import { getActivePersonaByPublicRef } from '@/services/identity/getActivePersona';
import { formAgreement, acceptAgreement, authorizeAgreement } from '@/services/constitutional/constitutionalAgreement';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FORBIDDEN_ACTIONS = ['publish', 'commit-funds', 'move-funds', 'delegate-agent', 'disclose-identity-credentials'];

export async function POST(request: NextRequest) {
  const principal = await resolvePersonaOrTimeout(request);
  if (principal.status === 'timeout') return NextResponse.json({ ok: false, error: PERSONA_TIMEOUT_MESSAGE }, { status: 503 });
  if (principal.status === 'unauthenticated') return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const handshakeCode = typeof body?.handshakeCode === 'string' ? body.handshakeCode.trim() : '';
  const action = body?.action === 'authorize' ? 'authorize' : 'inspect';
  if (!handshakeCode) return NextResponse.json({ ok: false, error: 'handshakeCode required' }, { status: 400 });

  const handshake = await getPersonaSwitchHandshake(handshakeCode);
  if (!handshake) return NextResponse.json({ ok: false, error: 'persona switch not found or unavailable' }, { status: 404 });
  if (handshake.status !== 'pending') {
    return NextResponse.json({ ok: false, error: `persona switch is '${handshake.status}', not pending` }, { status: 409 });
  }
  if (handshake.expiresAt && new Date(handshake.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: 'persona switch expired' }, { status: 410 });
  }

  const owned = await resolveOwnedSwitchTarget(
    principal.persona.authProfileId,
    handshake.sourcePrincipalPublicRef,
    handshake.targetPrincipalPublicRef,
  );
  if (!owned) return NextResponse.json({ ok: false, error: 'source and target are not both available to this principal' }, { status: 403 });

  const targetContext = await getActivePersonaByPublicRef(handshake.targetPrincipalPublicRef).catch(() => null);
  if (!targetContext || targetContext.personaId !== owned.target.id) {
    return NextResponse.json({ ok: false, error: 'target persona is not active' }, { status: 409 });
  }
  const grantedScope = rootScopeForTarget(targetContext.cartridgeFlags.isAdmin);
  const safe = {
    source: projectAvailablePersona(owned.source, handshake.sourcePrincipalPublicRef),
    target: projectAvailablePersona(owned.target, handshake.sourcePrincipalPublicRef),
    connectedAgent: handshake.agentAlias,
    requestedScope: grantedScope,
    switchRequiresReauthorization: true,
  };
  if (action === 'inspect') return NextResponse.json({ ok: true, crossing: safe });

  const agreementId = `thr-${handshakeCode}`;
  const formed = await formAgreement(owned.target.id, {
    agreementId,
    displayLabel: `Threshold persona re-crossing → ${handshake.initiatingService}`,
    capabilityRef: `threshold:persona-recross:${handshake.initiatingService}`,
    selectedAgentRef: handshake.agentAlias,
    delegatedAuthority: {
      band: 'L2',
      allowedActions: grantedScope,
      forbiddenActions: FORBIDDEN_ACTIONS,
      allowedSurfaces: ['threshold-gateway'],
      ttlHours: 720,
      maxActions: 1000,
      valueCeiling: null,
    },
    constraints: ['no-redelegation', 'no-money-movement', 'no-identity-disclosure', 'one-session-one-persona'],
    verificationRequirements: ['human-authorized', 'fresh-persona-crossing'],
    settlementTerms: null,
    governingInvariants: ['PRD-THR-001', 'CFS-043'],
  });
  if (!formed.ok) return NextResponse.json({ ok: false, error: `form failed: ${formed.reason}` }, { status: 503 });

  let status = formed.agreement.status;
  if (status === 'proposed') {
    const accepted = await acceptAgreement(owned.target.id, {
      agreementId,
      acceptorType: 'agent',
      acceptorId: handshake.agentAlias,
    });
    if (!accepted.ok) return NextResponse.json({ ok: false, error: `accept failed: ${accepted.reason}` }, { status: 503 });
    status = accepted.agreement.status;
  }
  if (status !== 'authorized') {
    const authorized = await authorizeAgreement(owned.target.id, { agreementId });
    if (!authorized.ok) return NextResponse.json({ ok: false, error: `authorize failed: ${authorized.reason}` }, { status: 403 });
  }

  const issued = await issueAuthorizationCode({
    handshakeCode,
    principalPublicRef: handshake.targetPrincipalPublicRef,
    agentAlias: handshake.agentAlias,
    agreementId,
    grantedScope,
  });
  if ('error' in issued) return NextResponse.json({ ok: false, error: issued.error }, { status: 503 });
  const redirect = new URL(issued.redirectUri);
  redirect.searchParams.set('code', issued.code);
  if (issued.oauthState) redirect.searchParams.set('state', issued.oauthState);
  return NextResponse.json({ ok: true, redirectTo: redirect.toString(), crossing: safe });
}
