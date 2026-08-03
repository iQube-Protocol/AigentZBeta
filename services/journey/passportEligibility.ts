/**
 * THE ONE PASSPORT ADMISSION GATE.
 *
 * ── THE OPERATOR'S RULING (2026-08-03), verbatim ──────────────────────────
 *
 *   > "ONE explicit admission-gate function — do not let every panel invent
 *   >  its own prerequisites. Only genuine constitutional prerequisites may
 *   >  block Passport. Pulse monitoring, P&L disclosure, optional partner
 *   >  metadata, missing ancillary receipts and diagnostic inconsistencies
 *   >  must NOT block Passport unless an existing ratified rule explicitly
 *   >  says they must."
 *
 * Every surface that needs to know whether the Passport act may proceed —
 * the journey `/state` route, the Passport stage's own panel, the Companion,
 * any future partner surface — calls THIS function. Not a second copy of its
 * reasoning, not "roughly the same checks". Five observers of one fact is the
 * defect this whole workstream exists to close
 * (RES-2026-08-03-HORIZEN-OBSERVER-RECONCILIATION-001); five gates on one act
 * would be the same defect wearing a different noun.
 *
 * ══ THE EVIDENCE SEARCH THE OPERATOR REQUIRED ══════════════════════════════
 *
 * Instructed to search for a ratified rule making Pulse/P&L a hard admission
 * gate before classifying it, and to say so explicitly either way. The search
 * was run across `codexes/packs/agentiq/updates/`, `docs/`, `services/` and
 * `components/`. **NO ratified rule makes Pulse monitoring, P&L disclosure or
 * any partner-transparency signal a prerequisite for Passport.** Four ratified
 * sources say the opposite, and they are cited on each classification below.
 *
 * The most direct is Marketa's own deterministic admission policy, which is
 * ratified and already shipped (`services/marketa/admissionAssessmentEngine.ts`):
 *
 *     const REFUSAL_RULE_IDS = new Set(['MKT-ADM-003','MKT-ADM-004',
 *                                       'MKT-ADM-005','MKT-ADM-006']);
 *
 * MKT-ADM-007 ("Pulse integration must be active") and MKT-ADM-008
 * ("disclosure consent must be explicit") EXIST as rules and are deliberately
 * NOT in the refusal set — so under the ratified policy an unmet Pulse rule
 * yields NOT_RECOMMENDED, never REFUSED. The gate below is the same judgment,
 * applied one stage later. It does not invent a classification; it honours one.
 *
 * ══ WHY THE DISTINCTION IS CONSTITUTIONAL AND NOT MERELY CONVENIENT ════════
 *
 * Control–Authority–Mandate: registration proves discoverability, control
 * proves the key, the Passport establishes the HUMAN SOURCE from whom
 * authority may originate. Transparency proves none of those. It makes an
 * agent's conduct observable — which is why PRD-GJR-001 routes it to
 * STANDING (§3.7, §5.8), a thing earned by disclosure over time, and not to
 * admission, a thing granted by a sponsoring human.
 */

import type { ExceptionRecord, NonEmptyActs } from '@/services/research/exceptionIsolation';
import { journeyAct, type BlockingReason, type JourneyAct } from './stageResolution';

// ── Inputs ──────────────────────────────────────────────────────────────────

/**
 * The subject's registration, as established by the settled fact — NOT
 * re-derived here. Structurally minimal so the gate consumes
 * `AgentRegistrationState` directly without importing it (that module reaches
 * Supabase; this one is pure).
 */
export interface RegistrationInput {
  registered: boolean;
  settled: boolean;
  tokenId: string | null;
  /** Evidence expected and not found. Disclosed, never subtracted from
   *  `registered`. */
  auditGaps: string[];
}

/**
 * The human from whom authority originates.
 *
 * ── THESE MUST COME FROM THE CANONICAL PASSPORT READ ─────────────────────
 *
 * NOT from a receipt this journey wrote. An operator who already holds a valid
 * Polity Passport — issued through the Passport Bureau, entirely outside this
 * journey — has no `operator_passport_validated` receipt here, and deriving
 * these flags from that receipt therefore presents a Passport APPLICATION to
 * someone who already holds a Passport. That is the same defect class as
 * everything else this workstream closed: evidence-of-this-ceremony
 * substituted for the canonical fact. A receipt is audit material; it is not
 * the authority on whether a Passport exists.
 *
 * The canonical read is `resolvePassportPrincipalForAuthUser` +
 * `isPassportUsable` (services/identity/passportPrincipal.ts).
 */
export interface PrincipalInput {
  /** Does the operator hold a resolving Polity Citizen Passport? */
  citizenPassportValid: boolean;
  /** Personhood relationship established (the passport's own precondition). */
  personhoodEstablished: boolean;
  /**
   * False when the canonical passport state COULD NOT BE READ — a service
   * error, an unresolvable lineage — as distinct from being read and found
   * absent.
   *
   * The distinction decides which act the operator is offered, and getting it
   * wrong restarts a completed ceremony: "could not read" must yield
   * *re-check*, never *apply for a Passport*. This mirrors
   * `resolveAgentRegistrationState`'s refusal to report `registered: false`
   * for `source: 'unresolved'`.
   */
  passportReadable?: boolean;
}

/** The Claim ceremony's outcome. */
export interface ClaimInput {
  controlProven: boolean;
  /** A proof that exists but has aged out is a real fault, not an absence —
   *  the same distinction MKT-ADM-005 draws between `missing` and `failed`. */
  controlProofFresh: boolean;
  /** Marketa's higher-risk signals. QUARANTINED is "never auto-cleared". */
  quarantined: boolean;
}

/**
 * A human authorization the Passport act itself requires. Supplied by the
 * caller because WHICH authorizations are required is a property of the act
 * being performed, not of this function — a gate that hardcoded the list
 * would be the "every panel invents its own prerequisites" defect inverted.
 */
export interface RequiredAuthorization {
  id: string;
  label: string;
  granted: boolean;
}

/** Signals that are real, disclosed, and constitutionally irrelevant to
 *  admission. Every one of these is classified NON-BLOCKING below, with its
 *  evidence. */
export interface AncillaryInput {
  pulseAuthorized?: boolean;
  pnlDisclosureAuthorized?: boolean;
  /** The `partner_authorization_requests` migration state — Verify-only. */
  authorizationStoreAvailable?: boolean;
  authorizationStoreRemedy?: string;
  /** Optional partner metadata (e.g. Horizen's human-readable page URL). */
  partnerMetadataComplete?: boolean;
  /** Any diagnostic inconsistency an observer noticed. */
  diagnosticInconsistencies?: string[];
}

export interface PassportEligibilityInput {
  registration: RegistrationInput | null;
  principal: PrincipalInput | null;
  claim: ClaimInput | null;
  requiredAuthorizations: readonly RequiredAuthorization[];
  ancillary?: AncillaryInput;
  /** Stage id the Passport act is performed on. */
  passportStageId?: string;
}

export interface PassportEligibility {
  eligible: boolean;
  blockingReasons: BlockingReason[];
  nonBlockingExceptions: ExceptionRecord[];
  nextExecutableAct: JourneyAct;
}

/**
 * The closed set of things that MAY block Passport. Closed on purpose: a new
 * blocker is a constitutional change and must be argued for, not added by a
 * panel that found a condition it did not like.
 */
export type BlockingReasonCode =
  | 'principal-personhood-unresolved'
  | 'principal-citizen-passport-invalid'
  | 'principal-passport-unreadable'
  | 'registration-not-established'
  | 'control-not-proven'
  | 'control-proof-stale'
  | 'admission-quarantined'
  | 'human-authorization-not-granted';

export const BLOCKING_REASON_CODES: readonly BlockingReasonCode[] = [
  'principal-personhood-unresolved',
  'principal-citizen-passport-invalid',
  'principal-passport-unreadable',
  'registration-not-established',
  'control-not-proven',
  'control-proof-stale',
  'admission-quarantined',
  'human-authorization-not-granted',
];

/**
 * The closed set of things that MAY NOT block Passport, each carrying the
 * ratified source that says so. Exported so a canary can assert that no code
 * path ever promotes one of these into `blockingReasons`.
 */
export type NonBlockingExceptionCode =
  | 'pulse-monitoring-not-authorized'
  | 'pnl-disclosure-not-authorized'
  | 'authorization-store-unavailable'
  | 'partner-metadata-incomplete'
  | 'registration-audit-gap'
  | 'diagnostic-inconsistency';

export const NON_BLOCKING_EXCEPTION_CODES: readonly NonBlockingExceptionCode[] = [
  'pulse-monitoring-not-authorized',
  'pnl-disclosure-not-authorized',
  'authorization-store-unavailable',
  'partner-metadata-incomplete',
  'registration-audit-gap',
  'diagnostic-inconsistency',
];

/**
 * The ratified authority for each non-blocking classification. Kept as DATA,
 * not as comments, so the surface can show the operator WHY a red-looking
 * condition is not stopping them — and so a future agent proposing to promote
 * one of these to a blocker must first contradict a named source.
 */
export const NON_BLOCKING_EVIDENCE: Record<NonBlockingExceptionCode, string> = {
  'pulse-monitoring-not-authorized':
    'MKT-ADM-007 is not in REFUSAL_RULE_IDS (services/marketa/admissionAssessmentEngine.ts) — under the ratified ' +
    'admission policy an unmet Pulse rule yields NOT_RECOMMENDED, never REFUSED. PRD-GJR-001 §3.7: "transparency is ' +
    'a gateway, never a grant"; §5.8 routes it to Standing eligibility, not admission.',
  'pnl-disclosure-not-authorized':
    'MKT-ADM-008 is not in REFUSAL_RULE_IDS. GJR-VFY-001 §2 (operator-ratified 2026-07-31): a transparency ' +
    'authorization "does not prove or create: constitutional authority generally; sponsorship; bounded delegation; ' +
    'payment authority; FS Runtime admission; Standing."',
  'authorization-store-unavailable':
    'A missing migration is an operational fault of THIS deployment, not a fact about the agent. ' +
    'services/journey/settledFacts.ts lists the five events that may reopen a settled fact and states that ' +
    '"a migration is missing" is expressly not among them.',
  'partner-metadata-incomplete':
    "Optional partner metadata (e.g. Horizen's human-readable page URL) appears in no ratified completion condition. " +
    'PRD-GJR-001 §7 stage 4 requires: valid operator Polity Citizen Passport ∩ sponsor binding ∩ Delegate Passport issued.',
  'registration-audit-gap':
    'The Settled Fact Non-Reconsideration ruling (2026-08-03): "Evidence absence in a downstream observer is not ' +
    'evidence that a settled fact has ceased to be true."',
  'diagnostic-inconsistency':
    'A disagreement between observers is a defect in the observers, never a finding about the subject ' +
    '(RES-2026-08-03-HORIZEN-OBSERVER-RECONCILIATION-001).',
};

function exception(
  code: NonBlockingExceptionCode,
  recordId: string,
  recordLabel: string,
  cause: string,
  consequence: string,
  acts: NonEmptyActs,
): ExceptionRecord {
  return {
    code,
    recordId,
    recordLabel,
    cause,
    disposition: 'exception',
    consequence,
    // THE LOAD-BEARING LINE. Every exception this gate produces blocks
    // nothing; if this were ever computed rather than constant, the module
    // would have grown the power to block on a non-constitutional signal.
    blocksCurrentAct: false,
    acts,
    deferrableUntil: null,
  };
}

/**
 * Resolve whether the Passport act may proceed.
 *
 * Pure — no I/O, no clock. The caller supplies settled facts; this function
 * decides. That split is what lets one gate serve a server route, a client
 * panel and a test without any of them re-deriving anything.
 */
export function resolvePassportEligibility(input: PassportEligibilityInput): PassportEligibility {
  const stageId = input.passportStageId ?? 'passport';
  const blockingReasons: BlockingReason[] = [];
  const nonBlockingExceptions: ExceptionRecord[] = [];

  // ── HARD GATE 1 · a valid principal / personhood relationship ────────────
  // PRD-GJR-001 §7 stage 4 and the Passport stage's own companion text: "Your
  // Polity Citizen Passport must resolve before you can sponsor MoneyPenny."
  // Authority originates in a human; there is no other source for it.
  if (input.principal?.passportReadable === false) {
    /*
     * COULD NOT READ ≠ DOES NOT HOLD. The act offered here is a RE-CHECK, and
     * deliberately never an application: offering "apply for a Passport" to an
     * operator whose Passport merely could not be read this second would
     * restart a ceremony they already completed.
     */
    blockingReasons.push({
      code: 'principal-passport-unreadable',
      stageId,
      summary: 'Your Passport state could not be read just now. Nothing about your Passport has changed.',
      acts: [journeyAct(stageId, 'recheck-passport', 're-check', 'Re-check')],
    });
  } else if (!input.principal?.personhoodEstablished) {
    blockingReasons.push({
      code: 'principal-personhood-unresolved',
      stageId,
      summary: 'Your personhood relationship is not yet established — authority can only originate from a verified human.',
      acts: [journeyAct(stageId, 'verify-personhood', 'perform-ceremony', 'Verify personhood')],
    });
  } else if (!input.principal.citizenPassportValid) {
    blockingReasons.push({
      code: 'principal-citizen-passport-invalid',
      stageId,
      summary: 'Your Polity Citizen Passport does not currently resolve — sponsorship requires it.',
      acts: [journeyAct(stageId, 'resolve-citizen-passport', 'perform-ceremony', 'Resolve your Citizen Passport')],
    });
  }

  // ── HARD GATE 2 · a valid registration binding ───────────────────────────
  // MKT-ADM-003/004 sit in REFUSAL_RULE_IDS: a network-qualified registry
  // identity and an explicit registered controller are refusal-class. Note
  // what is read — `registered`, the settled fact — and what is NOT: the
  // audit gaps, which are disclosed below as a non-blocking exception.
  if (!input.registration?.registered) {
    blockingReasons.push({
      code: 'registration-not-established',
      stageId,
      summary: 'No registration binding has been established for this agent.',
      acts: [journeyAct('register', 'perform:register', 'perform-ceremony', 'Continue to Register')],
    });
  }

  // ── HARD GATE 3 · proof of control ───────────────────────────────────────
  // MKT-ADM-005/006, both refusal-class, and the ratified "Control Before
  // Recommendation" invariant. Proven-but-stale is a distinct fault with a
  // distinct remedy, exactly as the rule engine models it.
  if (!input.claim?.controlProven) {
    blockingReasons.push({
      code: 'control-not-proven',
      stageId,
      summary: 'Wallet control has not been proven for this agent.',
      acts: [journeyAct('claim', 'perform:claim', 'perform-ceremony', 'Continue to Claim')],
    });
  } else if (!input.claim.controlProofFresh) {
    blockingReasons.push({
      code: 'control-proof-stale',
      stageId,
      summary: 'The proof of wallet control has aged out and must be re-signed.',
      acts: [journeyAct('claim', 're-prove-control', 'perform-ceremony', 'Re-prove wallet control')],
    });
  }

  if (input.claim?.quarantined) {
    blockingReasons.push({
      code: 'admission-quarantined',
      stageId,
      summary: 'Marketa recorded a higher-risk evidence signal — quarantine is never auto-cleared.',
      acts: [journeyAct('claim', 'review-quarantine', 'resolve-record', 'Review the quarantine signal')],
    });
  }

  // ── HARD GATE 4 · the human authorization for the Passport act itself ────
  // The Guided Sovereignty Principle (§5.4): a sovereign act is performed by
  // the human, never by the Companion or the runtime. An ungranted required
  // authorization is the absence of the act itself.
  for (const authorization of input.requiredAuthorizations) {
    if (authorization.granted) continue;
    blockingReasons.push({
      code: 'human-authorization-not-granted',
      stageId,
      summary: `${authorization.label} has not been granted — this act requires your explicit authorization.`,
      acts: [journeyAct(stageId, `grant:${authorization.id}`, 'perform-ceremony', `Grant ${authorization.label}`)],
    });
  }

  // ══ NON-BLOCKING — real, disclosed, and stopping nothing ═════════════════
  const ancillary = input.ancillary ?? {};

  if (ancillary.pulseAuthorized === false) {
    nonBlockingExceptions.push(
      exception(
        'pulse-monitoring-not-authorized',
        'horizen-pulse',
        'Horizen Pulse monitoring',
        'Pulse monitoring has not been authorized for this agent.',
        'Does not block Claim, Passport or Delegation. It defers Standing eligibility until transparency is authorized.',
        [journeyAct('verify', 'authorize-pulse', 'open-stage', 'Authorize Pulse in Verify')],
      ),
    );
  }

  if (ancillary.pnlDisclosureAuthorized === false) {
    nonBlockingExceptions.push(
      exception(
        'pnl-disclosure-not-authorized',
        'horizen-pnl',
        'P&L disclosure consent',
        'P&L disclosure consent has not been recorded.',
        'Does not block Claim, Passport or Delegation. Standing accrues from disclosure, so it remains deferred.',
        [journeyAct('verify', 'authorize-pnl', 'open-stage', 'Authorize P&L disclosure in Verify')],
      ),
    );
  }

  if (ancillary.authorizationStoreAvailable === false) {
    /*
     * THE VERIFY-ONLY EXCEPTION, and the reason this whole module exists.
     *
     * `partner_authorization_requests` is not in the deployed dev schema, so
     * `prepareHorizenTransparencyAuthorization` refuses with
     * AUTHORIZATION_STORE_UNAVAILABLE. That refusal is correct AND it is
     * entirely local: it describes a table in one deployment. Letting it
     * stop Claim and Passport would mean an unapplied migration had revoked
     * an agent's constitutional standing — which is the precise shape of
     * "global stoppage for a local anomaly" that the ratified exception-
     * isolation ruling forbids ("Constitutional control constrains the unsafe
     * act; it does not immobilize the safe remainder").
     */
    nonBlockingExceptions.push(
      exception(
        'authorization-store-unavailable',
        'partner-authorization-store',
        'Local authorization store',
        'The local authorization store is unavailable in this deployment.',
        'Blocks the Verify act only. Register, Claim, Passport and Delegation are unaffected — this is a fault of this ' +
          'deployment, not a fact about the agent.',
        [
          journeyAct(
            'verify',
            'apply-authorization-migration',
            'apply-migration',
            'Apply migration',
            ancillary.authorizationStoreRemedy ??
              'supabase/migrations/20260930000500_partner_authorization_requests.sql',
          ),
          journeyAct('verify', 'reload-schema-cache', 'reload-schema-cache', 'Refresh schema', "NOTIFY pgrst, 'reload schema';"),
          journeyAct('verify', 'recheck-authorization-store', 're-check', 'Re-check'),
        ],
      ),
    );
  }

  if (ancillary.partnerMetadataComplete === false) {
    nonBlockingExceptions.push(
      exception(
        'partner-metadata-incomplete',
        'partner-metadata',
        'Optional partner metadata',
        "Optional partner metadata (e.g. the registry's human-readable page URL) was never returned.",
        'Does not block any constitutional act. It appears in no ratified completion condition.',
        [journeyAct('register', 'view-partner-metadata-gap', 'view-audit-gaps', 'View audit gaps')],
      ),
    );
  }

  for (const gap of input.registration?.auditGaps ?? []) {
    nonBlockingExceptions.push(
      exception(
        'registration-audit-gap',
        'registration-audit-gap',
        'Registration evidence gap',
        gap,
        'Does not block any act. The registration is settled; this records what the evidence trail does not show.',
        [journeyAct('register', 'view-registration-audit-gaps', 'view-audit-gaps', 'View audit gaps')],
      ),
    );
  }

  for (const inconsistency of ancillary.diagnosticInconsistencies ?? []) {
    nonBlockingExceptions.push(
      exception(
        'diagnostic-inconsistency',
        'diagnostic-inconsistency',
        'Diagnostic inconsistency',
        inconsistency,
        'Does not block any act. A disagreement between observers is a defect in the observers, not a finding about the agent.',
        [journeyAct(stageId, 'recheck-diagnostics', 're-check', 'Re-check')],
      ),
    );
  }

  const eligible = blockingReasons.length === 0;

  /*
   * THE ONE NEXT ACT — never navigation, never "go somewhere else".
   *
   * Blocked: the first blocker's own remedy, because a stage you cannot start
   * is not the next thing you can do — clearing what stops it is.
   * Eligible: the Passport ceremony itself.
   */
  const nextExecutableAct: JourneyAct = eligible
    ? journeyAct(stageId, 'perform:passport', 'perform-ceremony', 'Continue to Passport', 'Record sponsorship and issue the Polity Delegate Passport.')
    : blockingReasons[0].acts[0];

  return { eligible, blockingReasons, nonBlockingExceptions, nextExecutableAct };
}
