/**
 * Capability Completion Artifact — the machine-readable type contract for
 * CCR-001 (`codexes/packs/irl/foundation/CCR-001_constitutional-capability-completion.md`),
 * schema `capability-completion-artifact/v2.0` — declared once as
 * `CAPABILITY_COMPLETION_SCHEMA_VERSION` below, which is the SINGLE source of
 * truth for the version string across the type, the validator, the CCA
 * template, CFS-049 and CCR-001.
 *
 * EXTENDS, DOES NOT FORK (CCR-001 §25, CFS-049 Amendment A). This is NOT a
 * second artifact family beside the Constitutional Capability Brief. It is the
 * Brief's completion half, expressed as a type:
 *
 *   CFS-049 (the Brief) answers  →  what shipped, where it is, how to use it
 *   CCR-001 (this contract) adds →  what must remain true, which defect proved
 *                                   it, which canary enforces it, how it is
 *                                   reproduced, how it may safely change
 *
 * The Brief's markdown twin remains the SOURCE OF TRUTH (CFS-049 §5). This
 * shape is DERIVED from that markdown by `parseCompletionArtifact` in
 * `services/constitutional/capabilityCompletionArtifact.ts` — it is never a
 * hand-maintained JSON duplicate of the document, because that would be the
 * exact `inv.engineering.036` defect (two things describing one thing, the
 * stale one winning) that CCR-001's own reference capability was written to
 * eliminate.
 *
 * The registry linkage is CFS-032's, unchanged: `capabilityId` here is the
 * same key `RegisterCapabilityInput.capabilityId` uses, and `briefUrl` on that
 * registry remains the single pointer to the document this shape is read from.
 * Registration stays the acceptance ceremony — this contract adds no second one.
 *
 * §9 LIFECYCLE — RESOLVED BY MAPPING, NOT UNIFICATION (operator, 2026-07-27:
 * *"map, don't unify. Agreed."*). `FINDING_LIFECYCLE` in `types/research.ts`
 * stays pinned canon and is never rewritten, extended or re-ordered — its
 * ORDER is constitutional data under `inv.constitutional.078`. CCR-001's
 * `COMPLETION_LIFECYCLE` is a SEPARATE ladder that maps onto the seed crystal's
 * vocabulary, carrying the source value alongside its own, in the same shape
 * the Horizen audit's Amendment B §B.4 ratified for `CommonsEvidencePosture`
 * (*"carries `sourceLifecycle` so the native ladder is never erased"*).
 *
 * So an invariant record carries BOTH: `completionStage` (CCR-001's own ladder)
 * and `status` (the seed crystal's `proposed | validated | canonical`, the
 * source value). Neither is rewritten into the other; `mapCompletionStage` is
 * the one-way projection between them.
 *
 * Validator idiom follows `services/passport/participantApplicationValidator.ts`
 * (path-addressed issues over an `unknown` input, version field checked first)
 * rather than `types/representation.ts`'s `ValidationResult` — that one is the
 * representation system's own domain contract with a flat `violations: string[]`,
 * which cannot address a fault inside a nested invariant record.
 */

// ---------------------------------------------------------------------------
// Schema version
// ---------------------------------------------------------------------------

/**
 * The versioned schema identifier (CCR-001 §12). Follows the repo's
 * `<kebab-domain-slug>/v<major>.<minor>` convention (cf. `venture-iqube/v1.0`
 * in `types/ventureQube.ts`). A document declaring any other version is
 * refused rather than coerced.
 *
 * ─── v2.0 (2026-07-27, operator ruling: "Add `Emits` to CCR-001") ───────────
 * WHAT CHANGED: `## Capability boundary` gains a REQUIRED `### Emits`
 * sub-section and a `### Emission rationale` sub-section required whenever
 * Emits is empty. Nothing else in the document format changed; every v1.0
 * section is carried forward unaltered.
 *
 * WHY MAJOR AND NOT MINOR. The format is a strict superset, which reads like a
 * minor bump — but a v1.0 document does NOT validate under this contract,
 * because the whole point of the field is that omitting it is an error. A minor
 * version signalling a compatibility that does not exist is precisely the
 * misleading signal these artifacts exist to eliminate, so this is `v2.0`.
 *
 * WHY REQUIRED. The ruling's own specification: the field must separate three
 * states that an absent field conflates — `none` (an empty list with a stated
 * rationale), `unknown` (an empty list with no rationale) and `forgotten` (no
 * list at all). If the section may be omitted silently, all three collapse back
 * into one and the extension solves nothing. `CAN-CCR-9` enforces it.
 */
export const CAPABILITY_COMPLETION_SCHEMA_VERSION = 'capability-completion-artifact/v2.0' as const;

/**
 * Superseded schema identifiers, newest-first. Recorded in the type rather than
 * only in prose so the history of the contract is machine-readable and a reader
 * encountering an old document can tell whether it is stale or merely foreign.
 * Nothing accepts these — the validator pins the current version exactly.
 */
export const SUPERSEDED_COMPLETION_SCHEMA_VERSIONS = [
  'capability-completion-artifact/v1.0',
] as const;

export type CapabilityCompletionSchemaVersion = typeof CAPABILITY_COMPLETION_SCHEMA_VERSION;

// ---------------------------------------------------------------------------
// §8 Provenance vocabulary — pinned
// ---------------------------------------------------------------------------

/**
 * CCR-001 §8 — how an invariant came to be known. CCR-INV-4 ("every invariant
 * retains provenance") is meaningless without a closed vocabulary: "we learned
 * this somehow" is not provenance. `CAN-CCR-2` pins it.
 *
 * ORDER IS NOT SEMANTIC here — unlike `FINDING_LIFECYCLE`, this is a set of
 * kinds, not a ladder. Nothing may read position in this array as rank.
 */
export const INVARIANT_PROVENANCE_KINDS = [
  /** A live regression proved it. The strongest and most common kind. */
  'regression-derived',
  /** Surfaced when two already-working parts were composed. */
  'integration-derived',
  /** Caught in design or review before it ever shipped a defect. */
  'pre-release-intercepted',
  /** Found by deliberately attacking the capability. */
  'adversarially-derived',
  /** Follows from a proof, a type, or a structural argument. */
  'formally-derived',
  /** The same shape recurred across two or more capabilities. */
  'cross-capability-recurrence',
  /** Asserted but not yet evidenced — a candidate, never a claim. */
  'proposed',
] as const;

export type InvariantProvenance = (typeof INVARIANT_PROVENANCE_KINDS)[number];

/**
 * The one provenance kind that carries NO evidence. Pinned separately so
 * `CAN-CCR-2` states its rule against a named constant rather than a literal.
 */
export const UNEVIDENCED_PROVENANCE: InvariantProvenance = 'proposed';

// ---------------------------------------------------------------------------
// Invariant status — the EXISTING seed-crystal vocabulary, not a new ladder
// ---------------------------------------------------------------------------

/**
 * `proposed | validated | canonical` — exactly the statuses the canonical
 * invariant crystal already uses. This is the SOURCE lifecycle value an
 * artifact carries; it is never rewritten. `canonical` is this vocabulary's
 * ratified terminus and is what `CAN-CCR-3` ("no ratified invariant without
 * enforcement") reads.
 */
export const INVARIANT_STATUSES = ['proposed', 'validated', 'canonical'] as const;

export type InvariantStatus = (typeof INVARIANT_STATUSES)[number];

/**
 * CCR-001 §9's completion ladder — CCR-001's OWN vocabulary, distinct from both
 * the crystal statuses above and from `FINDING_LIFECYCLE`. ORDER IS SEMANTIC
 * here: it is a ladder, and a stage's position is its maturity.
 *
 * Held separate on purpose. `FINDING_LIFECYCLE` governs empirical findings
 * earning canonisation through replication; this governs engineering invariants
 * earning enforcement through canaries. Mapping preserves both; unifying would
 * destroy one.
 */
export const COMPLETION_LIFECYCLE = [
  'observed',
  'candidate',
  'validated',
  'ratified',
  'canonical',
  'deprecated',
] as const;

export type CompletionStage = (typeof COMPLETION_LIFECYCLE)[number];

/**
 * The one-way projection from CCR-001's ladder onto the crystal's vocabulary.
 * Total by construction — every stage has an answer, so no stage can be added
 * without deciding what it means to the crystal.
 *
 * `deprecated` maps to `null`: a retired invariant asserts no crystal status at
 * all. That is honest rather than convenient — the crystal has no `deprecated`,
 * and inventing one would be exactly the unification this ruling forbids.
 */
export const COMPLETION_STAGE_TO_STATUS: Record<CompletionStage, InvariantStatus | null> = {
  observed: 'proposed',
  candidate: 'proposed',
  validated: 'validated',
  ratified: 'canonical',
  canonical: 'canonical',
  deprecated: null,
};

/** PURE — project a completion stage onto the crystal status it corresponds to. */
export function mapCompletionStage(stage: CompletionStage): InvariantStatus | null {
  return COMPLETION_STAGE_TO_STATUS[stage];
}

/** Statuses that assert the invariant is evidenced, not merely asserted. */
export const EVIDENCED_STATUSES: readonly InvariantStatus[] = ['validated', 'canonical'];

// ---------------------------------------------------------------------------
// §7.7 / §7.8 — reproduction invariants with their development-derived record
// ---------------------------------------------------------------------------

/**
 * One reproduction invariant: the rule, how it came to be known, the defect
 * that proved it (§7.8), and the executable proof that enforces it (§7.9).
 *
 * `defect` and `canaries` are what make this a completion record rather than
 * documentation. An invariant with neither is a slogan.
 */
export interface ReproductionInvariant {
  /** Stable id within the artifact, e.g. `MS-4`. Unique per artifact. */
  id: string;
  /** The rule, stated as something that must remain true. */
  statement: string;
  /** §8 vocabulary. `CAN-CCR-2` refuses an evidenced status without one. */
  provenance: InvariantProvenance;
  /** §7.8 — the defect that proved it, in enough detail to recognise a repeat. */
  defect: string;
  /**
   * §7.9 — repo-relative paths of the executable proofs enforcing this
   * invariant. `CAN-CCR-3` requires at least one for a `canonical` invariant;
   * `CAN-CCR-5` requires every path to resolve on disk.
   */
  canaries: string[];
  /** The SOURCE lifecycle value — the seed crystal's vocabulary, never rewritten. */
  status: InvariantStatus;
  /**
   * CCR-001's own ladder, carried ALONGSIDE `status` (map, don't unify —
   * operator ruling 2026-07-27). Optional: an artifact may record only the
   * source value. When present it MUST project onto `status` via
   * `mapCompletionStage`, which the validator enforces.
   */
  completionStage?: CompletionStage;
}

// ---------------------------------------------------------------------------
// §7.6 — capability boundary
// ---------------------------------------------------------------------------

/**
 * What the capability owns and — the half that code cannot record — what it
 * deliberately does NOT own. Six of the Companion's nine defects were two
 * things owning one thing; `doesNotOwn` is the field that would have named
 * the rule being broken.
 */
export interface CapabilityBoundary {
  owns: string[];
  doesNotOwn: string[];
  dependencies: string[];
  /** Authorities outside this capability that constrain it (spine, DVN, SDKs). */
  externalAuthorities: string[];
  /**
   * §7.6a / CB-3 (CFS-053) — what the capability EMITS when it acts.
   *
   * `null` means the document declared no Emits section at all: **forgotten**,
   * which is a validation error. `[]` means **none, deliberately**, and is only
   * valid alongside an `emissionRationale`. A populated list means **these**.
   * Distinguishing those three is the entire purpose of the field, so the
   * absent case must stay representable and must stay invalid.
   */
  emits: CapabilityEmission[] | null;
  /**
   * Required whenever `emits` is empty: why this capability legitimately emits
   * nothing. An empty list with no rationale is **unknown**, the state the
   * field exists to eliminate. Null when `emits` is non-empty or absent.
   */
  emissionRationale: string | null;
}

// ---------------------------------------------------------------------------
// §7.6a — the emission vocabulary
// ---------------------------------------------------------------------------

/**
 * The kinds of thing a capability on this platform emits. The operator's ruling
 * named three (`receipt` / `durable-record` / `artifact`); those three map onto
 * real, already-existing platform vocabulary rather than being new strings:
 *
 *   receipt         → `createActivityReceipt` + `ActivityActionType`
 *                     (`services/receipts/activityReceiptService.ts`)
 *   durable-record  → a persisted row — a Supabase table, or another store the
 *                     capability names explicitly
 *   artifact        → an `artifact_records` / StudioArtifact-class output
 *
 * `log` is the fourth, added because omitting it would force a real emission
 * class to be misclassified: the invariant engine's observe-mode floor is a
 * structured server log explicitly modelled on `[DVN ESCALATION]`
 * (`services/invariants/engine.ts`), and CLAUDE.md's DVN escalation contract
 * makes that log step one of a constitutional procedure. It is observable, it
 * is relied upon, and it is neither a receipt, a row, nor an artifact.
 *
 * ORDER IS NOT SEMANTIC — a set of kinds, not a ladder.
 */
export const EMISSION_KINDS = ['receipt', 'durable-record', 'artifact', 'log'] as const;

export type EmissionKind = (typeof EMISSION_KINDS)[number];

/**
 * One thing the capability emits, and the act that emits it.
 *
 * `ref` is the kind's identifier in its own vocabulary — the `ActivityActionType`
 * for a receipt, the table or store for a durable record, the format for an
 * artifact, the prefix for a log. Held as one field rather than as three
 * kind-specific keys so the shape stays uniform for tooling; the kind says how
 * to read it.
 *
 * `trigger` is what makes this a completion record rather than a wish list: it
 * names the invocation that actually writes the emission, so a reader can check
 * the claim against the code. `CAN-CCR-9` resolves `receipt` refs against the
 * real action-type union — the check that would have caught IDE-6.
 */
export interface CapabilityEmission {
  kind: EmissionKind;
  ref: string;
  trigger: string;
}

// ---------------------------------------------------------------------------
// §7.14 — Commons publication record
// ---------------------------------------------------------------------------

/**
 * The four native proof classes of the metaProof Commons (Horizen audit
 * Amendment D §D.1, operator-ratified 2026-07-27). Restated as a type, not
 * re-decided: this artifact classifies itself, it does not define the classes.
 */
export const COMMONS_PROOF_CLASSES = [
  'scientific',
  'operational',
  'commercial',
  'constitutional',
] as const;

export type CommonsProofClass = (typeof COMMONS_PROOF_CLASSES)[number];

/**
 * §7.14 / CCR-INV-10 — publication follows constitutional acceptance, and is
 * subject to Amendment E §E.3 Principle 5 (*only governed proof enters*):
 * a submission without evidence references, a claim scope and an evidence
 * posture is REFUSED, never accepted-then-hidden.
 *
 * `published: false` with `approvalRecordRef: null` is the honest default for
 * an artifact that has not been submitted — the Commons resource model
 * (`MetaCommonsResource`) is not built yet, so nothing here may claim it has.
 */
export interface CommonsPublicationRecord {
  proofClass: CommonsProofClass;
  /** What is being claimed, and over what — never "this is true generally". */
  claimScope: string;
  /** References supporting the claim. Principle 5: a claim with none is refused. */
  evidenceRefs: string[];
  /** Amendment E §E.3.4 — no commons record without one. Null until approved. */
  approvalRecordRef: string | null;
  published: boolean;
  /**
   * `CAN-CCR-8` — publication preserves lineage. The source artifact and the
   * capability it belongs to must survive publication, so a published proof
   * can always be traced back to the record that produced it.
   */
  lineage: {
    capabilityId: string;
    artifactPath: string;
    sourceReferences: string[];
  };
}

// ---------------------------------------------------------------------------
// §7.1 — identity
// ---------------------------------------------------------------------------

export interface CapabilityIdentity {
  /** Same key as `RegisterCapabilityInput.capabilityId` (CFS-032). */
  capabilityId: string;
  displayLabel: string;
  /** The artifact's own version — it changes as the capability changes. */
  artifactVersion: string;
  /** ISO date (YYYY-MM-DD) of this artifact revision. */
  date: string;
  /** Governing PRD / CFS / SPEC references. */
  governingDocuments: string[];
  /** Repo-relative path of the markdown twin this shape was derived from. */
  artifactPath: string;
}

// ---------------------------------------------------------------------------
// The artifact
// ---------------------------------------------------------------------------

export interface CapabilityCompletionArtifact {
  schemaVersion: CapabilityCompletionSchemaVersion;
  /** §7.1 */
  identity: CapabilityIdentity;
  /**
   * §7.2 — what the capability DOES, behaviourally. `CAN-CCR-4` refuses a
   * statement that is only a list of code locations: a reader who cannot
   * reproduce the behaviour from this sentence has not been told what the
   * capability is.
   */
  behaviouralCapabilityStatement: string;
  /** §7.3 — why it exists. */
  purpose: string;
  /** §7.4 — where it operates: surfaces first, source paths second. */
  location: { surfaces: string[]; sourcePaths: string[] };
  /** §7.5 — how it is invoked. */
  invocation: string[];
  /** §7.6 */
  boundary: CapabilityBoundary;
  /**
   * §7.7 / CCR-INV-8 — reproduction does not require identical implementation.
   * States which parts are free to differ and which are not.
   */
  implementationFreedom: string;
  /** §7.7 / §7.8 / §7.9 */
  reproductionInvariants: ReproductionInvariant[];
  /** §7.10 — the ordered procedure for reproducing the capability. */
  reproductionProcedure: string[];
  /** §7.11 — how it may safely change. */
  modificationRules: string[];
  /** §7.12 — hazards a reimplementer would otherwise rediscover expensively. */
  knownHazards: string[];
  /** §7.13 — what has actually been observed working. */
  operationalEvidence: string[];
  /** §7.14 */
  commons: CommonsPublicationRecord;
}

// ---------------------------------------------------------------------------
// Validation result (path-addressed)
// ---------------------------------------------------------------------------

export interface CompletionIssue {
  /** JSON-ish path of the fault, e.g. `reproductionInvariants[3].canaries`. */
  path: string;
  message: string;
  /** The canary this issue would trip, when it maps to one. */
  canary?: 'CAN-CCR-2' | 'CAN-CCR-3' | 'CAN-CCR-4' | 'CAN-CCR-5' | 'CAN-CCR-8' | 'CAN-CCR-9';
}

export interface CompletionValidationResult {
  valid: boolean;
  issues: CompletionIssue[];
}
