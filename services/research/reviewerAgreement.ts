/**
 * reviewerAgreement — the experiment-scoped Independent Reviewer Agreement
 * (operator ruling, 2026-08-02).
 *
 * ── WHAT THIS IS, AND WHAT IT IS NOT ───────────────────────────────────────
 *
 * Its constitutional meaning: *the reviewer accepts the terms, scope,
 * independence requirements and consequence boundaries governing review of a
 * specific experiment.*
 *
 * It does **not** grant review access. Access remains, exactly as before:
 *
 *     valid invitation ∩ reviewer-readable role ∩ experiment scope
 *
 * and is answered by `services/passport/participationAccess.ts`
 * (`diagnoseExperimentReviewAccess`). This agreement adds a strictly separate
 * conjunct:
 *
 *     reviewer consent ∩ review mandate ∩ declared independence
 *                      ∩ consequence boundaries
 *
 * Both are required to SUBMIT. Neither substitutes for the other, and neither
 * is derived from the other — that separation is the point. A reviewer who
 * holds access but has not accepted the mandate has not consented; a reviewer
 * who signed the mandate but lost access no longer reaches the evidence.
 *
 * ── WHY NOT `constitutional_agreements` ────────────────────────────────────
 *
 * `services/constitutional/constitutionalAgreement.ts` is a real, ratified
 * primitive and is NOT being forked — it binds
 * {operator · capability · SELECTED AGENT · delegated authority · settlement}
 * for *delegated execution by an agent*. A reviewer agreement binds a
 * different tuple: {reviewer principal · experiment · review package scope ·
 * independence · conflict disclosure · consequence boundaries}. There is no
 * `selectedAgentRef`, no `capabilityRef`, no delegated authority and no
 * settlement, and the fields the ruling REQUIRES this record to carry
 * (experiment id, package scope, conflict declaration, supersession state)
 * have nowhere to live in that shape. Bending one into the other would make
 * both illegible.
 *
 * What IS reused, deliberately: the x409 refusal idiom (409 + a structured,
 * actionable code rather than a generic failure), the one-way commitment
 * discipline for principals, the versioned-and-hashed terms, and the single
 * `createActivityReceipt` path. Same grammar, different sentence.
 *
 * ── THE AGREEMENT IS CODE, THE AUTHORIZATION IS DATA ───────────────────────
 *
 * The terms live HERE, in source, as a frozen versioned object with a content
 * hash derived from the terms themselves. That makes the artifact reusable
 * (every EXP-P1 reviewer authorizes the same v1, not a bespoke per-collaborator
 * console artifact), diffable in review, and impossible to edit silently — any
 * change to the text changes the hash, and a stored authorization that pins an
 * older hash stops satisfying the gate. Superseding is additive: v1's text and
 * every v1 authorization remain readable forever; v1 simply stops authorizing
 * NEW submissions once v2 is current.
 *
 * ── T0/T2 DISCIPLINE ───────────────────────────────────────────────────────
 *
 * The durable record stores `persona_id` because it is an owner-scoped
 * server-side authorization row — the same exposure class as `access_grants`,
 * which this sits beside and is queried the same way. What it NEVER stores or
 * emits is a raw persona id in any receipt, DVN payload or client response:
 * the receipt carries `personaPublicRef` (the sha256/16 governed-ecosystem
 * handle) exactly as the review pipeline already does.
 */

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { personaPublicRef } from '@/services/identity/personaReferences';

// ---------------------------------------------------------------------------
// The canonical artifact
// ---------------------------------------------------------------------------

export interface ReviewerAgreementClause {
  id: string;
  heading: string;
  body: string;
}

export interface ReviewerAgreementDefinition {
  agreementId: string;
  version: string;
  experimentId: string;
  displayLabel: string;
  /** Which review packages this agreement governs. `'*'` = every package for
   *  the experiment; a list pins specific ones. */
  packageScope: string[] | '*';
  effectiveFrom: string;
  /** The agreement this one supersedes, if any. Never deleted — see header. */
  supersedes: string | null;
  clauses: ReviewerAgreementClause[];
  /** Acts the signing reviewer is permitted. */
  permittedActs: string[];
  /** Acts the signing reviewer is explicitly refused — the consequence boundary. */
  prohibitedActs: string[];
}

/**
 * `agreement.exp-p1.independent-review.v1` — the canonical, reusable,
 * experiment-scoped reviewer agreement.
 *
 * Every clause below is load-bearing and was named in the ruling. Do not edit
 * this object to "fix" wording: any edit changes `agreementHash`, which
 * invalidates every stored v1 authorization. To change terms, add a v2 entry
 * and set `supersedes: 'agreement.exp-p1.independent-review.v1'`.
 */
export const EXP_P1_REVIEWER_AGREEMENT_V1: ReviewerAgreementDefinition = Object.freeze({
  agreementId: 'agreement.exp-p1.independent-review.v1',
  version: 'v1',
  experimentId: 'EXP-P1',
  displayLabel: 'EXP-P1 Independent Reviewer Agreement',
  packageScope: '*',
  effectiveFrom: '2026-08-02',
  supersedes: null,
  permittedActs: [
    'inspect the review package and its evidence',
    'comment on any record',
    'cite evidence',
    'recommend a disposition',
    'contest a finding',
    'mark a record unable-to-assess',
    'submit review findings attributable to you',
  ],
  prohibitedActs: [
    'freeze the crystal or any experiment artifact',
    'canonise, ratify or publish any finding',
    'alter any lifecycle state',
    'grant, alter or revoke Standing',
    'modify working materials or the review package itself',
  ],
  clauses: [
    {
      id: 'mandate',
      heading: 'Review mandate',
      body:
        'You are asked to review experiment EXP-P1 independently: to inspect the methods, ' +
        'run what you wish to run, and report where the work is wrong. You are not asked to ' +
        'agree with the conclusions, and nothing in this agreement obliges you to reach any ' +
        'particular finding.',
    },
    {
      id: 'non-ratification',
      heading: 'Findings are evidence, not ratification',
      body:
        'Your review findings enter the record as EVIDENCE. They do not ratify, canonise or ' +
        'freeze anything, and submitting them does not make them canon. Contested findings ' +
        'remain contested pending a governed resolution performed by an authorized steward or ' +
        'investigator — not by you, and not by the platform on your behalf.',
    },
    {
      id: 'consequence-boundary',
      heading: 'What you may not do',
      body:
        'This agreement does not grant, and must never be read to grant, authority to freeze ' +
        'the crystal, alter lifecycle state, publish, canonise, or grant Standing. Those are ' +
        'operator-governed acts. Authorizing this agreement changes nothing about who may ' +
        'perform them.',
    },
    {
      id: 'independence',
      heading: 'Independence',
      body:
        'You confirm that your review will be your own: that no party to this experiment has ' +
        'directed your findings, and that you are free to report adverse conclusions without ' +
        'consequence to your participation.',
    },
    {
      id: 'conflict',
      heading: 'Conflict disclosure',
      body:
        'You must disclose any interest that a reasonable reader would want to know when ' +
        'weighing your review — financial, professional, personal or institutional. Disclosure ' +
        'does not disqualify you; concealment invalidates the review. If a conflict arises after ' +
        'you authorize this agreement, you must disclose it and re-authorize.',
    },
    {
      id: 'evidence-handling',
      heading: 'Confidentiality and evidence handling',
      body:
        'Materials in the review package are shared with you for the purpose of this review. ' +
        'Treat unpublished material as confidential until it is published, and do not ' +
        'redistribute it outside the review. You may retain your own working notes.',
    },
    {
      id: 'submission',
      heading: 'Submission obligations',
      body:
        'A review you submit is attributable to you as the signing reviewer. Submit findings ' +
        'you are prepared to stand behind, mark anything you could not assess as ' +
        'unable-to-assess rather than guessing, and state the limits of what you examined.',
    },
    {
      id: 'supersession',
      heading: 'Version and renewal',
      body:
        'This agreement is versioned and content-hashed. If its terms change materially, a new ' +
        'version supersedes this one: your authorization of this version remains on the record ' +
        'and auditable, but new submissions will require authorizing the new version. An ' +
        'undisclosed conflict or a material change in the evidence may also require renewed ' +
        'authorization.',
    },
  ],
});

/** The registry. Add versions here; never edit a published one in place. */
export const REVIEWER_AGREEMENTS: readonly ReviewerAgreementDefinition[] = Object.freeze([
  EXP_P1_REVIEWER_AGREEMENT_V1,
]);

/**
 * Content hash of the agreement's TERMS — what a stored authorization pins.
 * Deliberately covers everything a reviewer consented TO (identity, scope,
 * clauses, and both act lists) and nothing incidental, so a wording change or
 * a widened permission changes the hash while a comment in this file does not.
 */
export function agreementHash(def: ReviewerAgreementDefinition): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        agreementId: def.agreementId,
        version: def.version,
        experimentId: def.experimentId,
        packageScope: def.packageScope,
        clauses: def.clauses,
        permittedActs: def.permittedActs,
        prohibitedActs: def.prohibitedActs,
      }),
    )
    .digest('hex');
}

/** The agreement currently governing new submissions for `experimentId`. */
export function currentReviewerAgreement(experimentId: string): ReviewerAgreementDefinition | null {
  const forExperiment = REVIEWER_AGREEMENTS.filter((a) => a.experimentId === experimentId);
  if (forExperiment.length === 0) return null;
  // The current one is the one nothing else supersedes.
  const superseded = new Set(forExperiment.map((a) => a.supersedes).filter(Boolean) as string[]);
  return forExperiment.find((a) => !superseded.has(a.agreementId)) ?? forExperiment[forExperiment.length - 1];
}

/** Does this agreement's package scope cover `packageRef`? */
export function agreementCoversPackage(def: ReviewerAgreementDefinition, packageRef: string | null): boolean {
  if (def.packageScope === '*') return true;
  if (!packageRef) return false;
  return def.packageScope.includes(packageRef);
}

// ---------------------------------------------------------------------------
// The durable authorization record
// ---------------------------------------------------------------------------

export interface ReviewerAgreementAuthorization {
  id: string;
  personaId: string;
  /** T2-safe governed-ecosystem handle — what receipts and payloads carry. */
  reviewerRef: string;
  passportRef: string | null;
  agreementId: string;
  agreementVersion: string;
  agreementHash: string;
  experimentId: string;
  packageScope: string[] | '*';
  conflictDeclared: boolean;
  conflictStatement: string | null;
  authorizedAt: string;
  proofRef: string | null;
  receiptId: string | null;
  /** 'active' | 'revoked' | 'superseded'. Rows are never deleted. */
  status: string;
}

const TABLE = 'reviewer_agreement_authorizations';

function rowToAuthorization(r: Record<string, unknown>): ReviewerAgreementAuthorization {
  const scope = r.package_scope as string[] | string | null;
  return {
    id: String(r.id),
    personaId: String(r.persona_id),
    reviewerRef: String(r.reviewer_ref),
    passportRef: (r.passport_ref as string | null) ?? null,
    agreementId: String(r.agreement_id),
    agreementVersion: String(r.agreement_version),
    agreementHash: String(r.agreement_hash),
    experimentId: String(r.experiment_id),
    packageScope: scope === '*' || scope === null ? '*' : (scope as string[]),
    conflictDeclared: !!r.conflict_declared,
    conflictStatement: (r.conflict_statement as string | null) ?? null,
    authorizedAt: String(r.authorized_at),
    proofRef: (r.proof_ref as string | null) ?? null,
    receiptId: (r.receipt_id as string | null) ?? null,
    status: String(r.status),
  };
}

// ---------------------------------------------------------------------------
// Authorize
// ---------------------------------------------------------------------------

export type AuthorizeReviewerAgreementResult =
  | { ok: true; authorization: ReviewerAgreementAuthorization; alreadyAuthorized: boolean }
  | { ok: false; reason: string };

/**
 * The reviewer's constitutional act. Idempotent per
 * (persona, agreement, hash) — re-authorizing an identical, still-active
 * agreement returns the existing row rather than stacking duplicates, so a
 * double-click cannot produce two consents to the same thing.
 *
 * DISPLAY IS NOT CONSENT: nothing here can be reached by rendering the
 * agreement. This runs only from an explicit POST carrying an explicit
 * acknowledgement and an explicit conflict declaration.
 */
export async function authorizeReviewerAgreement(
  admin: SupabaseClient,
  input: {
    personaId: string;
    passportRef?: string | null;
    definition: ReviewerAgreementDefinition;
    acknowledged: boolean;
    conflictDeclared: boolean;
    conflictStatement?: string | null;
    proofRef?: string | null;
  },
): Promise<AuthorizeReviewerAgreementResult> {
  if (!input.acknowledged) {
    return { ok: false, reason: 'The agreement must be explicitly acknowledged before it can be authorized.' };
  }
  if (input.conflictDeclared && !input.conflictStatement?.trim()) {
    return { ok: false, reason: 'A declared conflict requires a statement describing it.' };
  }

  const def = input.definition;
  const hash = agreementHash(def);
  const reviewerRef = personaPublicRef(input.personaId);

  // Idempotency — an existing ACTIVE authorization for this exact version+hash.
  const { data: existing } = await admin
    .from(TABLE)
    .select('*')
    .eq('persona_id', input.personaId)
    .eq('agreement_id', def.agreementId)
    .eq('agreement_hash', hash)
    .eq('status', 'active')
    .maybeSingle();
  if (existing) {
    return { ok: true, authorization: rowToAuthorization(existing), alreadyAuthorized: true };
  }

  // Receipt first (fail-soft): the row carries the receipt id when it lands.
  // T0 law — the summary names the T2 reviewerRef, never the persona id.
  let receiptId: string | null = null;
  try {
    const receipt = await createActivityReceipt({
      personaId: input.personaId,
      actionType: 'agreement_authorized',
      activeCartridge: 'metame',
      summary:
        `Independent Reviewer Agreement authorized: "${def.displayLabel}" ` +
        `[agr=${def.agreementId} v=${def.version} hash=${hash.slice(0, 12)}] ` +
        `experiment=${def.experimentId} reviewer=${reviewerRef} ` +
        `conflict=${input.conflictDeclared ? 'declared' : 'none-declared'} — ` +
        `authorizes review submission only; confers no freeze, publication, canonisation or Standing authority`,
      contextShared: ['agreement_id', 'experiment_id', 'conflict_declaration'],
      policyEnvelopeId: def.agreementId,
    });
    receiptId = receipt?.id ?? null;
  } catch {
    // A receipt failure never blocks the authorization — the row is canonical.
  }

  const { data, error } = await admin
    .from(TABLE)
    .insert({
      persona_id: input.personaId,
      reviewer_ref: reviewerRef,
      passport_ref: input.passportRef ?? null,
      agreement_id: def.agreementId,
      agreement_version: def.version,
      agreement_hash: hash,
      experiment_id: def.experimentId,
      package_scope: def.packageScope === '*' ? '*' : def.packageScope,
      conflict_declared: input.conflictDeclared,
      conflict_statement: input.conflictStatement?.trim() || null,
      proof_ref: input.proofRef ?? null,
      receipt_id: receiptId,
      status: 'active',
    })
    .select('*')
    .single();
  if (error || !data) {
    return { ok: false, reason: error?.message ?? 'Could not record the agreement authorization.' };
  }
  return { ok: true, authorization: rowToAuthorization(data), alreadyAuthorized: false };
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

export const REVIEWER_AGREEMENT_REQUIRED = 'REVIEWER_AGREEMENT_REQUIRED';

export type ReviewerAgreementGateFailure =
  | 'no-authorization'
  | 'version-superseded'
  | 'hash-mismatch'
  | 'package-scope'
  | 'revoked'
  | 'no-agreement-defined'
  | 'unavailable';

/**
 * CONSENT AUTHORIZES EXACT TERMS, NOT A MUTABLE AGREEMENT IDENTITY.
 *
 *   > "Any material change invalidates inherited authorization until the new
 *   > terms are expressly accepted." — operator ruling, 2026-08-02
 *
 * This is why `agreement_hash` is PINNED on the row at authorization time
 * rather than looked up fresh. A reviewer does not consent to "the EXP-P1
 * reviewer agreement" as a name that may later mean something else; they
 * consent to the exact clauses they read. When the canonical terms change, the
 * recomputed hash stops matching every stored row, and every inherited
 * authorization lapses until re-accepted — automatically, with no cleanup step
 * anyone could forget to run.
 *
 * The principle generalises beyond EXP-P1: delegation, partner agreements,
 * agent mandates, data-use permissions and money-moving authority all carry
 * the same hazard, and the same fix.
 *
 * A NOTE ON WORDING: the reviewer is not "signing a row". They authorize a
 * canonical agreement VERSION; the row is the auditable evidence that they did.
 * Any surface that describes the row as the object of consent has inverted the
 * relationship.
 */
export const CONSENT_BINDS_EXACT_TERMS =
  'Consent authorizes exact terms, not a mutable agreement identity. Any material change ' +
  'invalidates inherited authorization until the new terms are expressly accepted.';

/**
 * The reviewer-facing status of one agreement, for the human panel AND the
 * agent package — ONE projection, so the two can never disagree about whether
 * a reviewer is authorized.
 *
 * `authorizationStatus` deliberately has five values, not two. "You have not
 * authorized this", "your authorization was withdrawn", "the terms changed
 * since you authorized", and "we could not check" call for four different
 * things from the reviewer, and collapsing them into `false` tells them to do
 * the wrong one — or, in the `unavailable` case, tells them something untrue.
 */
export type ReviewerAgreementAuthorizationStatus =
  | 'authorized'
  | 'not-authorized'
  | 'revoked'
  | 'superseded'
  | 'unavailable';

export interface ReviewerAgreementStatus {
  agreementId: string | null;
  version: string | null;
  /** sha256 of the CURRENT canonical terms — what a fresh authorization pins. */
  canonicalHash: string | null;
  authorizationStatus: ReviewerAgreementAuthorizationStatus;
  /** The hash pinned on the reviewer's own row, when one exists. */
  authorizedHash: string | null;
  /** `authorizedHash === canonicalHash`. Null when there is nothing to compare. */
  hashMatch: boolean | null;
  /**
   * True when a stored authorization exists but no longer authorizes — the
   * terms moved, or it was withdrawn. Distinct from never having authorized:
   * the reviewer must be told the terms CHANGED, not merely asked again.
   */
  requiresReauthorization: boolean;
  authorizedAt: string | null;
  conflictDeclared: boolean | null;
  /** Human-readable, addressed to the reviewer. Never a raw failure code. */
  message: string;
}

export interface ReviewerAgreementGateResult {
  ok: boolean;
  /** Present when `ok` is false — why, structurally. */
  failure?: ReviewerAgreementGateFailure;
  /** The structured, actionable 409 body the ruling specifies. */
  refusal?: {
    code: typeof REVIEWER_AGREEMENT_REQUIRED;
    experimentId: string;
    agreementId: string | null;
    agreementVersion: string | null;
    requiredAction: 'AUTHORIZE_REVIEWER_AGREEMENT';
    reason: ReviewerAgreementGateFailure;
  };
  authorization?: ReviewerAgreementAuthorization;
}

/**
 * `collaborationAgreementAuthorized`, derived — never a UI boolean.
 *
 * True only when the caller's own ACTIVE authorization matches, all five
 * conjuncts at once:
 *
 *   active reviewer principal  ∩  experiment  ∩  agreement id+version
 *                              ∩  current terms hash  ∩  package scope
 *
 * A historical authorization for another experiment, another reviewer, or a
 * materially changed (re-hashed) version does not satisfy it — which is the
 * whole reason the hash is pinned on the row rather than looked up fresh.
 *
 * Fails CLOSED but distinguishes 'unavailable' from a real refusal, so a store
 * outage never renders as "you did not sign this".
 */
export async function requireReviewerAgreement(
  admin: SupabaseClient,
  input: { personaId: string; experimentId: string; packageRef?: string | null },
): Promise<ReviewerAgreementGateResult> {
  const def = currentReviewerAgreement(input.experimentId);
  const refuse = (reason: ReviewerAgreementGateFailure): ReviewerAgreementGateResult => ({
    ok: false,
    failure: reason,
    refusal: {
      code: REVIEWER_AGREEMENT_REQUIRED,
      experimentId: input.experimentId,
      agreementId: def?.agreementId ?? null,
      agreementVersion: def?.version ?? null,
      requiredAction: 'AUTHORIZE_REVIEWER_AGREEMENT',
      reason,
    },
  });

  if (!def) return refuse('no-agreement-defined');

  const expectedHash = agreementHash(def);
  const { data, error } = await admin
    .from(TABLE)
    .select('*')
    .eq('persona_id', input.personaId)
    .eq('experiment_id', input.experimentId)
    .eq('status', 'active')
    .order('authorized_at', { ascending: false });

  if (error) return refuse('unavailable');
  const rows = (data ?? []).map(rowToAuthorization);
  if (rows.length === 0) return refuse('no-authorization');

  const forThisAgreement = rows.filter((r) => r.agreementId === def.agreementId);
  if (forThisAgreement.length === 0) return refuse('version-superseded');

  const matchingHash = forThisAgreement.find((r) => r.agreementHash === expectedHash);
  if (!matchingHash) return refuse('hash-mismatch');

  if (!agreementCoversPackage(def, input.packageRef ?? null)) return refuse('package-scope');
  if (
    matchingHash.packageScope !== '*' &&
    input.packageRef &&
    !matchingHash.packageScope.includes(input.packageRef)
  ) {
    return refuse('package-scope');
  }

  return { ok: true, authorization: matchingHash };
}

/**
 * The full status of the caller's agreement standing — the ONE projection both
 * the human panel and the agent JSON render.
 *
 * Built from the same `requireReviewerAgreement` gate that admits or refuses a
 * submission, so the badge a reviewer reads and the decision the server makes
 * cannot disagree. A second, independently-computed status object is exactly
 * the drift `inv.engineering.036` names.
 */
export async function reviewerAgreementStatus(
  admin: SupabaseClient,
  input: { personaId: string; experimentId: string; packageRef?: string | null },
): Promise<ReviewerAgreementStatus> {
  const def = currentReviewerAgreement(input.experimentId);
  const canonicalHash = def ? agreementHash(def) : null;
  const base = {
    agreementId: def?.agreementId ?? null,
    version: def?.version ?? null,
    canonicalHash,
  };

  const gate = await requireReviewerAgreement(admin, input);
  if (gate.ok && gate.authorization) {
    return {
      ...base,
      authorizationStatus: 'authorized',
      authorizedHash: gate.authorization.agreementHash,
      hashMatch: gate.authorization.agreementHash === canonicalHash,
      requiresReauthorization: false,
      authorizedAt: gate.authorization.authorizedAt,
      conflictDeclared: gate.authorization.conflictDeclared,
      message: 'You have authorized the current version of this agreement.',
    };
  }

  // Not authorized. WHY matters — see the five-value note on the type.
  if (gate.failure === 'unavailable') {
    return {
      ...base,
      authorizationStatus: 'unavailable',
      authorizedHash: null,
      hashMatch: null,
      // Unknown is not "no". Telling a reviewer to re-authorize because we
      // could not read the record would ask them to redo a completed act.
      requiresReauthorization: false,
      authorizedAt: null,
      conflictDeclared: null,
      message:
        'Your agreement status could not be checked just now. This does not affect any authorization you have already given.',
    };
  }

  // Look for a prior row, INCLUDING inactive ones — that is the difference
  // between "never authorized" and "authorized, and it no longer holds".
  const prior = await findLatestAuthorizationAnyStatus(admin, input.personaId, input.experimentId);

  if (gate.failure === 'hash-mismatch' || (prior && prior.status === 'superseded')) {
    return {
      ...base,
      authorizationStatus: 'superseded',
      authorizedHash: prior?.agreementHash ?? null,
      hashMatch: false,
      requiresReauthorization: true,
      authorizedAt: prior?.authorizedAt ?? null,
      conflictDeclared: prior?.conflictDeclared ?? null,
      message:
        'The terms of this agreement have changed since you authorized it. Your earlier authorization remains on record, ' +
        'but it does not carry over — please read and authorize the current version.',
    };
  }

  if (prior && prior.status === 'revoked') {
    return {
      ...base,
      authorizationStatus: 'revoked',
      authorizedHash: prior.agreementHash,
      hashMatch: prior.agreementHash === canonicalHash,
      requiresReauthorization: true,
      authorizedAt: prior.authorizedAt,
      conflictDeclared: prior.conflictDeclared,
      message: 'Your authorization for this agreement has been withdrawn. Authorize the current version to submit a review.',
    };
  }

  return {
    ...base,
    authorizationStatus: 'not-authorized',
    authorizedHash: null,
    hashMatch: null,
    requiresReauthorization: false,
    authorizedAt: null,
    conflictDeclared: null,
    message: def
      ? 'Read and authorize this agreement to submit a review.'
      : 'No reviewer agreement is defined for this experiment.',
  };
}

/**
 * The most recent authorization of ANY status.
 *
 * `requireReviewerAgreement` filters to `status = 'active'`, which is right for
 * a gate — a revoked row must never admit anyone. But it means the gate cannot
 * tell "never authorized" from "authorized and revoked", and those need
 * opposite words to the reviewer. This read exists only to make that
 * distinction; it never grants anything.
 */
async function findLatestAuthorizationAnyStatus(
  admin: SupabaseClient,
  personaId: string,
  experimentId: string,
): Promise<ReviewerAgreementAuthorization | null> {
  const { data, error } = await admin
    .from(TABLE)
    .select('*')
    .eq('persona_id', personaId)
    .eq('experiment_id', experimentId)
    .order('authorized_at', { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return rowToAuthorization(data[0] as Record<string, unknown>);
}

/** The plain boolean the journey's completion evidence consumes. */
export async function isReviewerAgreementAuthorized(
  admin: SupabaseClient,
  personaId: string,
  experimentId: string,
): Promise<boolean> {
  return (await requireReviewerAgreement(admin, { personaId, experimentId })).ok;
}
