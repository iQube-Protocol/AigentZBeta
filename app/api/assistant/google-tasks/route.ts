/**
 * GET /api/assistant/google-tasks
 *
 * Read-only, read-on-demand window into the operator's Google Tasks default
 * list. Returns completed tasks (loggable as proof-of-work Standing signals) and
 * pending tasks (suggested actions). NOTHING is stored — pass-through read; only
 * tasks the operator explicitly turns into a signal (via /api/assistant/standing-
 * signal) are persisted. No activity receipt is emitted for the read itself.
 *
 * Requires the persona to have connected Google Tasks (tasks.readonly). Returns
 * { ok:false, code:'not-connected' } cleanly when they haven't.
 *
 * Auth: persona-scoped via the spine.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getGoogleConnector, type GoogleTaskSummary } from '@/services/google/connectors';
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

  const connector = getGoogleConnector('google.tasks.list');
  if (!connector) {
    return NextResponse.json({ ok: false, error: 'connector-unavailable' }, { status: 500, headers: NO_STORE });
  }

  let result;
  try {
    result = await connector.execute({ maxResults: 100 }, { personaId: persona.personaId, cartridge: 'metame' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, code: 'execute-threw', reason: msg }, { status: 500, headers: NO_STORE });
  }

  if (!result.ok) {
    return NextResponse.json(result, {
      status: result.code === 'not-connected' ? 409 : 502,
      headers: NO_STORE,
    });
  }

  const tasks = (result.output as { tasks: GoogleTaskSummary[] }).tasks ?? [];
  const completed = tasks
    .filter((t) => t.status === 'completed')
    .sort((a, b) => (b.completedIso ?? '').localeCompare(a.completedIso ?? ''));
  const pending = tasks.filter((t) => t.status === 'needsAction');

  return NextResponse.json({ ok: true, completed, pending }, { headers: NO_STORE });
}
