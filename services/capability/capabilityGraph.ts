/**
 * capabilityGraph — the CFS-028 seed graph + recommendation resolver
 * (RATIFIED 2026-07-12).
 *
 * Producers are never invented (contract invariant 5): model producers derive
 * DYNAMICALLY from the ModelQube registry (skipping stubbed entries), delegate
 * producers from the Homecoming roster, and the two harness producers are the
 * operator-declared harnesses of record (Claude Code for Implementation Packs;
 * the Studio invariant-grounded video pipeline for multimedia).
 *
 * Fitness values are HAND-SEEDED design values with stated reasons; the
 * receipt-learned update loop is a later, separately ratified increment
 * (contract invariant 2). Costs are stubbed ordinals (operator direction).
 *
 * Law XI: `recommendProducers` returns a ranked, reasoned list for the
 * OPERATOR to pick from. Ineligible producers (standing bar unmet, dormant
 * capability) are listed with the reason — transparency over silent dropping —
 * but never ranked above eligible ones.
 */

import type {
  CapabilityEdge,
  CapabilityId,
  CostBand,
  Producer,
  ProducerRecommendation,
} from '@/types/capabilityGraph';
import type { ConsequenceClass } from '@/types/artifactRuntime';
import { HOMECOMING_DELEGATES } from '@/types/homecoming';
import { HOMECOMING_DELEGATE_SPECS } from '@/services/homecoming/agentHomecoming';
import { CONSTITUTIONAL_MODEL_QUBES, type ModelQube } from '@/services/constitutional/modelQube';
import {
  resolveDelegateAgentId,
  readDelegateStanding,
  trustBandRank,
} from '@/services/homecoming/delegateStanding';

/** The standing bar a DELEGATE's earned ceiling must clear to be recommended
 *  for constitutional-tier production. Grounded in the delegation ladder:
 *  L3_PRODUCTION_CANDIDATE is where registry_submission_proposal unlocks —
 *  proposing durable, promotable work is exactly constitutional-tier shape. */
export const CONSTITUTIONAL_MIN_CEILING = 'L3_PRODUCTION_CANDIDATE';

/** Document-class profiles (the CPS renderer family) — the capability set
 *  model producers seed against. */
export const DOCUMENT_PROFILES: readonly CapabilityId[] = [
  'standard',
  'white-paper',
  'research',
  'agreement',
  'presentation',
  'book',
  'investor-deck',
  'documentation',
  'policy',
];

const evidence0 = () => ({ productions: 0, promotions: 0, failures: 0 });

// ─────────────────────────────────────────────────────────────────────────
// Producers (invariant 5 — every node traces to something real)
// ─────────────────────────────────────────────────────────────────────────

/** Operator-declared harnesses of record. */
export const HARNESS_PRODUCERS: readonly Producer[] = [
  {
    id: 'harness:claude-code',
    kind: 'harness',
    label: 'Claude Code (session harness)',
    ref: 'harness:claude-code',
  },
  {
    id: 'harness:studio-video-pipeline',
    kind: 'harness',
    label: 'Studio video pipeline (invariant-grounded)',
    ref: 'harness:studio-video-pipeline',
  },
];

/** Delegate producers — the Homecoming roster, labels from the stand-up specs. */
export function delegateProducers(): Producer[] {
  return HOMECOMING_DELEGATES.map((slug) => ({
    id: `delegate:${slug}`,
    kind: 'delegate' as const,
    label: HOMECOMING_DELEGATE_SPECS[slug]?.displayName ?? slug,
    ref: slug,
  }));
}

/** Model producers — derived from the ModelQube registry; stubbed entries are
 *  named-but-not-routable and therefore never become producers. Pure. */
export function modelProducers(qubes: readonly ModelQube[] = CONSTITUTIONAL_MODEL_QUBES): Producer[] {
  return qubes
    .filter((q) => !q.payload.stubbed)
    .map((q) => ({
      id: q.identity.ref, // 'modelqube:<id>' — already a stable T2-safe ref
      kind: 'model' as const,
      label: q.identity.displayLabel,
      ref: q.identity.ref,
    }));
}

// ─────────────────────────────────────────────────────────────────────────
// Seed edges (invariants 2–4 — hand-seeded, reasons stated, costs stubbed)
// ─────────────────────────────────────────────────────────────────────────

const edge = (
  producerId: string,
  capability: CapabilityId,
  fitness: number,
  cost: CostBand,
  seedReason: string,
  dormant?: boolean,
): CapabilityEdge => ({ producerId, capability, fitness, cost, seedReason, ...(dormant ? { dormant } : {}), evidence: evidence0() });

/** Static seed edges — harnesses + delegates. Reasons trace to charters/specs. */
export const SEED_EDGES: readonly CapabilityEdge[] = [
  // Claude Code — the harness of record for the software cycle (CFS-015/016).
  edge('harness:claude-code', 'software', 0.9, 'unknown', 'Harness of record for Implementation Packs (CFS-015); D1: execution stays human'),
  edge('harness:claude-code', 'api', 0.8, 'unknown', 'Same implementation harness — API routes are its native surface'),
  edge('harness:claude-code', 'documentation', 0.6, 'unknown', 'Session docs (specs, trackers) authored in-harness today'),
  // DORMANT until CFS-016 D2 ratification (contract invariant 4).
  edge('harness:claude-code', 'deployment-execution', 0.9, 'unknown', 'CFS-016 D2 executor of record (operator direction 2026-07-12: start here)', true),
  // The Studio video pipeline — the multimedia producer that exists today.
  edge('harness:studio-video-pipeline', 'multimedia', 0.8, 'high', 'The invariant-grounded 4-segment video brief generator + orchestrator'),
  // Delegates — fitness traces to charter/spec domains (agentHomecoming.ts + PROGRAM_OVERVIEW).
  edge('delegate:aletheon', 'research', 0.85, 'medium', 'Constitutional companion — knowledge synthesis + institutional memory (charter)'),
  edge('delegate:aletheon', 'white-paper', 0.8, 'medium', 'CCS/CDS drafter — governance design support (charter)'),
  edge('delegate:aletheon', 'documentation', 0.8, 'medium', 'Context revelation + synthesis (charter)'),
  edge('delegate:aletheon', 'policy', 0.7, 'medium', 'Governance design support (charter)'),
  edge('delegate:moneypenny', 'research', 0.6, 'medium', 'Financial ops / micro-economics briefs (PROGRAM_OVERVIEW + specialistRouter)'),
  edge('delegate:moneypenny', 'documentation', 0.5, 'medium', 'Advisory drafting within bounded delegation (spec)'),
  edge('delegate:nakamoto', 'research', 0.6, 'medium', 'Bitcoin / COYN / risk / decentralisation briefs (PROGRAM_OVERVIEW + specialistRouter)'),
  edge('delegate:nakamoto', 'documentation', 0.5, 'medium', 'Advisory analysis within bounded delegation (spec)'),
  edge('delegate:marketa', 'presentation', 0.7, 'medium', 'Guide-agent for the marketing/campaign surfaces (services/marketa)'),
  edge('delegate:marketa', 'standard', 0.6, 'medium', 'Campaign copy + operator-facing drafting (services/marketa)'),
  edge('delegate:kn0w1', 'documentation', 0.7, 'medium', 'Knowledge guide-agent (reference trio, Venture Lab α)'),
  edge('delegate:kn0w1', 'research', 0.6, 'medium', 'Knowledge retrieval + synthesis (reference trio)'),
  edge('delegate:aigent-z', 'standard', 0.6, 'medium', 'System orchestrator — general drafting via NBE routing'),
];

/** Model edges — every non-stubbed ModelQube seeds against the document-class
 *  profiles; frontier tier seeds higher than the open-weight floor. Pure. */
export function modelEdges(qubes: readonly ModelQube[] = CONSTITUTIONAL_MODEL_QUBES): CapabilityEdge[] {
  const out: CapabilityEdge[] = [];
  for (const q of qubes) {
    if (q.payload.stubbed) continue;
    const frontier = q.payload.tier === 'frontier';
    for (const profile of DOCUMENT_PROFILES) {
      out.push(
        edge(
          q.identity.ref,
          profile,
          frontier ? 0.7 : 0.4,
          frontier ? 'medium' : 'low',
          frontier
            ? `Frontier ModelQube (${q.identity.displayLabel}) via callSovereign`
            : `Open-weight sovereign floor (${q.identity.displayLabel}) — always available, lower seeded fitness`,
        ),
      );
    }
  }
  return out;
}

/** The full graph: producers + edges. Pure over the injected qube set. */
export function buildCapabilityGraph(qubes: readonly ModelQube[] = CONSTITUTIONAL_MODEL_QUBES): {
  producers: Producer[];
  edges: CapabilityEdge[];
} {
  return {
    producers: [...HARNESS_PRODUCERS, ...delegateProducers(), ...modelProducers(qubes)],
    edges: [...SEED_EDGES, ...modelEdges(qubes)],
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Ranking (pure) + recommendation (server — reads delegate standing)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Pure ranking core: join edges to producers for one capability, apply the
 * tier's standing bar to DELEGATE producers using the supplied earned
 * standings, mark dormant edges ineligible, sort eligible-first then fitness
 * descending. Canary-drillable without a DB.
 */
export function rankProducersForCapability(
  capability: CapabilityId,
  consequenceClass: ConsequenceClass,
  graph: { producers: Producer[]; edges: CapabilityEdge[] },
  delegateStandings: Record<string, { overall: number; trustBandCeiling: string } | null>,
): ProducerRecommendation[] {
  const byId = new Map(graph.producers.map((p) => [p.id, p]));
  const recs: ProducerRecommendation[] = [];
  for (const e of graph.edges) {
    if (e.capability !== capability) continue;
    const producer = byId.get(e.producerId);
    if (!producer) continue; // seed integrity is canary-enforced; skip defensively at runtime
    const reasons = [e.seedReason];
    let eligible = true;
    let ineligibleReason: string | undefined;
    let standing: { overall: number; trustBandCeiling: string } | null = null;

    if (e.dormant) {
      eligible = false;
      ineligibleReason = 'dormant — capability gated on an unratified authority level (CFS-016 D2)';
    } else if (producer.kind === 'delegate') {
      standing = delegateStandings[producer.ref] ?? null;
      if (consequenceClass === 'constitutional') {
        const ceiling = standing?.trustBandCeiling ?? 'L1_EXPERIMENTAL';
        if (trustBandRank(ceiling) < trustBandRank(CONSTITUTIONAL_MIN_CEILING)) {
          eligible = false;
          ineligibleReason = `constitutional tier requires earned ceiling ≥ ${CONSTITUTIONAL_MIN_CEILING.split('_')[0]} (current: ${ceiling.split('_')[0]}, standing ${standing?.overall ?? 0})`;
        } else {
          reasons.push(`earned ceiling ${ceiling.split('_')[0]} clears the constitutional bar`);
        }
      }
    } else if (consequenceClass === 'constitutional') {
      reasons.push("inherits the operator's own standing in v1 (harness/model)");
    }

    recs.push({ producer, capability, fitness: e.fitness, cost: e.cost, reasons, standing, eligible, ineligibleReason });
  }
  return recs.sort((a, b) => (a.eligible === b.eligible ? b.fitness - a.fitness : a.eligible ? -1 : 1));
}

/**
 * Server entrypoint: build the graph, resolve each delegate's EARNED standing
 * (best-effort — an unresolvable delegate reads null and is judged at the L1
 * floor), and rank. Law XI: the caller renders this list for the operator.
 */
export async function recommendProducers(
  capability: CapabilityId,
  consequenceClass: ConsequenceClass,
): Promise<ProducerRecommendation[]> {
  const graph = buildCapabilityGraph();
  const standings: Record<string, { overall: number; trustBandCeiling: string } | null> = {};
  await Promise.all(
    HOMECOMING_DELEGATES.map(async (slug) => {
      try {
        const agentId = await resolveDelegateAgentId(slug);
        standings[slug] = agentId ? await readDelegateStanding(agentId) : null;
      } catch {
        standings[slug] = null;
      }
    }),
  );
  return rankProducersForCapability(capability, consequenceClass, graph, standings);
}
