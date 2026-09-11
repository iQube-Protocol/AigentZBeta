/**
 * GET /api/assistant/calendar-events
 *
 * Read-only, read-on-demand window into the operator's primary Google Calendar.
 * Returns past events (loggable as actions taken) and upcoming events (prep
 * suggestions). NOTHING is stored — this is a pass-through read; only events the
 * operator explicitly turns into a Standing signal (via /api/assistant/standing-
 * signal) are persisted. No activity receipt is emitted for the read itself.
 *
 * Requires the persona to have connected Google Calendar (calendar.events scope,
 * which already grants read). Returns { ok:false, code:'not-connected' } cleanly
 * when they haven't.
 *
 * Auth: persona-scoped via the spine.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getGoogleConnector, type CalendarEventSummary } from '@/services/google/connectors';
import { getOAuthConfig } from '@/services/google/oauth';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401, headers: NO_STORE });
  }

  const cfg = getOAuthConfig();
  if (!cfg.configured) {
    return NextResponse.json(
      { ok: false, code: 'oauth-not-configured', reason: cfg.reason },
      { status: 503, headers: NO_STORE },
    );
  }

  const connector = getGoogleConnector('google.calendar.list-events');
  if (!connector) {
    return NextResponse.json({ ok: false, error: 'connector-unavailable' }, { status: 500, headers: NO_STORE });
  }

  const url = new URL(req.url);
  const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 30, 1), 90);
  const nowMs = Date.now();

  let result;
  try {
    result = await connector.execute(
      {
        timeMin: new Date(nowMs - days * 864e5).toISOString(),
        timeMax: new Date(nowMs + days * 864e5).toISOString(),
        maxResults: 50,
      },
      { personaId: persona.personaId, cartridge: 'metame' },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, code: 'execute-threw', reason: msg }, { status: 500, headers: NO_STORE });
  }

  if (!result.ok) {
    // 'not-connected' → 409 so the UI can prompt the operator to connect Calendar.
    return NextResponse.json(result, {
      status: result.code === 'not-connected' ? 409 : 502,
      headers: NO_STORE,
    });
  }

  const events = (result.output as { events: CalendarEventSummary[] }).events ?? [];
  const past = events.filter((e) => e.isPast).reverse(); // most-recent past first
  const upcoming = events.filter((e) => !e.isPast);

  return NextResponse.json({ ok: true, past, upcoming }, { headers: NO_STORE });
}
