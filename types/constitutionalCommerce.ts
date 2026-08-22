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
 * Consequence Projection: if this proposed action is permitted, what is
 * expected to happen. Prospective — never to be confused with
 * ObservedConsequence (retrospective).
 *
 * `public` is populated by CFS-006a's `forecastConsequences()` — the
 * invariant-graph-based projection every action already gets. `confidential`
 * is populated by a ConfidentialProjectionProvider (Vela first) ONLY when the
 * action's consequenceDomain requires confidential evidence. A projection
 * with no confidential requirement simply has `confidential: undefined` —
 * that is a complete, valid projection, not a partial one.
 */
export interface ConsequenceProjection {
  projectionRef: string;
  actionRef: string;
  authorityRef: string;
  mandateRef: string;
  projectedConsequences: ProjectedConsequence[];
  invariantFindings: InvariantFinding[];
  riskProjection?: RiskProjection;
  opportunityProjection?: OpportunityProjection;
  /** The public/invariant-graph half — CFS-006a's own forecast, referenced not duplicated. */
  public?: {
    source: 'consequence_operating_model';
    forecast: ConsequenceForecast;
  };
  /** The confidential half. `provider` names the mechanism so accountability survives confidentiality. */
  confidential?: {
    provider: string;
    confidentialEvidenceRefs: string[];
  };
  disposition: 'ACCEPTABLE' | 'UNACCEPTABLE' | 'UNRESOLVED';
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
  validationState: 'MATCHED_PROJECTION' | 'DIVERGED' | 'UNRESOLVED';
  receiptRefs: string[];
}
