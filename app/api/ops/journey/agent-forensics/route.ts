import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { readSettledFact } from '@/services/journey/settledFacts';
import { readJourneyResolution } from '@/services/journey/stageResolution';
import { findAgentReceiptRefs } from '@/services/receipts/activityReceiptService';

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
 * part 5: "Forensic repair... Inspect: exact receipt id; created_at;
 * action_input; evidence refs; settled fact registry_standing_seeded;
 * whether a capability_registered receipt actually existed at the time").
 *
 * Agent-generic — takes agentRuntimeId/aigentQubeId/journeyId as query
 * params, works for any agent, not MoneyPenny-specific.
 *
 * Returns, never mutates:
 *   - every `standing_accrued` and `capability_registered` receipt for this
 *     agent (id, createdAt, receiptStatus) via the SAME findAgentReceiptRefs
 *     used everywhere else — no parallel query;
 *   - the `registry_standing_seeded` settled fact (services/journey/
 *     settledFacts.ts), status/evidenceRefs/resolvedAt as recorded;
 *   - the persisted journey_resolutions[journeyId] record (canonicalStages,
 *     milestones) — the OTHER ratchet floor (services/journey/
 *     stageResolution.ts's recordJourneyResolution) that a settled-fact
 *     invalidation alone does not touch;
 *   - a plain verdict: did `capability_registered` exist BEFORE the earliest
 *     `standing_accrued` receipt's `created_at`? If not, the accrual was
 *     premature by definition — never inferred, always shown with its own
 *     timestamps so a human can verify the same conclusion independently.
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
    const [standingReceipts, ingestReceipts, standingSeededFact, journeyResolution] = await Promise.all([
      findAgentReceiptRefs(agentRuntimeId, ['standing_accrued'], { limit: 50 }),
      findAgentReceiptRefs(agentRuntimeId, ['capability_registered'], { limit: 50 }),
      readSettledFact(admin, aigentQubeId, agentRuntimeId, 'registry_standing_seeded'),
      readJourneyResolution(admin, aigentQubeId, journeyId),
    ]);

    // createdAt isn't part of findAgentReceiptRefs' return shape (id/actionType/
    // receiptStatus only) — read it directly, by id, for exactly the receipts
    // just found. Small, bounded set; never a second broad scan.
    const allIds = [...standingReceipts.map((r) => r.id), ...ingestReceipts.map((r) => r.id)];
    const receiptDetails: Record<string, { createdAt: string; actionInput: unknown; dvnReceiptId: string | null }> = {};
    if (allIds.length > 0) {
      const { data } = await admin
        .from('activity_receipts')
        .select('id, created_at, action_input, dvn_receipt_id')
        .in('id', allIds);
      for (const row of data ?? []) {
        receiptDetails[(row as any).id] = {
          createdAt: (row as any).created_at,
          actionInput: (row as any).action_input,
          dvnReceiptId: (row as any).dvn_receipt_id ?? null,
        };
      }
    }

    const withDetails = (refs: typeof standingReceipts) =>
      refs
        .map((r) => ({ id: r.id, receiptStatus: r.receiptStatus, ...receiptDetails[r.id] }))
        .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));

    const standing = withDetails(standingReceipts);
    const ingest = withDetails(ingestReceipts);

    const earliestStanding = standing[0] ?? null;
    const earliestIngest = ingest[0] ?? null;
    const capabilityRegisteredExistedFirst =
      earliestIngest && earliestStanding ? earliestIngest.createdAt <= earliestStanding.createdAt : false;

    return NextResponse.json(
      {
        agentRuntimeId,
        aigentQubeId,
        journeyId,
        standingAccruedReceipts: standing,
        capabilityRegisteredReceipts: ingest,
        registryStandingSeededFact: standingSeededFact,
        persistedJourneyResolution: journeyResolution,
        verdict: {
          hasAnyStandingAccrued: standing.length > 0,
          hasAnyCapabilityRegistered: ingest.length > 0,
          capabilityRegisteredExistedBeforeEarliestStandingAccrued: capabilityRegisteredExistedFirst,
          likelyPrematureBySequencingDefect: standing.length > 0 && !capabilityRegisteredExistedFirst,
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
