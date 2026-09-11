/**
 * GET /api/agents/aegis/health
 *
 * Public, deterministic, non-sensitive health surface for Aegis's Agent
 * Runtime Endpoint (`registry_assets.metadata.runtime.health` —
 * services/registry/runtimeDescriptor.ts). Mirrors app/api/agents/factor/
 * health/route.ts — Aegis is likewise not an LLM-orchestrated chat
 * specialist; it is MoneyPenny's independent assessment engine, invoked
 * through services/aegis/aegisAssessmentService.ts's own API routes.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function withCors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET() {
  return withCors(
    NextResponse.json({
      status: 'ok',
      agent: 'aigent-aegis',
      runtime: 'pipeline',
      timestamp: new Date().toISOString(),
    }),
  );
}
