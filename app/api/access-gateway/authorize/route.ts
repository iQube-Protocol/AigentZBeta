/**
 * POST /api/access-gateway/authorize — begin a HUMAN crossing ("Continue with
 * Polity Passport", PRD-PAG-001 §2.1 Phase 1, operator-ratified 2026-07-22).
 *
 * The browser consent page (/access-gateway/authorize) calls this once with the
 * authorization request parameters (client_id, redirect_uri, code_challenge
 * [S256], state, claims). We validate the client + redirect against the SHARED
 * Threshold DCR registry (agent_gateway_clients — one client store, both
 * adapters), enforce PKCE S256, filter the requested claims to the Phase-1
 * vocabulary, and create a `pending` HUMAN handshake bound to exactly these
 * parameters in the shared session substrate. No human auth here — this only
 * sets up the request the human will (or won't) consent to. Same-device
 * redirect flow only (QR cross-device is later-phase). Inert until the
 * 20260813000000 migration is applied (503).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHumanPendingHandshake, getRegisteredClientSummary } from '@/services/accessGateway/humanSession';
import { filterRequestedClaims } from '@/services/accessGateway/sessionQube';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const clientId = typeof body?.client_id === 'string' ? body.client_id : '';
  const redirectUri = typeof body?.redirect_uri === 'string' ? body.redirect_uri : '';
  const codeChallenge = typeof body?.code_challenge === 'string' ? body.code_challenge : '';
  const method = typeof body?.code_challenge_method === 'string' ? body.code_challenge_method : '';
  const state = typeof body?.state === 'string' ? body.state : '';

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'invalid_request', error_description: 'client_id and redirect_uri required' }, { status: 400 });
  }
  if (!codeChallenge || method !== 'S256') {
    return NextResponse.json({ error: 'invalid_request', error_description: 'PKCE S256 code_challenge required' }, { status: 400 });
  }

  // Validate the client + redirect_uri against the registered allowlist
  // (Threshold DCR registry — RPs register via /api/threshold/oauth/register).
  const client = await getRegisteredClientSummary(clientId);
  if (!client) return NextResponse.json({ error: 'unauthorized_client' }, { status: 400 });
  if (!client.redirectUris.includes(redirectUri)) {
    return NextResponse.json({ error: 'invalid_request', error_description: 'redirect_uri not registered for this client' }, { status: 400 });
  }

  // Claims, not capabilities: the human channel requests identity CLAIMS from
  // the Phase-1 vocabulary. Unknown claims are dropped, never granted.
  const requestedClaims = filterRequestedClaims(body?.claims ?? body?.scope);

  const created = await createHumanPendingHandshake({
    clientId,
    redirectUri,
    pkceChallenge: codeChallenge,
    oauthState: state,
    requestedClaims,
  });
  if (!created) return NextResponse.json({ error: 'temporarily_unavailable' }, { status: 503 });

  return NextResponse.json({
    handshakeCode: created.handshakeCode,
    expiresAt: created.expiresAt,
    request: {
      clientId: client.clientId,
      clientName: client.clientName,
      requestedClaims,
    },
  });
}
