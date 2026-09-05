/**
 * GET /api/agents/factor/health
 *
 * Public, deterministic, non-sensitive health surface for Factor's Agent
 * Runtime Endpoint (`registry_assets.metadata.runtime.health` —
 * services/registry/runtimeDescriptor.ts). Mirrors app/api/agents/
 * nakamoto/health/route.ts in overall shape.
 *
 * Cheap and side-effect-free by design: Factor is not an LLM-orchestrated
 * chat specialist in the RUNTIME_AGENT_IDS sense (it is invoked through
 * services/factor/factorCaseService.ts's own API routes for its
 * operational capabilities), so this never reports an 'llm' runtime the
 * way the chat-specialist agents do.
 *
 * Factor cognitive-runtime fix (2026-09-05): an unconditional 'ok' was
 * dishonest once Factor grew a real capability manifest with genuinely
 * partial/advisory/planned capabilities — a caller polling this endpoint
 * to decide whether a capability is safe to invoke deserves the SAME
 * truthful status the manifest itself carries (services/factor/
 * factorCapabilityManifest.ts), never a second, hand-typed readiness list.
 * `status` is 'ok' only when every capability is operational; 'degraded'
 * when any is partial/advisory/planned (Factor is still reachable — some
 * capabilities just aren't fully wired yet).
 */
import { NextResponse } from 'next/server';
import { FACTOR_CAPABILITIES } from '@/services/factor/factorCapabilityManifest';

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
  const capabilities: Record<string, string> = {};
  let allOperational = true;
  for (const cap of FACTOR_CAPABILITIES) {
    capabilities[cap.id] = cap.status;
    if (cap.status !== 'operational') allOperational = false;
  }
  return withCors(
    NextResponse.json({
      status: allOperational ? 'ok' : 'degraded',
      agent: 'aigent-factor',
      runtime: 'pipeline',
      capabilities,
      timestamp: new Date().toISOString(),
    }),
  );
}
