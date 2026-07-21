/**
 * GET /.well-known/oauth-protected-resource — MCP OAuth Protected Resource
 * metadata (RFC 9728) for the metaMe Threshold Gateway (PRD-THR-001 §6/§8).
 *
 * The Threshold Gateway MCP endpoint (`/api/threshold/mcp`) is the protected
 * resource; this document tells an MCP client where the authorization server is
 * so it can run the Constitutional Handshake (OAuth 2.1 authorization-code +
 * PKCE) before presenting a bearer. Discovery only — never mutating.
 */

import { NextRequest, NextResponse } from 'next/server';
import { publicOrigin } from '@/utils/publicOrigin';

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
      resource: `${origin}/api/threshold/mcp`,
      authorization_servers: [origin],
      bearer_methods_supported: ['header'],
      resource_name: 'metaMe Threshold Gateway',
      resource_documentation: `${origin}/api/threshold/mcp`,
    }),
  );
}
