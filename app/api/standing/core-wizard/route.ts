/**
 * GET  /api/standing/core-wizard — read the persona's Standing Core answers
 *                                  (hydrates the wizard; T1-safe).
 * POST /api/standing/core-wizard — save the Standing Core declaration as
 *                                  self-attested facts; optionally (build:true)
 *                                  derive the Standing Asset Graph.
 *
 * Standing Core is free for every citizen (wizardAccess.core is always true),
 * so this route is not plan-gated — it only requires an authenticated persona.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  saveStandingCore,
  readStandingCore,
  type StandingCoreAnswers,
} from '@/services/standing/standingCore';
import { buildStandingGraph } from '@/services/standing/buildStandingGraph';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'database unavailable' }, { status: 503 });

  const snapshot = await readStandingCore(admin, persona.personaId);
  return NextResponse.json({ ok: true, ...snapshot });
}

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'database unavailable' }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as {
    answers?: StandingCoreAnswers;
    build?: boolean;
  };

  try {
    const saved = await saveStandingCore(admin, persona.personaId, body.answers ?? {});

    // Best-effort graph build — never fails the save if the LLM is unavailable.
    let graph: Record<string, unknown> | null = null;
    let graphError: string | null = null;
    if (body.build && saved.factCount > 0) {
      const result = await buildStandingGraph(admin, saved.profileId);
      if (result.ok) graph = result.graph;
      else graphError = result.error;
    }

    return NextResponse.json({
      ok: true,
      profileId: saved.profileId,
      factCount: saved.factCount,
      graph,
      graphError,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Save failed' },
      { status: 500 },
    );
  }
}
