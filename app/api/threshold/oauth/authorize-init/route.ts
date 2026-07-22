/**
 * POST /api/threshold/oauth/authorize-init — begin an OAuth crossing.
 *
 * The browser authorize page calls this once with the OAuth authorization
 * request parameters (client_id, redirect_uri, code_challenge[S256], state,
 * scope). We validate the client + redirect against the registered allowlist,
 * enforce PKCE S256, and create a `pending` handshake bound to exactly these
 * parameters. Returns the handshake code + a description of the crossing to show
 * the human. No human auth here — this only sets up the request the human will
 * (or won't) authorize. Inert until the tables exist (503).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClient, createPendingHandshake } from '@/services/threshold/gatewaySession';
import { getService, CONSTITUTIONAL_ROOT_CAPABILITIES } from '@/services/threshold/serviceRegistry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const clientId = typeof body?.client_id === 'string' ? body.client_id : '';
  const redirectUri = typeof body?.redirect_uri === 'string' ? body.redirect_uri : '';
  const codeChallenge = typeof body?.code_challenge === 'string' ? body.code_challenge : '';
  const method = typeof body?.code_challenge_method === 'string' ? body.code_challenge_method : '';
  const state = typeof body?.state === 'string' ? body.state : '';
  const scopeStr = typeof body?.scope === 'string' ? body.scope : '';
  const service = typeof body?.service === 'string' && body.service ? body.service : 'polity-passport';

  if (!clientId || !redirectUri) return NextResponse.json({ error: 'invalid_request', error_description: 'client_id and redirect_uri required' }, { status: 400 });
  if (!codeChallenge || method !== 'S256') return NextResponse.json({ error: 'invalid_request', error_description: 'PKCE S256 code_challenge required' }, { status: 400 });

  // Validate the client + redirect_uri against the registered allowlist.
  const client = await getClient(clientId);
  if (!client) return NextResponse.json({ error: 'unauthorized_client' }, { status: 400 });
  if (!client.redirectUris.includes(redirectUri)) {
    return NextResponse.json({ error: 'invalid_request', error_description: 'redirect_uri not registered for this client' }, { status: 400 });
  }

  // Passport-first re-sequencing (PRD-THR-001 §9) + security review Finding 4:
  // the INITIAL client-driven crossing grants constitutional-ROOT navigation
  // authority ONLY. Service-operating capabilities are NEVER folded into this
  // screen from a client-supplied `service` — they are granted exclusively via
  // the incremental, human-authorized service crossing (request_service_capabilities
  // → /threshold/enter-service → /api/threshold/service/complete → applyUpgrade),
  // which is gated on a validated upgrade handshake pinned to the caller's session.
  // This keeps the advertised two-step consent honest: a self-service "connect my
  // agent" can never acquire service authority in one click by asserting a service id.
  // `service` is retained only for the crossing's DISPLAY context (initiatingService).
  const svc = getService(service);
  const scopeCount = scopeStr.split(/\s+/).filter(Boolean).length;
  const requestedScope = Array.from(new Set([...CONSTITUTIONAL_ROOT_CAPABILITIES]));
  if (scopeCount > CONSTITUTIONAL_ROOT_CAPABILITIES.length) {
    // The client asked for more than root at the initial crossing — not granted
    // here by design. Surfaced (not an error) so the agent can route to the
    // incremental service crossing instead.
    // eslint-disable-next-line no-console
    console.log('[threshold] authorize-init: service scope requested at base crossing — granting root only (Finding 4).');
  }
  const created = await createPendingHandshake({
    initiatingService: svc?.id ?? 'polity-passport',
    requestedScope,
    clientId,
    redirectUri,
    pkceChallenge: codeChallenge,
    oauthState: state,
  });
  if (!created) return NextResponse.json({ error: 'temporarily_unavailable' }, { status: 503 });

  return NextResponse.json({
    handshakeCode: created.handshakeCode,
    expiresAt: created.expiresAt,
    crossing: {
      initiatingService: svc?.id ?? 'polity-passport',
      serviceTitle: svc?.title ?? 'Polity Passport',
      requestedScope,
    },
  });
}
