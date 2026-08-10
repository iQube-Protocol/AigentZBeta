import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { readSettledFact, invalidateSettledFact } from '@/services/journey/settledFacts';
import { readJourneyResolution, type StageInvalidationRecord } from '@/services/journey/stageResolution';
import { createActivityReceipt, findAgentReceiptRefs } from '@/services/receipts/activityReceiptService';
import { resolveStandingEvidence } from '@/services/journey/standingEvidenceProjection';

export const dynamic = 'force-dynamic';
// See agent-forensics/route.ts's own comment — mitigates the default
// serverless timeout against a slow agents_invoked containment query.
export const maxDuration = 60;

/**
 * POST /api/ops/journey/correct-premature-standing-seed
 *
 * The non-destructive correction for "URGENT SEQUENCING CORRECTION —
 * AigentQube Presence ≠ Factory Ingestion" part 5, and "Horizen Pilot
 * Closure — Final Standing + DVN Closure" part A2/A3 and the POSIT state
 * model amendment (operator directive, 2026-08-09/2026-08-10). Agent-generic
 * — never MoneyPenny-specific — and re-verifies the defect signature ITSELF,
 * via the SAME canonical projection
 * (services/journey/standingEvidenceProjection.ts's `resolveStandingEvidence`)
 * the journey `/state` route and `/agent-forensics` both consume, before
 * touching anything. It does not trust the caller's belief that a
 * correction is warranted, and it never re-implements the ordering check a
 * second, slightly-different way.
 *
 * ── What this does NOT do ────────────────────────────────────────────────
 *
 * NEVER deletes or mutates the original `standing_accrued` receipt(s) — they
 * remain, permanently, as historical evidence (including evidence of an
 * erroneous platform act). This route only:
 *
 *   1. Writes a NEW `reconciliation_discrepancy_recorded` receipt (the
 *      EXISTING, protocol-level, partner-agnostic receipt type this
 *      codebase already reserves for exactly this shape of correction —
 *      never a bespoke one-off type) naming the superseded receipt ids.
 *   2. Invalidates the `registry_standing_seeded` settled fact via
 *      `invalidateSettledFact`'s EXISTING `governed-correction-supersedes`
 *      event (services/journey/settledFacts.ts) — the constitutional
 *      mechanism this codebase already has for reopening a wrongly-settled
 *      fact, never a bespoke unsettle path.
 *   3. Removes 'standing' — and 'deploy' ONLY IF Ingest is INDEPENDENTLY
 *      shown to have no genuine evidence of its own (no agent-scoped
 *      `capability_registered` receipt at all) — from the agent's persisted
 *      `journey_resolutions[journeyId].canonicalStages` array. Correcting a
 *      premature Standing seed never revokes a separately-established Ingest
 *      state (operator ruling 2026-08-10: "A premature Standing award
 *      invalidates Standing, not necessarily Ingest"). Every OTHER
 *      canonically-established stage in that array (register, claim, etc.)
 *      is preserved untouched regardless.
 *   4. Writes a `StageInvalidationRecord` TOMBSTONE for every stage id
 *      removed in step 3 (POSIT state model, 2026-08-10) — the fix for the
 *      defect discovered reconciling MoneyPenny: `canonicalStages` alone is
 *      a POSITIVE-ONLY ratchet (services/journey/stageResolution.ts's
 *      `recordJourneyResolution` union can never shrink it), so a bare
 *      removal from that array is not durable — the very next ordinary
 *      `/state` read that happens to (re-)derive the same stage as
 *      canonical writes it straight back, and it then self-perpetuates via
 *      ratchet-synthesized evidence forever. The tombstone permanently
 *      retires ONLY the `prior-resolution` synthesis shortcut for that stage
 *      id — see `resolveMonotonicJourneyState`'s `invalidatedStages` input —
 *      while still allowing genuine LIVE evidence to re-establish it later
 *      with `canonicalAuthority: 'evidence'`. Never a permanent deny-list on
 *      the stage itself: "old assertion → governed invalidation →
 *      unresolved → new valid evidence → established again."
 *
 * The discrepancy receipt's `standingAccruedReceiptIds` is what
 * `resolveStandingEvidence` reads on every LATER call to exclude these
 * specific receipts from the effective set — "preserve historical evidence;
 * invalidate its present consequence", made structural rather than a
 * one-time cleanup.
 *
 * ── The safety gate ───────────────────────────────────────────────────────
 *
 * Refuses (never proceeds) unless `resolveStandingEvidence` independently
 * finds at least one `sequencingViolationReceiptIds` entry — a seed receipt
 * that predates any genuine `capability_registered` receipt. If every
 * standing_accrued receipt for this agent is genuinely ordered, this route
 * changes nothing and reports why.
 *
 * Idempotent: if the settled fact is already invalidated, 'standing' is
 * already absent from canonicalStages, and (Ingest is genuinely established
 * OR 'deploy' is already absent too), reports no-op.
 *
 * Auth: CRON_TRIGGER_TOKEN. Requires `correctingPersonaId` in the body — a
 * real, named "who" for the audit trail, never a static resolver string
 * (same discipline the Standing-seed AWARD itself already follows).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_TRIGGER_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'cron_token_not_configured' }, { status: 503 });
  }
  const provided =
    request.headers.get('x-cron-token') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { agentRuntimeId?: string; aigentQubeId?: string; journeyId?: string; correctingPersonaId?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const { agentRuntimeId, aigentQubeId, correctingPersonaId } = body;
  const journeyId = body.journeyId ?? 'horizen-moneypenny-admission';
  if (!agentRuntimeId || !aigentQubeId || !correctingPersonaId) {
    return NextResponse.json(
      { error: 'agentRuntimeId, aigentQubeId, and correctingPersonaId are all required' },
      { status: 400 },
    );
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ error: 'db unavailable' }, { status: 503 });
  }

  try {
    // ── Re-verify the defect signature independently, via the canonical projection ──
    const [standingEvidence, standingSeededFact, journeyResolution, ingestReceipts] = await Promise.all([
      resolveStandingEvidence(agentRuntimeId),
      readSettledFact(admin, aigentQubeId, agentRuntimeId, 'registry_standing_seeded'),
      readJourneyResolution(admin, aigentQubeId, journeyId),
      // INDEPENDENT of the Standing check — never coupled. This is the SAME
      // agent-scoped evidence Ingest's own route
      // (app/api/journey/moneypenny-horizen/ingest/route.ts) requires before
      // writing capability_registered, read here rather than inferred.
      findAgentReceiptRefs(agentRuntimeId, ['capability_registered'], { limit: 1 }),
    ]);

    if (standingEvidence.sequencingViolationReceiptIds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          refusalCode: 'NOT_PREMATURE',
          detail:
            standingEvidence.effectiveInitialReceipts.length === 0 && standingEvidence.effectiveContributionReceipts.length === 0
              ? 'nothing to correct — no standing_accrued receipt exists for this agent (or all are already superseded)'
              : 'every standing_accrued receipt for this agent is genuinely ordered after a capability_registered receipt — this accrual is legitimate and will not be touched',
        },
        { status: 409 },
      );
    }

    const correctedIds = standingEvidence.sequencingViolationReceiptIds;
    const alreadyInvalidated = standingSeededFact?.status === 'invalidated';
    // Ingest is invalidated ALONGSIDE Standing only when it independently has
    // no evidence of its own — never merely because Standing was premature.
    const ingestGenuinelyEstablished = ingestReceipts.length > 0;
    const stagesToInvalidate = ingestGenuinelyEstablished ? ['standing'] : ['standing', 'deploy'];
    const priorCanonicalStages = journeyResolution?.canonicalStages ?? [];
    const priorTombstones = journeyResolution?.invalidatedStages ?? {};
    const alreadyRemoved =
      !priorCanonicalStages.includes('standing') &&
      stagesToInvalidate.every((id) => Boolean(priorTombstones[id])) &&
      (ingestGenuinelyEstablished || !priorCanonicalStages.includes('deploy'));

    const result: Record<string, unknown> = {
      agentRuntimeId,
      aigentQubeId,
      journeyId,
      correctedStandingAccruedReceiptIds: correctedIds,
      ingestGenuinelyEstablished,
      stagesToInvalidate,
    };

    // ── 1. Discrepancy receipt (never a substitute for, or mutation of, the original) ──
    let discrepancyReceiptId: string | null = null;
    try {
      const receipt = await createActivityReceipt({
        personaId: correctingPersonaId,
        activeCartridge: 'agentiq',
        actionType: 'reconciliation_discrepancy_recorded',
        summary: `Standing accrual(s) for ${agentRuntimeId} predate genuine Factory ingestion — corrected under the 2026-08-09 AigentQube-presence/Factory-ingestion sequencing ruling`,
        agentsInvoked: [agentRuntimeId],
        actionInput: {
          discrepancyKind: 'PREMATURE_STANDING_SEED',
          journeyId,
          standingAccruedReceiptIds: correctedIds,
        },
      });
      discrepancyReceiptId = receipt?.id ?? null;
    } catch (err) {
      return NextResponse.json({ ok: false, refusalCode: 'DISCREPANCY_RECEIPT_WRITE_FAILED', detail: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
    result.discrepancyReceiptId = discrepancyReceiptId;

    // ── 2. Invalidate the settled fact ─────────────────────────────────────
    if (alreadyInvalidated) {
      result.settledFactInvalidation = { applied: false, reason: 'already invalidated' };
    } else if (!standingSeededFact) {
      result.settledFactInvalidation = { applied: false, reason: 'no registry_standing_seeded fact was ever settled — nothing to invalidate' };
    } else {
      const outcome = await invalidateSettledFact(
        admin,
        aigentQubeId,
        agentRuntimeId,
        'registry_standing_seeded',
        'governed-correction-supersedes',
        `Premature award — this accrual predates any genuine capability_registered receipt. Corrected per discrepancy receipt ${discrepancyReceiptId}.`,
        `ops/journey/correct-premature-standing-seed:${correctingPersonaId}`,
      );
      result.settledFactInvalidation = outcome.ok ? { applied: true } : { applied: false, reason: outcome.detail };
    }

    // ── 3. Remove the invalidated stage(s) from the canonical ratchet AND ──
    // ── write a tombstone for each, in the SAME update (POSIT, 2026-08-10) ──
    if (alreadyRemoved) {
      result.canonicalStagesCorrection = { applied: false, reason: `${stagesToInvalidate.join('/')} already absent and tombstoned` };
    } else {
      const { data } = await admin.from('registry_assets').select('metadata').eq('asset_id', aigentQubeId).maybeSingle();
      const metadata = (data?.metadata as Record<string, unknown> | null) ?? {};
      const map = (metadata.journey_resolutions as Record<string, any> | undefined) ?? {};
      const existing = map[journeyId];
      if (!existing) {
        result.canonicalStagesCorrection = { applied: false, reason: 'no persisted journey_resolutions record for this journeyId' };
      } else {
        const before: string[] = existing.canonicalStages ?? [];
        const after = before.filter((s: string) => !stagesToInvalidate.includes(s));
        const invalidatedAt = new Date().toISOString();
        const newTombstones: Record<string, StageInvalidationRecord> = {};
        for (const stageId of stagesToInvalidate) {
          newTombstones[stageId] = {
            invalidatedAt,
            reason:
              stageId === 'standing'
                ? `Premature award — this accrual predates any genuine capability_registered receipt. Corrected per discrepancy receipt ${discrepancyReceiptId}.`
                : `No agent-scoped capability_registered receipt exists — Ingest was never independently established (only the premature Standing seed asserted it).`,
            correctionReceiptId: discrepancyReceiptId,
            supersededEvidenceIds: stageId === 'standing' ? correctedIds : [],
          };
        }
        const existingTombstones = (existing.invalidatedStages as Record<string, StageInvalidationRecord> | undefined) ?? {};
        const { error } = await admin
          .from('registry_assets')
          .update({
            metadata: {
              ...metadata,
              journey_resolutions: {
                ...map,
                [journeyId]: {
                  ...existing,
                  canonicalStages: after,
                  invalidatedStages: { ...existingTombstones, ...newTombstones },
                },
              },
            },
          })
          .eq('asset_id', aigentQubeId);
        result.canonicalStagesCorrection = error
          ? { applied: false, reason: error.message }
          : { applied: true, before, after, invalidatedStages: Object.keys(newTombstones) };
      }
    }

    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

/** GET shows what this route does — handy for verification without a POST. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      method: 'POST',
      description:
        'Non-destructive correction for Standing accrual(s) that predate genuine Factory ingestion (2026-08-09 sequencing ruling). ' +
        'Body: { agentRuntimeId, aigentQubeId, journeyId?, correctingPersonaId }. Re-verifies the defect via the canonical ' +
        'standingEvidenceProjection before acting; never deletes or mutates the original standing_accrued receipt(s). ' +
        'Requires x-cron-token header (CRON_TRIGGER_TOKEN).',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
