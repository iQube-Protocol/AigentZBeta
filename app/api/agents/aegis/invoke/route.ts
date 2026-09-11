/**
 * POST /api/agents/aegis/invoke
 *
 * The governed `invoke` surface for Aegis as a MoneyPenny/aigentMe
 * specialist. Mirrors app/api/agents/nakamoto/invoke/route.ts and
 * app/api/agents/factor/invoke/route.ts exactly. Aegis is NOT a Horizen
 * pilot-journey participant (services/horizen/registrableAgents.ts
 * deliberately excludes it) — this route exists purely so Aegis can be
 * consulted the same way every other specialist is, never wired into
 * registry_assets.metadata.runtime (that would advertise it into the
 * Horizen pilot surface, which it does not belong to).
 *
 * Delegates to app/api/assistant/ask-agent/route.ts's POST, which calls
 * askSpecialist({specialistId: 'aegis', ...}) in
 * services/agents/specialistRouter.ts. specialistId is pinned here so this
 * route can never be redirected to answer as a different specialist.
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
    // override it — this route only ever speaks for Aegis.
    body: JSON.stringify({ ...parsed, specialistId: 'aegis' }),
  });

  return withCors(await askAgent(forwarded));
}
