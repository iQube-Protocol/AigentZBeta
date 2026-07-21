/**
 * GET /.well-known/oauth-authorization-server — OAuth 2.1 Authorization Server
 * metadata (RFC 8414) for the metaMe Threshold Constitutional Handshake
 * (PRD-THR-001 §6). Advertises the endpoints an MCP client uses to cross the
 * Threshold: dynamic client registration, the browser authorize page (where the
 * HUMAN establishes their Passport + authorizes delegation), and the token
 * endpoint (PKCE code exchange → scoped bearer). PKCE S256 is REQUIRED.
 */

import { NextRequest, NextResponse } from 'next/server';
import { publicOrigin } from '@/utils/publicOrigin';
import { CONSTITUTIONAL_ROOT_CAPABILITIES, knownCapabilities } from '@/services/threshold/serviceRegistry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function withCors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.headers.set('Cache-Control', 'public, max-age=300');
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  return withCors(
    NextResponse.json({
      issuer: origin,
      // The authorization endpoint is the human-facing browser crossing page:
      // the person signs in, establishes their Passport, and authorizes the
      // bounded delegation. The agent never authorizes here.
      authorization_endpoint: `${origin}/threshold/authorize`,
      token_endpoint: `${origin}/api/threshold/oauth/token`,
      registration_endpoint: `${origin}/api/threshold/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      // PKCE is mandatory — public clients (MCP connectors) carry no secret.
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      // A base crossing is granted ONLY the constitutional-root (navigation)
      // capabilities — so a generic "connect my agent" acquires no service
      // authority. Service capabilities are a distinct class, granted only by a
      // service-initiated crossing; the server enforces this regardless of what a
      // client requests. Advertising only the root class here also stops clients
      // that request "the union of everything" from over-asking at sign-up.
      scopes_supported: [...CONSTITUTIONAL_ROOT_CAPABILITIES],
      'x-metame-capability-classes': {
        constitutional_root: [...CONSTITUTIONAL_ROOT_CAPABILITIES],
        service: Array.from(knownCapabilities()),
        note: 'Base crossing → constitutional_root only. Service capabilities are granted per-service via an incremental, journey-driven crossing that the human authorizes separately.',
      },
    }),
  );
}
