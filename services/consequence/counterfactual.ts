/**
 * Counterfactual projection over the invariant field (CCRL Phase E,
 * CFS-019 §5 item 6 — the deferral footnoted in the Field Explorer's first
 * slice).
 *
 * PURE + ISOMORPHIC. No Supabase, no fetch, no DB writes — takes the baseline
 * field edges (+ the invariants they touch, for status) and a hypothetical,
 * and returns the field the hypothetical WOULD produce, alongside the delta,
 * coherence flip, and escalation change. Deterministic and unit-testable.
 *
 * This is the decision-support instrument behind the propose→see-consequences
 * →ratify loop (inv.cybernetics.111 — "the system may propose its own
 * evolution; the operator ratifies it"). NOTHING here is written: a researcher
 * SEES the projected consequence field BEFORE anything is ratified.
 *
 * The field is defined over the three consequence-bearing edge types
 * (CFS-006a). Coherence follows the KnowledgeQube rule (services/consequence/
 * stages.knowledgeCuration): ANY contradicts edge among the selected set flips
 * coherent=false. Escalation follows the forecaster's rule
 * (services/consequence/stages.forecastConsequences): a reachable contradiction
 * OR a constrains edge bounding a canonical invariant forces escalation.
 */

import type { InvariantEdgeType, InvariantStatus } from '@/types/invariants';

/** The three consequence-bearing edge types the field is defined over. */
export type FieldEdgeType = 'enables' | 'constrains' | 'contradicts';

export const FIELD_EDGE_TYPES: readonly FieldEdgeType[] = ['enables', 'constrains', 'contradicts'];

export function isFieldEdgeType(value: unknown): value is FieldEdgeType {
  return value === 'enables' || value === 'constrains' || value === 'contradicts';
}

/** A field edge — the minimal shape the projection needs (isomorphic; not a DB row). */
export interface CounterfactualEdge {
  id: string;
  fromInvariantId: string;
  toInvariantId: string;
  edgeType: InvariantEdgeType | string;
}

/** An invariant touched by the field — only id + status are needed (status
 *  decides whether a constrains edge bounds a CANONICAL invariant). */
export interface CounterfactualInvariant {
  id: string;
  status?: InvariantStatus | string | null;
}

/** A single proposed edge from a hypothetical new node to an existing invariant. */
export interface ProposedEdge {
  toInvariantId: string;
  edgeType: FieldEdgeType;
}

export type Hypothetical =
  | { mode: 'add-node'; proposedEdges: ProposedEdge[] }
  | { mode: 'remove-edge'; edgeId: string };

export interface FieldCounts {
  enables: number;
  constrains: number;
  contradicts: number;
}

export interface CounterfactualProjection {
  mode: 'add-node' | 'remove-edge';
  baseline: FieldCounts;
  projected: FieldCounts;
  /** projected − baseline, per edge type. */
  delta: FieldCounts;
  coherentBefore: boolean;
  coherentAfter: boolean;
  /** True when coherence changed value (either direction). */
  coherenceFlips: boolean;
  forcesEscalationBefore: boolean;
  forcesEscalationAfter: boolean;
  /** True when the forced-escalation posture changed value (either direction). */
  forcesEscalationChange: boolean;
  /** Plain-language, honest readout of what the hypothetical does to the field. */
  readout: string;
}

// ── Pure field mechanics ─────────────────────────────────────────────────

function countFieldEdges(edges: CounterfactualEdge[]): FieldCounts {
  const counts: FieldCounts = { enables: 0, constrains: 0, contradicts: 0 };
  for (const e of edges) {
    if (e.edgeType === 'enables') counts.enables++;
    else if (e.edgeType === 'constrains') counts.constrains++;
    else if (e.edgeType === 'contradicts') counts.contradicts++;
  }
  return counts;
}

/** Coherence rule (knowledgeCuration): any contradicts edge ⇒ incoherent. */
function isCoherent(counts: FieldCounts): boolean {
  return counts.contradicts === 0;
}

/**
 * Escalation rule (forecastConsequences §5, field-level): a contradiction in
 * reach OR a constrains edge that bounds a CANONICAL invariant forces
 * escalation — the guardian's veto becomes informed rather than lexical.
 */
function forcesEscalation(
  edges: CounterfactualEdge[],
  statusById: Map<string, string>,
): boolean {
  let contradicts = false;
  let canonicalConstrain = false;
  for (const e of edges) {
    if (e.edgeType === 'contradicts') contradicts = true;
    else if (e.edgeType === 'constrains' && statusById.get(e.toInvariantId) === 'canonical') {
      canonicalConstrain = true;
    }
  }
  return contradicts || canonicalConstrain;
}

// ── The projection ──────────────────────────────────────────────────────

/**
 * Project the field a hypothetical would produce. `baselineEdges` is the
 * current field neighbourhood (the real substrate edges, fetched by the
 * caller); `invariants` supplies status for the canonical-constraint test.
 * Both baseline and projected are computed the SAME way over the same set, so
 * the delta is honest — never a live-vs-depth-mismatched comparison.
 */
export function projectCounterfactual(
  baselineEdges: CounterfactualEdge[],
  hypothetical: Hypothetical,
  invariants: CounterfactualInvariant[] = [],
): CounterfactualProjection {
  const statusById = new Map<string, string>();
  for (const inv of invariants) {
    if (inv.status != null) statusById.set(inv.id, String(inv.status));
  }

  let projectedEdges: CounterfactualEdge[];
  if (hypothetical.mode === 'add-node') {
    // The hypothetical node is synthetic; its proposed edges layer onto the
    // baseline field. A stable synthetic id keeps the projection deterministic.
    const added: CounterfactualEdge[] = hypothetical.proposedEdges.map((pe, i) => ({
      id: `hypothetical:add-node:${i}`,
      fromInvariantId: 'hypothetical:new-node',
      toInvariantId: pe.toInvariantId,
      edgeType: pe.edgeType,
    }));
    projectedEdges = [...baselineEdges, ...added];
  } else {
    // remove-edge: the projected field is the baseline minus the named edge.
    projectedEdges = baselineEdges.filter((e) => e.id !== hypothetical.edgeId);
  }

  const baseline = countFieldEdges(baselineEdges);
  const projected = countFieldEdges(projectedEdges);
  const delta: FieldCounts = {
    enables: projected.enables - baseline.enables,
    constrains: projected.constrains - baseline.constrains,
    contradicts: projected.contradicts - baseline.contradicts,
  };

  const coherentBefore = isCoherent(baseline);
  const coherentAfter = isCoherent(projected);
  const coherenceFlips = coherentBefore !== coherentAfter;

  const forcesEscalationBefore = forcesEscalation(baselineEdges, statusById);
  const forcesEscalationAfter = forcesEscalation(projectedEdges, statusById);
  const forcesEscalationChange = forcesEscalationBefore !== forcesEscalationAfter;

  const noDelta = delta.enables === 0 && delta.constrains === 0 && delta.contradicts === 0;

  const action =
    hypothetical.mode === 'add-node'
      ? `Adding a proposed finding with ${hypothetical.proposedEdges.length} edge(s)`
      : `Removing edge ${hypothetical.edgeId}`;

  let readout: string;
  if (coherenceFlips && !coherentAfter) {
    readout = `${action} introduces a contradicts edge — the selected set flips INCOHERENT and escalation is forced. Constitutional adaptation never bypasses ratification (inv.cybernetics.111): this projection is examined, then ratified.`;
  } else if (coherenceFlips && coherentAfter) {
    readout = `${action} removes the last contradiction — the selected set flips COHERENT and no escalation is forced.`;
  } else if (forcesEscalationChange && forcesEscalationAfter) {
    readout = `${action} bounds the action by a canonical constraint — escalation is now forced for ratification, though the set stays coherent.`;
  } else if (forcesEscalationChange && !forcesEscalationAfter) {
    readout = `${action} lifts the canonical constraint that forced escalation — escalation is no longer forced.`;
  } else if (noDelta) {
    readout = `${action} changes nothing in the field — a no-op projection (zero delta). Nothing would need ratification.`;
  } else {
    readout = `${action} shifts the field (Δ enables ${delta.enables >= 0 ? '+' : ''}${delta.enables}, constrains ${delta.constrains >= 0 ? '+' : ''}${delta.constrains}, contradicts ${delta.contradicts >= 0 ? '+' : ''}${delta.contradicts}) with no coherence or escalation change.`;
  }

  return {
    mode: hypothetical.mode,
    baseline,
    projected,
    delta,
    coherentBefore,
    coherentAfter,
    coherenceFlips,
    forcesEscalationBefore,
    forcesEscalationAfter,
    forcesEscalationChange,
    readout,
  };
}
