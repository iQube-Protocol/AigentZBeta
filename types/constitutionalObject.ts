/**
 * The Constitutional Object Model — the keystone contract of the Constitutional
 * Operating Environment (CFS-022 §4, gap G1). P0, contract-first.
 *
 * ONE object contract that every constitutional object kind implements —
 * repositories, specifications, research, experiments, documents, canonical
 * assets, prompt libraries, skills, aigents, workflows, policies, standing,
 * publications. Every object has: **identity · version · standing · authority ·
 * dependencies · ownership · provenance · lifecycle**. Everything downstream in
 * the COE (the Registry, the Composition engine, the Factory, the Publication
 * layer) composes over THIS — so an Atlas Plate, an InvariantQube, a research
 * finding, and a git repository are the same kind of thing with the same spine.
 *
 * This is a UNIFICATION, not an invention. It is the common superset of the
 * object shapes that already exist:
 *   - `types/invariants.ts` — `version`, `standing`, `reach`, `status`,
 *     `provenance`, and the InvariantQube "published, versioned, provenance-
 *     bearing package" (Levels 1–3). The richest existing model.
 *   - `types/research.ts` — per-kind `lifecycle` orders + `governingInvariants`
 *     + receipt-backed provenance (`recordExperimentTransition`).
 *   - `types/access.ts` — the T0/T1/T2 identifier-tier discipline.
 *   - `types/iqube/*` — `provenance_receipts`, `charter_version`.
 * Each of those keeps its authority; this contract is the shape they map ONTO,
 * so the runtime can reason over all object kinds uniformly.
 *
 * CONTRACT-FIRST (the D0 discipline): types + a few pure helpers + canaries, NO
 * implementation, NO storage. Each field is typed honestly; a kind hardens its
 * own `lifecycle` order and `payload` in the increment that builds it, never
 * before. Fields deferred to a later increment are typed loosely on purpose.
 *
 * TIER DISCIPLINE (Identity & Access Spine — non-negotiable): a
 * ConstitutionalObject is a T1/T2 surface. T0 identifiers (`personaId`,
 * `authProfileId`, `rootDid`, `fioHandle`, `kybeAttestation`) are STRUCTURALLY
 * INEXPRESSIBLE here — ownership and provenance carry only server-computed
 * COMMITMENTS (one-way hashes) and receipt ids, never a raw subject identifier.
 * `findForbiddenObjectKey` + the canary in tests/constitutional-object.test.ts
 * make a leak fail the build, not merely forbid it.
 *
 * Isomorphic: no fs, no DB, no React, no clock, no randomness — safe on the
 * server, the chat route, and client components alike.
 */

// ─────────────────────────────────────────────────────────────────────────
// §1 Object kinds — open, extensible
// ─────────────────────────────────────────────────────────────────────────

/**
 * The base constitutional object kinds. OPEN by design — a new organ adds its
 * kind here (and its lifecycle order) in the increment that builds it. The
 * string union keeps kinds legible + canary-checkable without a runtime enum.
 */
export type ConstitutionalObjectKind =
  | 'invariant'            // a canonical invariant (types/invariants.ts)
  | 'invariant_qube'       // a published, mintable InvariantQube
  | 'representation_asset' // a RepresentationQube — palette, typography, iconography, an interpretation
  | 'canonical_asset'      // a versioned canonical asset (e.g. Bearing Instrument v1 — Canonical Asset 001)
  | 'research_experiment'  // types/research.ts
  | 'research_finding'
  | 'publication'
  | 'iqube'                // a registry iQube
  | 'specification'        // a CFS / spec document
  | 'document'             // a produced document (PRD, deck, paper, …)
  | 'skill'                // a prompt library / skill
  | 'aigent'               // an agent definition
  | 'workflow'
  | 'policy'
  | 'repository'
  | 'deployment'           // a constitutional deployment (CFS-016) — proposal→authorization→execution as a first-class object; EXECUTION stays human under D1
  | 'atlas_plate'          // a composed Constitutional Atlas Plate (the P2 vertical)
  | 'capability'           // a SHIPPED capability admitted to the Registry — Constitutional Acceptance (CFS-032 §4)
  | 'agreement';           // a Constitutional Agreement — intent→agent→authority binding before delegated execution (CRP-003a N1 / CFI-002)

// ─────────────────────────────────────────────────────────────────────────
// §2 Identity — T2-safe reference, never a raw subject id
// ─────────────────────────────────────────────────────────────────────────

export interface ObjectIdentity {
  /** Stable, kind-scoped id (e.g. 'bearing-instrument' / 'inv.reasoning.001').
   *  An OBJECT id — never a personaId / authProfileId / rootDid. */
  id: string;
  kind: ConstitutionalObjectKind;
  /** A T2-safe commitment reference for network/chain-bound use — a one-way
   *  hash of the id (+ namespace), safe for DVN receipts and Walrus/chain
   *  metadata. Server-computed; the raw id may be T1 but the ref is always T2. */
  ref: string;
  /** Human-facing label (T1). Optional — display only. */
  displayLabel?: string;
}

/** A dependency edge target — a reference to another constitutional object. */
export interface ObjectRef {
  id: string;
  kind: ConstitutionalObjectKind;
}

// ─────────────────────────────────────────────────────────────────────────
// §3 Version — monotonic + supersession chain (mirrors InvariantQube)
// ─────────────────────────────────────────────────────────────────────────

/** The publication/version status. Superset of invariants.ts InvariantQube
 *  (`draft | published | superseded`) + registry (`active | archived`). */
export type ObjectVersionStatus =
  | 'draft'
  | 'active'
  | 'published'
  | 'superseded'
  | 'deprecated'
  | 'archived';

export interface ObjectVersion {
  /** Monotonic integer version (invariants.ts convention). v1 = 1. */
  version: number;
  status: ObjectVersionStatus;
  /** The object id this version supersedes, if any (the supersession chain). */
  supersedes?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// §4 Standing — the maturity ladder + Reach (Law XII, orthogonal)
// ─────────────────────────────────────────────────────────────────────────

/**
 * The constitutional maturity band — mirrors CFS-021's StandingLevel ladder
 * (`experimental → validated → canonical → foundational`), the same ordered
 * vocabulary the representation `standing.*` roles encode. Kept as a local
 * union so the base model does not depend on the representation layer (which is
 * itself an object kind).
 */
export type StandingBand = 'experimental' | 'validated' | 'canonical' | 'foundational';

export const STANDING_BANDS: readonly StandingBand[] = [
  'experimental',
  'validated',
  'canonical',
  'foundational',
] as const;

export interface ObjectStanding {
  /** 0..1 aggregate standing (invariants.ts `standing`; weakest-link for
   *  composites). The numeric score. */
  standing: number;
  /** The band the score falls in — the human-legible ladder rung. */
  band: StandingBand;
  /** Law XII — Reach: adoption (references + usage). ORTHOGONAL to standing;
   *  a foundational object can have low reach and vice-versa. */
  reach: number;
}

// ─────────────────────────────────────────────────────────────────────────
// §5 Authority — who/what may act on the object (governance)
// ─────────────────────────────────────────────────────────────────────────

/** The authority required to transition / ratify / supersede this object. */
export interface ObjectAuthority {
  /** The minimum standing band an object must reach before it may be treated
   *  as authoritative for composition/publication (e.g. a plate should compose
   *  only from `canonical`+ assets). */
  minStandingToCompose?: StandingBand;
  /** Whether a lifecycle transition on this object requires operator
   *  ratification (the IRL governance boundary — behavioural/observed objects
   *  never self-canonize). */
  ratificationRequired: boolean;
  /** The governing invariants that authorize/constrain this object's existence
   *  (research.ts `governingInvariants`). Constitutional basis, not a gate. */
  governingInvariants: string[];
}

// ─────────────────────────────────────────────────────────────────────────
// §6 Ownership — T2 commitment ONLY (no raw subject id, ever)
// ─────────────────────────────────────────────────────────────────────────

export interface ObjectOwnership {
  /** A server-computed, one-way COMMITMENT to the owning subject — never the
   *  raw personaId/authProfileId/rootDid. Deterministic (idempotent) and
   *  T2-safe (safe in receipts + chain metadata). See CLAUDE.md HMS Identifier
   *  Isolation — the same discipline generalized to every object. */
  ownerCommitment: string;
  /** Optional T2-safe cohort/scope commitment (multi-tenant grouping). */
  scopeCommitment?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// §7 Provenance — receipts + hash commitments (T2-safe)
// ─────────────────────────────────────────────────────────────────────────

export interface ObjectProvenance {
  /** Activity/lifecycle receipt ids proving this object's transitions
   *  (research.ts `receiptId`; iqube `provenance_receipts`). */
  receiptIds: string[];
  /** A content hash commitment of the object payload — the tamper-evident
   *  anchor (the hash-committed publication discipline). */
  contentCommitment?: string;
  /** How the object entered the substrate (e.g. 'composed' | 'ingested' |
   *  'authored' | 'derived'). Composition (CFS-022 §3) records 'composed'. */
  source?: string;
  /** The object refs this one was COMPOSED from (compose-not-generate audit
   *  trail) — the canonical assets retrieved + assembled to make it. */
  composedFrom?: ObjectRef[];
}

// ─────────────────────────────────────────────────────────────────────────
// §8 Lifecycle — a state within a kind-supplied ordered set
// ─────────────────────────────────────────────────────────────────────────

/**
 * Lifecycle is kind-specific in its STATES but uniform in its SHAPE: a current
 * state plus the ordered set of legal states for the kind. Transition legality
 * is the research/devLoop rule — one step forward, or re-enter the current
 * state (the flywheel). Kinds supply their own `order`.
 */
export interface ObjectLifecycle {
  /** The current state (must be a member of `order`). */
  state: string;
  /** The ordered, kind-specific lifecycle states (e.g. the research
   *  EXPERIMENT_LIFECYCLE, or draft→active→published→superseded). */
  order: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────
// §9 The composed base object
// ─────────────────────────────────────────────────────────────────────────

/**
 * The Constitutional Object — the base every kind implements. `payload` is the
 * kind-specific body (typed by the kind in its own increment; `unknown` here is
 * an honest deferral, NOT an extension point for ad-hoc data). All eight
 * cross-cutting facets are present on every object.
 */
export interface ConstitutionalObject<Payload = unknown> {
  identity: ObjectIdentity;
  version: ObjectVersion;
  standing: ObjectStanding;
  authority: ObjectAuthority;
  ownership: ObjectOwnership;
  provenance: ObjectProvenance;
  lifecycle: ObjectLifecycle;
  dependencies: ObjectRef[];
  /** The kind-specific body. Hardened by each kind; never a home for T0 ids. */
  payload: Payload;
}

// ─────────────────────────────────────────────────────────────────────────
// §10 Pure helpers (isomorphic, node-drillable)
// ─────────────────────────────────────────────────────────────────────────

/** Build a T2-safe object reference (no raw subject id). Pure. */
export function objectRef(id: string, kind: ConstitutionalObjectKind): ObjectRef {
  return { id, kind };
}

/** The band a 0..1 standing score falls in. Boundaries mirror the CFS-021
 *  contrast-ordered ladder; foundational is the ceiling. Pure. */
export function standingBandFor(score: number): StandingBand {
  if (score >= 0.85) return 'foundational';
  if (score >= 0.6) return 'canonical';
  if (score >= 0.3) return 'validated';
  return 'experimental';
}

/** Monotonic ordering of two bands (experimental < … < foundational). Pure. */
export function bandAtLeast(band: StandingBand, floor: StandingBand): boolean {
  return STANDING_BANDS.indexOf(band) >= STANDING_BANDS.indexOf(floor);
}

/**
 * Legal lifecycle transition: one step forward in the kind's order, or
 * re-entering the current state (the flywheel — e.g. re-running an experiment).
 * Mirrors `isLegalExperimentTransition` / the dev-loop advance rule; never
 * forked. Pure.
 */
export function isLegalObjectTransition(
  order: readonly string[],
  from: string,
  to: string,
): boolean {
  const fi = order.indexOf(from);
  const ti = order.indexOf(to);
  if (fi < 0 || ti < 0) return false;
  return ti === fi || ti === fi + 1;
}

// ─────────────────────────────────────────────────────────────────────────
// §11 T0 inexpressibility — the leak-canary predicate
// ─────────────────────────────────────────────────────────────────────────

/** T0 identifier keys that must NEVER appear anywhere in a serialised object. */
export const FORBIDDEN_OBJECT_KEYS: readonly string[] = [
  'personaId',
  'authProfileId',
  'rootDid',
  'fioHandle',
  'kybeAttestation',
];

/**
 * Deep-scan any value for a forbidden T0 key (any casing, any nesting). Returns
 * the offending key path, or null when clean. The single choke-point that makes
 * a T0 leak into a ConstitutionalObject a build failure. Pure; mirrors the DCIR
 * + dev-loop-session T2 guards.
 */
export function findForbiddenObjectKey(value: unknown, path = ''): string | null {
  if (value === null || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const hit = findForbiddenObjectKey(value[i], `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    const lowered = key.toLowerCase();
    if (FORBIDDEN_OBJECT_KEYS.some((f) => f.toLowerCase() === lowered)) {
      return path ? `${path}.${key}` : key;
    }
    const hit = findForbiddenObjectKey(v, path ? `${path}.${key}` : key);
    if (hit) return hit;
  }
  return null;
}

/** True iff the object carries NO T0 identifier anywhere. Pure. */
export function isTierSafeObject(obj: ConstitutionalObject): boolean {
  return findForbiddenObjectKey(obj) === null;
}
