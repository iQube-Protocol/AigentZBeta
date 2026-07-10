/**
 * The Constitutional Production Runtime — the contract surface (CFS-025).
 *
 * The separation, not a merger: **composition** (where ideas are explored,
 * edited, refined) versus **production** (where an idea becomes a reviewed,
 * verified, versioned, signed, published, recorded constitutional artifact).
 * CPR owns production; nothing else has to. Every runtime (AgentMe, AigentZ,
 * Studio, CCRL, Cryptopia) INVOKES CPR and keeps its own identity — it simply
 * stops owning production.
 *
 * Contract-first (the CFS-024 Phase 0 discipline): order-pinned constitutional
 * data + a few pure helpers + a canary, NO runtime organs, NO storage. The
 * runtime (`services/production/*`) executes this shape in a later phase and
 * COMPOSES the already-shipped primitives — the Constitutional Object Model
 * (`types/constitutionalObject.ts`), the Composition engine
 * (`services/composition/composeArtifact.ts`, whose result IS a
 * CompositionResult), the unified receipts + protected DVN pipeline
 * (`services/receipts/activityReceiptService.ts`), the Registry, Standing, and
 * the identity spine (`getActivePersona`) — it never forks any of them. A
 * production output IS a `ConstitutionalObject`; production never re-implements
 * composition, versioning, or receipts.
 *
 * TIER DISCIPLINE (Identity & Access Spine — non-negotiable): CPR is a T1/T2
 * surface. NO T0 identifier (`personaId`, `authProfileId`, `rootDid`) is
 * expressible anywhere in this contract — the owning subject and the acting
 * subject carry only server-computed one-way COMMITMENTS (`ownerCommitment`,
 * `actorCommitment`), never a raw subject identifier. Receipts and registry
 * refs are the only network/chain-bound handles, and they are T2-safe by
 * construction (they inherit the object model + receipt-service discipline).
 *
 * Isomorphic: no fs, no DB, no React, no clock, no randomness — safe on the
 * server, the chat route, and client components alike.
 */

import type {
  ConstitutionalObject,
  ConstitutionalObjectKind,
  ObjectRef,
  ObjectVersion,
} from '@/types/constitutionalObject';
import type { CompositionResult } from '@/types/composition';

// ─────────────────────────────────────────────────────────────────────────
// §1 The single production lifecycle (order pinned — order is meaning)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Every artifact — whatever its profile — follows ONE lifecycle. A profile
 * configures the runtime (templates, review rules, verifier, output format); it
 * never adds, removes, or reorders a stage. Pinned by canary.
 */
export const PRODUCTION_LIFECYCLE = [
  'intent', // the authorised intent that licenses production
  'planning', // production plan for the profile
  'composition', // RETRIEVE + ASSEMBLE canonical assets (composeArtifact) — not re-implemented here
  'review', // profile review gates
  'verification', // profile verifier — evidence gathering
  'publication', // immutable id + version minted — the immutability boundary
  'distribution', // the published artifact is delivered to its surfaces
  'receipts', // publication receipt emitted (unified receipt + protected DVN)
  'standing', // standing event accrues
  'registry', // the registry entry is written — the object becomes canonical
] as const;

export type ProductionStage = (typeof PRODUCTION_LIFECYCLE)[number];

/**
 * The stage at which the artifact's identity + version become IMMUTABLE. Nothing
 * downstream of publication may mutate the published bytes — distribution,
 * receipts, standing, and registry all reference the sealed artifact.
 */
export const IMMUTABILITY_STAGE: ProductionStage = 'publication';

/** Numeric position of a stage (0 = intent), or -1 if unknown. Pure. */
export function stageIndexOf(stage: string): number {
  return (PRODUCTION_LIFECYCLE as readonly string[]).indexOf(stage);
}

/**
 * Legal lifecycle transition: one step forward in the pinned order, or
 * re-entering the current stage (the flywheel — e.g. a second review pass).
 * Mirrors `isLegalObjectTransition` (constitutionalObject.ts) semantics; never
 * forked. Unknown, skip-ahead, and backward transitions are illegal. Pure.
 */
export function isLegalStageTransition(from: string, to: string): boolean {
  const fi = stageIndexOf(from);
  const ti = stageIndexOf(to);
  if (fi < 0 || ti < 0) return false;
  return ti === fi || ti === fi + 1;
}

// ─────────────────────────────────────────────────────────────────────────
// §2 Production profiles (configure, don't replace)
// ─────────────────────────────────────────────────────────────────────────

/**
 * The profiles CPR supports. A profile configures the runtime; ADDING a profile
 * must not change CPR. Order-pinned so the set is canary-checkable. Extend by
 * adding an id (+ a ProductionProfile record) — never by forking the runtime.
 */
export const PRODUCTION_PROFILES = [
  'standard',
  'white-paper',
  'research',
  'software',
  'agreement',
  'presentation',
  'book',
  'investor-deck',
  'api',
  'documentation',
  'policy',
  'multimedia',
] as const;

export type ProductionProfileId = (typeof PRODUCTION_PROFILES)[number];

/** Numeric position of a profile in the pinned set, or -1 if unknown. Pure. */
export function profileIndexOf(profile: string): number {
  return (PRODUCTION_PROFILES as readonly string[]).indexOf(profile);
}

/**
 * A profile's configuration of the ONE lifecycle. It selects which kind of
 * ConstitutionalObject the run produces, which review gates apply, which
 * verifier runs, how the artifact is distributed, and whether publication
 * requires operator ratification. It never changes the lifecycle itself.
 */
export interface ProductionProfile {
  id: ProductionProfileId;
  /** The object kind every output of this profile is (constitutionalObject.ts). */
  objectKind: ConstitutionalObjectKind;
  /** The named review gates the `review` stage runs (profile-specific). */
  reviewGates: readonly string[];
  /** The verifier the `verification` stage invokes (a named verifier, not a fn). */
  verifier: string;
  /** How the `distribution` stage delivers the sealed artifact. */
  distribution: string;
  /** Whether `publication` requires operator ratification (the CCRL boundary). */
  ratificationRequired: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// §3 The invoking runtimes — who calls CPR (none owns it)
// ─────────────────────────────────────────────────────────────────────────

/**
 * The runtimes that INVOKE production. Each retains its identity (planning,
 * reasoning, composition, editorial) and transfers only its production phase to
 * CPR. `operator` is the direct-invocation path. Order-pinned.
 */
export const INVOKING_RUNTIMES = ['agentme', 'aigentz', 'studio', 'ccrl', 'operator'] as const;

export type InvokingRuntime = (typeof INVOKING_RUNTIMES)[number];

// ─────────────────────────────────────────────────────────────────────────
// §4 The production job — the run record (T2-safe throughout)
// ─────────────────────────────────────────────────────────────────────────

/**
 * The composition input a job carries INTO production — a reference to the
 * composition and (when composition has run) its result. CPR's `composition`
 * stage CONSUMES this; it does not re-run the composition engine's logic.
 */
export interface ProductionCompositionInput {
  /** A T2-safe ref to the composition this production consumes, if any. */
  compositionRef: string | null;
  /** The composition engine's result (types/composition.ts), or null. */
  result: CompositionResult | null;
}

/** One stage's evidence — the auditable trail of what the lifecycle did. */
export interface StageEvidence {
  stage: ProductionStage;
  outcome: 'passed' | 'failed' | 'skipped';
  /** Human-readable detail (a gate name, a verifier note). Never a T0 id. */
  detail: string;
  /** ISO timestamp — stamped by the CALLER/runtime, never read from a clock here. */
  at: string | null;
}

/**
 * A production run. `ownerCommitment` is a server-computed one-way commitment to
 * the owning subject — NEVER a raw personaId/authProfileId/rootDid (see the
 * header TIER DISCIPLINE). `receiptIds` are the unified receipts the run emits.
 */
export interface ProductionJob {
  jobId: string | null;
  /** T2-safe ref to the authorising intent (an IntentQube ref). */
  intentRef: string | null;
  profile: ProductionProfileId | null;
  invokedBy: InvokingRuntime | null;
  compositionInput: ProductionCompositionInput;
  state: ProductionStage;
  evidence: StageEvidence[];
  receiptIds: string[];
  /** One-way commitment to the owner — the ONLY subject handle CPR expresses. */
  ownerCommitment: string | null;
}

/** An empty production job (not yet invoked) — honest nulls, fresh arrays. */
export function emptyProductionJob(): ProductionJob {
  return {
    jobId: null,
    intentRef: null,
    profile: null,
    invokedBy: null,
    compositionInput: { compositionRef: null, result: null },
    state: PRODUCTION_LIFECYCLE[0], // 'intent' — the honest lifecycle start
    evidence: [],
    receiptIds: [],
    ownerCommitment: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// §5 The production result — the publication contract's outputs
// ─────────────────────────────────────────────────────────────────────────

/**
 * The result of a production run. Every successful publication yields the
 * non-negotiable outputs: an immutable identifier (`artifactId`), a `version`, a
 * `receiptId`, a `registryEntry`, and the produced `object` — which IS a
 * ConstitutionalObject, never an artifact outside the object model.
 */
export interface ProductionResult {
  ok: boolean;
  /** The produced object (constitutionalObject.ts), or null on failure. */
  object: ConstitutionalObject | null;
  /** The immutable artifact identifier minted at `publication`, or null. */
  artifactId: string | null;
  /** The object version (constitutionalObject.ts ObjectVersion), or null. */
  version: ObjectVersion | string | null;
  /** The publication receipt id (unified receipt + protected DVN), or null. */
  receiptId: string | null;
  /** The registry ref written at `registry` (an ObjectRef), or null. */
  registryEntry: ObjectRef | string | null;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// §6 The produce seam — the single entry contract every runtime invokes
// ─────────────────────────────────────────────────────────────────────────

/**
 * The context a runtime supplies when it invokes production. `actorCommitment`
 * is a one-way commitment to the acting subject (NEVER a personaId) — the runtime
 * derives it the way `composeArtifact` derives its public ref. `mode` mirrors the
 * composition observe-mode discipline: 'propose' (default) produces the artifact
 * + provenance draft WITHOUT publishing; 'publish' is honoured only behind an
 * explicit operator gate at the call site.
 */
export interface ProduceContext {
  invokedBy: InvokingRuntime;
  intentRef: string;
  actorCommitment: string;
  mode?: 'propose' | 'publish';
}

/**
 * The single production entry point. The runtime (`services/production/*`)
 * implements this; every invoker calls it. Contract-only here — no logic.
 */
export type ProduceFn = (
  profile: ProductionProfileId,
  input: ProductionCompositionInput,
  context: ProduceContext,
) => Promise<ProductionResult>;

// ─────────────────────────────────────────────────────────────────────────
// §7 The three production invariants (stated; proposed under Law XI)
// ─────────────────────────────────────────────────────────────────────────

/**
 * The invariants CFS-025 ratifies. They enter the substrate as PROPOSED (Law XI
 * — the operator ratifies); the canary pins their statements, not their
 * canonical status.
 */
export const CONSTITUTIONAL_PRODUCTION_INVARIANTS = [
  {
    id: 'production-not-composition',
    statement:
      'Composition and production SHALL be distinct: composition explores, edits, and refines an idea, while production turns it into a reviewed, verified, versioned, published, recorded constitutional artifact. CPR owns production; it invokes composition and never re-implements it.',
  },
  {
    id: 'production-single-lifecycle',
    statement:
      'Every produced artifact, whatever its profile, SHALL follow ONE lifecycle (intent → planning → composition → review → verification → publication → distribution → receipts → standing → registry). A profile configures the runtime; it never adds, removes, or reorders a stage.',
  },
  {
    id: 'production-object-identity',
    statement:
      'Every production output SHALL be a ConstitutionalObject carrying identity, version, standing, and provenance. Production never emits an artifact outside the Constitutional Object Model.',
  },
] as const;
