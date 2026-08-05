/**
 * POST /api/research/track2/[experimentId]/accept-bridges — Stage 9's
 * "Accept all grounded bridges" batch action (operator direction,
 * 2026-08-05: "only where each bridge independently satisfies the existing
 * relationship-validation rules... Never invent an edge simply to satisfy
 * readiness.").
 *
 * A single-bridge Accept already has a canonical path — the EXISTING
 * `POST /api/invariants/[id]/edges` — and the frontend should keep using it
 * for one-at-a-time accepts. This route exists ONLY for the batch case, and
 * it calls the SAME service function (`addEdge`) that route calls, with the
 * SAME validation (relation type, non-empty rationale, no self-loop) — never
 * a looser batch-only rule. Every bridge is evaluated independently; one
 * failure (a cycle, a bad relation type) never blocks the others, mirroring
 * the crystal/assign route's own per-item outcome disclosure.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { personaPublicRef } from '@/services/identity/personaReferences';
import { addEdge } from '@/services/invariants';
import { INVARIANT_EDGE_TYPES, type InvariantEdgeType } from '@/types/invariants';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isEdgeType(v: unknown): v is InvariantEdgeType {
  return typeof v === 'string' && (INVARIANT_EDGE_TYPES as readonly string[]).includes(v);
}

interface BridgeInput {
  fromInvariantId?: unknown;
  toInvariantId?: unknown;
  relation?: unknown;
  rationale?: unknown;
}

interface BridgeOutcome {
  fromInvariantId: string;
  toInvariantId: string;
  written: boolean;
  error: string | null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ experimentId: string }> },
) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
  }

  await params; // experimentId is not used for the write itself — every check below is invariant-scoped, same as the single-edge route.

  let body: { bridges?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 });
  }
  const bridges = Array.isArray(body.bridges) ? (body.bridges as BridgeInput[]) : [];
  if (bridges.length === 0) {
    return NextResponse.json({ ok: false, error: 'bridges must be a non-empty array' }, { status: 400 });
  }

  const outcomes: BridgeOutcome[] = [];
  for (const b of bridges) {
    const fromInvariantId = typeof b.fromInvariantId === 'string' ? b.fromInvariantId.trim() : '';
    const toInvariantId = typeof b.toInvariantId === 'string' ? b.toInvariantId.trim() : '';
    const rationale = typeof b.rationale === 'string' ? b.rationale.trim() : '';

    if (!fromInvariantId || !toInvariantId) {
      outcomes.push({ fromInvariantId, toInvariantId, written: false, error: 'fromInvariantId and toInvariantId are required' });
      continue;
    }
    if (fromInvariantId === toInvariantId) {
      outcomes.push({ fromInvariantId, toInvariantId, written: false, error: 'an invariant cannot relate to itself' });
      continue;
    }
    if (!isEdgeType(b.relation)) {
      outcomes.push({ fromInvariantId, toInvariantId, written: false, error: `relation must be one of: ${INVARIANT_EDGE_TYPES.join(', ')}` });
      continue;
    }
    if (!rationale) {
      outcomes.push({ fromInvariantId, toInvariantId, written: false, error: 'rationale is required' });
      continue;
    }

    try {
      await addEdge({
        fromInvariantId,
        toInvariantId,
        edgeType: b.relation,
        rationale,
        provenance: { recordedBy: personaPublicRef(persona.personaId), recordedAt: new Date().toISOString() },
      });
      outcomes.push({ fromInvariantId, toInvariantId, written: true, error: null });
    } catch (error) {
      outcomes.push({ fromInvariantId, toInvariantId, written: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const written = outcomes.filter((o) => o.written).length;
  return NextResponse.json(
    { ok: true, requested: bridges.length, written, outcomes },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
