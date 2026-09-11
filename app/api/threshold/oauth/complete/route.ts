/**
 * POST /api/threshold/oauth/complete — the HUMAN crossing act.
 *
 * Initial crossings and persona re-crossings share this OAuth completion route.
 * A persona re-cross remains a projection of the same canonical wallet/persona
 * spine: the pending transition already names its target persona; this route
 * verifies the browser principal owns both source and target and then issues the
 * target-bound authorization code. The MCP host performs the PKCE exchange.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import {
  resolvePersonaOrTimeout,
  PERSONA_TIMEOUT_MESSAGE,
} from '@/app/api/dev-command-center/_lib/persona';
import { personaPublicRef } from '@/services/identity/personaReferences';
import { formAgreement, acceptAgreement, authorizeAgreement } from '@/services/constitutional/constitutionalAgreement';
import { getHandshake, getPersonaSwitchHandshake, issueAuthorizationCode } from '@/services/threshold/gatewaySession';
import { normalizeThresholdScope } from '@/services/threshold/requireThresholdSession';
import { getActivePersona, getActivePersonaByPublicRef } from '@/services/identity/getActivePersona';
import { resolveOwnedSwitchTarget, rootScopeForTarget } from '@/services/threshold/personaRecross';

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

  // Persona-switch handshakes use the same table but carry transition metadata.
  // Resolve this first so an adopted switch is not accidentally treated as a
  // fresh base crossing.
  const personaSwitch = await getPersonaSwitchHandshake(handshakeCode);
  if (personaSwitch) {
    if (personaSwitch.status !== 'pending') {
      return NextResponse.json({ ok: false, error: `persona switch is '${personaSwitch.status}', not pending` }, { status: 409 });
    }
    if (!personaSwitch.oauthState?.trim()) {
      return NextResponse.json({ ok: false, error: 'persona switch OAuth state missing; restart the client authorization flow' }, { status: 409 });
    }

    const owned = await resolveOwnedSwitchTarget(
      pr.persona.authProfileId,
      personaSwitch.sourcePrincipalPublicRef,
      personaSwitch.targetPrincipalPublicRef,
    );
    if (!owned) return NextResponse.json({ ok: false, error: 'source and target are not both available to this principal' }, { status: 403 });

    const targetContext = await getActivePersonaByPublicRef(personaSwitch.targetPrincipalPublicRef).catch(() => null);
    if (!targetContext || targetContext.personaId !== owned.target.id) {
      return NextResponse.json({ ok: false, error: 'target persona is not active' }, { status: 409 });
    }
    const grantedScope = rootScopeForTarget(targetContext.cartridgeFlags.isAdmin);
    const agreementId = `thr-${handshakeCode}`;
    const formed = await formAgreement(owned.target.id, {
      agreementId,
      displayLabel: `Threshold persona re-crossing → ${personaSwitch.initiatingService}`,
      capabilityRef: `threshold:persona-recross:${personaSwitch.initiatingService}`,
      selectedAgentRef: personaSwitch.agentAlias,
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
      const accepted = await acceptAgreement(owned.target.id, { agreementId, acceptorType: 'agent', acceptorId: personaSwitch.agentAlias });
      if (!accepted.ok) return NextResponse.json({ ok: false, error: `accept failed: ${accepted.reason}` }, { status: 503 });
      status = accepted.agreement.status;
    }
    if (status !== 'authorized') {
      const authorized = await authorizeAgreement(owned.target.id, { agreementId });
      if (!authorized.ok) return NextResponse.json({ ok: false, error: `authorize failed: ${authorized.reason}` }, { status: 403 });
    }

    const issued = await issueAuthorizationCode({
      handshakeCode,
      principalPublicRef: personaSwitch.targetPrincipalPublicRef,
      agentAlias: personaSwitch.agentAlias,
      agreementId,
      grantedScope,
    });
    if ('error' in issued) return NextResponse.json({ ok: false, error: `could not issue authorization code: ${issued.error}` }, { status: 503 });

    const redirect = new URL(issued.redirectUri);
    redirect.searchParams.set('code', issued.code);
    redirect.searchParams.set('state', personaSwitch.oauthState);
    return NextResponse.json({ ok: true, redirectTo: redirect.toString(), grantedScope, transitionKind: 'persona_switch' });
  }

  const handshake = await getHandshake(handshakeCode);
  if (!handshake) return NextResponse.json({ ok: false, error: 'handshake not found or unavailable' }, { status: 404 });
  if (handshake.status !== 'pending') return NextResponse.json({ ok: false, error: `handshake is '${handshake.status}', not pending` }, { status: 409 });
  if (handshake.expiresAt && new Date(handshake.expiresAt).getTime() < Date.now()) return NextResponse.json({ ok: false, error: 'handshake expired' }, { status: 410 });

  const persona = await getActivePersona(request);
  const hasAdminAuthority = Boolean(persona?.cartridgeFlags.isAdmin);
  const requestedScope = (handshake.requestedScope ?? []).filter((s) => !FORBIDDEN_ACTIONS.includes(s));
  const grantedScope = normalizeThresholdScope(hasAdminAuthority ? [...requestedScope, 'content.asset.upload'] : requestedScope);

  const agentAlias = 'companion_' + createHash('sha256').update('threshold-agent:' + handshakeCode).digest('hex').slice(0, 16);
  const agreementId = `thr-${handshakeCode}`;
  const formed = await formAgreement(personaId, {
    agreementId,
    displayLabel: `Threshold crossing → ${handshake.initiatingService}`,
    capabilityRef: `threshold:crossing:${handshake.initiatingService}`,
    selectedAgentRef: agentAlias,
    delegatedAuthority: {
      band: 'L2',
      allowedActions: grantedScope,
      forbiddenActions: FORBIDDEN_ACTIONS,
      allowedSurfaces: ['threshold-gateway'],
      ttlHours: 720,
      maxActions: 1000,
      valueCeiling: null,
    },
    constraints: ['no-redelegation', 'no-money-movement', 'no-identity-disclosure'],
    verificationRequirements: ['human-authorized'],
    settlementTerms: null,
    governingInvariants: ['PRD-THR-001', 'CFS-043'],
  });
  if (!formed.ok) return NextResponse.json({ ok: false, error: `form failed: ${formed.reason}` }, { status: 503 });

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

  const issued = await issueAuthorizationCode({
    handshakeCode,
    principalPublicRef: personaPublicRef(personaId),
    agentAlias,
    agreementId,
    grantedScope,
  });
  if ('error' in issued) return NextResponse.json({ ok: false, error: `could not issue authorization code: ${issued.error}` }, { status: 503 });

  const redirect = new URL(issued.redirectUri);
  redirect.searchParams.set('code', issued.code);
  if (issued.oauthState) redirect.searchParams.set('state', issued.oauthState);
  return NextResponse.json({ ok: true, redirectTo: redirect.toString(), grantedScope });
}
