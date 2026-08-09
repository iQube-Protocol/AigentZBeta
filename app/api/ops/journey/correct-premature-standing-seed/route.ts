import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { readSettledFact, invalidateSettledFact } from '@/services/journey/settledFacts';
import { readJourneyResolution } from '@/services/journey/stageResolution';
import { findAgentReceiptRefs, createActivityReceipt } from '@/services/receipts/activityReceiptService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ops/journey/correct-premature-standing-seed
 *
 * The non-destructive correction for "URGENT SEQUENCING CORRECTION —
 * AigentQube Presence ≠ Factory Ingestion" part 5 (operator directive,
 * 2026-08-09). Agent-generic — never MoneyPenny-specific — and re-verifies
 * the defect signature itself before touching anything; it does not trust
 * the caller's belief that a correction is warranted.
 *
 * ── What this does NOT do ────────────────────────────────────────────────
 *
 * NEVER deletes or mutates the original `standing_accrued` receipt — it
 * remains, permanently, as historical evidence (including evidence of an
 * erroneous platform act). This route only:
 *
 *   1. Writes a NEW `reconciliation_discrepancy_recorded` receipt (the
 *      EXISTING, protocol-level, partner-agnostic receipt type this
 *      codebase already reserves for exactly this shape of correction —
 *      never a bespoke one-off type) documenting the discrepancy.
 *   2. Invalidates the `registry_standing_seeded` settled fact via
 *      `invalidateSettledFact`'s EXISTING `governed-correction-supersedes`
 *      event (services/journey/settledFacts.ts) — the constitutional
 *      mechanism this codebase already has for reopening a wrongly-settled
 *      fact, never a bespoke unsettle path.
 *   3. Removes ONLY 'deploy'/'standing' from the agent's persisted
 *      `journey_resolutions[journeyId].canonicalStages` array — the SECOND
 *      ratchet floor (services/journey/stageResolution.ts's
 *      `recordJourneyResolution`) that invalidating the settled fact alone
 *      does not touch. Every OTHER canonically-established stage in that
 *      array (register, claim, etc.) is preserved untouched.
 *
 * ── The safety gate ───────────────────────────────────────────────────────
 *
 * Refuses (never proceeds) unless it can independently confirm the exact
 * defect signature: a `standing_accrued` receipt exists AND no
 * `capability_registered` receipt exists at or before it. If a genuine
 * Factory-ingestion receipt DOES predate the accrual, the seed may be
 * legitimate — this route will not touch it.
 *
 * Idempotent: if the settled fact is already invalidated and 'deploy'/
 * 'standing' are already absent from canonicalStages, reports no-op.
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
    // ── Re-verify the defect signature independently ──────────────────────
    const [standingReceipts, ingestReceipts, standingSeededFact, journeyResolution] = await Promise.all([
      findAgentReceiptRefs(agentRuntimeId, ['standing_accrued'], { limit: 50 }),
      findAgentReceiptRefs(agentRuntimeId, ['capability_registered'], { limit: 50 }),
      readSettledFact(admin, aigentQubeId, agentRuntimeId, 'registry_standing_seeded'),
      readJourneyResolution(admin, aigentQubeId, journeyId),
    ]);

    if (standingReceipts.length === 0) {
      return NextResponse.json({ ok: false, refusalCode: 'NO_STANDING_ACCRUED_RECEIPT', detail: 'nothing to correct — no standing_accrued receipt exists for this agent' }, { status: 409 });
    }

    const allIds = [...standingReceipts.map((r) => r.id), ...ingestReceipts.map((r) => r.id)];
    const { data: receiptRows } = await admin.from('activity_receipts').select('id, created_at, action_type').in('id', allIds);
    const createdAtById = new Map((receiptRows ?? []).map((r: any) => [r.id, r.created_at]));

    const earliestStandingAt = standingReceipts.map((r) => createdAtById.get(r.id)).filter(Boolean).sort()[0] as string | undefined;
    const earliestIngestAt = ingestReceipts.map((r) => createdAtById.get(r.id)).filter(Boolean).sort()[0] as string | undefined;
    const genuinelyIngestedFirst = !!earliestIngestAt && !!earliestStandingAt && earliestIngestAt <= earliestStandingAt;

    if (genuinelyIngestedFirst) {
      return NextResponse.json(
        {
          ok: false,
          refusalCode: 'NOT_PREMATURE',
          detail: `a capability_registered receipt (${earliestIngestAt}) predates the earliest standing_accrued receipt (${earliestStandingAt}) — this accrual may be legitimate and will not be touched`,
        },
        { status: 409 },
      );
    }

    const alreadyInvalidated = standingSeededFact?.status === 'invalidated';
    const alreadyRemoved =
      !(journeyResolution?.canonicalStages ?? []).includes('deploy') &&
      !(journeyResolution?.canonicalStages ?? []).includes('standing');

    const result: Record<string, unknown> = {
      agentRuntimeId,
      aigentQubeId,
      journeyId,
      correctedStandingAccruedReceiptIds: standingReceipts.map((r) => r.id),
    };

    // ── 1. Discrepancy receipt (never a substitute for, or mutation of, the original) ──
    let discrepancyReceiptId: string | null = null;
    try {
      const receipt = await createActivityReceipt({
        personaId: correctingPersonaId,
        activeCartridge: 'agentiq',
        actionType: 'reconciliation_discrepancy_recorded',
        summary: `Standing seed for ${agentRuntimeId} was awarded before genuine Factory ingestion — corrected under the 2026-08-09 AigentQube-presence/Factory-ingestion sequencing ruling`,
        agentsInvoked: [agentRuntimeId],
        actionInput: {
          discrepancyKind: 'PREMATURE_STANDING_SEED',
          journeyId,
          standingAccruedReceiptIds: standingReceipts.map((r) => r.id),
          capabilityRegisteredReceiptIds: ingestReceipts.map((r) => r.id),
          earliestStandingAccruedAt: earliestStandingAt ?? null,
          earliestCapabilityRegisteredAt: earliestIngestAt ?? null,
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
        `Premature award — Factory ingestion evidence (capability_registered) did not predate this accrual. Corrected per discrepancy receipt ${discrepancyReceiptId}.`,
        `ops/journey/correct-premature-standing-seed:${correctingPersonaId}`,
      );
      result.settledFactInvalidation = outcome.ok ? { applied: true } : { applied: false, reason: outcome.detail };
    }

    // ── 3. Remove 'deploy'/'standing' from the persisted canonical-stage ratchet ──
    if (alreadyRemoved) {
      result.canonicalStagesCorrection = { applied: false, reason: 'deploy/standing already absent' };
    } else {
      const { data } = await admin.from('registry_assets').select('metadata').eq('asset_id', aigentQubeId).maybeSingle();
      const metadata = (data?.metadata as Record<string, unknown> | null) ?? {};
      const map = (metadata.journey_resolutions as Record<string, any> | undefined) ?? {};
      const existing = map[journeyId];
      if (!existing) {
        result.canonicalStagesCorrection = { applied: false, reason: 'no persisted journey_resolutions record for this journeyId' };
      } else {
        const before = existing.canonicalStages ?? [];
        const after = before.filter((s: string) => s !== 'deploy' && s !== 'standing');
        const { error } = await admin
          .from('registry_assets')
          .update({ metadata: { ...metadata, journey_resolutions: { ...map, [journeyId]: { ...existing, canonicalStages: after } } } })
          .eq('asset_id', aigentQubeId);
        result.canonicalStagesCorrection = error
          ? { applied: false, reason: error.message }
          : { applied: true, before, after };
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
        'Non-destructive correction for a Standing seed awarded before genuine Factory ingestion (2026-08-09 sequencing ruling). ' +
        'Body: { agentRuntimeId, aigentQubeId, journeyId?, correctingPersonaId }. Re-verifies the defect signature before acting; ' +
        'never deletes or mutates the original standing_accrued receipt. Requires x-cron-token header (CRON_TRIGGER_TOKEN).',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
