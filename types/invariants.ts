/**
 * Invariant Intelligence substrate — type contract.
 *
 * Chrysalis Foundation Phase 1. Specs:
 *   CFS-001 (invariant primitive, three levels, Invariant Context, Invariant Standing)
 *   CFS-002 (ontology), CFS-003 (graph), CFS-003a (Invariant Service)
 * Constitutional anchor:
 *   codexes/packs/polity-core/constitutional-records/invariant-intelligence.md
 *
 * Identifier tiering (Identity & Access Spine):
 *   creator_persona_id is T0 — it exists on the DB row but is DELIBERATELY
 *   ABSENT from every record type in this file. The public surface carries
 *   only creator_alias_commitment (T2). Do not add a personaId field to any
 *   record type here.
 */

export type InvariantNamespace =
  | 'constitutional'
  | 'reasoning'
  | 'engineering'
  | 'experience'
  | 'capability'
  | 'style'      // CFS-011 — Style Invariants: visual/cinematographic continuity (ratified 2026-07-04)
  | 'narrative'  // CFS-012 — Narrative Invariants: fixed structural beats (ratified 2026-07-04)
  // Five namespaces below entered the seed crystal (canonical-invariants.seed.json)
  // ahead of this type — widened 2026-07-13 when the drift surfaced as an ingest
  // constraint violation. Their composition laws are PROVISIONAL (see
  // COMPOSITION_LAWS) pending operator ratification per CFS-013 §3.
  | 'sovereignty'
  | 'cybernetics'
  | 'interaction'
  | 'epistemology'
  | 'representation'
  // Polity namespace entered the seed crystal (canonical-invariants.seed.json)
  // via the Polity Papers canonization (2026-07-17) ahead of this type —
  // widened when the drift surfaced as (a) the ontology_classes CHECK
  // constraint violation and (b) the Invariant Registry omitting all 136
  // operator-ratified polity invariants. The Polity Papers are the
  // constitutional-architecture corpus, so polity composes as constitutional.
  | 'polity';

export const INVARIANT_NAMESPACES: readonly InvariantNamespace[] = [
  'constitutional',
  'reasoning',
  'engineering',
  'experience',
  'capability',
  'style',
  'narrative',
  'sovereignty',
  'cybernetics',
  'interaction',
  'epistemology',
  'representation',
  'polity',
];

/**
 * CFS-013 — Invariant Composition Laws. Every invariant class defines not
 * only a semantic domain but a lawful method by which its members compose.
 * The Record is exhaustive over InvariantNamespace, so a new class cannot
 * be added without declaring its algebra (CFS-013 §3, enforced at compile
 * time). Future invariant classes shall define their composition law
 * before entering canonical status.
 */
export type CompositionLaw =
  | 'distributive'  // members distribute across units; each unit foregrounds a subset
  | 'sequential'    // members carry fixed order; proportional monotonic mapping
  | 'global'        // members apply identically to every unit
  | 'contextual'    // members resolve per-context at render time
  | 'causal'        // members compose by dependency-graph traversal
  | 'normative';    // members bind every act simultaneously (law-like)

export const COMPOSITION_LAWS: Record<InvariantNamespace, CompositionLaw> = {
  constitutional: 'distributive',
  reasoning: 'causal',
  engineering: 'normative',
  experience: 'contextual',
  capability: 'distributive',
  style: 'global',
  narrative: 'sequential',
  // PROVISIONAL algebra for the 2026-07-13 namespace widening (CFS-013 §3:
  // declared before entering canonical status — these seeds enter 'validated';
  // the operator confirms or amends before any is advanced to 'canonical'):
  sovereignty: 'normative',     // sovereignty guarantees bind every act simultaneously (law-like, as engineering)
  cybernetics: 'causal',        // feedback/control invariants compose by loop/dependency traversal
  interaction: 'contextual',    // DCIR-class invariants resolve per-surface/per-context at render time
  epistemology: 'normative',    // truth/standing rules (Law XII family) bind every knowledge act
  representation: 'global',     // representation continuity applies identically to every surface (as style)
  // Polity Papers canonization (2026-07-17), operator-ratified to canonical.
  // The Polity corpus is the constitutional-architecture family, so it composes
  // distributively as the constitutional namespace does (each unit foregrounds
  // a subset of the polity's rights/standing/delegation/presence guarantees).
  polity: 'distributive',
};

export type InvariantStatus =
  | 'draft'
  | 'proposed'
  | 'validated'
  | 'canonical'
  | 'rejected'
  | 'deprecated'
  | 'superseded';

export type InvariantSemanticType =
  | 'principle'
  | 'constraint'
  | 'definition'
  | 'heuristic'
  | 'law'
  | 'epistemic'; // ratified by Law XII (CFS-009 amendment)

/** CFS-001 §5 — the confidence ladder, mirroring standingScore.ts weights. */
export type InvariantConfidenceBasis =
  | 'document_verified'   // 1.0
  | 'principal_verified'  // 0.85
  | 'agent_verified'      // 0.6
  | 'unknown';            // 0.3

export const CONFIDENCE_BASIS_WEIGHT: Record<InvariantConfidenceBasis, number> = {
  document_verified: 1.0,
  principal_verified: 0.85,
  agent_verified: 0.6,
  unknown: 0.3,
};

/** CFS-003 §2 — the twelve canonical edge types. */
export type InvariantEdgeType =
  | 'derives_from'
  | 'enables'
  | 'constrains'
  | 'contradicts'
  | 'supersedes'
  | 'generalizes'
  | 'specializes'
  | 'depends_on'
  | 'supports'
  | 'validates'
  | 'explains'
  | 'composes';

export const INVARIANT_EDGE_TYPES: readonly InvariantEdgeType[] = [
  'derives_from',
  'enables',
  'constrains',
  'contradicts',
  'supersedes',
  'generalizes',
  'specializes',
  'depends_on',
  'supports',
  'validates',
  'explains',
  'composes',
];

/** CFS-003 §3 — edge types that must remain acyclic (service-enforced). */
export const ACYCLIC_EDGE_TYPES: readonly InvariantEdgeType[] = [
  'depends_on',
  'derives_from',
  'supersedes',
];

// ─────────────────────────────────────────────────────────────────────────
// Records — the public (T1-safe) surface. No T0 fields.
// ─────────────────────────────────────────────────────────────────────────

export interface InvariantRecord {
  id: string;
  seedId: string | null;
  statement: string;
  namespace: InvariantNamespace;
  ontologyClassId: string | null;
  semanticType: InvariantSemanticType | null;
  status: InvariantStatus;
  confidence: number;
  confidenceBasis: InvariantConfidenceBasis;
  /**
   * CFS-001 §6 / Law XII — Standing: constitutional confidence from
   * validation-class signals ONLY (never adoption).
   */
  standing: number;
  /** Law XII — Reach: adoption (references + usage). Orthogonal to standing. */
  reach: number;
  timesValidated: number;
  timesContradicted: number;
  timesReferenced: number;
  timesUsed: number;
  version: number;
  supersedesId: string | null;
  ratifiedSource: string | null;
  provenance: Record<string, unknown>;
  reasoningProvenance: Record<string, unknown>;
  creatorAliasCommitment: string | null;
  dvnReceiptId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvariantContextRecord {
  id: string;
  invariantId: string;
  domain: string;
  interpretation: string | null;
  applicabilityConditions: Record<string, unknown> | null;
  retrievalTags: string[];
  createdAt: string;
}

export interface InvariantEdgeRecord {
  id: string;
  fromInvariantId: string;
  toInvariantId: string;
  edgeType: InvariantEdgeType;
  weight: number;
  contextId: string | null;
  rationale: string | null;
  provenance: Record<string, unknown>;
  reasoningProvenance: Record<string, unknown>;
  dvnReceiptId: string | null;
  createdAt: string;
}

export interface OntologyClassRecord {
  id: string;
  namespace: InvariantNamespace;
  slug: string;
  name: string;
  parentId: string | null;
  semanticType: InvariantSemanticType | null;
  description: string | null;
  status: 'active' | 'deprecated';
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Level 2 — Invariant Collections (CFS-001 §1). Public (T1-safe): no T0.
// ─────────────────────────────────────────────────────────────────────────

export interface InvariantCollectionRecord {
  id: string;
  slug: string;
  name: string;
  namespace: InvariantNamespace | null;
  description: string | null;
  status: 'active' | 'archived';
  curatorAliasCommitment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvariantCollectionMember {
  invariantId: string;
  position: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Level 3 — InvariantQube (CFS-001 §1, CFS-004 §3). The published, versioned,
// provenance-bearing package of compressed expertise — what becomes mintable.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The composition manifest (CFS-003 §5): members + the internal edge subgraph
 * + contexts, with aggregate confidence (weakest-link) and aggregate standing.
 */
export interface InvariantQubeManifest {
  members: {
    invariantId: string;
    statement: string;
    namespace: InvariantNamespace;
    confidence: number;
    standing: number;
  }[];
  /** Edges whose endpoints are both members of the bundle. */
  internalEdges: {
    fromInvariantId: string;
    toInvariantId: string;
    edgeType: InvariantEdgeType;
  }[];
  contexts: string[]; // union of member context domains
  aggregateConfidence: number;
  aggregateStanding: number;
}

export interface InvariantQubeRecord {
  id: string;
  iqubeId: string | null;
  collectionId: string | null;
  publicRef: string;
  title: string;
  version: number;
  manifest: InvariantQubeManifest;
  aggregateConfidence: number;
  aggregateStanding: number;
  memberCount: number;
  status: 'draft' | 'published' | 'superseded';
  supersedesId: string | null;
  creatorAliasCommitment: string | null;
  dvnReceiptId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Graph traversal (CFS-003 §4)
// ─────────────────────────────────────────────────────────────────────────

export interface TraversalOptions {
  edgeTypes?: InvariantEdgeType[];
  direction?: 'out' | 'in' | 'both';
  maxDepth?: number;        // default 4, hard cap 8
  minWeight?: number;
  minConfidence?: number;
  /** Only follow edges that are global or scoped to a context with this domain. */
  contextDomain?: string;
}

export interface TraversalNode {
  invariant: InvariantRecord;
  depth: number;
  /** Edge that reached this node (null for roots). */
  viaEdge: InvariantEdgeRecord | null;
}

export interface TraversalResult {
  roots: string[];
  nodes: TraversalNode[];
  edges: InvariantEdgeRecord[];
  truncated: boolean;
}
