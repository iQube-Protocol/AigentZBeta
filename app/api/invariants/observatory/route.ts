/**
 * GET /api/invariants/observatory — the Constitutional Observatory data backbone
 * (CFS-035 Observatory amendment). Read-only projection of the constitutional
 * field's live state for the iQube Registry "Field" view.
 *
 * It READS the engine, it does not re-instrument: the node registry + the live
 * shadow observations come from `services/invariants/engine.ts`; the field
 * summary comes from the invariant store. No new telemetry pipeline; T1-safe
 * (statement/score meta only, never a personaId).
 *
 * Importing the nodes barrel ensures every Invariant Decision Node is registered
 * (each registers at module load), so the Node View sees all nodes regardless of
 * which surfaces ran in this instance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { allObservations, listRegisteredNodes } from '@/services/invariants/engine';
import { listInvariants, getCanonVersionStamp } from '@/services/invariants/store';
import '@/services/invariants/nodes'; // side-effect: register every node

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  // Any authenticated persona may observe (operators + researchers). T1-safe.
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  // Node View — every registered Invariant Decision Node + its last observation.
  const nodes = listRegisteredNodes();
  const observations = allObservations();
  const nodeView = nodes.map((n) => ({
    ...n,
    lastObservation: observations[n.id] ?? null,
  }));

  // Field summary — the constitutional field's coarse state (from the substrate).
  let fieldSummary: { canonVersion: string | null; knowledgeCount: number } = {
    canonVersion: null,
    knowledgeCount: 0,
  };
  try {
    const [canonVersion, knowledge] = await Promise.all([
      getCanonVersionStamp().catch(() => null),
      // Broad knowledge slice (canonical+validated), standing-ordered, capped in the store.
      listInvariants({}).catch(() => []),
    ]);
    fieldSummary = { canonVersion, knowledgeCount: Array.isArray(knowledge) ? knowledge.length : 0 };
  } catch {
    /* field summary is best-effort */
  }

  // Platform Health — constitutional-observability metrics DERIVED from the
  // observations already collected (projection accuracy = shadow agreement).
  const rankObs = Object.values(observations).filter((o) => 'rankAgreement' in o) as Array<{ rankAgreement: number; topAgreement: boolean }>;
  const valueObs = Object.values(observations).filter((o) => 'delta' in o) as Array<{ delta: number }>;
  const health = {
    nodesRegistered: nodes.length,
    nodesObserved: Object.keys(observations).length,
    // Projection accuracy: mean rank agreement across ranking nodes (1 = faithful).
    meanRankAgreement:
      rankObs.length > 0 ? rankObs.reduce((s, o) => s + o.rankAgreement, 0) / rankObs.length : null,
    // Mean absolute value delta across value nodes (0 = faithful).
    meanValueDelta:
      valueObs.length > 0 ? valueObs.reduce((s, o) => s + Math.abs(o.delta), 0) / valueObs.length : null,
  };

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    nodes: nodeView,
    field: fieldSummary,
    health,
    note: 'Constitutional Observatory v0 — Node View + field summary + derived health. Live shadow observations are per-instance (in-memory); persisted history is a follow-on (CFS-035 Observatory amendment).',
  });
}
