/**
 * GET /api/homecoming/agent/continuity — the continuity assessment surface
 * (SPEC-HMC-001 Phase 1).
 *
 * `?delegate=<HomecomingDelegateId>` assesses one delegate; omit it to assess the
 * whole roster. READ-ONLY by construction — this route observes platform state
 * and reports which of the five continuity dimensions are satisfiable today. It
 * has no POST/PATCH/DELETE handler and it never advances a migration, never
 * writes a receipt, and never touches an agreement or delegation grant.
 *
 * Principal–Delegate Separation (CFS-043 / SPEC-HMC-001 §9.2 component 6): the
 * assessment's lifecycle stage is hard-capped at `ASSESSABLE_STAGE_CEILING`
 * (stage 4, presence-reconstituted). Stages 5–6 turn on a human act performed in
 * the browser by the principal — there is deliberately no code path here that
 * could reach them. Canary: tests/homecoming.test.ts.
 *
 * Gate: the identity spine (`getActivePersona`) + `cartridgeFlags.isAdmin` — the
 * SAME gate all five sibling /api/homecoming/agent/* routes already carry. This
 * is deliberately not loosened for a read: continuity state describes the whole
 * delegate roster, which is operator surface, not per-citizen surface.
 *
 * T2-safe response: delegate slug, dimension statuses, presence rungs, counts and
 * stage labels only — never a personaId, authProfileId, rootDid, agent UUID, or
 * any other T0 identifier. The caller's persona is resolved server-side for the
 * gate and never echoed back.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { assessAgentContinuity } from '@/services/homecoming/agentContinuity';
import { HOMECOMING_DELEGATES, type HomecomingDelegateId } from '@/types/homecoming';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });
  }

  const requested = new URL(req.url).searchParams.get('delegate')?.trim();
  if (requested && !(HOMECOMING_DELEGATES as readonly string[]).includes(requested)) {
    return NextResponse.json(
      { ok: false, error: `delegate must be one of: ${HOMECOMING_DELEGATES.join(', ')}` },
      { status: 400 },
    );
  }

  const targets: readonly HomecomingDelegateId[] = requested
    ? [requested as HomecomingDelegateId]
    : HOMECOMING_DELEGATES;

  const assessments = [];
  for (const delegate of targets) {
    assessments.push(await assessAgentContinuity(delegate));
  }

  return NextResponse.json(
    {
      ok: true,
      assessments,
      note:
        'Read-only continuity assessment (SPEC-HMC-001 Phase 1). Lifecycle stages 5 (delegation-reauthorized) and 6 (native) are never resolved here — they require a human act by the principal and are excluded by construction, not by omission. Migration execution is not built.',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
