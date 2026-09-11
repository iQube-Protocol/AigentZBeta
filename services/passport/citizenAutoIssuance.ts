/**
 * Citizen Passport — automatic recognition decision engine (P1).
 *
 * Operator ruling, 2026-08-21: "The system should establish whether the
 * required proof is satisfied. When it is, recognition follows. Human
 * review is for ambiguity and failure cases, not discretionary admission."
 *
 * Canonical order (operator brief §11 — never violate this order):
 *   application → evidence evaluation → issuance/review decision →
 *   state transition → receipt → admin notification.
 * This module performs the first three steps by calling INTO
 * services/passport/issuanceService.ts (never reimplementing its DB writes)
 * and only records an admin action AFTER the decision is settled — it never
 * decides anything from inside a notification handler.
 *
 * The four event classes (operator brief §5):
 *   A. New application received       → informational (recorded first, always)
 *   B. Citizen auto-issued             → informational
 *   C. Citizen requires review         → action_required (evidence exception)
 *   D. Issuance failed                 → action_required (infra exception,
 *                                         NOT an applicant rejection)
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { applyReviewDecision, PASSPORT_BUREAU_CARTRIDGE_SLUG } from '@/services/passport/issuanceService';
import { evaluateCitizenEvidenceCompleteness } from '@/services/passport/citizenPassportRequirements';
import type { PolityPassportApplicationRow } from '@/services/passport/passportApplicationTypes';
import {
  recordAdminAction,
  resolveOpenActionsForSource,
} from '@/services/adminActions/adminActionService';
import {
  passportAutoIssuedKey,
  passportIssuanceFailedKey,
  passportNewApplicationKey,
  passportReviewRequiredKey,
} from '@/services/adminActions/idempotencyKeys';

const SYSTEM_ACTOR_ID = process.env.PASSPORT_BUREAU_SYSTEM_PERSONA_ID || 'system';

export type CitizenAutoIssuanceOutcome =
  | { issued: true; passportId: string }
  | { issued: false; reason: 'not_applicable' | 'evidence_incomplete' | 'issuance_failed' };

/**
 * Deep link into the EXISTING Passport Bureau steward surface (codex slug
 * `polity-passport-bureau`, tab slug `steward` — data/codex-configs.ts
 * :5150,5259) — never a new queue. `PassportBureauStewardTab` resolves the
 * application itself from its own `/api/passport/review/queue` fetch; this
 * only needs to land the steward on the right cartridge tab.
 *
 * Relative + no identity params by design (CLAUDE.md "Inter-Cartridge
 * Navigation" rule): this row is written before any specific admin viewer
 * is known, so it cannot carry a personaId. Whatever surface RENDERS this
 * href — the Bureau tab's own badge, a future Action Centre view — MUST run
 * it through `buildCodexUrl`-style persona enrichment (utils/codex-nav.ts)
 * with the VIEWING admin's own personaId before using it as a link; this
 * stored value is a navigational target, not a ready-to-click URL.
 */
function reviewApplicationHref(applicationId: string): string {
  return `/triad/embed/codex/polity-passport-bureau?tab=steward&applicationId=${encodeURIComponent(applicationId)}`;
}

/**
 * Record the verification_unavailable exception — the single handler for
 * EVERY way a Supabase read can fail to answer authoritatively: a THROWN
 * exception, and the ordinary non-throwing `{ data: null, error }` result
 * Supabase calls resolve with far more often than they throw. Both call
 * sites below (the application fetch, the conflict/active-Passport checks)
 * must treat both failure shapes identically — a `{ data: null, error }`
 * result is not "no data", it is "the read did not happen," and reading
 * `data` as if it answered anything is the exact defect this function
 * exists to prevent (corrective audit, 2026-08-21).
 */
async function recordVerificationUnavailable(applicationId: string, detail: string): Promise<void> {
  await recordAdminAction({
    idempotencyKey: passportReviewRequiredKey(applicationId, 'verification_unavailable'),
    category: 'passport',
    severity: 'attention',
    disposition: 'action_required',
    title: 'Citizen Passport application requires review',
    summary: 'Automatic recognition could not complete: verification was unavailable.',
    sourceType: 'passport_application',
    sourceRef: applicationId,
    sourceSurface: PASSPORT_BUREAU_CARTRIDGE_SLUG,
    actionType: 'review_application',
    actionHref: reviewApplicationHref(applicationId),
    metadata: { reasonCode: 'verification_unavailable', detail },
  });
}

/**
 * Attempt automatic recognition for one Citizen application. Idempotent and
 * safe to call more than once for the same applicationId — the idempotency
 * keys ensure a retry never produces a duplicate admin action, and this
 * function no-ops (returns `not_applicable`) once the application has left
 * the 'submitted' state (it already went through this path, or a steward
 * already decided it).
 */
export async function attemptCitizenAutoIssuance(
  applicationId: string,
): Promise<CitizenAutoIssuanceOutcome> {
  const admin = getSupabaseServer();
  if (!admin) return { issued: false, reason: 'not_applicable' };

  let app: unknown = null;
  let appError: { message: string } | null = null;
  try {
    const fetched = await admin
      .from('polity_passport_applications')
      .select(
        'id, passport_class, application_status, persona_id, personhood_proof_type, personhood_proof_ref, consents, review_priority, passport_grade',
      )
      .eq('id', applicationId)
      .maybeSingle();
    app = fetched.data;
    appError = fetched.error;
  } catch (e) {
    // A THROWN failure — handled identically to the ordinary {error} result
    // checked immediately below; Supabase calls generally resolve with
    // { data, error } rather than throwing, so both shapes must route here.
    await recordVerificationUnavailable(applicationId, e instanceof Error ? e.message : String(e));
    return { issued: false, reason: 'evidence_incomplete' };
  }

  // CORRECTIVE AUDIT (2026-08-21): `appError` must NEVER be folded into the
  // same branch as `!app`. A database failure ({ data: null, error }) is an
  // infrastructure exception — the read did not happen, so nothing about
  // the application is known. `!app` with NO error is the genuinely
  // different case: the read succeeded and there is no such row. Treating
  // "the query failed" as "the record doesn't exist" would silently
  // discard a live outage with no admin action recorded at all.
  if (appError) {
    await recordVerificationUnavailable(applicationId, appError.message);
    return { issued: false, reason: 'evidence_incomplete' };
  }

  // Event class A — new application received. Recorded unconditionally,
  // before evaluation, regardless of outcome — this is a "something
  // happened" signal, not a judgment. If there is genuinely no such
  // application, there is nothing to describe yet; skip A rather than
  // record a lie.
  if (app) {
    await recordAdminAction({
      idempotencyKey: passportNewApplicationKey(applicationId),
      category: 'passport',
      severity: 'info',
      disposition: 'informational',
      title: 'New Citizen Passport application received',
      summary: 'A citizen submitted a Passport application.',
      sourceType: 'passport_application',
      sourceRef: applicationId,
      sourceSurface: PASSPORT_BUREAU_CARTRIDGE_SLUG,
      actionType: 'view_application',
      actionHref: reviewApplicationHref(applicationId),
    });
  } else {
    return { issued: false, reason: 'not_applicable' };
  }
  const row = app as PolityPassportApplicationRow;
  if (row.passport_class !== 'citizen' || row.application_status !== 'submitted') {
    return { issued: false, reason: 'not_applicable' };
  }

  let conflictingOpenApplicationExists = false;
  let activeCitizenPassportExists = false;
  try {
    const [openResult, activeResult] = await Promise.all([
      admin
        .from('polity_passport_applications')
        .select('id')
        .eq('persona_id', row.persona_id ?? '')
        .eq('passport_class', 'citizen')
        .neq('id', applicationId)
        .in('application_status', ['submitted', 'pending_approval', 'needs_more_information'])
        .limit(1),
      admin
        .from('polity_passport_records')
        .select('passport_id')
        .eq('persona_id', row.persona_id ?? '')
        .eq('passport_class', 'citizen')
        .in('citizen_status', ['active', 'renewal_due'])
        .limit(1),
    ]);
    // CORRECTIVE AUDIT (2026-08-21): capture the FULL { data, error } result
    // from each query and check error explicitly before deriving anything
    // from data. `data: null` alongside an error is NOT "no conflicting
    // application" / "no active Passport" — it is "this query did not run,"
    // and deriving `Boolean(null && ...)` → false from it would silently
    // treat a database failure as a clean absence-of-conflict finding,
    // exactly the defect this audit exists to close.
    if (openResult.error || activeResult.error) {
      await recordVerificationUnavailable(
        applicationId,
        openResult.error?.message ?? activeResult.error?.message ?? 'unknown error',
      );
      return { issued: false, reason: 'evidence_incomplete' };
    }
    conflictingOpenApplicationExists = Boolean(openResult.data && openResult.data.length > 0);
    activeCitizenPassportExists = Boolean(activeResult.data && activeResult.data.length > 0);
  } catch (e) {
    // A THROWN failure — handled identically to the ordinary {error} result
    // checked above.
    await recordVerificationUnavailable(applicationId, e instanceof Error ? e.message : String(e));
    return { issued: false, reason: 'evidence_incomplete' };
  }

  const evaluation = evaluateCitizenEvidenceCompleteness(row, {
    conflictingOpenApplicationExists,
    activeCitizenPassportExists,
  });

  if (!evaluation.complete) {
    // Event class C — requires review. The application_status is left
    // untouched ('submitted') — it stays exactly where the existing steward
    // queue already looks for it; nothing about the queue shape changes.
    await recordAdminAction({
      idempotencyKey: passportReviewRequiredKey(applicationId, evaluation.reasonCode),
      category: 'passport',
      severity: 'attention',
      disposition: 'action_required',
      title: 'Citizen Passport application requires review',
      summary: evaluation.detail,
      sourceType: 'passport_application',
      sourceRef: applicationId,
      sourceSurface: PASSPORT_BUREAU_CARTRIDGE_SLUG,
      actionType: 'review_application',
      actionHref: reviewApplicationHref(applicationId),
      metadata: { reasonCode: evaluation.reasonCode, schemaReasonCodes: evaluation.schemaReasonCodes },
    });
    return { issued: false, reason: 'evidence_incomplete' };
  }

  // Evidence complete — system transition to active.
  const result = await applyReviewDecision({
    applicationId,
    decision: 'approve',
    stewardPersonaId: SYSTEM_ACTOR_ID,
    actorType: 'system',
    notes: `Auto-issued: ${evaluation.schemaReasonCodes.join(', ')}`,
  });

  if (!result.ok || !result.passportId) {
    // Event class D — issuance failed AFTER evidence was found complete.
    // This is an operational failure, never an applicant rejection — the
    // applicant remains 'submitted' and eligible; nothing here denies them.
    await recordAdminAction({
      idempotencyKey: passportIssuanceFailedKey(applicationId, 'issuance_transition_failed'),
      category: 'passport',
      severity: 'urgent',
      disposition: 'action_required',
      title: 'Citizen Passport issuance failed after evidence completion',
      summary: result.error ?? 'Issuance transition failed for an unknown reason.',
      sourceType: 'passport_application',
      sourceRef: applicationId,
      sourceSurface: PASSPORT_BUREAU_CARTRIDGE_SLUG,
      actionType: 'review_application',
      actionHref: reviewApplicationHref(applicationId),
      metadata: { reasonCode: 'issuance_transition_failed', detail: result.error },
    });
    return { issued: false, reason: 'issuance_failed' };
  }

  // A human decision on a Citizen application resolves whatever
  // action_required item drew a steward's attention to it in the first
  // place — an issued passport supersedes any earlier review-required
  // exception regardless of which branch below fires next.
  await resolveOpenActionsForSource('passport_application', applicationId, SYSTEM_ACTOR_ID);

  if (!result.receiptId) {
    // The passport IS issued — the state transition succeeded and the
    // citizen holds a real, active passport; that constitutional act must
    // never be reverted because provenance tooling hiccuped (the receipt is
    // a view into what happened, not the source of truth for it — operator
    // brief §10). But writeReceipt() returning null means
    // createActivityReceipt() itself threw, which is a genuine operational
    // failure in the provenance/DVN-anchoring chain (CLAUDE.md's "DVN
    // Pipeline Protection" section: a receipt gap must never be silent).
    // Recording this as a clean informational "issued automatically" would
    // hide exactly that failure — so it is action_required instead, even
    // though issuance itself succeeded.
    await recordAdminAction({
      idempotencyKey: passportIssuanceFailedKey(applicationId, 'receipt_write_failed'),
      category: 'passport',
      severity: 'urgent',
      disposition: 'action_required',
      title: 'Citizen Passport issued, but its receipt failed to write',
      summary: `Passport ${result.passportId} was issued; the provenance receipt failed and needs manual reconciliation.`,
      sourceType: 'passport_application',
      sourceRef: applicationId,
      sourceSurface: PASSPORT_BUREAU_CARTRIDGE_SLUG,
      actionType: 'review_application',
      actionHref: reviewApplicationHref(applicationId),
      metadata: { reasonCode: 'receipt_write_failed', passportId: result.passportId },
    });
    return { issued: true, passportId: result.passportId };
  }

  // Event class B — auto-issued. Informational: no admin action is needed,
  // only awareness.
  await recordAdminAction({
    idempotencyKey: passportAutoIssuedKey(applicationId),
    category: 'passport',
    severity: 'info',
    disposition: 'informational',
    title: 'Citizen Passport issued automatically',
    summary: `Passport ${result.passportId} issued — mandatory evidence was satisfied.`,
    sourceType: 'passport_application',
    sourceRef: applicationId,
    sourceSurface: PASSPORT_BUREAU_CARTRIDGE_SLUG,
    actionType: 'view_application',
    actionHref: reviewApplicationHref(applicationId),
    metadata: { passportId: result.passportId, schemaReasonCodes: evaluation.schemaReasonCodes },
  });

  return { issued: true, passportId: result.passportId };
}
