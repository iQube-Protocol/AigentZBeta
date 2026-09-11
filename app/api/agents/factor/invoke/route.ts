/**
 * POST /api/agents/factor/invoke
 *
 * The governed `invoke` surface of Factor's Agent Runtime Endpoint
 * (`registry_assets.metadata.runtime.invoke` — services/registry/
 * runtimeDescriptor.ts). Mirrors app/api/agents/nakamoto/invoke/route.ts
 * exactly. Reserved for the Invocation phase; Pulse only ever calls
 * `/health`, never this route.
 *
 * NOT a second implementation of "ask Factor". Delegates to the exact same
 * handler the aigentMe/MoneyPenny specialist panel already calls —
 * app/api/assistant/ask-agent/route.ts's POST, which calls
 * askSpecialist({specialistId: 'factor', ...}) in
 * services/agents/specialistRouter.ts. specialistId is pinned here so this
 * agent-scoped route can never be redirected to answer as a different
 * specialist; the request is otherwise forwarded verbatim, governed by the
 * identical identity-spine gate (getActivePersona) as every other spine
 * endpoint.
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
    // override it — this route only ever speaks for Factor.
    body: JSON.stringify({ ...parsed, specialistId: 'factor' }),
  });

  return withCors(await askAgent(forwarded));
}
