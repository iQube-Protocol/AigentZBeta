/**
 * /api/corpus-scout/candidates/[sourceId]/review — the human review action
 * (PRD-ICA-001 §9). Admin-gated, mirroring `/api/invariants/discovery`'s auth
 * pattern exactly.
 *
 * POST { decision, notes?, provenanceClass?, duplicateOfSourceId? }
 *
 * `decision` maps onto `reviewWorkflowStatus` (§8, §0.3 — a separate,
 * composable axis from `provenanceClass`). When the decision is an
 * `approve_*` variant, `ingestApprovedSource` runs automatically as the final
 * step — approval and hand-off are one reviewer action (§6): the human
 * decides, the broker executes deterministically, no separate manual trigger.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { updateCandidateReview, getCandidateSource } from '@/services/corpusScout/provenance';
import { ingestApprovedSource } from '@/services/corpusScout/ingestionBroker';
import { isProvenanceClass, type ReviewWorkflowStatus } from '@/services/corpusScout/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type ReviewDecision =
  | 'approve_exp_p1'
  | 'approve_general_finance'
  | 'approve_reference_only'
  | 'reject_out_of_domain'
  | 'reject_low_substance'
  | 'reject_provenance'
  | 'reject_access_or_license'
  | 'mark_duplicate';

const DECISION_TO_STATUS: Record<ReviewDecision, ReviewWorkflowStatus> = {
  approve_exp_p1: 'approved_exp_p1',
  approve_general_finance: 'approved_general_finance',
  approve_reference_only: 'approved_reference_only',
  reject_out_of_domain: 'rejected_out_of_domain',
  reject_low_substance: 'rejected_low_substance',
  reject_provenance: 'rejected_provenance',
  reject_access_or_license: 'rejected_access_or_license',
  mark_duplicate: 'duplicate',
};

function isReviewDecision(v: unknown): v is ReviewDecision {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(DECISION_TO_STATUS, v);
}

export async function POST(req: NextRequest, props: { params: Promise<{ sourceId: string }> }) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const { sourceId } = await props.params;
  const body = (await req.json().catch(() => ({}))) as {
    decision?: string;
    notes?: string;
    provenanceClass?: string;
    duplicateOfSourceId?: string;
  };

  if (!isReviewDecision(body.decision)) {
    return NextResponse.json(
      { ok: false, error: `decision must be one of: ${Object.keys(DECISION_TO_STATUS).join(', ')}` },
      { status: 400 },
    );
  }
  if (body.decision === 'mark_duplicate' && !body.duplicateOfSourceId?.trim()) {
    return NextResponse.json({ ok: false, error: 'duplicateOfSourceId is required for mark_duplicate' }, { status: 400 });
  }
  if (body.provenanceClass !== undefined && !isProvenanceClass(body.provenanceClass)) {
    return NextResponse.json({ ok: false, error: `provenanceClass must be one of the four ratified values (got '${body.provenanceClass}')` }, { status: 400 });
  }

  const existing = await getCandidateSource(admin, sourceId);
  if (!existing) return NextResponse.json({ ok: false, error: `candidate source '${sourceId}' not found` }, { status: 404 });

  const reviewWorkflowStatus = DECISION_TO_STATUS[body.decision];
  const updateResult = await updateCandidateReview(admin, sourceId, {
    reviewWorkflowStatus,
    humanReviewNotes: body.notes,
    provenanceClass: body.provenanceClass,
    duplicateOfSourceId: body.decision === 'mark_duplicate' ? body.duplicateOfSourceId : undefined,
  });
  if (!updateResult.ok) return NextResponse.json(updateResult, { status: 400 });

  const isApproval = body.decision === 'approve_exp_p1' || body.decision === 'approve_general_finance';
  if (!isApproval) {
    return NextResponse.json({ ok: true, candidate: updateResult.candidate });
  }

  // Approval + hand-off are one reviewer action (§6) — the broker executes
  // deterministically right after the human's decision is persisted.
  const ingestion = await ingestApprovedSource(admin, sourceId, persona.personaId);
  const finalCandidate = ingestion.ok ? await getCandidateSource(admin, sourceId) : updateResult.candidate;
  return NextResponse.json(
    { ok: true, candidate: finalCandidate, ingestion },
    { status: 200 },
  );
}
