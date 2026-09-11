/**
 * /api/corpus-scout/candidates/bulk-review — a governed BULK admission act
 * (Track 2 Stage 2). Admin-gated, mirroring every other Corpus Scout route.
 *
 * POST { sourceIds[], decision, notes, provenanceClass?, dryRun? }
 *
 * ── Why a bulk route exists at all ─────────────────────────────────────────
 *
 * Stage 2 holds tens of sources awaiting a decision, and a per-source form is
 * the only way to decide them. That is correct for a judgment call and wrong
 * for the case the operator actually faces: a run of sources from ONE
 * institution, at ONE tier, where the constitutional judgment is the same for
 * all of them and re-typing it forty times invites the reviewer to stop
 * reading. This route makes the batch an explicit, receipted act instead of
 * forty unreceipted ones.
 *
 * ── What it does NOT relax ─────────────────────────────────────────────────
 *
 * Nothing. Every source still goes through `applyCandidateReviewDecision` —
 * the SAME function the single-source route calls — so the decision
 * vocabulary, the provenanceClass requirement on an ingesting admission, the
 * mark_duplicate rule and the approve-then-ingest sequencing are identical.
 * There is no bulk-only path into the corpus.
 *
 * Specifically:
 *   · `dryRun` DEFAULTS TO TRUE (`!== false`) — a caller who forgets the flag
 *     inspects rather than admits, the same posture as the crystal-assignment
 *     route.
 *   · A write REQUIRES a non-empty `notes` rationale. It is recorded on every
 *     source in the batch, so no admission exists without a stated reason.
 *   · One receipt is written for the BATCH (via `writeLifecycleReceipt`, the
 *     one research-lifecycle receipt constructor — never forked), carrying
 *     every source id, the decision, the class and the rationale. A receipt
 *     failure never rolls back an admission and is never silent.
 *   · Per-source outcomes are reported individually, including ingestion
 *     failures. A batch is never summarised as "succeeded" when a member
 *     did not.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getCandidateSource } from '@/services/corpusScout/provenance';
import {
  applyCandidateReviewDecision,
  isReviewDecision,
  DECISION_TO_STATUS,
  INGESTING_DECISIONS,
} from '@/services/corpusScout/reviewDecision';
import { isProvenanceClass } from '@/services/corpusScout/types';
import { writeLifecycleReceipt } from '@/services/research/lifecycle';
import { personaPublicRef } from '@/services/identity/personaReferences';
import { prepareAdmissionRecommendations, eligibleAdmissionCohortIds } from '@/services/corpusScout/admissionPreparation';
import { computeCohortHash } from '@/services/research/cohortAuthorization';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Bounded so one request cannot run past the function's own budget mid-batch,
 *  leaving some sources decided and some not with no report of where it
 *  stopped. A larger batch is refused by name, not silently truncated. */
const MAX_BATCH = 25;

interface BulkOutcome {
  sourceId: string;
  /** What the source's status WAS before this act — read before any write, so
   *  a re-run over an already-decided source is visible rather than implied. */
  priorStatus: string | null;
  decided: boolean;
  written: boolean;
  ingested: boolean | null;
  detail: string;
}

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as {
    sourceIds?: unknown;
    decision?: string;
    notes?: string;
    provenanceClass?: string;
    dryRun?: boolean;
    /**
     * STALE-COHORT PROTECTION (2026-09-01) — the acquisition domain the
     * caller's `sourceIds` were prepared against, required alongside
     * `expectedCohortHash` to re-verify. Unrelated to `provenanceClass`
     * (the evidence-integrity axis); this is which corpus the eligible-
     * cohort recomputation reads.
     */
    campaignDomain?: string;
    /**
     * Echo of `admissionCohortHash` from the pending decision / prepare-
     * recommendations response that showed this cohort. When present
     * (alongside `campaignDomain`), the route recomputes the CURRENT
     * eligible cohort for that domain and refuses
     * (`recommendation-set-changed`) if it no longer matches — the corpus
     * moved since preparation. Omit to skip the check (unchanged behaviour
     * for every existing caller — a manual per-source decision, a targeted
     * rejection, or `BulkAdmissionControl`'s own hand-selected batch carry
     * no prepared-cohort commitment to verify against).
     */
    expectedCohortHash?: string;
  };

  const sourceIds = Array.isArray(body.sourceIds)
    ? [...new Set((body.sourceIds as unknown[]).filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim()))]
    : [];
  // Opt-in write. A forgotten flag inspects; it never admits.
  const dryRun = body.dryRun !== false;
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

  if (sourceIds.length === 0) {
    return NextResponse.json({ ok: false, error: 'sourceIds must contain at least one source id' }, { status: 400 });
  }
  if (sourceIds.length > MAX_BATCH) {
    return NextResponse.json(
      {
        ok: false,
        error:
          `${sourceIds.length} sources exceeds the ${MAX_BATCH}-source batch limit. This is refused rather than ` +
          'truncated: a partially applied batch that reported success would leave some sources decided and some ' +
          'not, with no record of where it stopped. Split the selection.',
      },
      { status: 400 },
    );
  }
  if (!isReviewDecision(body.decision)) {
    return NextResponse.json(
      { ok: false, error: `decision must be one of: ${Object.keys(DECISION_TO_STATUS).join(', ')}` },
      { status: 400 },
    );
  }
  // `mark_duplicate` names ONE canonical source the duplicate points at. That
  // is a per-source fact, so applying one to a whole batch would assert every
  // member duplicates the same document. Refused rather than guessed.
  if (body.decision === 'mark_duplicate') {
    return NextResponse.json(
      {
        ok: false,
        error:
          'mark_duplicate cannot be applied in bulk — it records WHICH source each duplicate points at, which is ' +
          'a per-source fact. Use the single-source review for duplicates.',
      },
      { status: 400 },
    );
  }
  if (body.provenanceClass !== undefined && !isProvenanceClass(body.provenanceClass)) {
    return NextResponse.json({ ok: false, error: `provenanceClass must be one of the five ratified values (got '${body.provenanceClass}')` }, { status: 400 });
  }
  if (INGESTING_DECISIONS.has(body.decision) && !body.provenanceClass) {
    return NextResponse.json(
      {
        ok: false,
        error:
          `provenanceClass is required for '${body.decision}' — every source in the batch is admitted under the ` +
          'SAME evidence-provenance class, so a batch whose members do not share one must be split, not guessed.',
      },
      { status: 400 },
    );
  }
  // A rationale is required to WRITE, never to inspect — the same split the
  // crystal-assignment route uses. It is recorded on every source in the batch.
  if (!dryRun && !notes) {
    return NextResponse.json(
      { ok: false, error: 'a rationale (notes) is required to record a bulk decision — it is written onto every source in the batch' },
      { status: 400 },
    );
  }

  // STALE-COHORT PROTECTION (2026-09-01) — see `expectedCohortHash`'s own
  // doc comment above. Checked ONLY on the write path, same posture as
  // `resolve-duplicates`: a stale dry-run preview is merely uninformative, a
  // stale WRITE would admit a cohort the steward never actually confirmed.
  // Recomputes the CURRENT eligible cohort for `campaignDomain` — never
  // trusts the caller's own `sourceIds` as proof nothing changed, since a
  // stale caller is exactly the one whose `sourceIds` are wrong.
  if (!dryRun && body.expectedCohortHash) {
    const campaignDomain = typeof body.campaignDomain === 'string' ? body.campaignDomain.trim() : '';
    if (!campaignDomain) {
      return NextResponse.json(
        { ok: false, error: 'campaignDomain is required alongside expectedCohortHash to re-verify the prepared cohort' },
        { status: 400 },
      );
    }
    const fresh = await prepareAdmissionRecommendations(admin, campaignDomain).catch(() => null);
    if (!fresh) {
      return NextResponse.json(
        { ok: false, error: 'could not re-verify the prepared cohort — the recommendation set could not be recomputed just now' },
        { status: 503 },
      );
    }
    const currentCohortHash = computeCohortHash(eligibleAdmissionCohortIds(fresh.recommendations));
    if (currentCohortHash !== body.expectedCohortHash) {
      return NextResponse.json(
        {
          ok: false,
          error: 'recommendation-set-changed',
          detail:
            'The prepared eligible cohort no longer matches what was shown — a source may have been decided, ' +
            'discovered, or its recommendation changed since preparation. Refresh recommendations and reconfirm ' +
            'before admitting.',
          currentCohortHash,
        },
        { status: 409 },
      );
    }
  }

  const outcomes: BulkOutcome[] = [];
  for (const sourceId of sourceIds) {
    // Read BEFORE any write — a source's prior status is unanswerable
    // afterwards, and it is what makes a re-run over already-decided sources
    // visible instead of silently repeated.
    const existing = await getCandidateSource(admin, sourceId);
    if (!existing) {
      outcomes.push({ sourceId, priorStatus: null, decided: false, written: false, ingested: null, detail: 'no such candidate source' });
      continue;
    }
    const priorStatus = existing.reviewWorkflowStatus;
    if (dryRun) {
      outcomes.push({
        sourceId,
        priorStatus,
        decided: true,
        written: false,
        ingested: null,
        detail:
          priorStatus === 'pending_review'
            ? `would move to '${DECISION_TO_STATUS[body.decision]}'`
            : `already '${priorStatus}' — this would OVERWRITE that decision with '${DECISION_TO_STATUS[body.decision]}'`,
      });
      continue;
    }

    const result = await applyCandidateReviewDecision(
      admin,
      sourceId,
      { decision: body.decision, notes, provenanceClass: body.provenanceClass },
      persona.personaId,
    );
    if (!result.ok) {
      outcomes.push({ sourceId, priorStatus, decided: false, written: false, ingested: null, detail: result.error });
      continue;
    }
    const ingestion = result.ingestion;
    outcomes.push({
      sourceId,
      priorStatus,
      decided: true,
      written: true,
      ingested: ingestion ? ingestion.ok : null,
      detail: ingestion
        ? ingestion.ok
          ? `admitted and ingested as evidence row ${ingestion.evidenceRowId}`
          : `admitted, but the Ingestion Broker hand-off FAILED: ${ingestion.error}`
        : `recorded as '${DECISION_TO_STATUS[body.decision]}'`,
    });
  }

  const written = outcomes.filter((o) => o.written);
  const ingestionFailures = outcomes.filter((o) => o.ingested === false);

  let receiptWritten = false;
  let receiptWarning: string | null = null;
  if (!dryRun && written.length > 0) {
    // ONE receipt for the batch, on the SAME research_lifecycle_transition
    // action type every other research act rides. The facts live in the
    // summary text (auditable by reading, not queryable by field) — the same
    // named trade-off the crystal-assignment receipt makes, and the same
    // reason: no new ActivityActionType, no CHECK-constraint migration.
    const summary =
      `Corpus Scout bulk review — ${written.length} source(s) recorded as '${DECISION_TO_STATUS[body.decision]}'` +
      (body.provenanceClass ? ` with evidence provenance '${body.provenanceClass}'` : '') +
      ` by ${personaPublicRef(persona.personaId)}. ` +
      `Sources: ${written.map((o) => `${o.sourceId} (was ${o.priorStatus})`).join(', ')}. ` +
      (ingestionFailures.length > 0
        ? `INGESTION FAILED for ${ingestionFailures.length}: ${ingestionFailures.map((o) => `${o.sourceId} — ${o.detail}`).join('; ')}. `
        : '') +
      `Rationale: ${notes}`;
    const receipt = await writeLifecycleReceipt({ personaId: persona.personaId, summary, invariantSeedIds: [] });
    receiptWritten = receipt.ok;
    if (!receipt.ok) {
      // A receipt failure never rolls back an admission that already
      // succeeded, and is never silent.
      console.error('[CORPUS BULK REVIEW] receipt not written for', written.map((o) => o.sourceId).join(', '));
      receiptWarning = 'The decisions were recorded but the batch receipt was not written. The admissions stand; the attributable record of this act does not.';
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    decision: body.decision,
    provenanceClass: body.provenanceClass ?? null,
    requested: sourceIds.length,
    decided: outcomes.filter((o) => o.decided).length,
    written: written.length,
    ingestionFailures: ingestionFailures.length,
    receiptWritten,
    receiptWarning,
    outcomes,
  });
}
