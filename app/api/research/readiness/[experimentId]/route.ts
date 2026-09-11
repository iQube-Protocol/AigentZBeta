/**
 * GET /api/research/readiness/[experimentId] — PRD-EPI-001 §10 Readiness
 * Dashboard backing data, read-only. Returns the seven sections with
 * red/amber/green status + the protocol-ratified projection. The IRL OS
 * Laboratory dashboard (`irl-exp-p1-readiness`/`irl-os-exp-p1-readiness`,
 * both `adminOnly: true`) renders this; so does the Workspace "Experimental
 * Readiness" capability card (2026-09-08) for a caller who holds a scoped
 * `research-lab` reviewer grant for THIS experiment but is not a platform
 * admin — the header comment above ("a reviewer can also hit it directly")
 * predates this fix; the gate below now actually matches it. Same
 * admin-OR-scoped-grant pattern as `/api/journey/validation-programme/agent-package`
 * and the Phase 2 `irl`-pack file routes (`services/passport/participationAccess.ts::resolveExperimentReviewGrant`).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveExperimentReviewGrant } from '@/services/passport/participationAccess';
import { buildReadinessDashboard } from '@/services/research/readinessDashboard';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ experimentId: string }> },
) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  const { experimentId } = await params;
  const isAdmin = Boolean(persona.cartridgeFlags?.isAdmin);
  if (!isAdmin) {
    const admin = getSupabaseServer();
    const grant = admin ? await resolveExperimentReviewGrant(admin, persona.personaId, experimentId) : null;
    if (!grant) {
      return NextResponse.json(
        { ok: false, error: 'Admin or a scoped research-lab reviewer grant for this experiment is required.' },
        { status: 403 },
      );
    }
  }

  const dashboard = await buildReadinessDashboard(experimentId);
  return NextResponse.json(
    { ok: true, dashboard },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
