/**
 * GET /api/agents/moneypenny/health
 *
 * Public, deterministic, non-sensitive health surface for Aigent MoneyPenny's
 * Agent Runtime Endpoint (`registry_assets.metadata.runtime.health` —
 * services/registry/runtimeDescriptor.ts). This is the URL Horizen Pulse
 * polls (services/horizen/pulseEndpoint.ts's resolvePulseEndpoint), mirroring
 * app/api/agents/nakamoto/health/route.ts exactly — same shape, same
 * providers checked, only the reported `agent` differs.
 *
 * Horizen Pilot Closure item 3 (2026-08-09): MoneyPenny's registry_assets row
 * had no `metadata.runtime` at all, so Pulse/Ratify's runtime resolution
 * (already generic — services/registry/runtimeDescriptor.ts,
 * services/horizen/pulseEndpoint.ts) honestly returned null for her, the same
 * way it did for every unpopulated agent. This route is the real,
 * always-reachable health surface the paired migration
 * (20260930002300_moneypenny_runtime_endpoint.sql) points at — never a
 * synthesized URL for a check that doesn't actually exist.
 *
 * Cheap and side-effect-free by design: reports whether MoneyPenny's actual
 * chat runtime (app/api/moneypenny/chat/route.ts's callSovereign('reasoning',
 * ...)) has a live LLM provider configured. It never calls a provider, never
 * calls /chat, and never touches the database.
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
  // Same provider order callSovereign resolves through (services/constitutional/modelRouter.ts) —
  // an absent key degrades the reported runtime rather than failing this check.
  const providersConfigured = [
    process.env.OPENAI_API_KEY ? 'openai' : null,
    process.env.ANTHROPIC_API_KEY ? 'anthropic' : null,
    process.env.VENICE_API_KEY ? 'venice' : null,
  ].filter((p): p is string => Boolean(p));

  return withCors(
    NextResponse.json({
      status: 'ok',
      agent: 'aigent-moneypenny',
      runtime: providersConfigured.length > 0 ? 'llm' : 'template',
      providers: providersConfigured,
      timestamp: new Date().toISOString(),
    }),
  );
}
