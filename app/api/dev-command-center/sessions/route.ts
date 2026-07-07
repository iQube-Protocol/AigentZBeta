/**
 * /api/dev-command-center/sessions — dev-loop session persistence
 * (Constitutional Development Environment, CFS-020).
 *
 * GET  → { session: DevLoopState | null } — the caller's MOST RECENT session
 *        (`?sessionId=` for a specific one). Strictly caller-owned: rows are
 *        filtered by the resolved persona. persona_id (T0) is NEVER included
 *        in the response — the DB ownership key stays server-internal.
 * POST { session: DevLoopState } → { ok: true } — upsert keyed on session_id.
 *        An upsert against a session_id owned by another persona is a 403.
 *        The state jsonb is T2-guarded: serialized state carrying a T0
 *        identifier key (personaId/authProfileId/rootDid/fioHandle/
 *        kybeAttestation) is rejected — the dev-loop state must never carry
 *        them (findForbiddenStateKey, canary-pinned).
 *
 * Identity via getActivePersona(request) ONLY (identity spine — no parallel
 * resolvers). No admin gate: sessions are persona-owned, nothing more.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { isDevLoopStage, findForbiddenStateKey } from '@/services/devCommandCenter/devLoop';
import type { DevLoopState } from '@/types/devCommandCenter';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const client = getSupabaseServer();
  if (!client) return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });

  const sessionId = request.nextUrl.searchParams.get('sessionId');
  let query = client
    .from('dev_loop_sessions')
    .select('state')
    .eq('persona_id', persona.personaId)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (sessionId) query = query.eq('session_id', sessionId);

  const { data, error } = await query;
  if (error) {
    console.error('[api/dev-command-center/sessions] read failed:', error.message);
    return NextResponse.json({ error: 'read_failed' }, { status: 500 });
  }

  // Only the state jsonb leaves the server — never persona_id (T0).
  const session = (data?.[0]?.state as DevLoopState | undefined) ?? null;
  return NextResponse.json({ session });
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const client = getSupabaseServer();
  if (!client) return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });

  let body: { session?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const session = body.session as Partial<DevLoopState> | null | undefined;
  if (
    !session ||
    typeof session !== 'object' ||
    typeof session.sessionId !== 'string' ||
    session.sessionId.trim().length === 0
  ) {
    return NextResponse.json(
      { error: 'session.sessionId (non-empty string) is required' },
      { status: 400 },
    );
  }
  if (!isDevLoopStage(session.stage)) {
    return NextResponse.json(
      { error: 'session.stage must be a known DevLoopStage' },
      { status: 400 },
    );
  }

  // T2 guard: the dev-loop state must never carry T0 identifiers.
  const forbidden = findForbiddenStateKey(JSON.stringify(session));
  if (forbidden) {
    return NextResponse.json(
      { error: `session state contains forbidden identifier key '${forbidden}'` },
      { status: 400 },
    );
  }

  // Ownership: an upsert against another persona's session_id is a 403.
  const { data: existing, error: readError } = await client
    .from('dev_loop_sessions')
    .select('persona_id')
    .eq('session_id', session.sessionId)
    .maybeSingle();
  if (readError) {
    console.error('[api/dev-command-center/sessions] ownership check failed:', readError.message);
    return NextResponse.json({ error: 'write_failed' }, { status: 500 });
  }
  if (existing && existing.persona_id !== persona.personaId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { error: writeError } = await client.from('dev_loop_sessions').upsert(
    {
      session_id: session.sessionId,
      persona_id: persona.personaId,
      stage: session.stage,
      state: session,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'session_id' },
  );
  if (writeError) {
    console.error('[api/dev-command-center/sessions] upsert failed:', writeError.message);
    return NextResponse.json({ error: 'write_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
