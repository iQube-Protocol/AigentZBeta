/**
 * POST /api/threshold/oauth/register — OAuth Dynamic Client Registration
 * (RFC 7591) for the metaMe Threshold Constitutional Handshake.
 *
 * MCP remote connectors are PUBLIC clients: they register a redirect_uri and
 * rely on PKCE, not a client secret. We store only {client_id, name, redirect
 * allowlist} and return the client_id. No secret is ever issued. Inert until the
 * agent_gateway_clients table exists (returns 503).
 */

import { NextRequest, NextResponse } from 'next/server';
import { registerClient } from '@/services/threshold/gatewaySession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'content-type');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return cors(NextResponse.json({ error: 'invalid_client_metadata' }, { status: 400 }));
  }

  const redirectUris = Array.isArray(body.redirect_uris)
    ? (body.redirect_uris as unknown[]).filter((u): u is string => typeof u === 'string')
    : [];
  if (redirectUris.length === 0) {
    return cors(NextResponse.json({ error: 'invalid_redirect_uri', error_description: 'redirect_uris is required' }, { status: 400 }));
  }
  const clientName = typeof body.client_name === 'string' ? body.client_name : undefined;

  const result = await registerClient({ clientName, redirectUris });
  if (!result) {
    return cors(NextResponse.json({ error: 'temporarily_unavailable' }, { status: 503 }));
  }
  return cors(
    NextResponse.json(
      {
        client_id: result.clientId,
        client_name: clientName ?? null,
        redirect_uris: result.redirectUris,
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code'],
        response_types: ['code'],
      },
      { status: 201 },
    ),
  );
}
