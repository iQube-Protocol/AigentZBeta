/**
 * POST /api/research/run-lifecycle — advance an experiment's research-object
 * lifecycle from a RUN event (CFS-019 §4, instruments ↔ institution).
 *
 * The EXP runners call this after a run publishes: `run-started` moves the
 * object toward `running`; `results-published` takes the single legal step
 * toward `published` (never `replicated` — that is deriveOverview's computed
 * multi-provider signal). The service (services/research/lifecycle) computes
 * the legal transition, refuses illegal ones honestly (records NOTHING), and
 * auto-materialises registry experiments that predate C2.2 before transitioning
 * — all through the ONE receipt path (`research_lifecycle_transition`).
 *
 * Admin-gated identically to /api/research/lifecycle. `personaId` is used
 * server-side for the receipt only — never echoed, never persisted.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { recordExperimentRunLifecycle, type ExperimentRunEvent } from '@/services/research/lifecycle';

export const dynamic = 'force-dynamic';

const RUN_EVENTS: readonly string[] = ['run-started', 'results-published'];

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { experimentId?: string; event?: string; evidence?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  if (!body.experimentId || !body.event || !RUN_EVENTS.includes(body.event)) {
    return NextResponse.json(
      { ok: false, error: 'experimentId and event (run-started | results-published) required' },
      { status: 400 },
    );
  }

  const result = await recordExperimentRunLifecycle({
    personaId: persona.personaId,
    experimentId: body.experimentId,
    event: body.event as ExperimentRunEvent,
    evidence: typeof body.evidence === 'string' ? body.evidence : '',
  });
  // 200 on any resolved outcome — an honest refusal (ok:false, reason) is a
  // valid result the runner surfaces inline, not a transport error.
  return NextResponse.json(result, { status: 200 });
}
