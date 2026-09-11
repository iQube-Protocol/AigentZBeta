/**
 * GET /api/research/review/models
 *
 * The model catalogue as the Lab's reviewer pickers see it — ids WITH their
 * server-derived family metadata, and a `selectable` flag with a reason where
 * false.
 *
 * This endpoint exists so the UI's disabled-option logic is DERIVED from the
 * same family metadata the server enforces on, rather than from a second
 * hand-maintained list. A hand-maintained UI list is the classic
 * two-things-describing-one-thing defect, and here it fails in the worst
 * direction: the dropdown says a pair is fine, the server refuses it, and the
 * operator concludes the feature is broken — or worse, the list drifts the
 * other way and offers a same-family pair the server happens to accept because
 * someone "fixed" the mismatch on the wrong side.
 *
 * A missing provider credential is reported as a REFUSAL, not an empty list.
 * An empty catalogue would render as "no models available", which reads like a
 * provider outage and invites a retry loop against a problem no retry fixes.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireReviewAccess } from '../_lib/gate';
import { toSelectableModels } from '../_lib/resolveSelection';
import { createVeniceProvider, ReviewRefusal } from '@/services/research/review';
import { EXP_P1_REVIEWER_PAIR } from '@/services/research/review/templates/expP1Admissibility';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = await requireReviewAccess(req);
  if (!gate.ok) return gate.response;

  const runAtIso = new Date().toISOString();
  try {
    const provider = createVeniceProvider();
    const catalogue = await provider.listModels();
    return NextResponse.json({
      ok: true,
      runAt: runAtIso,
      provider: provider.providerName,
      models: toSelectableModels(catalogue, runAtIso),
      defaultPair: {
        pairVersion: EXP_P1_REVIEWER_PAIR.pairVersion,
        rationale: EXP_P1_REVIEWER_PAIR.rationale,
        R1: EXP_P1_REVIEWER_PAIR.R1,
        R2: EXP_P1_REVIEWER_PAIR.R2,
      },
    });
  } catch (e) {
    if (e instanceof ReviewRefusal) {
      return NextResponse.json({ ok: false, refusalCode: e.refusalCode, error: e.message }, { status: 409 });
    }
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'catalogue unavailable' },
      { status: 502 },
    );
  }
}
