/**
 * Crystal v2 targeted acquisition — the durable "has a steward authorized
 * this" fact, and the ONE bounded step a Copilot-driven acquisition run
 * performs per invocation (operator directive, 2026-08-30, "turn Discover
 * Sources into a precise Copilot authorization, not another navigation
 * exercise").
 *
 * ── WHY THIS IS SEPARATE FROM `researchProgrammeOrchestrator.ts`'S LOOP ────
 *
 * That module's own header already recorded, before this file existed, why
 * `discover-sources` stays OUT of the closed `PROGRAMME_ACT_KINDS` catalogue:
 * it issues sequential external HTTP requests to ratified institutions —
 * "unbounded wall-clock against third-party sites inside one request, which
 * is the one shape a bounded loop cannot bound" — and belongs in "its own
 * deliberate act, not as a side effect of adding a loop." This module IS
 * that deliberate act: it never joins `PROGRAMME_ACT_KINDS`, never touches
 * `IsolationStage`, and never runs inside `advanceResearchProgramme`'s own
 * while-loop. It is driven by the CLIENT the same way "Run until you need
 * me" already is (services/research/researchProgrammeOrchestrator.ts's own
 * consumer, `IRLResearchCopilotTab.tsx`, already calls `/advance` repeatedly
 * until a stop) — each call here processes AT MOST ONE ratified+verified
 * institution, bounded exactly like `MAX_RECORDS_PER_ACT` bounds a record
 * batch: sorted deterministically, one unit of work, nothing left half-done.
 *
 * ── THE DURABLE FACT, NOT A CACHED DECISION ────────────────────────────────
 *
 * Per this repo's own established discipline (services/research/
 * track2Programme.ts, services/threshold/constitutionalNavigator.ts —
 * "never persist a derived decision; persist the underlying facts and let
 * the decision re-derive"), `crystal_acquisition_approvals` stores ONLY the
 * fact that a steward approved targeted acquisition, and a snapshot of what
 * was targeted at that moment for the receipt's own record. Whether
 * acquisition is STILL needed is always re-derived fresh from live readiness
 * (`acquisitionBriefApplies`), never read off this table.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getDomainConstitution } from '@/services/corpusScout/domainConstitution';
import {
  canRunInstitutionDiscovery,
  runVerificationStep,
  type VerificationStepResult,
} from '@/services/corpusScout/registryVerification';
import { runDiscoveryForInstitution, type InstitutionDiscoveryRunResult } from '@/services/corpusScout/discoveryOrchestrator';
import { listCandidateSources } from '@/services/corpusScout/provenance';
import { writeLifecycleReceipt } from '@/services/research/lifecycle';
import type { CrystalAcquisitionBrief } from '@/services/research/crystalAcquisitionBrief';

const TABLE = 'crystal_acquisition_approvals';

/** The full disposition vocabulary for a targeted-acquisition proposal
 *  (2026-09-05, complete human proposal-decision contract): 'approved'
 *  authorizes; 'declined' and 'revision_requested' close the proposal
 *  WITHOUT authorizing it — neither ever satisfies `getActiveAcquisitionApproval`,
 *  which still matches only 'approved'. 'completed'/'superseded' are the
 *  existing post-approval lifecycle states, unchanged. */
export type AcquisitionDispositionStatus =
  | 'approved'
  | 'completed'
  | 'superseded'
  | 'declined'
  | 'revision_requested';

export interface AcquisitionApprovalRow {
  id: string;
  experimentId: string;
  acquisitionDomain: string;
  crystalDomain: string;
  status: AcquisitionDispositionStatus;
  targetSnapshot: {
    requiredNetNewDistinctMembers: number;
    missingNamespaces: readonly string[];
    deficientRelationalStructures: readonly string[];
    sourceAdmissibilityConstraints: readonly string[];
  };
  /** The durable identity beyond experiment+domain (2026-08-31 state-machine
   *  repair): the crystal generation this approval targeted, and a content
   *  hash of the brief (`hashAcquisitionBrief`). A row predating this fix
   *  carries `''` for both — never a false match against a freshly computed
   *  hash (see the migration's own backfill note). */
  crystalGeneration: string;
  briefHash: string;
  /** The persona who recorded THIS disposition — the approver for
   *  'approved' rows, the decliner/reviser for 'declined'/'revision_requested'
   *  rows (same column, reused: it is always "who made this disposition"). */
  approvedByPersonaId: string;
  approvedAt: string;
  completedAt: string | null;
  receiptId: string | null;
  /** Operator rationale (decline) or direction (revision request), recorded
   *  2026-09-05. `null` for 'approved'/'completed'/'superseded' rows. */
  rationale: string | null;
}

function rowToApproval(r: Record<string, unknown>): AcquisitionApprovalRow {
  return {
    id: String(r.id),
    experimentId: String(r.experiment_id),
    acquisitionDomain: String(r.acquisition_domain),
    crystalDomain: String(r.crystal_domain),
    status: r.status as AcquisitionApprovalRow['status'],
    targetSnapshot: r.target_snapshot as AcquisitionApprovalRow['targetSnapshot'],
    crystalGeneration: String(r.crystal_generation ?? ''),
    briefHash: String(r.brief_hash ?? ''),
    approvedByPersonaId: String(r.approved_by_persona_id),
    approvedAt: String(r.approved_at),
    completedAt: (r.completed_at as string | null) ?? null,
    receiptId: (r.receipt_id as string | null) ?? null,
    rationale: (r.rationale as string | null) ?? null,
  };
}

/** The one active (status='approved') approval for this experiment+domain, or
 *  `null` when none exists — the fact every gate/CTA reads. Never more than
 *  one row is 'approved' at a time for the same pair (enforced in
 *  `approveAcquisitionJob`, not by a DB constraint, mirroring this codebase's
 *  existing convention for similar single-active-row invariants). */
export async function getActiveAcquisitionApproval(
  admin: SupabaseClient,
  experimentId: string,
  acquisitionDomain: string,
): Promise<AcquisitionApprovalRow | null> {
  const { data, error } = await admin
    .from(TABLE)
    .select('*')
    .eq('experiment_id', experimentId)
    .eq('acquisition_domain', acquisitionDomain)
    .eq('status', 'approved')
    .order('approved_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return rowToApproval(data as Record<string, unknown>);
}

/** The MOST RECENT disposition of ANY kind (approved, completed, superseded,
 *  declined, revision_requested) for this experiment+domain — used to
 *  recognise a decline/revision-request against the EXACT brief it targeted
 *  (2026-09-05, complete human proposal-decision contract). A row here whose
 *  `crystalGeneration`+`briefHash` no longer matches a freshly computed brief
 *  is a disposition of a DIFFERENT (now-stale) proposal — the caller's own
 *  comparison, never assumed here, is what makes a materially changed
 *  proposal require a fresh human decision (requirement: never silently
 *  reapplying an old disposition to a new hash). */
export async function getLatestAcquisitionDisposition(
  admin: SupabaseClient,
  experimentId: string,
  acquisitionDomain: string,
): Promise<AcquisitionApprovalRow | null> {
  const { data, error } = await admin
    .from(TABLE)
    .select('*')
    .eq('experiment_id', experimentId)
    .eq('acquisition_domain', acquisitionDomain)
    .order('approved_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return rowToApproval(data as Record<string, unknown>);
}

/**
 * THE OTHER TWO HUMAN DISPOSITIONS of a proposed targeted-acquisition plan —
 * Decline and Revise (2026-09-05, "complete human proposal-decision contract"
 * fix: the card previously exposed ONLY Approve, leaving navigating away as
 * the operator's only other option, which recorded nothing). Mirrors
 * `approveAcquisitionJob` in shape — one inserted row, receipted through the
 * SAME `writeLifecycleReceipt` path — but writes a status
 * `getActiveAcquisitionApproval` never matches, so neither disposition can
 * ever be mistaken for an authorization to run acquisition. Declining or
 * requesting revision NEVER marks any readiness/scientific check satisfied:
 * `crystalReadiness` re-derives independently of this table, exactly like
 * `approveAcquisitionJob`'s own header already establishes for approval.
 *
 * Does not supersede prior 'approved' rows (unlike `approveAcquisitionJob`) —
 * a decline/revision-request is not itself an authorization change; if an
 * approval is genuinely active for this SAME brief, the caller (the route)
 * refuses before ever reaching this function.
 */
export async function recordAcquisitionDisposition(
  admin: SupabaseClient,
  input: {
    experimentId: string;
    acquisitionDomain: string;
    crystalDomain: string;
    disposition: 'declined' | 'revision_requested';
    decidedByPersonaId: string;
    brief: CrystalAcquisitionBrief;
    briefHash: string;
    rationale: string | null;
  },
): Promise<{ ok: true; approval: AcquisitionApprovalRow } | { ok: false; error: string }> {
  const targetSnapshot = {
    requiredNetNewDistinctMembers: input.brief.requiredNetNewDistinctMembers,
    missingNamespaces: input.brief.missingNamespaces,
    deficientRelationalStructures: input.brief.deficientRelationalStructures,
    sourceAdmissibilityConstraints: input.brief.sourceAdmissibilityConstraints,
  };

  const { data, error } = await admin
    .from(TABLE)
    .insert({
      experiment_id: input.experimentId,
      acquisition_domain: input.acquisitionDomain,
      crystal_domain: input.crystalDomain,
      status: input.disposition,
      target_snapshot: targetSnapshot,
      crystal_generation: input.brief.crystalGeneration,
      brief_hash: input.briefHash,
      approved_by_persona_id: input.decidedByPersonaId,
      rationale: input.rationale,
    })
    .select('*')
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? `${input.disposition} could not be written` };
  }

  const verb = input.disposition === 'declined' ? 'declined' : 'sent back for revision on';
  const receipt = await writeLifecycleReceipt({
    personaId: input.decidedByPersonaId,
    summary:
      `Targeted acquisition proposal ${verb} experiment ${input.experimentId} (${input.crystalDomain}): ` +
      `${targetSnapshot.requiredNetNewDistinctMembers} additional distinct member(s), ` +
      `${targetSnapshot.missingNamespaces.length} namespace(s) unrepresented ` +
      `(${targetSnapshot.missingNamespaces.join(', ') || 'none named'}). Domain '${input.acquisitionDomain}'. ` +
      (input.rationale ? `Operator direction: ${input.rationale}. ` : '') +
      'No source added, no statement authored, no boundary changed, no readiness/scientific check marked ' +
      'satisfied by this act — it closes the proposal, it does not authorize anything.',
    invariantSeedIds: [],
  }).catch(() => ({ ok: false, receiptId: null }));

  if (receipt.receiptId) {
    await admin.from(TABLE).update({ receipt_id: receipt.receiptId }).eq('id', data.id);
  }

  return {
    ok: true,
    approval: rowToApproval({ ...(data as Record<string, unknown>), receipt_id: receipt.receiptId }),
  };
}

/**
 * THE HUMAN ACT — a steward approves the targeted acquisition plan the brief
 * already computed. Supersedes any prior 'approved' row for the same
 * experiment+domain first (never two simultaneously active), then inserts
 * the new one and receipts it through the SAME `writeLifecycleReceipt` every
 * other governed Track 2 act rides — never a second receipt path.
 */
export async function approveAcquisitionJob(
  admin: SupabaseClient,
  input: {
    experimentId: string;
    acquisitionDomain: string;
    crystalDomain: string;
    approvedByPersonaId: string;
    brief: CrystalAcquisitionBrief;
    /** hashAcquisitionBrief(brief) — computed by the caller (the route
     *  already needs it for the idempotency check before deciding to call
     *  this at all) rather than re-derived here, so the hash the route
     *  compared against is EXACTLY the hash persisted (inv.engineering.036/
     *  037: never a second, possibly-diverging computation of the same
     *  value). */
    briefHash: string;
  },
): Promise<{ ok: true; approval: AcquisitionApprovalRow } | { ok: false; error: string }> {
  await admin
    .from(TABLE)
    .update({ status: 'superseded' })
    .eq('experiment_id', input.experimentId)
    .eq('acquisition_domain', input.acquisitionDomain)
    .eq('status', 'approved');

  const targetSnapshot = {
    requiredNetNewDistinctMembers: input.brief.requiredNetNewDistinctMembers,
    missingNamespaces: input.brief.missingNamespaces,
    deficientRelationalStructures: input.brief.deficientRelationalStructures,
    sourceAdmissibilityConstraints: input.brief.sourceAdmissibilityConstraints,
  };

  const { data, error } = await admin
    .from(TABLE)
    .insert({
      experiment_id: input.experimentId,
      acquisition_domain: input.acquisitionDomain,
      crystal_domain: input.crystalDomain,
      status: 'approved',
      target_snapshot: targetSnapshot,
      crystal_generation: input.brief.crystalGeneration,
      brief_hash: input.briefHash,
      approved_by_persona_id: input.approvedByPersonaId,
    })
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'approval could not be written' };

  const receipt = await writeLifecycleReceipt({
    personaId: input.approvedByPersonaId,
    summary:
      `Targeted acquisition approved for experiment ${input.experimentId} (${input.crystalDomain}): ` +
      `${targetSnapshot.requiredNetNewDistinctMembers} additional distinct member(s), ` +
      `${targetSnapshot.missingNamespaces.length} namespace(s) unrepresented ` +
      `(${targetSnapshot.missingNamespaces.join(', ') || 'none named'}). Ratified institutions only, ` +
      `domain '${input.acquisitionDomain}'. No source added, no statement authored, no boundary changed by ` +
      'this act — it authorizes bounded discovery to run.',
    invariantSeedIds: [],
  }).catch(() => ({ ok: false, receiptId: null }));

  if (receipt.receiptId) {
    await admin.from(TABLE).update({ receipt_id: receipt.receiptId }).eq('id', data.id);
  }

  return { ok: true, approval: rowToApproval({ ...(data as Record<string, unknown>), receipt_id: receipt.receiptId }) };
}

/** Marks the approval 'completed' — called once readiness no longer needs
 *  acquisition (`!acquisitionBriefApplies(freshReadiness)`) or every ratified
 *  institution has been attempted. Idempotent: a caller that completes an
 *  already-completed/superseded row is a no-op, never an error. */
export async function completeAcquisitionJob(admin: SupabaseClient, approvalId: string): Promise<void> {
  await admin
    .from(TABLE)
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', approvalId)
    .eq('status', 'approved');
}

export interface AcquisitionStepResult {
  ok: true;
  /** `null` when every ratified+verified institution in the domain already
   *  has at least one candidate source on record — there is nothing left
   *  this job can discover, distinct from a genuine per-institution failure. */
  institution: { pillarKey: string; institutionName: string } | null;
  discovery: InstitutionDiscoveryRunResult | null;
  /** True when no ratified+verified institution remains unattempted — the
   *  caller should stop calling this step and re-check readiness. */
  exhausted: boolean;
  /**
   * How many ratified+verified institutions in the domain remained
   * UNATTEMPTED at the start of this call (already-attempted ones, tracked
   * via existing candidate sources, excluded). Informational only — this
   * can legitimately reach 0 through a completed multi-call round, so it is
   * NOT the signal that distinguishes a blocked source universe (see
   * `ratifiedVerifiedInstitutionCount` below).
   */
  eligibleInstitutionCountAtStart: number;
  /**
   * How many institutions in the domain are ratified+verified AT ALL
   * (2026-08-31 state-machine repair), regardless of whether they have
   * already been attempted. THIS is the signal that tells "governance gap"
   * apart from "legitimately worked through everything available":
   *   - `exhausted && ratifiedVerifiedInstitutionCount === 0` — the source
   *     universe had NOTHING eligible from the very first call in this
   *     approval's lifetime; no institution was ever attempted. A
   *     governance/verification gap, never a completed round.
   *   - `exhausted && ratifiedVerifiedInstitutionCount > 0` — every eligible
   *     institution WAS genuinely attempted (this call or an earlier one in
   *     the same round); a real completed round.
   * The caller (the run-step route) uses this, never
   * `eligibleInstitutionCountAtStart`, to decide whether marking the
   * approval 'completed' is honest.
   */
  ratifiedVerifiedInstitutionCount: number;
}

/**
 * THE ONE BOUNDED STEP. Picks the FIRST ratified+verified institution (sorted
 * by name — `getDomainConstitution`'s own deterministic order) that has no
 * candidate source on record yet for this domain, and runs discovery for
 * THAT institution alone — never more than one, never the whole-domain
 * sequential sweep `runDiscoveryForDomain` performs. A caller drives this
 * repeatedly (mirroring "Run until you need me") until `exhausted: true`.
 */
export async function runOneAcquisitionStep(
  admin: SupabaseClient,
  acquisitionDomain: string,
): Promise<AcquisitionStepResult> {
  const [constitution, existingSources] = await Promise.all([
    getDomainConstitution(admin, acquisitionDomain),
    listCandidateSources(admin, { campaignDomain: acquisitionDomain }).catch(() => []),
  ]);
  const attemptedIssuers = new Set(
    existingSources.map((s) => s.issuer).filter((issuer): issuer is string => Boolean(issuer)),
  );
  // Computed BEFORE excluding already-attempted institutions — this is
  // "does the domain have anything ratified+verified at all", never
  // narrowed by what a prior call in this same round already attempted
  // (2026-08-31 state-machine repair; see `ratifiedVerifiedInstitutionCount`'s
  // own doc comment for why this must be a separate count from `eligible`).
  const ratifiedVerified = constitution.institutions.filter((i) => canRunInstitutionDiscovery(i).allowed);
  const ratifiedVerifiedInstitutionCount = ratifiedVerified.length;
  const eligible = ratifiedVerified.filter((i) => !attemptedIssuers.has(i.institutionName));
  const eligibleInstitutionCountAtStart = eligible.length;
  const next = eligible[0];
  if (!next) {
    return {
      ok: true, institution: null, discovery: null, exhausted: true,
      eligibleInstitutionCountAtStart, ratifiedVerifiedInstitutionCount,
    };
  }
  const discovery = await runDiscoveryForInstitution(admin, {
    domain: acquisitionDomain,
    pillarKey: next.pillarKey,
    institutionName: next.institutionName,
  });
  const remaining = eligible.length - 1;
  return {
    ok: true,
    institution: { pillarKey: next.pillarKey, institutionName: next.institutionName },
    discovery,
    exhausted: remaining <= 0,
    eligibleInstitutionCountAtStart,
    ratifiedVerifiedInstitutionCount,
  };
}

// ── INSTITUTION VERIFICATION — the SAME bounded-step shape as acquisition
// (2026-08-31, "targeted-acquisition ratified-but-unverified dead end"
// repair) ────────────────────────────────────────────────────────────────
//
// Traced from `services/corpusScout/registryVerification.ts` before writing
// this: `verifyInstitutionEntry` is a DETERMINISTIC, BOUNDED machine act —
// resolve the seed URL, discover document candidates, retrieve and inspect
// up to `MAX_DOCUMENTS_TO_INSPECT` (5) of them, record the outcome. No human
// interpretation decides the outcome; it is mechanically derived from HTTP
// responses and content inspection. It is gated by the SAME Steward
// (`isAdmin`) authority already driving every Track 2 acquisition route —
// no separate approval or judgement is required to run it. It is NOT a
// scientific/governance decision in the sense the orchestrator's own human
// gates exist for.
//
// It IS, however, EXTERNAL HTTP against a real institution's homepage —
// exactly the property that keeps `discover-sources` out of
// `PROGRAMME_ACT_KINDS` (per this file's own header). `verifyDomainRegistry`
// compounds that by looping ALL registry rows inside ONE request
// (`maxDuration: 300` on its route) — the same unbounded-sweep shape
// `runDiscoveryForDomain` has, which is why acquisition was never wired to
// that whole-domain sweep either. So verification gets the IDENTICAL
// treatment as acquisition: a bounded, ONE-institution-per-call step,
// reusing `verifyInstitutionEntry` verbatim (never a second verification
// implementation), driven repeatedly by the client exactly like
// `runOneAcquisitionStep` already is.
//
// SCOPE, deliberately narrow: only `verification_status === 'proposed'`
// (never yet submitted) institutions are picked. This is what makes the
// step safe to auto-drive without an infinite-retry risk on a persistently
// dead URL: each ratified institution gets EXACTLY ONE automatic pass.
// Whatever that pass produces — `verified`, `verification_failed`,
// `insufficient_corpus`, `temporarily_unavailable`, `redirect_changed` — is
// a durable, isolated, per-institution fact on the registry row; a failing
// institution does not block the next one, and does not get silently
// retried forever within the same bounded run (exception isolation). A
// STALE already-attempted entry (failed/insufficient/temporarily-unavailable)
// is a deliberate RE-verification a steward triggers separately
// (`POST /api/corpus-scout/institution-verification`), never something
// "Run until you need me" re-attempts on its own — the same distinction
// this codebase already draws between a bounded machine pass and a steward
// re-run. `redirect_changed` and `deprecated` are excluded from auto-run
// entirely: both are the ONE place this mechanism genuinely returns to a
// human (the code's own comment: "a steward must re-confirm the entry").

export interface InstitutionVerificationStepResult {
  ok: true;
  /** `null` when no ratified institution in the domain has any outstanding
   *  verification work (never started, or in-flight) — there is nothing
   *  left for this step to verify automatically. */
  institution: { pillarKey: string; institutionName: string } | null;
  step: VerificationStepResult | null;
  /** True when no ratified institution has any outstanding verification
   *  work AT THE START of this call. Distinct from `step.status ===
   *  'in-progress'` (2026-08-31 wall-clock granularity repair): ONE
   *  institution's verification can now take MANY calls (phase by phase),
   *  so this being `false` does NOT mean this call finished anything — it
   *  only means there was real work to attempt. The caller keeps calling
   *  until this becomes `true`. */
  exhausted: boolean;
}

/**
 * THE ONE BOUNDED VERIFICATION STEP. Picks the institution `runVerificationStep`
 * should work on next — an institution ALREADY mid-verification (resuming
 * its persisted phase/cursor) takes priority over starting a fresh one, so
 * no institution's progress is abandoned while another is worked — and
 * performs EXACTLY ONE bounded phase for it via `runVerificationStep`
 * (services/corpusScout/registryVerification.ts), never the whole-entry
 * one-shot `verifyInstitutionEntry` and never the whole-domain sweep
 * `verifyDomainRegistry` performs. A caller drives this repeatedly until
 * `exhausted: true`.
 */
export async function runOneInstitutionVerificationStep(
  admin: SupabaseClient,
  acquisitionDomain: string,
): Promise<InstitutionVerificationStepResult> {
  const constitution = await getDomainConstitution(admin, acquisitionDomain);
  const eligible = constitution.institutions.filter(
    (i) => i.status === 'ratified' && (i.verificationStatus === 'proposed' || i.verificationStatus === 'pending_verification'),
  );
  // Resume an in-flight institution before starting a fresh one.
  const next = eligible.find((i) => i.verificationStatus === 'pending_verification') ?? eligible[0];
  if (!next) {
    return { ok: true, institution: null, step: null, exhausted: true };
  }
  const step = await runVerificationStep(admin, {
    domain: acquisitionDomain,
    pillarKey: next.pillarKey,
    institutionName: next.institutionName,
  });
  return {
    ok: true,
    institution: { pillarKey: next.pillarKey, institutionName: next.institutionName },
    step,
    exhausted: false,
  };
}
