/**
 * GET /api/agents/factor/health
 *
 * Public, deterministic, non-sensitive health surface for Factor's Agent
 * Runtime Endpoint (`registry_assets.metadata.runtime.health` —
 * services/registry/runtimeDescriptor.ts). Mirrors app/api/agents/
 * nakamoto/health/route.ts byte-for-byte in shape.
 *
 * Cheap and side-effect-free by design: Factor is not an LLM-orchestrated
 * chat specialist (it has no RUNTIME_AGENT_IDS/personas.ts entry — it is
 * MoneyPenny's candidate-intake pipeline, invoked through
 * services/factor/factorCaseService.ts's own API routes), so this never
 * reports an 'llm' runtime the way the chat-specialist agents do. It
 * reports 'ok' unconditionally — the pipeline itself has no external
 * provider dependency to check.
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
      agent: 'aigent-factor',
      runtime: 'pipeline',
      timestamp: new Date().toISOString(),
    }),
  );
}
