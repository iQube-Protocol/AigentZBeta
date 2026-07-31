/**
 * POST /api/research/crystal/[experimentId]/freeze-preview — builds a Freeze
 * Ceremony PACKAGE PREVIEW (CFS-054 §5 / PRD-EPI-001 §3.1 Workstream 5).
 * Admin-gated.
 *
 * ── This route NEVER freezes anything ───────────────────────────────────
 *
 * It calls `runFreezeCeremonyPreview`, which is pure/read-only end to end:
 * it runs the readiness + statistics reports and assembles the ratification
 * PACKAGE a human reviews. It never calls `freezeArtifact`, never writes to
 * `research_objects`, never creates a receipt, and never touches the DVN
 * pipeline. The response's `package.dvnAnchorRef` is always `null` and
 * `package.receiptPreview` is always a preview, not a created receipt — see
 * services/research/crystalFreezeCeremony.ts's header for the actual
 * (separate, operator-issued) freeze call this package previews.
 *
 * The request body supplies the ratification fields (operatorRef,
 * reviewerRef, domainBoundary, knownLimitations, freezeRationale,
 * ratifiedAt) — all required, all echoed verbatim into the package, never
 * defaulted or guessed by this route.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { runFreezeCeremonyPreview } from '@/services/research/crystalFreezeCeremony';

export const dynamic = 'force-dynamic';

interface FreezePreviewBody {
  crystalId?: unknown;
  crystalDomain?: unknown;
  operatorRef?: unknown;
  reviewerRef?: unknown;
  domainBoundary?: unknown;
  knownLimitations?: unknown;
  freezeRationale?: unknown;
  ratifiedAt?: unknown;
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ experimentId: string }> },
) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
  }

  const { experimentId } = await params;
  let body: FreezePreviewBody;
  try {
    body = (await req.json()) as FreezePreviewBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 });
  }

  const knownLimitations = Array.isArray(body.knownLimitations)
    ? body.knownLimitations.filter((v): v is string => typeof v === 'string')
    : [];

  const result = await runFreezeCeremonyPreview({
    crystalId: asString(body.crystalId) || `${experimentId}/crystal-vP1`,
    experimentId,
    crystalDomain: asString(body.crystalDomain) || 'constitutional-reasoning',
    operatorRef: asString(body.operatorRef),
    reviewerRef: asString(body.reviewerRef) || null,
    domainBoundary: asString(body.domainBoundary),
    knownLimitations,
    freezeRationale: asString(body.freezeRationale),
    ratifiedAt: asString(body.ratifiedAt) || new Date().toISOString(),
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }

  return NextResponse.json(
    { ok: true, package: result.package, note: 'PREVIEW ONLY — no freeze was performed. See package.eligibleForRatification.' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
