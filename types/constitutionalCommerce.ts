/**
 * Constitutional Commerce / Conditional Commerce — shared ontology (VELA-001 §2–8).
 *
 * Canonical sequence: Personhood → Authority → Mandate → Proposed Action →
 * Consequence Projection → Authorisation → Execution → Observed Consequence →
 * Validation → Receipt → Standing / Learning.
 *
 * Constitutional Commerce = Authority (who may act, for whom, under what mandate).
 * Conditional Commerce = Authorisation (may this exact action proceed now).
 * "Authority is constitutional. Authorisation is conditional."
 *
 * Composition with CFS-006a (see docs/vela/CONSEQUENCE-ONTOLOGY-001.md
 * "Resolution"): this module does NOT rename or replace `types/consequence.ts` /
 * `services/consequence/*`. `ConsequenceProjection.public` is populated by
 * CFS-006a's existing `forecastConsequences()` (public/invariant-graph
 * projection); `ConsequenceProjection.confidential` is populated by a
 * confidential projection provider (first implementation: Vela). Every new
 * Vela/Ian/MoneyPenny commerce and consequence-aware runtime code path uses
 * THIS module's types, per VELA-001 §8 — existing CFS-006a code is untouched.
 *
 * T0 discipline: no personaId, authProfileId or rootDid on any type here —
 * only opaque refs (see types/access.ts identifier-tier table). Confidential
 * values (private balances, exposure, limits) are never represented here as
 * plaintext fields — only as refs/commitments to evidence held elsewhere.
 */

import type { ConsequenceForecast, ConsequenceNode } from './consequence';

// ── Plane 1 — Authority ─────────────────────────────────────────────────

/**
 * Constitutional Commerce: who may act, for whom, within what constitutional
 * envelope. Derives from personhood + Passport + control + standing +
 * sponsorship + bounded delegation + mandate.
 *
 * Invariant: Control ∩ Authority ∩ Mandate = Consequential Authority.
 */
export interface ConstitutionalAuthority {
  principalRef: string;
  actorRef: string;
  authoritySource: string;
  passportRef?: string;
  delegationRef?: string;
  standingRef?: string;
  mandateRef: string;
  state: 'NONE' | 'PENDING' | 'BOUNDED' | 'ACTIVE';
}

// ── Plane 2 — Projection ─────────────────────────────────────────────────

export interface ProposedAction {
  actionRef: string;
  actorRef: string;
  mandateRef: string;
  actionType: string;
  consequenceDomain: string;
}

/**
 * A single prospective outcome an action is expected to cause. Distinct from
 * an InvariantFinding (a specific invariant-graph node reached from the
 * action's knowledge) — a ProjectedConsequence is a plain-language expected
 * effect, invariant-graph-derived or otherwise.
 */
export interface ProjectedConsequence {
  description: string;
  domain: string;
  polarity: 'positive' | 'negative' | 'neutral';
  confidence?: number;
}

/**
 * An invariant-graph node reached while forecasting a proposed action's
 * consequences. Deliberately the same shape as CFS-006a's `ConsequenceNode`
 * (`types/consequence.ts`) — this IS that type, not a re-derivation of it,
 * per the composition decision in docs/vela/CONSEQUENCE-ONTOLOGY-001.md.
 */
export type InvariantFinding = ConsequenceNode;

/** Reuses the canonical risk shape (services/registry/phase2/risk) rather than a second risk vocabulary. */
export interface RiskProjection {
  overallScore: number;
  dimensions: Record<string, number>;
  riskFlags: string[];
}

/** Reuses the canonical value/opportunity shape (services/registry/phase2/value) rather than a second one. */
export interface OpportunityProjection {
  workPotentialQc?: number;
  timeSavedMinutesPerUse?: number;
}

/**
 * The three-valued disposition every projection component and the composed
 * projection share. Identical vocabulary to a confidential provider's
 * `ConfidentialProjectionDisposition` on purpose — one word means one thing
 * across the whole projection plane.
 *
 * UNACCEPTABLE = a projection WAS established, and the projected consequence
 * is not acceptable. UNRESOLVED = a projection could not be established.
 * Infrastructure failure, fee failure, missing evidence and unverifiable
 * attestation are all UNRESOLVED — never UNACCEPTABLE.
 */
export type ProjectionDisposition = 'ACCEPTABLE' | 'UNACCEPTABLE' | 'UNRESOLVED';

/**
 * Whether every required component reached a definite (ACCEPTABLE or
 * UNACCEPTABLE) disposition. Independent of `disposition` on purpose
 * (operator ruling, 2026-08-22): precedence — UNACCEPTABLE > UNRESOLVED >
 * ACCEPTABLE — decides the final disposition ONLY. It must not also decide
 * whether the projection was epistemically complete, or a known refusal
 * (UNACCEPTABLE, precedence-selected) would silently look identical to a
 * fully-resolved one even when a required component never resolved.
 * `unresolvedComponents` names which ones, so a genuine refusal is never
 * hidden behind incomplete evidence.
 */
export type ProjectionCompleteness = 'COMPLETE' | 'PARTIAL';

/**
 * Whether the confidential component is constitutionally required for this
 * action. Explicit rather than inferred from presence: "we didn't get
 * confidential evidence" and "this action never needed any" are different
 * facts, and conflating them is exactly how missing evidence would silently
 * read as ACCEPTABLE.
 */
export type ConfidentialRequirement = 'REQUIRED' | 'NOT_REQUIRED';

/**
 * Governs whether the confidential component's disposition may stand without
 * a verified hardware attestation chain (operator ruling, 2026-08-22).
 * Attestation is evidence QUALITY, never projected consequence — this policy
 * gates whether a projection can be ESTABLISHED at all from unattested
 * evidence; it never converts one disposition into another (an unattested
 * ACCEPTABLE never becomes UNACCEPTABLE, and vice versa — only ACCEPTABLE or
 * UNACCEPTABLE may be downgraded to UNRESOLVED, never re-signed as the other).
 *
 * `UNSPECIFIED` FAILS CLOSED: it is treated exactly as `REQUIRED`, never as
 * `NOT_REQUIRED`. A caller that cares nothing about attestation (e.g. the
 * local Vela deployment, which runs `NoAttestationTeeAuthenticator` with zero
 * attestation by construction) must say so explicitly with `NOT_REQUIRED` —
 * omission is never read as permission.
 */
export type AttestationRequirement = 'NOT_REQUIRED' | 'REQUIRED' | 'UNSPECIFIED';

/**
 * The public half — CFS-006a's invariant-graph forecast. Carries the full
 * forecast so its findings stay independently inspectable; the composed
 * disposition never replaces it.
 */
export interface PublicProjectionComponent {
  source: 'consequence_operating_model';
  disposition: ProjectionDisposition;
  /** Provenance handle for the forecast that produced this component. */
  forecastRef: string;
  /** CFS-006a's own output, referenced not flattened. */
  forecast: ConsequenceForecast;
  reason: string;
}

/**
 * The confidential half — evidence contributed by a confidential projection
 * provider. Every provenance field is separate: which provider, which request,
 * which verdict, which evidence commitment, and the two independent
 * attestation booleans. Never collapsed into a score.
 */
export interface ConfidentialProjectionComponent {
  requirement: ConfidentialRequirement;
  /** null when NOT_REQUIRED, or when REQUIRED evidence never arrived. */
  disposition: ProjectionDisposition | null;
  provider: string | null;
  requestRef: string | null;
  /** Commitment over the confidential result — receipt-safe, never the result. */
  evidenceRef: string | null;
  /** Commitment tying the evidence to the exact ciphertext submitted. */
  payloadCommitment: string | null;
  /** The result was signed by the identity the chain trusts. */
  protocolExecutionVerified: boolean | null;
  /** A real hardware attestation chain was verified. NEVER inferred from the above. */
  teeAttestationVerified: boolean | null;
  attestationMode: string | null;
  reason: string;
}

/**
 * Consequence Projection: if this proposed action is permitted, what is
 * expected to happen. Prospective — never to be confused with
 * ObservedConsequence (retrospective).
 *
 * This is the COMPOSITION ENVELOPE. Neither CFS-006a nor a confidential
 * provider owns the final constitutional projection alone:
 *
 *   CFS-006a forecastConsequences()  → `public`       (invariant-graph projection)
 *   ConfidentialProjectionProvider   → `confidential` (confidential evidence)
 *   this envelope                    → `disposition`  (the composition)
 *
 * Composed by `services/constitutionalCommerce/unifiedConsequenceProjection.ts`,
 * which is deliberately owned by neither side.
 */
export interface ConsequenceProjection {
  projectionRef: string;
  /**
   * Correlates this projection to the exact decision context it was produced
   * from — the same context handle the Ian experiment uses, so a
   * projected-vs-observed delta can later be attributed to a specific context
   * rather than guessed at. Survives composition unchanged.
   */
  projectionContextRef: string;
  actionRef: string;
  authorityRef: string;
  mandateRef: string;
  /** Descriptive aggregates. Never the basis of the disposition. */
  projectedConsequences: ProjectedConsequence[];
  invariantFindings: InvariantFinding[];
  riskProjection?: RiskProjection;
  opportunityProjection?: OpportunityProjection;
  public: PublicProjectionComponent;
  confidential: ConfidentialProjectionComponent;
  /** Precedence-selected: UNACCEPTABLE > UNRESOLVED > ACCEPTABLE. Decides the final disposition ONLY — see `completeness`. */
  disposition: ProjectionDisposition;
  /**
   * COMPLETE only when every required component reached a definite
   * (ACCEPTABLE or UNACCEPTABLE) disposition. PARTIAL whenever any required
   * component is UNRESOLVED — including when `disposition` is UNACCEPTABLE
   * because a DIFFERENT component established a definite refusal. A known
   * refusal must never be hidden behind unresolved evidence: read
   * `disposition` for what to do, `completeness` + `unresolvedComponents` for
   * how much of the picture is actually in.
   */
  completeness: ProjectionCompleteness;
  /** Labels of every required component whose own disposition was UNRESOLVED, regardless of the final composed disposition. */
  unresolvedComponents: string[];
  /** Why the composition produced this disposition, naming the deciding component. */
  compositionRationale: string;
}

// ── Plane 3 — Authorisation ──────────────────────────────────────────────

/**
 * Conditional Commerce: given the established authority, mandate and
 * projected consequence, may this exact proposed action proceed now.
 *
 * Invariant: Consequential Authority ∩ Acceptable Consequence Projection =
 * Action Authorised.
 *
 * `status` extends the PRD §8 suggested type with `'UNRESOLVED'`: PRD §20
 * requires the authorisation service to "emit exactly one: AUTHORISED,
 * REFUSED, UNRESOLVED" and PRD §31 requires "UNRESOLVED projection produces
 * [a fail-closed outcome]" — an explicit, auditable UNRESOLVED authorisation
 * record is what "fails closed" means; the absence of any record would not
 * be distinguishable from "never evaluated."
 */
export interface ActionAuthorisation {
  authorisationRef: string;
  authorityRef: string;
  mandateRef: string;
  projectionRef: string;
  actionRef: string;
  status: 'AUTHORISED' | 'REFUSED' | 'UNRESOLVED' | 'EXPIRED' | 'REVOKED';
  expiresAt?: string;
  receiptRef?: string;
}

// ── Plane 4 — Execution ──────────────────────────────────────────────────

export interface CommerceExecution {
  executionRef: string;
  authorisationRef: string;
  actionRef: string;
  signerRef: string;
  network?: string;
  transactionRef?: string;
}

// ── Plane 5 — Consequence ────────────────────────────────────────────────

/**
 * Observed Consequence: what actually happened. Retrospective — never to be
 * confused with, or allowed to overwrite, ConsequenceProjection. Their delta
 * is a first-class learning signal (PRD §23), shared substrate for the Ian
 * Experiment (PRD §24) — not itself implemented here.
 */
export interface ObservedConsequence {
  consequenceRef: string;
  executionRef: string;
  projectionRef: string;
  observedState: unknown;
  validationState: 'MATCHED_PROJECTION' | 'DIVERGED_FROM_PROJECTION' | 'UNRESOLVED';
  receiptRefs: string[];
}
