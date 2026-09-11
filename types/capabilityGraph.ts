/**
 * CFS-028 — Capability Graph & Production Routing ("context calibration").
 * RATIFIED 2026-07-12. Contract-first (the CFS-024/025 pattern): these types
 * are the graph's constitution; services implement them, surfaces consume them.
 *
 * The unification: everything that can produce or execute is a PRODUCER —
 * a harness (Claude Code, the Studio video pipeline), a model (a ModelQube
 * registry entry), or a delegate (the Homecoming roster). The AR profile
 * taxonomy is the task vocabulary, so routing applies to ANY production
 * artifact at the root AR/CPS level. Execution is not a special case: the D2
 * executor is a Producer whose capability is `deployment-execution`, DORMANT
 * until CFS-016 D2 is ratified.
 *
 * Law XI boundary: the graph RECOMMENDS, the operator SELECTS. Nothing in this
 * contract auto-routes consequence-bearing production.
 *
 * INVARIANTS (canary-enforced in tests/capability-graph.test.ts):
 *   1. Every edge's capability is a real ArtifactProfileId or 'deployment-execution'.
 *   2. Fitness is seeded ∈ [0,1]; receipt-learned updates are a later, separately
 *      ratified increment — v1 never mutates fitness at runtime.
 *   3. Costs are STUBBED ordinals (operator direction) — never invented numbers.
 *   4. `deployment-execution` edges are dormant until D2 ratification.
 *   5. No producer is invented: every node traces to a ModelQube entry, a
 *      Homecoming delegate, or an operator-declared harness.
 */

import type { ArtifactProfileId } from '@/types/artifactRuntime';

export type ProducerKind = 'harness' | 'model' | 'delegate';

/** Stubbed cost ordinal (CFS-028 §2 — real cost ingestion is a later increment). */
export type CostBand = 'low' | 'medium' | 'high' | 'unknown';
export const COST_BANDS = ['low', 'medium', 'high', 'unknown'] as const;

/** The task vocabulary: AR profiles + the (dormant) execution capability. */
export type CapabilityId = ArtifactProfileId | 'deployment-execution';

export interface Producer {
  /** Stable graph id, e.g. 'harness:claude-code', 'modelqube:anthropic-haiku-4-5', 'delegate:aletheon'. */
  id: string;
  kind: ProducerKind;
  label: string;
  /** The REAL registry ref this node traces to (invariant 5). */
  ref: string;
}

export interface CapabilityEvidence {
  productions: number;
  promotions: number;
  failures: number;
}

export interface CapabilityEdge {
  producerId: string;
  capability: CapabilityId;
  /** Seeded fitness ∈ [0,1] (invariant 2). */
  fitness: number;
  cost: CostBand;
  /** WHY this edge exists — stated, never implied (No-Guessing applied to the graph). */
  seedReason: string;
  /** True for capabilities gated on an unratified authority level (invariant 4). */
  dormant?: boolean;
  /** Receipt-backed counters — all zero at seed; the learning loop fills them later. */
  evidence: CapabilityEvidence;
}

/** One ranked entry the operator picks from (Law XI: recommend, never select). */
export interface ProducerRecommendation {
  producer: Producer;
  capability: CapabilityId;
  fitness: number;
  cost: CostBand;
  /** Stated reasons — the seed reason + any standing/tier notes. */
  reasons: string[];
  /** Delegate producers carry their EARNED standing (server-resolved); harnesses
   *  and models inherit the operator's own standing in v1 (null here). */
  standing: { overall: number; trustBandCeiling: string } | null;
  /** False when the standing bar for the requested tier isn't met, or the edge
   *  is dormant — still LISTED (transparency), never silently dropped. */
  eligible: boolean;
  ineligibleReason?: string;
}
