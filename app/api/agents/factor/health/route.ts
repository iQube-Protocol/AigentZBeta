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
 * Capability-runtime contract closure (2026-09-05) — corrects a defect in
 * the 2026-09-05 Factor cognitive-runtime fix: blending per-capability
 * status into the top-level `status` field made this route report
 * 'degraded' PERMANENTLY, since financial_service_composition/
 * vela_confidential_compute/bankr_tokenization/runtime_activation are
 * genuinely 'planned' by design (no fake handlers are ever wired for them —
 * see the manifest's own doc comment) and will stay that way for the
 * foreseeable future. A caller checking whether Factor's RUNTIME is
 * reachable at all got a permanently-red signal for something that was
 * never actually wrong.
 *
 * `status` now answers ONLY "is Factor's pipeline reachable" (this route
 * responding at all proves that — there is no external provider dependency
 * to check, so it is unconditionally 'ok'). `capabilityReadiness` is a
 * SEPARATE, clearly-labeled summary of the manifest's declared per-
 * capability status (services/factor/factorCapabilityManifest.ts) — a
 * planned/advisory capability degrades its own entry in that summary, never
 * the runtime `status` a caller would gate a request on.
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
  const byCapability: Record<string, string> = {};
  let operationalCount = 0;
  for (const cap of FACTOR_CAPABILITIES) {
    byCapability[cap.id] = cap.status;
    if (cap.status === 'operational') operationalCount += 1;
  }
  return withCors(
    NextResponse.json({
      // Runtime reachability only — never blended with capability status.
      status: 'ok',
      agent: 'aigent-factor',
      runtime: 'pipeline',
      capabilityReadiness: {
        summary: `${operationalCount}/${FACTOR_CAPABILITIES.length} capabilities operational`,
        byCapability,
      },
      timestamp: new Date().toISOString(),
    }),
  );
}
