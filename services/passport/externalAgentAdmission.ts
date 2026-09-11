/**
 * Provisional External Agent Admission — a non-human, non-passport-holding
 * admission record.
 *
 * Operator ruling, 2026-07-30: *"A [external, e.g. Horizen] agent is not a
 * human citizen and should not receive a human Polity Passport. It can be
 * admitted as: external agent candidate → Marketa vetting → agent identity /
 * Agent Card resolution → polity-bound agent credential → bounded delegation
 * → Standing eligibility. Under the existing constitutional model, a
 * non-human agent may become polity-bound, act under delegation and accrue
 * Standing, but it cannot originate human authority or delegate onward."*
 *
 * ── WHY THIS IS A NEW, SMALL TYPE — NOT A FORK OF THE PASSPORT MACHINERY ────
 *
 * The operator was explicit: *"this does not need the final generalized
 * agent-passport framework."* `services/passport/passportStatusMachine.ts`
 * already models TWO real, heavier lifecycles (irrevocable Citizen
 * personhood; revocable Participant standing) — issuing a human Polity
 * Passport, or even the full `ParticipantPassportStatus` machine, to an
 * external, non-human, not-yet-vetted candidate would be exactly the
 * conflation the ruling forbids. This module is the PRECURSOR object: a
 * provisional, pilot-scoped credential that may later be superseded by a
 * real Agent Participant Passport once the full framework exists — it is a
 * sibling concept, not a rename.
 *
 * ── COMPOSITION, NOT DUPLICATION ─────────────────────────────────────────────
 *
 *  - The card itself is never copied in — `externalAgentCardCommitment` is a
 *    sha256 digest, the same discipline `services/horizen/evidence.ts`'s
 *    `commitCard` already uses for third-party, unbounded-size Agent Cards.
 *  - `network`/`registry` reuse `HorizenNetwork` (services/horizen/identity.ts)
 *    when the external agent is Horizen-native, because that is the concrete
 *    case this record type exists for today; a future non-Horizen registry
 *    is representable via the `registry` free-text field without forking the
 *    type.
 *  - `sponsorRef` is a T2 commitment via `constitutionalRef`
 *    (services/identity/personaReferences.ts) — the SAME derivation the
 *    Horizen binding's `bindingRefs` uses, never a second hashing scheme
 *    (inv.engineering.036/037).
 *  - The status graph below is a THIRD small instance of the same
 *    from→to-graph pattern `passportStatusMachine.ts` uses twice (once per
 *    passport class) — that file's `buildGraph`/`validate` helpers are
 *    module-private (not exported), so this mirrors the pattern locally
 *    rather than forking an exported primitive that does not exist.
 *
 * ── THE HARD, STRUCTURAL "NO ONWARD DELEGATION" RULE ────────────────────────
 *
 * `mayDelegateOnward: false` is a LITERAL type, not `boolean` — mirroring
 * `ReviewRoleAuthority.mayEditSourceAssets: false` in
 * `services/research/review/types.ts`. Assigning `true` anywhere is a
 * TypeScript compile error, not a runtime check that can be forgotten or
 * bypassed. `canDelegateOnward()` below is typed to return the literal
 * `false` unconditionally, so no future refactor can make it return anything
 * else without changing its declared return type — a caller reading `false`
 * literal from this function's signature does not need to trust its body.
 *
 * ── WHAT THIS MODULE DOES NOT DO ────────────────────────────────────────────
 *
 * No Marketa vetting workflow is implemented here — the operator's own
 * scope-discipline ruling (2026-07-26/29 pilot briefs) places full Marketa
 * vetting outside the Base Sepolia first slice. `candidateStatus: 'vetting'`
 * is a state this record can occupy; the vetting DECISION LOGIC is Marketa's,
 * not this module's, exactly as `passportStatusMachine.ts` "describes
 * transitions; it never executes them." No Standing accrual is implemented;
 * `standingAccrualEligible` and `evidenceRefs` are the extension point the
 * operator asked for, not a working accrual pipeline.
 */

import { createHash } from 'crypto';
import type { HorizenNetwork } from '@/services/horizen/identity';
import { constitutionalRef } from '@/services/identity/personaReferences';

// ─── The card commitment ─────────────────────────────────────────────────────

/** sha256 of a stable JSON projection of the external agent's card. Never the
 *  raw card bytes — mirrors `services/horizen/evidence.ts`'s `commitCard`. */
export function externalAgentCardCommitment(card: unknown): string {
  return createHash('sha256').update(JSON.stringify(card)).digest('hex');
}

// ─── Sponsor ──────────────────────────────────────────────────────────────────

/**
 * Who vouches for this candidate. `operator` is the human operator acting in
 * their own constitutional capacity (T0 personaId in, T2 commitment out —
 * never the raw id past this function); `institutional` is a named
 * institution (e.g. "Horizen Labs") with no personaId to commit — its ref is
 * a free-text namespaced commitment of the institution's own stable name.
 */
export type AdmissionSponsor =
  | { kind: 'operator'; personaId: string }
  | { kind: 'institutional'; institutionName: string };

export interface AdmissionSponsorRef {
  kind: 'operator' | 'institutional';
  /** T2 commitment — never the raw personaId or a reversible identifier. */
  ref: string;
}

export function sponsorRef(sponsor: AdmissionSponsor): AdmissionSponsorRef {
  if (sponsor.kind === 'operator') {
    return { kind: 'operator', ref: constitutionalRef('admission-sponsor-operator', sponsor.personaId) };
  }
  return { kind: 'institutional', ref: constitutionalRef('admission-sponsor-institution', sponsor.institutionName) };
}

// ─── Candidate status — closed set ──────────────────────────────────────────

/**
 * EXACTLY these seven. Mirrors the operator's stated sequence:
 * `candidate → vetting → {admitted, rejected}`, then the lifecycle of an
 * admitted record: `admitted → {suspended, revoked, expired}`,
 * `suspended → {admitted, revoked}`. `rejected` and `revoked` are terminal
 * (no re-admission from this record — a fresh candidacy is a new record,
 * mirroring `passportStatusMachine.ts`'s "reissue is a new row" discipline).
 */
export type ExternalAgentAdmissionStatus =
  | 'candidate'
  | 'vetting'
  | 'admitted'
  | 'rejected'
  | 'suspended'
  | 'revoked'
  | 'expired';

export const EXTERNAL_AGENT_ADMISSION_STATUSES: ReadonlyArray<ExternalAgentAdmissionStatus> = [
  'candidate',
  'vetting',
  'admitted',
  'rejected',
  'suspended',
  'revoked',
  'expired',
];

const ADMISSION_GRAPH: Record<ExternalAgentAdmissionStatus, ReadonlyArray<ExternalAgentAdmissionStatus>> = {
  candidate: ['vetting'],
  vetting: ['admitted', 'rejected'],
  admitted: ['suspended', 'revoked', 'expired'],
  suspended: ['admitted', 'revoked'],
  rejected: [],
  revoked: [],
  expired: [],
};

export type AdmissionTransitionValidation = { allowed: true } | { allowed: false; reason: string };

export function validateAdmissionTransition(
  from: ExternalAgentAdmissionStatus,
  to: ExternalAgentAdmissionStatus,
): AdmissionTransitionValidation {
  const allowed = ADMISSION_GRAPH[from];
  if (!allowed.includes(to)) {
    return {
      allowed: false,
      reason: `Transition ${from} → ${to} is not permitted (${allowed.join(', ') || 'terminal state — no transitions'})`,
    };
  }
  return { allowed: true };
}

export function isAdmissionTerminal(status: ExternalAgentAdmissionStatus): boolean {
  return ADMISSION_GRAPH[status].length === 0;
}

// ─── The record ──────────────────────────────────────────────────────────────

/**
 * The provisional admission record itself. Every field the operator's
 * ruling named, one per field:
 *
 *   external Agent Card · network and registry · operator or institutional
 *   sponsor · candidate status · permitted pilot actions · expiry ·
 *   revocation · no onward delegation · evidence and Standing hooks.
 */
export interface ExternalAgentAdmission {
  admissionId: string;

  /** The external agent's own identity, as far as it is resolved. */
  externalAgentCardCommitment: string;
  /** e.g. Horizen's registry hex alias, or another registry's native id. */
  externalAgentRegistryAlias: string | null;
  network: HorizenNetwork | null;
  /** The identity/registry CONTRACT or endpoint this candidate is claimed
   *  against — recorded, never re-derived, mirroring `agentBinding.ts`'s
   *  `identityRegistry` discipline (a superseded deployment must still say
   *  what it was bound against at admission time). */
  registry: string;

  sponsor: AdmissionSponsorRef;

  candidateStatus: ExternalAgentAdmissionStatus;
  statusReason: string | null;

  /**
   * Explicit allowlist. NEVER `['*']` or an "everything" sentinel — enforced
   * by `createExternalAgentAdmission` below, which refuses an empty or
   * wildcard-looking action list rather than silently admitting one.
   */
  permittedPilotActions: readonly string[];

  createdAt: string;
  expiresAt: string;

  revocation: {
    revoked: boolean;
    revokedAt: string | null;
    revokedReason: string | null;
  };

  /**
   * STRUCTURALLY false. See the module header — this is a literal type, not
   * a runtime flag, so no assignment anywhere in the codebase can make an
   * admission record claim onward-delegation authority.
   */
  mayDelegateOnward: false;

  /** Extension point only — no accrual pipeline is implemented here. */
  standingAccrualEligible: boolean;
  /** T2 commitments to whatever evidence this candidacy has produced so far
   *  (e.g. a Horizen evidence record's own commitments). Empty until wired. */
  evidenceRefs: readonly string[];
}

const WILDCARD_ACTION_PATTERNS = new Set(['*', 'all', 'any']);

export type CreateAdmissionFailure =
  | 'no-permitted-actions'
  | 'wildcard-action-not-allowed'
  | 'expiry-not-in-future';

export type CreateAdmissionResult =
  | { ok: true; admission: ExternalAgentAdmission }
  | { ok: false; reason: CreateAdmissionFailure };

export interface CreateExternalAgentAdmissionInput {
  admissionId: string;
  externalAgentCard: unknown;
  externalAgentRegistryAlias?: string | null;
  network?: HorizenNetwork | null;
  registry: string;
  sponsor: AdmissionSponsor;
  permittedPilotActions: readonly string[];
  createdAt: string;
  expiresAt: string;
}

/**
 * The constructor. Every new admission starts in `candidate` status — the
 * operator's sequence begins there, before Marketa vetting has even started.
 * Refuses an empty or wildcard action list and a non-future expiry rather
 * than admitting a candidate with unbounded or already-lapsed authority.
 */
export function createExternalAgentAdmission(
  input: CreateExternalAgentAdmissionInput,
): CreateAdmissionResult {
  if (input.permittedPilotActions.length === 0) {
    return { ok: false, reason: 'no-permitted-actions' };
  }
  if (input.permittedPilotActions.some((a) => WILDCARD_ACTION_PATTERNS.has(a.trim().toLowerCase()))) {
    return { ok: false, reason: 'wildcard-action-not-allowed' };
  }
  if (Date.parse(input.expiresAt) <= Date.parse(input.createdAt)) {
    return { ok: false, reason: 'expiry-not-in-future' };
  }

  return {
    ok: true,
    admission: {
      admissionId: input.admissionId,
      externalAgentCardCommitment: externalAgentCardCommitment(input.externalAgentCard),
      externalAgentRegistryAlias: input.externalAgentRegistryAlias ?? null,
      network: input.network ?? null,
      registry: input.registry,
      sponsor: sponsorRef(input.sponsor),
      candidateStatus: 'candidate',
      statusReason: null,
      permittedPilotActions: [...input.permittedPilotActions],
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
      revocation: { revoked: false, revokedAt: null, revokedReason: null },
      mayDelegateOnward: false,
      standingAccrualEligible: false,
      evidenceRefs: [],
    },
  };
}

// ─── Structural, never-overridable "no onward delegation" ───────────────────

/**
 * ALWAYS false. The return type is the literal `false`, not `boolean` — a
 * caller does not have to trust this function's body, only its signature,
 * exactly like the `ReviewRoleAuthority.mayEditSourceAssets: false` pattern
 * this module mirrors. No parameter influences the result; none ever should.
 */
export function canDelegateOnward(_admission: ExternalAgentAdmission): false {
  return false;
}

// ─── Transitions (describe only — callers perform the side effects) ────────

export interface AdmissionTransitionResult {
  ok: boolean;
  admission: ExternalAgentAdmission;
  reason?: string;
}

function applyTransition(
  admission: ExternalAgentAdmission,
  to: ExternalAgentAdmissionStatus,
  statusReason: string | null,
): AdmissionTransitionResult {
  const validation = validateAdmissionTransition(admission.candidateStatus, to);
  if (!validation.allowed) {
    return { ok: false, admission, reason: validation.reason };
  }
  return { ok: true, admission: { ...admission, candidateStatus: to, statusReason } };
}

/** candidate → vetting. The Marketa vetting DECISION itself is out of scope
 *  here — this only describes the state the candidate enters while it runs. */
export function beginVetting(admission: ExternalAgentAdmission): AdmissionTransitionResult {
  return applyTransition(admission, 'vetting', 'Marketa vetting in progress');
}

/** vetting → admitted. Caller (Marketa's vetting decision) supplies the reason. */
export function admitCandidate(admission: ExternalAgentAdmission, reason: string): AdmissionTransitionResult {
  return applyTransition(admission, 'admitted', reason);
}

/** vetting → rejected. Terminal — a fresh candidacy is a new record. */
export function rejectCandidate(admission: ExternalAgentAdmission, reason: string): AdmissionTransitionResult {
  return applyTransition(admission, 'rejected', reason);
}

/** admitted ↔ suspended. */
export function suspendAdmission(admission: ExternalAgentAdmission, reason: string): AdmissionTransitionResult {
  return applyTransition(admission, 'suspended', reason);
}
export function reinstateAdmission(admission: ExternalAgentAdmission, reason: string): AdmissionTransitionResult {
  return applyTransition(admission, 'admitted', reason);
}

/** {admitted, suspended} → revoked. Terminal. Sets the revocation block. */
export function revokeAdmission(admission: ExternalAgentAdmission, reason: string, revokedAt: string): AdmissionTransitionResult {
  const applied = applyTransition(admission, 'revoked', reason);
  if (!applied.ok) return applied;
  return {
    ok: true,
    admission: {
      ...applied.admission,
      revocation: { revoked: true, revokedAt, revokedReason: reason },
    },
  };
}

/** admitted → expired. System-initiated when `now` passes `expiresAt`. */
export function expireIfPastDue(admission: ExternalAgentAdmission, now: string): AdmissionTransitionResult {
  if (admission.candidateStatus !== 'admitted') {
    return { ok: false, admission, reason: `only an 'admitted' admission can expire on its own; current status is '${admission.candidateStatus}'` };
  }
  if (Date.parse(now) < Date.parse(admission.expiresAt)) {
    return { ok: false, admission, reason: 'not yet past expiresAt' };
  }
  return applyTransition(admission, 'expired', `expired at ${now}`);
}

// ─── Authority evaluation — the gate a runtime action must pass ────────────

export type AdmissionAuthorityRefusal =
  | 'not-admitted'
  | 'expired'
  | 'revoked'
  | 'action-not-permitted';

export interface AdmissionAuthority {
  eligible: boolean;
  refusals: AdmissionAuthorityRefusal[];
}

/**
 * May this admission perform `action` right now? Pure — the caller supplies
 * `now`. Mirrors `evaluateNewActionAuthority`'s shape in
 * `services/horizen/agentBinding.ts` (refusals as a list, not a single
 * boolean) so a denied caller can tell WHY, not just that it was denied.
 */
export function evaluateAdmissionAuthority(
  admission: ExternalAgentAdmission,
  action: string,
  now: string,
): AdmissionAuthority {
  const refusals: AdmissionAuthorityRefusal[] = [];
  if (admission.candidateStatus !== 'admitted') refusals.push('not-admitted');
  if (admission.revocation.revoked) refusals.push('revoked');
  if (Date.parse(now) >= Date.parse(admission.expiresAt)) refusals.push('expired');
  if (!admission.permittedPilotActions.includes(action)) refusals.push('action-not-permitted');
  return { eligible: refusals.length === 0, refusals };
}

// ─── Evidence / Standing extension point (not implemented) ─────────────────

/**
 * Append an evidence commitment to the record. Does NOT itself decide
 * `standingAccrualEligible` — that is a future Standing-accrual decision this
 * module intentionally does not make (the operator's "does not need to fully
 * implement Standing accrual, just the extension point").
 */
export function withEvidenceRef(admission: ExternalAgentAdmission, ref: string): ExternalAgentAdmission {
  if (admission.evidenceRefs.includes(ref)) return admission;
  return { ...admission, evidenceRefs: [...admission.evidenceRefs, ref] };
}
