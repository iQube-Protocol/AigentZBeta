/**
 * Invariant Development Envelope — the canonical type contract.
 * Homecoming III bootstrap, Phase 1.
 *
 * Contract-first, façade-not-fork (the `types/dcir.ts` precedent): this file is
 * the CONTRACT — types, pinned constants, and the minimum pure runtime needed
 * to make the contract ENFORCEABLE rather than advisory. The organs the
 * envelope composes over already exist in production and are named at each
 * `@organ` note; later phases enter by composing over those organs, never by
 * parallel implementation (inv.engineering.036/037).
 *
 * ── The four roles this contract sits inside ───────────────────────────────
 * IDE 2.0 discovers and retrieves; DevOn orchestrates; DCIR (Dynamic
 * Constitutional Interaction Runtime) observes and governs; Crystal retains
 * memory. Canonical definitions: `docs/platform-ontology.md`. DCIR is NOT
 * "Development Constitutional Invariant Runtime" — that expansion is recorded
 * as incorrect (RES-2026-08-15-CANONICAL-TERM-RESOLUTION-001).
 *
 * ── Constitutional cautions baked into this contract ───────────────────────
 *
 *  1. **Epistemic provenance is inseparable from the statement.** Every
 *     retrieved invariant carries WHERE it came from and WHICH lifecycle
 *     ladder it sits on. This is enforced by the type system, not by
 *     convention — see §4 and the `MarkedInvariantBlock` brand in §8.
 *
 *  2. **Two lifecycle ladders are MAPPED, never unified.** The invariant
 *     substrate and the resolution-record registry grade different things.
 *     `InvariantLifecycleRef` is a discriminated union that keeps each status
 *     attached to its own registry (`map, don't unify` — the operator's
 *     2026-07-27 ruling, already canaried in tests/capability-completion.test.ts).
 *
 *  3. **Bearing is an axis, not a class.** positive/negative/dual is
 *     ORTHOGONAL to constitutional/structural/experiential. There is no
 *     "negative invariant" ontology (PRD §7).
 *
 *  4. **Unknown stays unknown.** Risk magnitudes are `number | 'unknown'`.
 *     A default of 0 would read as "assessed and found negligible", which is
 *     a different claim from "not assessed" (PRD §12).
 *
 *  5. **The envelope is ADDITIVE to the DevOn session.** It attaches to
 *     `DevLoopState` as one optional field. It is never a second source of
 *     truth for the development session (PRD §5, CANARY-06).
 *
 *  6. **Nothing here canonizes.** No type in this file can express a
 *     promotion. Learning emits into the existing resolution-record registry,
 *     where `AGENT_MAX_STAGE = 'validated'` already binds (PRD §20).
 */

import type { CompletionStage } from './capabilityCompletion';
import type { InvariantStatus } from './invariants';

// ---------------------------------------------------------------------------
// §0 Schema version
// ---------------------------------------------------------------------------

/** Repo convention: `<kebab-domain-slug>/v<major>.<minor>`. */
export const INVARIANT_ENVELOPE_SCHEMA_VERSION = 'invariant-development-envelope/v1.0' as const;

// ---------------------------------------------------------------------------
// §1 Bearing — an AXIS, independent of invariant class
// ---------------------------------------------------------------------------

/**
 * How an invariant bears on an intent.
 *
 *  - `positive` — a causal condition required for the intended consequence.
 *    Discovered by asking what must remain true for the intent to succeed.
 *    Primarily associated with collapsing Time to Value.
 *
 *  - `negative` — a causal condition required to prevent, detect, contain or
 *    reverse a material adverse consequence. Primarily associated with
 *    Risk of Repair.
 *
 *  - `dual` — substantially the same causal condition INDEPENDENTLY recovered
 *    from both searches. Dual recovery is EVIDENCE, never a promotion: see
 *    `BearingRecovery` below, which records how each side was found so the
 *    independence claim stays auditable.
 *
 * This union is deliberately NOT a subtype of any class vocabulary. An
 * invariant is (constitutional | structural | experiential) AND
 * (positive | negative | dual). Collapsing the two axes would recreate the
 * "negative invariants are prohibitions" error PRD §9 warns against.
 */
export const INVARIANT_BEARINGS = ['positive', 'negative', 'dual'] as const;
export type InvariantBearing = (typeof INVARIANT_BEARINGS)[number];

/**
 * How a bearing was arrived at — the audit trail behind a `dual` claim.
 *
 * `dual` asserts INDEPENDENT recovery. Without recording each side's route,
 * "we ran one discovery pass and labelled the output twice" is
 * indistinguishable from genuine convergence — which is precisely the failure
 * the operator's Phase 1 acceptance refinement guards against.
 */
export interface BearingRecovery {
  bearing: Exclude<InvariantBearing, 'dual'>;
  /** Which pass surfaced it, and from what starting point. */
  route: 'intent-driven' | 'risk-driven';
  /**
   * The domain the search was operating in when this surfaced. For a
   * risk-driven recovery this is frequently NOT the intent's own domain —
   * that is the point of the negative pass (PRD §9).
   */
  searchDomain: string;
  /** The risk vector that motivated a risk-driven recovery, where one did. */
  riskVectorRef: RiskVectorRef | null;
  /**
   * The repair path the risk vector implied — the middle link of the causal
   * chain below. Null on an intent-driven recovery, which has no repair to
   * reason from.
   */
  repairPath: string | null;
  /** How the search widened past the intent's own domain, where it did. */
  scopeExpansion: ScopeExpansion | null;
}

/**
 * One widening of the search, recorded so the reason survives the result.
 *
 * THE CAUSAL CHAIN THIS COMPLETES (operator ruling, 2026-08-15):
 *
 *   intent / risk vector  →  repair path  →  scope expansion  →  candidate
 *
 * Every link is retained on the recovery. Without it, a negative-bearing
 * candidate arrives as a bare statement from an unrelated domain and the only
 * available reading is "the model wandered" — which is indistinguishable from
 * a genuinely risk-driven discovery, and will eventually be pruned as noise.
 * The chain is what makes an out-of-domain finding auditable rather than
 * merely surprising.
 *
 * `motivatedByRiskVectorId` is a RISK VECTOR ID, never an invariant ref: risk
 * vectors guide the search and are not themselves invariants.
 */
export interface ScopeExpansion {
  /** The domain the search began in — normally the intent's own. */
  fromDomain: string;
  /** The domain it widened to. */
  toDomain: string;
  fromScope: InvariantScope;
  toScope: InvariantScope;
  /** The `RiskVectorRef.id` that motivated the widening. */
  motivatedByRiskVectorId: string;
}

// ---------------------------------------------------------------------------
// §2 Scope — broad to specific, ranked by causal materiality
// ---------------------------------------------------------------------------

/**
 * The retrieval ladder (PRD §6). Order is broad → specific and is
 * constitutional data; the canary pins it.
 *
 * Retrieval SEARCHES in this order but RANKS by causal materiality, not by
 * taxonomy position: a repository-scoped invariant that determines the
 * outcome outranks a cross-domain one that merely touches it. An invariant
 * may hold at several scopes, so this is a property of the RETRIEVAL, not an
 * exclusive classification of the invariant.
 */
export const INVARIANT_SCOPES = [
  'constitutional',
  'cross-domain',
  'software-development',
  'agentic-development',
  'project-runtime',
  'repository',
  'intent',
] as const;
export type InvariantScope = (typeof INVARIANT_SCOPES)[number];

// ---------------------------------------------------------------------------
// §3 Provenance — WHERE a statement came from
// ---------------------------------------------------------------------------

/**
 * The source that supplied an invariant to this envelope.
 *
 * Kept separate from lifecycle (§4) because they answer different questions
 * and can disagree in every combination: the substrate holds `proposed`
 * hypotheses as well as `canonical` rules, and the resolution-record registry
 * holds `ratified` invariants as well as `observed` ones. Source does not
 * imply standing, and standing does not imply source.
 *
 * @organ `crystal-substrate`        → services/invariants/store.ts, grounding.ts
 * @organ `constitutional-substrate` → services/invariants/resolution.ts (universal pass)
 * @organ `projection-devon`         → PROJECTION_TARGETS 'devon' (types/resolutionRecords.ts)
 * @organ `session-memory`           → hooks/useSessionInvariants.ts
 */
export const INVARIANT_PROVENANCES = [
  /** The L1 universal pass — the constitutional ground every surface stands on. */
  'constitutional-substrate',
  /** The invariant substrate proper (the `invariants` table). */
  'crystal-substrate',
  /**
   * A candidate invariant declaring a `devon` projection target. Operator
   * ruling 2026-08-15: such material MAY inform live discovery but MUST NOT be
   * represented as validated Crystal memory. Its lifecycle travels with it and
   * `mayBeCitedAsEstablished()` is the gate.
   */
  'projection-devon',
  /** Discovered during THIS run. In no registry. Has earned nothing yet. */
  'live-discovery',
  /** Carried from earlier turns of the same session. */
  'session-memory',
] as const;
export type InvariantProvenance = (typeof INVARIANT_PROVENANCES)[number];

// ---------------------------------------------------------------------------
// §4 Lifecycle — WHICH ladder, and where on it
// ---------------------------------------------------------------------------

/**
 * A status kept attached to the registry that issued it.
 *
 * THE POINT OF THE DISCRIMINANT. Both ladders contain the word `validated`,
 * and it does not mean the same thing in each: substrate `validated` is a
 * confidence-class judgement about an invariant record, while
 * resolution-record `validated` means ≥2 recorded occurrences or demonstrated
 * regression prevention. Flattening them to a shared string would silently
 * equate two different earnings — so the registry travels with the status and
 * every consumer must decide what it is looking at.
 *
 * `registry: 'none'` is not a gap to be filled in later. It is the honest
 * state of something discovered this run: real, possibly important, and
 * holding no position on any ladder.
 */
export type InvariantLifecycleRef =
  | { registry: 'invariant-substrate'; status: InvariantStatus }
  | { registry: 'resolution-records'; status: CompletionStage }
  | { registry: 'none'; status: 'unrecorded' };

/**
 * The statuses that may be presented to a reasoning context as ESTABLISHED.
 *
 * Everything else is offered as material to reason WITH, never as ground to
 * reason FROM. This is the single canonical reader for that question
 * (CI-2026-08-03-CANONICAL-READER-OWNERSHIP-001) — a consumer that
 * re-implements the check becomes a second, drifting answer.
 */
export function mayBeCitedAsEstablished(lifecycle: InvariantLifecycleRef): boolean {
  switch (lifecycle.registry) {
    case 'invariant-substrate':
      return lifecycle.status === 'canonical';
    case 'resolution-records':
      return lifecycle.status === 'ratified' || lifecycle.status === 'canonical';
    case 'none':
      return false;
  }
}

/**
 * The short marker rendered beside a statement so its standing survives into
 * the prompt. Total by construction over both ladders: a new status cannot be
 * added to either registry without deciding how it presents here.
 */
export function epistemicMarker(lifecycle: InvariantLifecycleRef): string {
  if (lifecycle.registry === 'none') return '[unrecorded — discovered this run]';
  if (lifecycle.registry === 'invariant-substrate') {
    switch (lifecycle.status) {
      case 'canonical':
        return '[canonical]';
      case 'validated':
        return '[validated — not ratified]';
      case 'proposed':
        return '[proposed — hypothesis, not established]';
      case 'draft':
        return '[draft]';
      case 'rejected':
        return '[rejected]';
      case 'deprecated':
        return '[deprecated]';
      case 'superseded':
        return '[superseded]';
    }
  }
  switch (lifecycle.status) {
    case 'canonical':
      return '[canonical]';
    case 'ratified':
      return '[ratified]';
    case 'validated':
      return '[validated — candidate, not ratified]';
    case 'candidate':
      return '[candidate — not yet validated]';
    case 'observed':
      return '[observed — single occurrence]';
    case 'deprecated':
      return '[deprecated]';
  }
}

// ---------------------------------------------------------------------------
// §5 The retrieved invariant
// ---------------------------------------------------------------------------

/**
 * One invariant as it exists INSIDE an envelope.
 *
 * `provenance` and `lifecycle` are REQUIRED and non-nullable. That is the
 * whole design: the envelope mixes constitutional invariants, validated
 * substrate members, `devon`-projected candidates and live discoveries in one
 * collection, and the mixing is only safe if no member can exist without its
 * epistemic position attached.
 *
 * Note what this type deliberately is NOT: it is not `{ id, statement }`. The
 * existing prompt path (`CitableInvariant` in services/invariants/resolution.ts)
 * projects a full `InvariantSliceItem` down to seedId + statement, dropping
 * `status`, `standing` and `confidence` before the text reaches the model. That
 * is tolerable while the only source is the substrate; it stops being
 * tolerable the moment projected candidates join the same list. §8 exists to
 * make that flattening a compile error on this path.
 */
export interface EnvelopeInvariant {
  /** Stable reference: substrate id, seedId, or candidateId. Never prose. */
  ref: string;
  statement: string;
  provenance: InvariantProvenance;
  lifecycle: InvariantLifecycleRef;
  /** The scope at which retrieval surfaced it. Not an exclusive property. */
  scope: InvariantScope;
  /** Null until a discovery pass assigns one — absence of a bearing is honest. */
  bearing: InvariantBearing | null;
  /**
   * How each bearing was recovered. A `dual` bearing REQUIRES two entries with
   * differing `route` values; the canary enforces it rather than trusting the
   * label.
   */
  recoveries: BearingRecovery[];
  /**
   * Causal materiality to THIS intent, [0,1] — the ranking axis. `'unknown'`
   * where nothing supports an estimate; never defaulted to 0, which would read
   * as "assessed as immaterial".
   */
  materiality: number | 'unknown';
}

// ---------------------------------------------------------------------------
// §6 Risk — the Intent Risk Field and its proofs
// ---------------------------------------------------------------------------

/**
 * An extensible reference to a risk vector.
 *
 * Deliberately a `{ model, id }` pair rather than a bare enum. The bootstrap
 * risk primitive is the EXISTING heuristic in services/consequence/stages.ts
 * (`assessRiskHeuristic`, dimensions uncertainty × downstream_blast_radius ×
 * reversibility).
 *
 * HONEST SCOPE NOTE (operator ruling, 2026-08-15). That heuristic is NOT a
 * Lehigh-derived risk model and must not be described as one. It is
 * self-labelled `v1 heuristics; wire to phase2 when it lands`, and the module
 * it defers to (services/registry/phase2/risk.ts) is a stub that throws. The
 * audit found NO code linkage between the Lehigh capstone programme and any
 * risk model; the Lehigh references in this repo are research workspace and
 * cohort structure. `model` exists so a canonical risk/value/price model can
 * be introduced later as its own named model, alongside rather than by
 * silently redefining this one.
 */
export interface RiskVectorRef {
  /** The risk model that issued this vector. */
  model: 'bootstrap-heuristic-v1';
  /** Vector identifier within that model. */
  id: string;
  /** Human-readable label, for surfaces. */
  label: string;
}

/** Where a risk entered the field (PRD §11). */
export const RISK_ORIGINS = [
  /** Projected from the intent and its risk model. */
  'projected',
  /** Retrieved from prior evidenced risk in Crystal / the record registry. */
  'retrieved',
  /** Observed — a real prior failure relevant to the present context. */
  'observed',
] as const;
export type RiskOrigin = (typeof RISK_ORIGINS)[number];

/**
 * A magnitude that may legitimately be unassessed.
 *
 * `'unknown'` is not a failure state and must not be coerced. PRD §12: unknown
 * is preferable to false precision, because a fabricated 0.3 is indistinguishable
 * downstream from a measured one.
 */
export type RiskMagnitude = number | 'unknown';

/**
 * Evidence that an adverse consequence is materially relevant to THIS intent.
 *
 * A Proof of Risk is a claim about relevance, not a prediction of occurrence.
 * `status` is where it sits epistemically; it is receiptable, but nothing here
 * canonizes anything.
 */
export interface ProofOfRisk {
  id: string;
  intentRef: string;
  riskVectorRef: RiskVectorRef | null;
  origin: RiskOrigin;
  /** Envelope invariant refs this risk bears on. Never prose. */
  invariantRefs: string[];
  /** The condition under which the adverse consequence becomes reachable. */
  initiatingCondition: string;
  /** What goes wrong, stated as consequence rather than as a rule violation. */
  adverseConsequence: string;
  severity: RiskMagnitude;
  probability: RiskMagnitude;
  uncertainty: RiskMagnitude;
  /** How it would be repaired, where that is known. */
  repairPath: string | null;
  reversibility: 'reversible' | 'partially-reversible' | 'irreversible' | 'unknown';
  blastRadius: string | null;
  /** Real references only — commits, tests, receipts, records. Never invented. */
  evidenceRefs: string[];
  status: 'projected' | 'observed' | 'supported' | 'challenged' | 'falsified';
  createdAt: string;
}

/**
 * The risk field for an intent: projected ∪ retrieved ∪ observed.
 *
 * CONSTRUCTED BEFORE NEGATIVE-BEARING DISCOVERY (operator ruling, 2026-08-15).
 * Risk of Repair is a BEARING USED TO BROADEN DISCOVERY, not a report
 * assembled after it. The field then evolves as new risks are observed —
 * `revision` increments so a later reader can tell which version of the field
 * a discovery pass actually ran against.
 */
export interface IntentRiskField {
  intentRef: string;
  vectors: RiskVectorRef[];
  proofRefs: string[];
  /** Which origins actually contributed. An empty origin is stated, not hidden. */
  originsPresent: RiskOrigin[];
  /** Increments on each evolution. Discovery records the revision it used. */
  revision: number;
  constructedAt: string;
}

// ---------------------------------------------------------------------------
// §7 Consequence binding and falsification
// ---------------------------------------------------------------------------

/**
 * An invariant bound to a testable consequence (PRD §16).
 *
 * This is what turns consequence validation into causal testing rather than
 * assertion review: each material invariant states what must happen, what must
 * not, and what observation would prove it wrong.
 */
export interface ConsequenceBinding {
  invariantRef: string;
  /** What must be observable if the invariant holds. */
  expectedConsequence: string;
  /** What must never be observable. */
  prohibitedConsequence: string;
  /** Where the evidence would be read from. */
  requiredEvidence: string[];
}

/**
 * An observation that would falsify a claim.
 *
 * `constitutionalClaim` marks the CFS distinction (PRD §21): a constitutional
 * right is not an empirical hypothesis, but an IMPLEMENTATION CLAIM made under
 * it ("this delegation preserves the stated authority boundary") is
 * consequentially testable. Normative authority does not exempt implementation
 * claims from evidence.
 */
export interface Falsifier {
  invariantRef: string;
  /** The observation that would falsify it. */
  observation: string;
  /** How that observation would be made. */
  method: string;
  constitutionalClaim: boolean;
}

// ---------------------------------------------------------------------------
// §8 Prompt composition — where erasure is structurally prevented
// ---------------------------------------------------------------------------

declare const epistemicBrand: unique symbol;

/**
 * A prompt fragment whose invariant lines CARRY THEIR EPISTEMIC MARKERS.
 *
 * ── Why a branded type rather than a comment ───────────────────────────────
 *
 * The requirement (operator, 2026-08-15) is that downstream prompt composition
 * must find it IMPOSSIBLE to erase the distinction between a canonical
 * invariant, a validated one, a projected candidate and a live discovery. A
 * documented convention does not achieve that: `items.map(i => i.statement)
 * .join('\n')` is one line, typechecks, and silently produces a block in which
 * a `candidate` reads exactly like a `canonical`.
 *
 * So the envelope's prompt-facing field is not `string`. It is this brand,
 * which no string literal and no hand-rolled join can satisfy — the only way
 * to obtain one is `renderMarkedInvariantBlock()`, which takes
 * `EnvelopeInvariant[]` and cannot be called without the lifecycle data. The
 * erasure becomes a compile error rather than a review miss.
 *
 * This is the same discipline the identity spine applies to T0 identifiers:
 * make the unsafe shape unrepresentable rather than forbidden.
 */
export type MarkedInvariantBlock = string & { readonly [epistemicBrand]: true };

/**
 * The ONLY constructor of a `MarkedInvariantBlock`.
 *
 * Every line carries its marker. Ordering is the caller's (materiality-ranked);
 * this function never reorders, never filters, and never drops a member —
 * silently omitting an invariant would be a quieter version of the same
 * erasure.
 */
export function renderMarkedInvariantBlock(items: readonly EnvelopeInvariant[]): MarkedInvariantBlock {
  return items
    .map((i) => `- ${epistemicMarker(i.lifecycle)} ${i.statement} (${i.ref}, ${i.provenance})`)
    .join('\n') as MarkedInvariantBlock;
}

/**
 * The compressed set that actually reaches the implementation context (PRD §14).
 *
 * Holds `EnvelopeInvariant[]`, never `string[]`. `omittedRefs` is required and
 * not optional: compression that cannot say what it dropped is
 * indistinguishable from retrieval that found nothing, and "no silent caps" is
 * already the house rule for bounded work.
 */
export interface CompressedInvariantSet {
  items: EnvelopeInvariant[];
  /** Refs retrieved into the envelope but not carried into the prompt. */
  omittedRefs: string[];
  /** Which budget bounded this. @organ INVARIANT_BUDGET (services/invariants/resolution.ts) */
  budgetApplied: number;
  block: MarkedInvariantBlock;
}

// ---------------------------------------------------------------------------
// §9 The envelope
// ---------------------------------------------------------------------------

/**
 * The causal field governing one development intent.
 *
 * SESSION OWNERSHIP. This attaches to the existing DevOn session as ONE
 * optional field on `DevLoopState`. It is not a store, has no id of its own
 * beyond the intent it serves, and must never become a second place where the
 * development session's truth lives (PRD §5, CANARY-06).
 *
 * HORIZONTAL, NOT A STAGE. Constructed at `intent_capture` and progressively
 * enriched across the existing ten-stage lifecycle; learning emits at
 * `complete`. `STAGE_ORDER`, `nextStage()` and the remediation fork are not
 * modified (operator ruling D2, 2026-08-15). `updatedAt` moving while
 * `stageAtConstruction` stays fixed is the normal, expected shape.
 */
export interface InvariantDevelopmentEnvelope {
  schemaVersion: typeof INVARIANT_ENVELOPE_SCHEMA_VERSION;
  intentRef: string;
  /** The DevOn session this belongs to. @organ DevLoopState.sessionId */
  sessionRef: string;
  /** The stage at which the envelope was first constructed. */
  stageAtConstruction: string;
  /** Scopes retrieval actually searched — an empty search is stated, not hidden. */
  scopesSearched: InvariantScope[];
  /**
   * Everything retrieved or discovered, each carrying its own provenance and
   * lifecycle. ONE collection deliberately: separate arrays per source would
   * let a consumer read one and miss the others, and the epistemic position is
   * already on every member.
   */
  invariants: EnvelopeInvariant[];
  riskField: IntentRiskField | null;
  proofsOfRisk: ProofOfRisk[];
  expectedConsequences: ConsequenceBinding[];
  falsifiers: Falsifier[];
  /**
   * What remains materially unresolved. Populated by the residual-uncertainty
   * step (PRD §13.8) so live reasoning is spent here rather than on
   * rediscovering established knowledge.
   */
  unresolvedQuestions: string[];
  /** The compressed projection that reached the model, once composed. */
  compressed: CompressedInvariantSet | null;
  generatedAt: string;
  updatedAt: string;
}
