/**
 * The Artifact Runtime (AR) — the contract surface (CFS-025).
 *
 * THE GOVERNING PRINCIPLE: *Constitutionality is a property of consequence, not
 * of creation.* People remain free to think, sketch, prototype and explore
 * without constitutional overhead. Only when an artifact is intended to become
 * authoritative, enduring, or consequential does it enter the constitutional
 * lifecycle. Forcing everything through the constitutional runtime would be
 * over-governance — Supreme-Court review for a shopping list.
 *
 * So the runtime does not "produce"; it SHEPHERDS ARTIFACTS ACROSS CONSEQUENCE
 * TIERS. There are three:
 *
 *   • DISPOSABLE    — no constitutional consequence. Brainstorming, scratch
 *                     notes, drafts, prototypes, exploratory research. NO
 *                     receipts / Standing / Registry / audit / publication.
 *                     Fast, cheap, ephemeral — a notebook.
 *   • OPERATIONAL   — some consequence, not constitutional. Internal docs,
 *                     proposal drafts, sprint specs, software builds, reports.
 *                     May carry versioning / review / approvals. Think GitHub.
 *   • CONSTITUTIONAL— high consequence, canonical. Polity Papers, CCS specs,
 *                     Passport issuance, Standing updates, Agreements, published
 *                     standards, government submissions. The FULL constitutional
 *                     lifecycle: invariant check → consequence review →
 *                     verification → publication → receipt → standing → registry.
 *
 * Consequence Engineering's first question is therefore NOT "should this be
 * constitutional?" but "what is the consequence CLASS?". The constitutional
 * process is EARNED by PROMOTION (disposable → operational → constitutional),
 * the final stage of maturation — never the mandatory starting point. This
 * mirrors software (scratch → branch → release candidate → production),
 * legislation, and scientific publishing.
 *
 * "CPR" (the Constitutional Production Runtime) is not a separate thing — it is
 * AR operating in the CONSTITUTIONAL tier. The tier below it (operational) and
 * the tier below that (disposable) are the same runtime with less ceremony.
 *
 * Contract-first (the CFS-024 Phase 0 discipline): order-pinned constitutional
 * data + a few pure helpers + a canary, NO runtime organs, NO storage. The
 * runtime (`services/artifact/*` or `services/production/*`) executes this shape
 * in a later phase and COMPOSES the already-shipped primitives — the
 * Constitutional Object Model (`types/constitutionalObject.ts`), the Composition
 * engine (`services/composition/composeArtifact.ts` → `CompositionResult`), the
 * unified receipts + protected DVN pipeline
 * (`services/receipts/activityReceiptService.ts`), the Registry, Standing, and
 * the identity spine (`getActivePersona`) — it never forks any of them. Only a
 * CONSTITUTIONAL-tier output IS a `ConstitutionalObject`.
 *
 * TIER DISCIPLINE (Identity & Access Spine — non-negotiable): AR is a T1/T2
 * surface. NO T0 identifier (`personaId`, `authProfileId`, `rootDid`) is
 * expressible anywhere in this contract — the owning/acting subjects carry only
 * server-computed one-way COMMITMENTS (`ownerCommitment`, `actorCommitment`).
 *
 * Isomorphic: no fs, no DB, no React, no clock, no randomness.
 */

import type {
  ConstitutionalObject,
  ConstitutionalObjectKind,
  ObjectRef,
  ObjectVersion,
} from '@/types/constitutionalObject';
import type { CompositionResult } from '@/types/composition';

// ─────────────────────────────────────────────────────────────────────────
// §1 Consequence classes (order pinned — increasing consequence)
// ─────────────────────────────────────────────────────────────────────────

/**
 * The three consequence tiers, in ascending order of consequence. Order IS
 * meaning: promotion only ever moves UP this list (see canPromote). Pinned by
 * canary.
 */
export const CONSEQUENCE_CLASSES = ['disposable', 'operational', 'constitutional'] as const;

export type ConsequenceClass = (typeof CONSEQUENCE_CLASSES)[number];

/** Numeric consequence level (0 = disposable), or -1 if unknown. Pure. */
export function consequenceClassIndex(cls: string): number {
  return (CONSEQUENCE_CLASSES as readonly string[]).indexOf(cls);
}

/** The tier that incurs the full constitutional lifecycle. */
export const CONSTITUTIONAL_CLASS: ConsequenceClass = 'constitutional';

// ─────────────────────────────────────────────────────────────────────────
// §2 Per-tier lifecycles (each order pinned) — one runtime, three ceremonies
// ─────────────────────────────────────────────────────────────────────────

/** DISPOSABLE: compose → done. No receipts, no Standing, no Registry. */
export const DISPOSABLE_LIFECYCLE = ['compose'] as const;

/** OPERATIONAL: compose → review → version → publish. GitHub-grade, not canonical. */
export const OPERATIONAL_LIFECYCLE = ['compose', 'review', 'version', 'publish'] as const;

/**
 * CONSTITUTIONAL: the full lifecycle. A profile configures the runtime within
 * this tier (templates, review gates, verifier, output); it never adds, removes,
 * or reorders a stage.
 */
export const CONSTITUTIONAL_LIFECYCLE = [
  'intent', // the authorised intent that licenses production
  'planning', // production plan for the profile
  'composition', // RETRIEVE + ASSEMBLE canonical assets (composeArtifact) — not re-implemented
  'review', // profile review gates
  'verification', // profile verifier — evidence gathering
  'publication', // immutable id + version minted — the immutability boundary
  'distribution', // the sealed artifact is delivered to its surfaces
  'receipts', // publication receipt emitted (unified receipt + protected DVN)
  'standing', // standing event accrues
  'registry', // the registry entry is written — the object becomes canonical
] as const;

export type DisposableStage = (typeof DISPOSABLE_LIFECYCLE)[number];
export type OperationalStage = (typeof OPERATIONAL_LIFECYCLE)[number];
export type ConstitutionalStage = (typeof CONSTITUTIONAL_LIFECYCLE)[number];
export type ArtifactStage = DisposableStage | OperationalStage | ConstitutionalStage;

/** The lifecycle for a consequence class. */
export const LIFECYCLE_FOR_CLASS: Record<ConsequenceClass, readonly string[]> = {
  disposable: DISPOSABLE_LIFECYCLE,
  operational: OPERATIONAL_LIFECYCLE,
  constitutional: CONSTITUTIONAL_LIFECYCLE,
};

/** The ordered lifecycle for a class, or [] if unknown. Pure. */
export function lifecycleFor(cls: string): readonly string[] {
  return LIFECYCLE_FOR_CLASS[cls as ConsequenceClass] ?? [];
}

/**
 * The stage at which a CONSTITUTIONAL artifact's identity + version become
 * IMMUTABLE. (Operational 'publish' seals an operational version, but only the
 * constitutional tier mints a canonical, receipt-anchored identity.)
 */
export const IMMUTABILITY_STAGE: ConstitutionalStage = 'publication';

/** Position of a stage within its class lifecycle (0-based), or -1. Pure. */
export function stageIndexOf(cls: string, stage: string): number {
  return lifecycleFor(cls).indexOf(stage);
}

/**
 * Legal lifecycle transition WITHIN a class: one step forward in that class's
 * pinned order, or re-entering the current stage (the flywheel — e.g. a second
 * review pass). Mirrors `isLegalObjectTransition` semantics; never forked.
 * Unknown, skip-ahead, and backward transitions are illegal. Pure.
 */
export function isLegalStageTransition(cls: string, from: string, to: string): boolean {
  const lifecycle = lifecycleFor(cls);
  const fi = lifecycle.indexOf(from);
  const ti = lifecycle.indexOf(to);
  if (fi < 0 || ti < 0) return false;
  return ti === fi || ti === fi + 1;
}

// ─────────────────────────────────────────────────────────────────────────
// §3 Promotion — constitutionality is EARNED (maturation, never demotion)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Whether an artifact may be PROMOTED from one consequence class to another. A
 * promotion is a deliberate act of maturation: it only ever moves UP exactly one
 * tier (disposable → operational → constitutional). Demotion and tier-skipping
 * are illegal — an artifact earns its constitutionality; it is never born into
 * it, and never quietly stripped of it. Pure.
 */
export function canPromote(from: string, to: string): boolean {
  const fi = consequenceClassIndex(from);
  const ti = consequenceClassIndex(to);
  if (fi < 0 || ti < 0) return false;
  return ti === fi + 1;
}

// ─────────────────────────────────────────────────────────────────────────
// §4 Artifact profiles (configure output; orthogonal to consequence class)
// ─────────────────────────────────────────────────────────────────────────

/**
 * The profiles AR supports. A profile configures the runtime's OUTPUT (object
 * kind, review gates, verifier, distribution); ADDING a profile must not change
 * AR. A profile is orthogonal to consequence class — the SAME profile can be
 * produced disposably (a draft), operationally (a working version), or
 * constitutionally (the canonical artifact). `defaultClass` is only the tier an
 * artifact of this profile TYPICALLY matures to, never a floor. Order-pinned.
 */
export const ARTIFACT_PROFILES = [
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

export type ArtifactProfileId = (typeof ARTIFACT_PROFILES)[number];

/** Numeric position of a profile in the pinned set, or -1 if unknown. Pure. */
export function profileIndexOf(profile: string): number {
  return (ARTIFACT_PROFILES as readonly string[]).indexOf(profile);
}

/**
 * A profile's configuration. It selects which kind of ConstitutionalObject a
 * CONSTITUTIONAL-tier run produces, which review gates apply, which verifier
 * runs, and how the artifact is distributed. It never changes a lifecycle.
 */
export interface ArtifactProfile {
  id: ArtifactProfileId;
  /** The object kind a constitutional-tier output of this profile is. */
  objectKind: ConstitutionalObjectKind;
  /** The tier an artifact of this profile TYPICALLY matures to (a hint, not a floor). */
  defaultClass: ConsequenceClass;
  /** The named review gates the `review` stage runs (profile-specific). */
  reviewGates: readonly string[];
  /** The verifier the `verification` stage invokes (a named verifier, not a fn). */
  verifier: string;
  /** How the `distribution` stage delivers the sealed artifact. */
  distribution: string;
  /** Whether constitutional `publication` requires operator ratification. */
  ratificationRequired: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// §5 The invoking runtimes — who calls AR (none owns it)
// ─────────────────────────────────────────────────────────────────────────

/**
 * The runtimes that INVOKE the Artifact Runtime. Each retains its identity
 * (planning, reasoning, composition, editorial) and transfers only artifact
 * shepherding to AR. `operator` is the direct-invocation path. Order-pinned.
 */
export const INVOKING_RUNTIMES = ['agentme', 'aigentz', 'studio', 'ccrl', 'operator'] as const;

export type InvokingRuntime = (typeof INVOKING_RUNTIMES)[number];

// ─────────────────────────────────────────────────────────────────────────
// §6 The artifact job — the run record (T2-safe throughout)
// ─────────────────────────────────────────────────────────────────────────

/**
 * The composition input a job carries INTO the runtime — a reference to the
 * composition and (when composition has run) its result. AR's composition stage
 * CONSUMES this; it does not re-run the composition engine's logic.
 */
export interface ArtifactCompositionInput {
  /** A T2-safe ref to the composition this run consumes, if any. */
  compositionRef: string | null;
  /** The composition engine's result (types/composition.ts), or null. */
  result: CompositionResult | null;
}

/** One stage's evidence — the auditable trail of what the lifecycle did. */
export interface StageEvidence {
  stage: ArtifactStage;
  outcome: 'passed' | 'failed' | 'skipped';
  /** Human-readable detail (a gate name, a verifier note). Never a T0 id. */
  detail: string;
  /** ISO timestamp — stamped by the CALLER/runtime, never read from a clock here. */
  at: string | null;
}

/**
 * An artifact run. `consequenceClass` is null until the classify step assigns
 * one. `ownerCommitment` is a server-computed one-way commitment to the owning
 * subject — NEVER a raw personaId/authProfileId/rootDid (header TIER DISCIPLINE).
 * `receiptIds` is populated only in the constitutional tier.
 */
export interface ArtifactJob {
  jobId: string | null;
  /** T2-safe ref to the authorising intent (an IntentQube ref). */
  intentRef: string | null;
  /** Assigned by the classify step; null before classification. */
  consequenceClass: ConsequenceClass | null;
  profile: ArtifactProfileId | null;
  invokedBy: InvokingRuntime | null;
  compositionInput: ArtifactCompositionInput;
  /** The current stage within the class lifecycle; null before classification. */
  state: ArtifactStage | null;
  evidence: StageEvidence[];
  receiptIds: string[];
  /** One-way commitment to the owner — the ONLY subject handle AR expresses. */
  ownerCommitment: string | null;
}

/** An empty artifact job (unclassified, not yet run) — honest nulls, fresh arrays. */
export function emptyArtifactJob(): ArtifactJob {
  return {
    jobId: null,
    intentRef: null,
    consequenceClass: null,
    profile: null,
    invokedBy: null,
    compositionInput: { compositionRef: null, result: null },
    state: null, // unclassified — classification is the first act
    evidence: [],
    receiptIds: [],
    ownerCommitment: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// §7 The artifact result — outputs vary by tier
// ─────────────────────────────────────────────────────────────────────────

/**
 * The result of an artifact run. Only the CONSTITUTIONAL tier yields the full
 * publication contract — an immutable `artifactId`, a `version`, a `receiptId`,
 * a `registryEntry`, and the produced `object` (a ConstitutionalObject).
 * OPERATIONAL yields a versioned artifact (`artifactId` + `version`) but null
 * `object`/`receiptId`/`registryEntry` — it is not canonical. DISPOSABLE yields
 * nothing persistent (all null). `consequenceClass` echoes the tier the run ran.
 */
export interface ArtifactResult {
  ok: boolean;
  consequenceClass: ConsequenceClass | null;
  /** The produced object — only in the constitutional tier; else null. */
  object: ConstitutionalObject | null;
  /** The artifact identifier (constitutional: immutable; operational: versioned), or null. */
  artifactId: string | null;
  /** The version (constitutional: ObjectVersion; operational: a version tag), or null. */
  version: ObjectVersion | string | null;
  /** The publication receipt id — constitutional tier only; else null. */
  receiptId: string | null;
  /** The registry ref — constitutional tier only; else null. */
  registryEntry: ObjectRef | string | null;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// §8 The seams — classify first, then run the tier
// ─────────────────────────────────────────────────────────────────────────

/**
 * The context a runtime supplies when it invokes AR. `actorCommitment` is a
 * one-way commitment to the acting subject (NEVER a personaId). `mode` mirrors
 * the composition observe-mode discipline: 'propose' (default) runs the artifact
 * + provenance draft WITHOUT publishing; 'publish' is honoured only behind an
 * explicit operator gate at the call site (and only matters for the
 * constitutional tier).
 */
export interface ArtifactContext {
  invokedBy: InvokingRuntime;
  intentRef: string;
  actorCommitment: string;
  mode?: 'propose' | 'publish';
}

/**
 * The FIRST act: classify an artifact's consequence. This is what Consequence
 * Engineering asks ("what is the consequence class?") before any ceremony.
 * The runtime implements it; contract-only here.
 */
export type ClassifyFn = (
  profile: ArtifactProfileId,
  input: ArtifactCompositionInput,
  context: ArtifactContext,
) => Promise<ConsequenceClass>;

/**
 * The run seam every runtime invokes, once the consequence class is known. The
 * class selects the lifecycle; disposable returns fast with nothing persistent,
 * constitutional runs the full lifecycle. The runtime (`services/artifact/*`)
 * implements this; contract-only here — no logic.
 */
export type RunArtifactFn = (
  consequenceClass: ConsequenceClass,
  profile: ArtifactProfileId,
  input: ArtifactCompositionInput,
  context: ArtifactContext,
) => Promise<ArtifactResult>;

// ─────────────────────────────────────────────────────────────────────────
// §9 The artifact-runtime invariants (stated; proposed under Law XI)
// ─────────────────────────────────────────────────────────────────────────

/**
 * The invariants CFS-025 ratifies. They enter the substrate as PROPOSED (Law XI
 * — the operator ratifies); the canary pins their statements, not their status.
 */
export const ARTIFACT_RUNTIME_INVARIANTS = [
  {
    id: 'constitutionality-is-earned',
    statement:
      'Constitutionality is a property of consequence, not of creation. An artifact SHALL be PROMOTED into the constitutional lifecycle as a deliberate act of maturation — never born into it, never quietly stripped of it. Promotion moves up exactly one tier and never down.',
  },
  {
    id: 'consequence-classification-first',
    statement:
      'Every artifact SHALL be classified by consequence (disposable | operational | constitutional) before any lifecycle runs. Disposable artifacts incur NO receipts, Standing, Registry, or audit. Only the constitutional class enters the full constitutional lifecycle.',
  },
  {
    id: 'production-not-composition',
    statement:
      'Composition and production SHALL be distinct: composition explores, edits, and refines an idea; production turns a promoted idea into a reviewed, verified, versioned, published, recorded artifact. The runtime invokes composition and never re-implements it.',
  },
  {
    id: 'constitutional-object-identity',
    statement:
      'Only a CONSTITUTIONAL-tier output SHALL be a ConstitutionalObject carrying identity, version, standing, provenance, receipt, and registry entry. Lower tiers produce no canonical object and no constitutional receipt.',
  },
] as const;
