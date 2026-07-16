/**
 * GET /api/invariants/observatory — the Constitutional Observatory data backbone
 * (CFS-035 Observatory amendment). Read-only projection of the constitutional
 * field's live state for the iQube Registry "Field" view.
 *
 * It READS the engine, it does not re-instrument: the node registry + the live
 * shadow observations come from `services/invariants/engine.ts`; the field
 * summary + namespace rollup come from the invariant store + `measurement.ts`;
 * the discovery-dimension weights come from the SAME `deriveDimensionWeights`
 * the live projector uses. No new telemetry pipeline; T1-safe (statement/score
 * meta only, never a personaId — invariants carry no persona data).
 *
 * Importing the nodes barrel ensures every Invariant Decision Node is registered
 * (each registers at module load), so the Node View sees all nodes regardless of
 * which surfaces ran in this instance.
 *
 * Five perspectives (CFS-035 §12): Node · Field · Graph · Projection · Health.
 * v0 serves Node + Field + Projection + Health from live/DB signals; Graph is a
 * follow-on (edge traversal) and persisted observation history is a follow-on.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { allObservations, listRegisteredNodes } from '@/services/invariants/engine';
import { listInvariants, getCanonVersionStamp, getInvariantsBySeedIds } from '@/services/invariants/store';
import { computeMeasurementRollup } from '@/services/invariants/measurement';
import { getObservationHistory, type NodeObservationRollup } from '@/services/invariants/observationStore';
import { getNodeFlip } from '@/services/invariants/flipStore';
import {
  DIMENSION_INVARIANT_SEED,
  deriveDimensionWeights,
  getDiscoveryFieldSnapshot,
  DISCOVERY_RANKING_NODE_ID,
} from '@/services/invariants/nodes/discoveryRanking';
import '@/services/invariants/nodes'; // side-effect: register every node

export const dynamic = 'force-dynamic';

type DiscoveryDim = 'importance' | 'novelty' | 'trust' | 'need';

export async function GET(req: NextRequest): Promise<Response> {
  // Any authenticated persona may observe (operators + researchers). T1-safe.
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  // ── Node View — every registered Invariant Decision Node + its last (in-instance)
  //    observation + its persisted history rollup (durable across instances).
  const nodes = listRegisteredNodes();
  const observations = allObservations();
  const history = await getObservationHistory().catch(() => ({ total: 0, byNode: [] as NodeObservationRollup[], persistenceAvailable: false }));
  const historyByNode = new Map(history.byNode.map((h) => [h.nodeId, h] as const));
  const nodeView = nodes.map((n) => ({
    ...n,
    lastObservation: observations[n.id] ?? null,
    history: historyByNode.get(n.id) ?? null,
  }));

  // ── Field summary + namespace rollup (the constitutional field's state) ──────
  let canonVersion: string | null = null;
  let totalInvariants = 0;
  let byNamespace: unknown[] = [];
  let topReused: unknown[] = [];
  let groundedReceiptCount: number | null = null;
  try {
    const [stamp, rollup] = await Promise.all([
      getCanonVersionStamp().catch(() => null),
      computeMeasurementRollup().catch(() => null),
    ]);
    canonVersion = stamp;
    if (rollup) {
      totalInvariants = rollup.totalInvariants;
      byNamespace = rollup.byNamespace;
      topReused = rollup.topReused;
      groundedReceiptCount = rollup.groundedReceiptCount;
    }
  } catch {
    /* field summary is best-effort */
  }

  // ── Projection View — the discovery-ranking node's live dimension weights ────
  // Uses the SAME deriveDimensionWeights the projector uses, over the SAME cached
  // discovery Field Snapshot — so what the Observatory shows is what the runtime
  // projects. Faithful (all-1) until the discovery invariants earn standing.
  let discoveryProjection: {
    nodeId: string;
    dimensions: Array<{ dimension: DiscoveryDim; seedId: string; standing: number; status: string | null; weight: number }>;
    diverges: boolean;
    authoritative: boolean;
    flippedAt: string | null;
  } | null = null;
  try {
    const snapshot = await getDiscoveryFieldSnapshot();
    const weights = deriveDimensionWeights(snapshot);
    const flip = await getNodeFlip(DISCOVERY_RANKING_NODE_ID).catch(() => null);
    const seedIds = Object.values(DIMENSION_INVARIANT_SEED);
    const records = await getInvariantsBySeedIds(seedIds).catch(() => []);
    const dims = (Object.keys(DIMENSION_INVARIANT_SEED) as DiscoveryDim[]).map((dimension) => {
      const seedId = DIMENSION_INVARIANT_SEED[dimension];
      const rec = records.find((r) => r.seedId === seedId);
      return {
        dimension,
        seedId,
        standing: rec?.standing ?? 0,
        status: rec?.status ?? null,
        weight: Math.round(weights[dimension] * 1000) / 1000,
      };
    });
    // Weights diverge from faithful once any pair differs (i.e. earned standing
    // is differentiated) — the signal that a shadow→authoritative flip is meaningful.
    const diverges = dims.some((d) => Math.abs(d.weight - 1) > 1e-6);
    discoveryProjection = {
      nodeId: DISCOVERY_RANKING_NODE_ID,
      dimensions: dims,
      diverges,
      authoritative: flip?.authoritative === true,
      flippedAt: flip?.flippedAt ?? null,
    };
  } catch {
    /* projection view is best-effort */
  }

  // ── Platform Health — Constitutional Observability metrics DERIVED from the
  // observations already collected + the field rollup (no new instrumentation).
  // Prefer PERSISTED history (durable, cross-instance) for the mean metrics; fall
  // back to the in-instance snapshot when persistence isn't available yet.
  const rankHist = history.byNode.filter((h) => h.meanRankAgreement !== null);
  const valueHist = history.byNode.filter((h) => h.meanAbsValueDelta !== null);
  const rankObs = Object.values(observations).filter((o) => 'rankAgreement' in o) as Array<{ rankAgreement: number; topAgreement: boolean }>;
  const valueObs = Object.values(observations).filter((o) => 'delta' in o) as Array<{ delta: number }>;
  const health = {
    nodesRegistered: nodes.length,
    nodesObserved: Object.keys(observations).length,
    totalInvariants,
    // Projection accuracy: mean rank agreement across ranking nodes (1 = faithful).
    meanRankAgreement:
      rankHist.length > 0
        ? Math.round((rankHist.reduce((s, h) => s + (h.meanRankAgreement ?? 0), 0) / rankHist.length) * 1000) / 1000
        : rankObs.length > 0
        ? rankObs.reduce((s, o) => s + o.rankAgreement, 0) / rankObs.length
        : null,
    // Mean absolute value delta across value nodes (0 = faithful).
    meanValueDelta:
      valueHist.length > 0
        ? Math.round((valueHist.reduce((s, h) => s + (h.meanAbsValueDelta ?? 0), 0) / valueHist.length) * 1000) / 1000
        : valueObs.length > 0
        ? valueObs.reduce((s, o) => s + Math.abs(o.delta), 0) / valueObs.length
        : null,
    // Durable observation history (null-safe): total sampled + whether persistence is live.
    persistedObservations: history.total,
    persistenceAvailable: history.persistenceAvailable,
    // Grounded provenance: receipts that cited an invariant (null = unmeasured).
    groundedReceiptCount,
  };

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    viewer: { isAdmin: persona.cartridgeFlags?.isAdmin === true },
    nodes: nodeView,
    field: {
      canonVersion,
      totalInvariants,
      byNamespace,
      topReused,
    },
    projection: discoveryProjection,
    health,
    note: 'Constitutional Observatory v0 — Node · Field · Projection · Health from live/DB signals. Live shadow observations are per-instance (in-memory); persisted history + the Graph (edge) view are follow-ons (CFS-035 Observatory amendment).',
  });
}
