/**
 * Consequence Operating Model — stage implementations (CFS-006a).
 *
 * The genuinely new stages consume the invariant substrate (Phase 1/2):
 *   - knowledgeCuration      → KnowledgeQube (minimum coherent knowledge)
 *   - forecastConsequences   → consequence graph over the invariant graph
 * Risk/Value reuse the existing phase2 interfaces (RiskAssessment /
 * ValueAssessment) with v1 heuristics — the canonical assessRisk/assessValue
 * are throwing stubs (services/registry/phase2), so the heuristic is the
 * documented wiring point until they land.
 *
 * Server-only.
 */

import type { RiskAssessment } from '@/services/registry/phase2/risk';
import type { ValueAssessment } from '@/services/registry/phase2/value';
import type {
  ConsequenceForecast,
  ConsequenceNode,
  KnowledgeQube,
} from '@/types/consequence';
import type { InvariantNamespace } from '@/types/invariants';
import { dependencyClosure, traverse } from '@/services/invariants/graph';
import { listInvariants } from '@/services/invariants/store';

// ── Knowledge Curation (new) ─────────────────────────────────────────────

export interface CurationInput {
  intentRef: string;
  contextDomain?: string | null;
  namespace?: InvariantNamespace;
  /** Cap on directly-matched seed invariants. */
  limit?: number;
}

/**
 * Identify the minimum coherent knowledge for an intent: the highest-standing
 * validated/canonical invariants applicable to the context, plus their
 * dependency closure. Coherence = no contradiction inside the selected set
 * (reuses the graph; a contradicts edge among members flips coherent=false).
 */
export async function knowledgeCuration(input: CurationInput): Promise<KnowledgeQube> {
  const seeds = await listInvariants({
    namespace: input.namespace,
    status: ['validated', 'canonical'],
    domain: input.contextDomain ?? undefined,
    limit: input.limit ?? 12,
  });
  const seedIds = seeds.map((s) => s.id);

  const closure = seedIds.length
    ? await dependencyClosure(seedIds, input.contextDomain ?? undefined)
    : { nodes: [], edges: [], roots: [], truncated: false };
  const closureIds = closure.nodes
    .map((n) => n.invariant.id)
    .filter((id) => !seedIds.includes(id));

  // Coherence: any contradicts edge among the full selected set.
  const allIds = new Set([...seedIds, ...closureIds]);
  const contradiction = closure.edges.some(
    (e) => e.edgeType === 'contradicts' && allIds.has(e.fromInvariantId) && allIds.has(e.toInvariantId),
  );

  const namespaces = [...new Set(seeds.map((s) => s.namespace))];

  return {
    intentRef: input.intentRef,
    contextDomain: input.contextDomain ?? null,
    invariantIds: seedIds,
    closureIds,
    namespaces,
    coherent: !contradiction,
  };
}

// ── Consequence Forecasting (new) ────────────────────────────────────────

/**
 * Forecast outcomes by traversing enables / constrains / contradicts from the
 * action's knowledge. A canonical constraint or any contradiction in reach
 * forces disposition='escalate' (CFS-006a §5): consequence intelligence makes
 * the guardian's veto informed rather than lexical.
 */
export async function forecastConsequences(
  seedInvariantIds: string[],
): Promise<ConsequenceForecast> {
  if (seedInvariantIds.length === 0) {
    return {
      seedInvariantIds: [],
      nodes: [],
      enables: 0,
      constrains: 0,
      contradicts: 0,
      forcesEscalation: false,
      constitutionalConstraint: false,
      constitutionalConstraintIds: [],
      rationale: 'no seed knowledge — nothing to forecast',
    };
  }

  const result = await traverse(seedInvariantIds, {
    edgeTypes: ['enables', 'constrains', 'contradicts'],
    direction: 'out',
    maxDepth: 3,
  });

  const seedSet = new Set(seedInvariantIds);
  const nodes: ConsequenceNode[] = result.nodes
    .filter((n) => !seedSet.has(n.invariant.id))
    .map((n) => {
      const via = n.viaEdge?.edgeType ?? 'seed';
      return {
        invariantId: n.invariant.id,
        statement: n.invariant.statement,
        via,
        cautionary: via === 'constrains' || via === 'contradicts',
      };
    });

  let enables = 0;
  let constrains = 0;
  let contradicts = 0;
  for (const edge of result.edges) {
    if (edge.edgeType === 'enables') enables++;
    else if (edge.edgeType === 'constrains') constrains++;
    else if (edge.edgeType === 'contradicts') contradicts++;
  }

  // Escalate if any contradiction is reachable, or a constraint from a
  // canonical invariant bounds the action.
  const constrainingCanonical = result.nodes.some(
    (n) => n.viaEdge?.edgeType === 'constrains' && n.invariant.status === 'canonical',
  );
  const forcesEscalation = contradicts > 0 || constrainingCanonical;

  // CFS-006 §2 — the constitutional veto: a reachable constraint/law invariant
  // in the `constitutional` namespace is the strongest, constitutionally-legible
  // reason to escalate. A subset of forcesEscalation (never widens it), surfaced
  // distinctly so the disposition/guardian can name the constitutional basis.
  const constitutionalConstraintIds = result.nodes
    .filter(
      (n) =>
        n.viaEdge?.edgeType === 'constrains' &&
        n.invariant.status === 'canonical' &&
        n.invariant.namespace === 'constitutional' &&
        (n.invariant.semanticType === 'constraint' || n.invariant.semanticType === 'law'),
    )
    .map((n) => n.invariant.id);
  const constitutionalConstraint = constitutionalConstraintIds.length > 0;

  return {
    seedInvariantIds,
    nodes,
    enables,
    constrains,
    contradicts,
    forcesEscalation,
    constitutionalConstraint,
    constitutionalConstraintIds,
    rationale: forcesEscalation
      ? constitutionalConstraint
        ? `forecast is bounded by ${constitutionalConstraintIds.length} constitutional constraint(s) — escalate for ratification`
        : contradicts > 0
          ? `forecast reaches ${contradicts} contradiction(s) — escalate for human ratification`
          : 'forecast is bounded by a canonical constraint — escalate'
      : `forecast enables ${enables} downstream outcome(s) with no reachable contradiction`,
  };
}

// ── Risk / Value (v1 heuristics; wire to phase2 when it lands) ───────────

export function assessRiskHeuristic(input: {
  iqubeId: string;
  aggregateConfidence: number;
  knowledgeSize: number;
  coherent: boolean;
  now: string;
}): RiskAssessment {
  // Lower confidence + broader knowledge footprint ⇒ higher risk. Reversibility
  // is refined later by the forecast (constrains/contradicts reach); here it is
  // seeded conservatively from coherence.
  const uncertainty = Math.round((1 - input.aggregateConfidence) * 100);
  const blastRadius = Math.min(100, input.knowledgeSize * 8);
  const reversibility = input.coherent ? 30 : 70;
  const overall = Math.min(
    100,
    Math.round(uncertainty * 0.5 + reversibility * 0.3 + blastRadius * 0.2),
  );
  const risk_flags: string[] = [];
  if (!input.coherent) risk_flags.push('incoherent_knowledge');
  if (input.aggregateConfidence < 0.6) risk_flags.push('low_confidence_knowledge');
  return {
    iqube_id: input.iqubeId,
    assessed_at: input.now,
    overall_score: overall,
    dimensions: { uncertainty, downstream_blast_radius: blastRadius, reversibility },
    risk_flags,
    recommended_controls:
      overall >= 60 ? ['require_guardian_approval', 'stage_execution'] : undefined,
  };
}

export function assessValueHeuristic(input: {
  iqubeId: string;
  aggregateStanding: number;
  knowledgeSize: number;
  now: string;
}): ValueAssessment {
  return {
    iqube_id: input.iqubeId,
    assessed_at: input.now,
    // Higher standing + broader validated knowledge ⇒ more work potential.
    work_potential_qc: Math.round(input.aggregateStanding * 10 + input.knowledgeSize * 25),
    usage_signal: { derivative_count: input.knowledgeSize },
  };
}
