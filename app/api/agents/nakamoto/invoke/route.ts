/**
 * POST /api/agents/nakamoto/invoke
 *
 * The governed `invoke` surface of Aigent Nakamoto's Agent Runtime Endpoint
 * (`registry_assets.metadata.runtime.invoke` — services/registry/
 * runtimeDescriptor.ts). Reserved for the Invocation phase; Pulse only ever
 * calls `/health`, never this route.
 *
 * This is deliberately NOT a second implementation of "ask Nakamoto". It
 * delegates to the exact same handler the aigentMe specialist panel already
 * calls — app/api/assistant/ask-agent/route.ts's POST, which in turn calls
 * askSpecialist({specialistId: 'aigent-nakamoto', ...}) in
 * services/agents/specialistRouter.ts. specialistId is pinned here so this
 * agent-scoped route can never be redirected to answer as a different
 * specialist, and the request is otherwise forwarded verbatim (same
 * Authorization header, same body shape: { prompt?, intentId?, cartridge?,
 * handoff? }) so it is governed by the identical identity-spine gate
 * (getActivePersona) as every other spine endpoint — "governed" means the
 * same spine, not a new parallel auth scheme.
 */
import { NextRequest, NextResponse } from 'next/server';
import { POST as askAgent } from '@/app/api/assistant/ask-agent/route';

export const dynamic = 'force-dynamic';

function withCors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();

  let parsed: Record<string, unknown>;
  try {
    const json = JSON.parse(rawBody);
    parsed = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  } catch {
    // Forward the unparsed body verbatim — ask-agent's own invalid-json
    // handling produces the identical 400 this route would otherwise have
    // to reimplement.
    const headers = new Headers(request.headers);
    headers.delete('content-length');
    const forwarded = new NextRequest(request.url, { method: 'POST', headers, body: rawBody });
    return withCors(await askAgent(forwarded));
  }

  const headers = new Headers(request.headers);
  headers.delete('content-length');
  const forwarded = new NextRequest(request.url, {
    method: 'POST',
    headers,
    // specialistId is pinned LAST so a caller-supplied value can never
    // override it — this route only ever speaks for Aigent Nakamoto.
    body: JSON.stringify({ ...parsed, specialistId: 'aigent-nakamoto' }),
  });

  return withCors(await askAgent(forwarded));
}
