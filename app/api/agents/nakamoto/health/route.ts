/**
 * GET /api/agents/nakamoto/health
 *
 * Public, deterministic, non-sensitive health surface for Aigent Nakamoto's
 * Agent Runtime Endpoint (`registry_assets.metadata.runtime.health` —
 * services/registry/runtimeDescriptor.ts). This is the URL Horizen Pulse
 * polls (services/horizen/pulseEndpoint.ts's resolvePulseEndpoint).
 *
 * Cheap and side-effect-free by design: it reports whether the specialist
 * runtime Nakamoto actually executes through (askSpecialist('aigent-
 * nakamoto', ...) in services/agents/specialistRouter.ts, the SAME function
 * app/api/assistant/ask-agent/route.ts and this route's sibling
 * /invoke both call) has a live LLM provider configured. It never calls a
 * provider, never calls /invoke, and never touches the database — a health
 * check that could itself fail on cost, latency, or DB contention would be
 * a worse signal than none.
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
  // Mirrors specialistRouter.ts's own provider-order (OpenAI -> Anthropic ->
  // Venice); template fallback still answers real requests when none are
  // configured, so an absent key degrades the reported runtime rather than
  // failing this check.
  const providersConfigured = [
    process.env.OPENAI_API_KEY ? 'openai' : null,
    process.env.ANTHROPIC_API_KEY ? 'anthropic' : null,
    process.env.VENICE_API_KEY ? 'venice' : null,
  ].filter((p): p is string => Boolean(p));

  return withCors(
    NextResponse.json({
      status: 'ok',
      agent: 'aigent-nakamoto',
      runtime: providersConfigured.length > 0 ? 'llm' : 'template',
      providers: providersConfigured,
      timestamp: new Date().toISOString(),
    }),
  );
}
