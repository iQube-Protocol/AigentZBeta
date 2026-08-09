import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { readSettledFact } from '@/services/journey/settledFacts';
import { readJourneyResolution } from '@/services/journey/stageResolution';
import { findAgentReceiptRefs } from '@/services/receipts/activityReceiptService';
import { resolveStandingEvidence } from '@/services/journey/standingEvidenceProjection';

export const dynamic = 'force-dynamic';
// Same reasoning as app/api/journey/moneypenny-horizen/state/route.ts's own
// maxDuration: the default serverless function timeout can be shorter than
// an array-containment query against activity_receipts takes without a GIN
// index on agents_invoked (see migration 20260930002600). Raising this is
// a mitigation for THAT gap, not a substitute for it.
export const maxDuration = 60;

/**
 * GET /api/ops/journey/agent-forensics?agentRuntimeId=aigent-moneypenny&aigentQubeId=aigentqube-moneypenny&journeyId=horizen-moneypenny-admission
 *
 * Read-only forensic inspection for "URGENT SEQUENCING CORRECTION —
 * AigentQube Presence ≠ Factory Ingestion" (operator directive, 2026-08-09,
 * part 5) and "Horizen Pilot Closure — Final Standing + DVN Closure"
 * (2026-08-09, part A3): "First confirm the new GIN index exists on LIVE
 * Supabase... Then run agent-journey-forensics for MoneyPenny."
 *
 * Agent-generic — takes agentRuntimeId/aigentQubeId/journeyId as query
 * params, works for any agent, not MoneyPenny-specific.
 *
 * Returns, never mutates:
 *   - every raw `standing_accrued` and `capability_registered` receipt for
 *     this agent (id, createdAt, receiptStatus, actionInput) via
 *     findAgentReceiptRefs — no parallel/duplicate query;
 *   - the SAME canonical, correction-aware verdict
 *     (services/journey/standingEvidenceProjection.ts's `resolveStandingEvidence`)
 *     the journey `/state` route and `/correct-premature-standing-seed`
 *     both consume — never a second, ad hoc premature-seed heuristic;
 *   - the `registry_standing_seeded` settled fact and the persisted
 *     `journey_resolutions[journeyId]` record (the OTHER ratchet floor a
 *     settled-fact invalidation alone does not touch).
 *
 * Auth: CRON_TRIGGER_TOKEN, same convention as the other /api/ops/** infra
 * routes.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_TRIGGER_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'cron_token_not_configured' }, { status: 503 });
  }
  const provided =
    request.headers.get('x-cron-token') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const agentRuntimeId = request.nextUrl.searchParams.get('agentRuntimeId');
  const aigentQubeId = request.nextUrl.searchParams.get('aigentQubeId');
  const journeyId = request.nextUrl.searchParams.get('journeyId') ?? 'horizen-moneypenny-admission';
  if (!agentRuntimeId || !aigentQubeId) {
    return NextResponse.json({ error: 'agentRuntimeId and aigentQubeId query params are required' }, { status: 400 });
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ error: 'db unavailable' }, { status: 503 });
  }

  try {
    const [standingReceipts, ingestReceipts, discrepancyReceipts, standingSeededFact, journeyResolution, standingEvidence] = await Promise.all([
      findAgentReceiptRefs(agentRuntimeId, ['standing_accrued'], { limit: 50 }),
      findAgentReceiptRefs(agentRuntimeId, ['capability_registered'], { limit: 50 }),
      findAgentReceiptRefs(agentRuntimeId, ['reconciliation_discrepancy_recorded'], { limit: 50 }),
      readSettledFact(admin, aigentQubeId, agentRuntimeId, 'registry_standing_seeded'),
      readJourneyResolution(admin, aigentQubeId, journeyId),
      resolveStandingEvidence(agentRuntimeId),
    ]);

    const sorted = <T extends { createdAt: string }>(rows: T[]) => [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    return NextResponse.json(
      {
        agentRuntimeId,
        aigentQubeId,
        journeyId,
        standingAccruedReceipts: sorted(standingReceipts),
        capabilityRegisteredReceipts: sorted(ingestReceipts),
        reconciliationDiscrepancyReceipts: sorted(discrepancyReceipts),
        registryStandingSeededFact: standingSeededFact,
        persistedJourneyResolution: journeyResolution,
        // The SAME canonical projection every consumer reads — see the
        // module header for what each field means.
        standingEvidence,
        verdict: {
          hasAnyStandingAccrued: standingReceipts.length > 0,
          hasAnyCapabilityRegistered: ingestReceipts.length > 0,
          effectiveInitialCount: standingEvidence.effectiveInitialReceipts.length,
          effectiveContributionCount: standingEvidence.effectiveContributionReceipts.length,
          supersededCount: standingEvidence.supersededReceiptIds.length,
          sequencingViolationCount: standingEvidence.sequencingViolationReceiptIds.length,
          likelyPrematureBySequencingDefect: standingEvidence.sequencingViolationReceiptIds.length > 0,
          persistedCanonicalStagesIncludeDeployOrStanding:
            (journeyResolution?.canonicalStages ?? []).includes('deploy') ||
            (journeyResolution?.canonicalStages ?? []).includes('standing'),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
