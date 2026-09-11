import { NextRequest, NextResponse } from 'next/server';
import { resolvePersonaOrTimeout, PERSONA_TIMEOUT_MESSAGE } from '@/app/api/dev-command-center/_lib/persona';
import { getPersonaSwitchHandshake } from '@/services/threshold/gatewaySession';
import { resolveOwnedSwitchTarget, rootScopeForTarget, projectAvailablePersona } from '@/services/threshold/personaRecross';
import { getActivePersonaByPublicRef } from '@/services/identity/getActivePersona';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Legacy/recovery inspection endpoint. OAuth completion is host-owned. */
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
    const recovery = handshake.status === 'authorized'
      ? 'Human authorization was recorded, but the MCP host did not complete its token exchange. Return to the MCP client and start a fresh persona switch.'
      : `Persona switch is '${handshake.status}'. Start a fresh switch from the MCP client.`;
    return NextResponse.json({ ok: false, error: recovery, status: handshake.status }, { status: 409 });
  }
  if (handshake.expiresAt && new Date(handshake.expiresAt).getTime() < Date.now()) return NextResponse.json({ ok: false, error: 'persona switch expired; start a fresh switch from the MCP client' }, { status: 410 });

  const owned = await resolveOwnedSwitchTarget(principal.persona.authProfileId, handshake.sourcePrincipalPublicRef, handshake.targetPrincipalPublicRef);
  if (!owned) return NextResponse.json({ ok: false, error: 'source and target are not both available to this principal' }, { status: 403 });
  const targetContext = await getActivePersonaByPublicRef(handshake.targetPrincipalPublicRef).catch(() => null);
  if (!targetContext || targetContext.personaId !== owned.target.id) return NextResponse.json({ ok: false, error: 'target persona is not active' }, { status: 409 });
  const safe = { source: projectAvailablePersona(owned.source, handshake.sourcePrincipalPublicRef), target: projectAvailablePersona(owned.target, handshake.sourcePrincipalPublicRef), connectedAgent: handshake.agentAlias, requestedScope: rootScopeForTarget(targetContext.cartridgeFlags.isAdmin), switchRequiresReauthorization: true, oauthOwner: 'mcp-host' };
  if (action === 'inspect') return NextResponse.json({ ok: true, crossing: safe });

  return NextResponse.json({ ok: false, error: 'Return to the MCP client to continue. Persona re-crossing must use the client-owned OAuth state and PKCE verifier; this browser recovery page cannot authorize it directly.', crossing: safe, reauthorizationRequired: true }, { status: 409 });
}
