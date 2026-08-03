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
 *
 * The decision vocabulary, validation and approve-then-ingest sequencing all
 * live in `applyCandidateReviewDecision` (services/corpusScout/
 * reviewDecision.ts) — shared with the bulk route
 * (`/api/corpus-scout/candidates/bulk-review`). This route validates only the
 * request shape and reports the shared function's result; it holds no rule of
 * its own (inv.engineering.036/037).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { applyCandidateReviewDecision } from '@/services/corpusScout/reviewDecision';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

  const result = await applyCandidateReviewDecision(
    admin,
    sourceId,
    {
      decision: body.decision ?? '',
      notes: body.notes,
      provenanceClass: body.provenanceClass,
      duplicateOfSourceId: body.duplicateOfSourceId,
    },
    persona.personaId,
  );
  if (!result.ok) {
    const status = result.error.includes('not found') ? 404 : 400;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result, { status: 200 });
}
