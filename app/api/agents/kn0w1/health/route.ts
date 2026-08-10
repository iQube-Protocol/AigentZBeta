/**
 * GET /api/agents/kn0w1/health
 *
 * Public, deterministic, non-sensitive health surface for Aigent Know1's
 * Agent Runtime Endpoint (`registry_assets.metadata.runtime.health` —
 * services/registry/runtimeDescriptor.ts). This is the URL Horizen Pulse
 * polls (services/horizen/pulseEndpoint.ts's resolvePulseEndpoint), mirroring
 * app/api/agents/moneypenny/health/route.ts and
 * app/api/agents/nakamoto/health/route.ts exactly — same shape, same
 * providers checked, only the reported `agent` differs.
 *
 * The paired migration (20260810010000_kn0w1_horizen_admission_fields.sql)
 * points `metadata.runtime.health` at this route — never a synthesized URL
 * for a check that doesn't actually exist.
 *
 * Cheap and side-effect-free by design: reports whether Know1's actual chat
 * runtime (app/api/codex/chat/route.ts, which defaults `persona` to
 * 'aigent-kn0w1') has a live LLM provider configured. It never calls a
 * provider, never calls /codex/chat, and never touches the database.
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
      agent: 'aigent-kn0w1',
      runtime: providersConfigured.length > 0 ? 'llm' : 'template',
      providers: providersConfigured,
      timestamp: new Date().toISOString(),
    }),
  );
}
