/**
 * Polity Passport status machines — two per-class state machines.
 *
 * PRD: codexes/packs/agentiq/updates/2026-06-10_polity-passport-bureau-prd-v1.md
 *   §11 (registry status model) as corrected by Addendum D (irrevocability):
 *   citizen passports are irrevocable personhood recognition with
 *   lifecycle/continuity states only (no 'revoked', no 'denied'); agent
 *   participant passports are revocable standing (+ 'delisted').
 *
 * Schema source of truth: polity-passport-bureau/schemas/
 *   polity-passport.common.schema.json — citizenPassportStatus /
 *   participantPassportStatus enums. The enums below MUST stay in sync;
 *   tests/passport-status-machine.test.ts asserts the invariants.
 *
 * Identity-surface note (operator clarification 2026-06-10): the Citizen
 * Passport is a KybeDID-level primitive — proof of personhood solely.
 * Reputation is managed at the RootDID / DiDQube level and NEVER drives a
 * citizen passport transition. Citizen reputation consequences act on the
 * separate privilege-standing object, not on these states. Participant
 * transitions MAY be reputation-triggered (standing is conditional).
 *
 * Pattern mirror: services/registry/lifecycle.ts — this module VALIDATES
 * and DESCRIBES transitions; it never executes them. Callers (application
 * routes, steward review handlers, renewal workers) invoke the state
 * machine, then perform side effects (DB write, DVN receipt, registry
 * projection refresh) themselves.
 *
 * Authority rule: this module never calls evaluateAccess, never calls
 * userOwnsAsset, never writes receipts. It describes.
 */

// ── Per-class status enums (Addendum D "Required Schema Change") ──────────

export type CitizenPassportStatus =
  | 'draft'
  | 'submitted'
  | 'pending_approval'
  | 'active'
  | 'renewal_due'
  | 'expired_non_renewal'
  | 'dormant'
  | 'inactive_presumed'
  | 'ceased_death_confirmed'
  | 'superseded_by_reissue';

export type ParticipantPassportStatus =
  | 'draft'
  | 'submitted'
  | 'pending_approval'
  | 'provisionally_issued'
  | 'approved'
  | 'restricted'
  | 'needs_more_information'
  | 'suspended'
  | 'revoked'
  | 'expired'
  | 'renewed'
  | 'delisted';

export const CITIZEN_PASSPORT_STATUSES: ReadonlyArray<CitizenPassportStatus> = [
  'draft',
  'submitted',
  'pending_approval',
  'active',
  'renewal_due',
  'expired_non_renewal',
  'dormant',
  'inactive_presumed',
  'ceased_death_confirmed',
  'superseded_by_reissue',
];

export const PARTICIPANT_PASSPORT_STATUSES: ReadonlyArray<ParticipantPassportStatus> = [
  'draft',
  'submitted',
  'pending_approval',
  'provisionally_issued',
  'approved',
  'restricted',
  'needs_more_information',
  'suspended',
  'revoked',
  'expired',
  'renewed',
  'delisted',
];

export function isCitizenStatus(value: string): value is CitizenPassportStatus {
  return (CITIZEN_PASSPORT_STATUSES as ReadonlyArray<string>).includes(value);
}

export function isParticipantStatus(value: string): value is ParticipantPassportStatus {
  return (PARTICIPANT_PASSPORT_STATUSES as ReadonlyArray<string>).includes(value);
}

// ── Transition actors (mirror status-transition schema actor_type) ─────────

export type TransitionActor =
  | 'applicant'
  | 'agent'
  | 'system'
  | 'steward'
  | 'committee'
  | 'admin';

/** DVN receipt action types this transition emits (caller anchors them). */
export type PassportReceiptAction =
  | 'passport_application_submitted'
  | 'passport_issued'
  | 'passport_status_changed'
  | 'passport_revoked'
  | 'passport_privilege_changed'
  | 'passport_infraction_recorded'
  | 'none';

export interface PassportTransitionRule<S extends string> {
  from: S;
  to: S;
  /** Actors allowed to initiate this transition. */
  initiators: ReadonlyArray<TransitionActor>;
  /** Receipt the CALLER must anchor via the DVN pipeline on success. */
  receipt: PassportReceiptAction;
  /**
   * Evidence the caller must hold before invoking. 'death_evidence' encodes
   * Addendum D: death is never declared solely from non-renewal — a
   * ceased_death_confirmed transition requires confirmed death evidence and
   * a human (steward/committee) initiator, never 'system'.
   *
   * STUB: upper thresholds and determination methods for death evidence are
   * deferred — for now the evidence type gates the transition, but the
   * threshold policy (e.g. duration of inactivity + corroborating signals
   * before a steward may initiate death proceedings) is not encoded here.
   */
  evidence:
    | 'none'
    | 'renewal_proof_of_control'
    | 'renewal_proof_of_aliveness'
    | 'continuity_proof'
    | 'death_evidence'
    | 'review_decision'
    | 'reissue_continuity_binding';
  reversibility: 'one_way' | 'two_way';
  /**
   * STUB: automation eligibility. When true, this transition may eventually
   * be triggered by an automated agent or scheduled job rather than requiring
   * a human initiator. For now all transitions with automatable = true still
   * require a human-in-the-loop; the flag marks where automation will slot in.
   * Participant standing transitions are the primary candidates.
   */
  automatable?: boolean;
}

// ── Citizen lifecycle graph (continuity semantics — never punitive) ───────
//
// draft → submitted → pending_approval → active
// active ↔ renewal_due (time-based; renewal restores active)
// renewal_due → expired_non_renewal → dormant → inactive_presumed
//   (dormancy ladder; every rung can return to active with continuity proof)
// {active, renewal_due, expired_non_renewal, dormant, inactive_presumed}
//   → ceased_death_confirmed (death evidence only — terminal)
// active → superseded_by_reissue (KybeDID-continuity reissue — terminal on
//   the old row; continuity moves to the successor passport)

const CITIZEN_RULES: ReadonlyArray<PassportTransitionRule<CitizenPassportStatus>> = [
  { from: 'draft', to: 'submitted', initiators: ['applicant'], receipt: 'passport_application_submitted', evidence: 'none', reversibility: 'one_way' },
  { from: 'submitted', to: 'pending_approval', initiators: ['system'], receipt: 'passport_status_changed', evidence: 'none', reversibility: 'one_way' },
  { from: 'pending_approval', to: 'active', initiators: ['system', 'steward'], receipt: 'passport_issued', evidence: 'review_decision', reversibility: 'one_way' },
  { from: 'active', to: 'renewal_due', initiators: ['system'], receipt: 'passport_status_changed', evidence: 'none', reversibility: 'two_way' },
  { from: 'renewal_due', to: 'active', initiators: ['applicant', 'system'], receipt: 'passport_status_changed', evidence: 'renewal_proof_of_aliveness', reversibility: 'two_way' },
  { from: 'renewal_due', to: 'expired_non_renewal', initiators: ['system'], receipt: 'passport_status_changed', evidence: 'none', reversibility: 'two_way' },
  { from: 'expired_non_renewal', to: 'active', initiators: ['applicant', 'steward'], receipt: 'passport_status_changed', evidence: 'continuity_proof', reversibility: 'two_way' },
  { from: 'expired_non_renewal', to: 'dormant', initiators: ['system'], receipt: 'passport_status_changed', evidence: 'none', reversibility: 'two_way' },
  { from: 'dormant', to: 'active', initiators: ['applicant', 'steward'], receipt: 'passport_status_changed', evidence: 'continuity_proof', reversibility: 'two_way' },
  { from: 'dormant', to: 'inactive_presumed', initiators: ['system'], receipt: 'passport_status_changed', evidence: 'none', reversibility: 'two_way' },
  { from: 'inactive_presumed', to: 'active', initiators: ['applicant', 'steward'], receipt: 'passport_status_changed', evidence: 'continuity_proof', reversibility: 'two_way' },
  { from: 'active', to: 'ceased_death_confirmed', initiators: ['steward', 'committee'], receipt: 'passport_status_changed', evidence: 'death_evidence', reversibility: 'one_way' },
  { from: 'renewal_due', to: 'ceased_death_confirmed', initiators: ['steward', 'committee'], receipt: 'passport_status_changed', evidence: 'death_evidence', reversibility: 'one_way' },
  { from: 'expired_non_renewal', to: 'ceased_death_confirmed', initiators: ['steward', 'committee'], receipt: 'passport_status_changed', evidence: 'death_evidence', reversibility: 'one_way' },
  { from: 'dormant', to: 'ceased_death_confirmed', initiators: ['steward', 'committee'], receipt: 'passport_status_changed', evidence: 'death_evidence', reversibility: 'one_way' },
  { from: 'inactive_presumed', to: 'ceased_death_confirmed', initiators: ['steward', 'committee'], receipt: 'passport_status_changed', evidence: 'death_evidence', reversibility: 'one_way' },
  { from: 'active', to: 'superseded_by_reissue', initiators: ['applicant', 'steward'], receipt: 'passport_status_changed', evidence: 'reissue_continuity_binding', reversibility: 'one_way' },
];

// ── Participant standing graph (conditional, revocable) ───────────────────
//
// draft → submitted → pending_approval → {provisionally_issued, approved,
//   restricted, needs_more_information}
// needs_more_information → pending_approval (info supplied)
// provisionally_issued → {approved, restricted, suspended, revoked, expired}
// approved ↔ restricted; approved → {suspended, revoked, expired, renewed}
// restricted → {approved, suspended, revoked, expired}
// suspended → {approved, restricted, revoked}
// expired → renewed; renewed → approved
// revoked → delisted (terminal after delist)
// Appeal-driven reinstatement is a review-decision concern (deferred per
// PRD §16); the graph deliberately has no revoked → approved edge in v0.1.
//
// STUB: automatable transitions are flagged for future agent/scheduled-job
// management. For now all transitions require human-in-the-loop; the
// automatable flag marks where agent-driven management will slot in.

const PARTICIPANT_RULES: ReadonlyArray<PassportTransitionRule<ParticipantPassportStatus>> = [
  { from: 'draft', to: 'submitted', initiators: ['agent', 'applicant'], receipt: 'passport_application_submitted', evidence: 'none', reversibility: 'one_way' },
  { from: 'submitted', to: 'pending_approval', initiators: ['system'], receipt: 'passport_status_changed', evidence: 'none', reversibility: 'one_way', automatable: true },
  { from: 'pending_approval', to: 'provisionally_issued', initiators: ['system', 'steward'], receipt: 'passport_issued', evidence: 'review_decision', reversibility: 'one_way', automatable: true },
  { from: 'pending_approval', to: 'approved', initiators: ['steward', 'committee'], receipt: 'passport_issued', evidence: 'review_decision', reversibility: 'one_way' },
  { from: 'pending_approval', to: 'restricted', initiators: ['steward', 'committee'], receipt: 'passport_issued', evidence: 'review_decision', reversibility: 'one_way' },
  { from: 'pending_approval', to: 'needs_more_information', initiators: ['system', 'steward'], receipt: 'passport_status_changed', evidence: 'review_decision', reversibility: 'two_way', automatable: true },
  { from: 'needs_more_information', to: 'pending_approval', initiators: ['agent', 'applicant'], receipt: 'passport_status_changed', evidence: 'none', reversibility: 'two_way' },
  { from: 'provisionally_issued', to: 'approved', initiators: ['steward', 'committee'], receipt: 'passport_status_changed', evidence: 'review_decision', reversibility: 'one_way' },
  { from: 'provisionally_issued', to: 'restricted', initiators: ['steward', 'committee'], receipt: 'passport_status_changed', evidence: 'review_decision', reversibility: 'one_way' },
  { from: 'provisionally_issued', to: 'suspended', initiators: ['steward', 'committee', 'system'], receipt: 'passport_status_changed', evidence: 'review_decision', reversibility: 'two_way', automatable: true },
  { from: 'provisionally_issued', to: 'revoked', initiators: ['steward', 'committee'], receipt: 'passport_revoked', evidence: 'review_decision', reversibility: 'one_way' },
  { from: 'provisionally_issued', to: 'expired', initiators: ['system'], receipt: 'passport_status_changed', evidence: 'none', reversibility: 'two_way', automatable: true },
  { from: 'approved', to: 'restricted', initiators: ['steward', 'committee', 'system'], receipt: 'passport_status_changed', evidence: 'review_decision', reversibility: 'two_way', automatable: true },
  { from: 'approved', to: 'suspended', initiators: ['steward', 'committee', 'system'], receipt: 'passport_status_changed', evidence: 'review_decision', reversibility: 'two_way', automatable: true },
  { from: 'approved', to: 'revoked', initiators: ['steward', 'committee'], receipt: 'passport_revoked', evidence: 'review_decision', reversibility: 'one_way' },
  { from: 'approved', to: 'expired', initiators: ['system'], receipt: 'passport_status_changed', evidence: 'none', reversibility: 'two_way', automatable: true },
  { from: 'approved', to: 'renewed', initiators: ['agent', 'applicant', 'system'], receipt: 'passport_status_changed', evidence: 'renewal_proof_of_control', reversibility: 'two_way', automatable: true },
  { from: 'restricted', to: 'approved', initiators: ['steward', 'committee'], receipt: 'passport_status_changed', evidence: 'review_decision', reversibility: 'two_way' },
  { from: 'restricted', to: 'suspended', initiators: ['steward', 'committee', 'system'], receipt: 'passport_status_changed', evidence: 'review_decision', reversibility: 'two_way', automatable: true },
  { from: 'restricted', to: 'revoked', initiators: ['steward', 'committee'], receipt: 'passport_revoked', evidence: 'review_decision', reversibility: 'one_way' },
  { from: 'restricted', to: 'expired', initiators: ['system'], receipt: 'passport_status_changed', evidence: 'none', reversibility: 'two_way', automatable: true },
  { from: 'suspended', to: 'approved', initiators: ['steward', 'committee'], receipt: 'passport_status_changed', evidence: 'review_decision', reversibility: 'two_way' },
  { from: 'suspended', to: 'restricted', initiators: ['steward', 'committee'], receipt: 'passport_status_changed', evidence: 'review_decision', reversibility: 'two_way' },
  { from: 'suspended', to: 'revoked', initiators: ['steward', 'committee'], receipt: 'passport_revoked', evidence: 'review_decision', reversibility: 'one_way' },
  { from: 'expired', to: 'renewed', initiators: ['agent', 'applicant', 'steward'], receipt: 'passport_status_changed', evidence: 'renewal_proof_of_control', reversibility: 'two_way', automatable: true },
  { from: 'renewed', to: 'approved', initiators: ['system', 'steward'], receipt: 'passport_status_changed', evidence: 'none', reversibility: 'one_way', automatable: true },
  { from: 'revoked', to: 'delisted', initiators: ['system', 'steward', 'admin'], receipt: 'passport_status_changed', evidence: 'none', reversibility: 'one_way', automatable: true },
];

// ── Shared validate/describe surface ──────────────────────────────────────

function buildGraph<S extends string>(
  rules: ReadonlyArray<PassportTransitionRule<S>>,
  states: ReadonlyArray<S>,
): Record<S, ReadonlyArray<S>> {
  const graph = Object.fromEntries(states.map((s) => [s, [] as S[]])) as Record<S, S[]>;
  for (const rule of rules) graph[rule.from].push(rule.to);
  return graph;
}

const CITIZEN_GRAPH = buildGraph(CITIZEN_RULES, CITIZEN_PASSPORT_STATUSES);
const PARTICIPANT_GRAPH = buildGraph(PARTICIPANT_RULES, PARTICIPANT_PASSPORT_STATUSES);

export type TransitionValidation =
  | { allowed: true }
  | { allowed: false; reason: string };

function validate<S extends string>(
  graph: Record<S, ReadonlyArray<S>>,
  from: S,
  to: S,
): TransitionValidation {
  const allowed = graph[from];
  if (!allowed) return { allowed: false, reason: `Unknown source state '${from}'` };
  if (!allowed.includes(to)) {
    return {
      allowed: false,
      reason: `Transition ${from} → ${to} is not in the allowed set (${allowed.join(', ') || 'terminal state — no transitions'})`,
    };
  }
  return { allowed: true };
}

export function validateCitizenTransition(
  from: CitizenPassportStatus,
  to: CitizenPassportStatus,
): TransitionValidation {
  return validate(CITIZEN_GRAPH, from, to);
}

export function validateParticipantTransition(
  from: ParticipantPassportStatus,
  to: ParticipantPassportStatus,
): TransitionValidation {
  return validate(PARTICIPANT_GRAPH, from, to);
}

export function citizenTransitionRule(
  from: CitizenPassportStatus,
  to: CitizenPassportStatus,
): PassportTransitionRule<CitizenPassportStatus> | undefined {
  return CITIZEN_RULES.find((r) => r.from === from && r.to === to);
}

export function participantTransitionRule(
  from: ParticipantPassportStatus,
  to: ParticipantPassportStatus,
): PassportTransitionRule<ParticipantPassportStatus> | undefined {
  return PARTICIPANT_RULES.find((r) => r.from === from && r.to === to);
}

export function isCitizenTerminal(state: CitizenPassportStatus): boolean {
  return CITIZEN_GRAPH[state].length === 0;
}

export function isParticipantTerminal(state: ParticipantPassportStatus): boolean {
  return PARTICIPANT_GRAPH[state].length === 0;
}

export function allowedCitizenTransitionsFrom(
  state: CitizenPassportStatus,
): ReadonlyArray<CitizenPassportStatus> {
  return CITIZEN_GRAPH[state] ?? [];
}

export function allowedParticipantTransitionsFrom(
  state: ParticipantPassportStatus,
): ReadonlyArray<ParticipantPassportStatus> {
  return PARTICIPANT_GRAPH[state] ?? [];
}

export const CITIZEN_TRANSITION_RULES = CITIZEN_RULES;
export const PARTICIPANT_TRANSITION_RULES = PARTICIPANT_RULES;
