/**
 * GET /api/participation/workspace-dossier?workspaceId=...
 *
 * The ONE route behind both the human Workspace dossier UI and any
 * machine/delegated-agent JSON consumer (2026-09-11, IRL Workspace Experiment
 * Dossier Completion Pass, `research.dossier.v1`). It is a thin wrapper over
 * `resolveExperimentDossier` (services/research/experimentDossier.ts) —
 * mirrors `workspace-state/route.ts`'s own shape exactly, because that route
 * is the precedent this one composes rather than forks.
 *
 * PARITY BY CONSTRUCTION: there is no separate "machine dossier" resolver.
 * The React panel that renders Protocol/Crystal/Apparatus/Readiness/Runs/
 * Review/Receipts/Exchange sections calls this SAME route and renders the
 * SAME `dossier` object a delegated agent would read as JSON — one
 * authorization boundary, one payload, two projections (render vs. consume).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveExperimentDossier } from '@/services/research/experimentDossier';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const workspaceId = req.nextUrl.searchParams.get('workspaceId');
  if (!workspaceId) {
    return NextResponse.json({ ok: false, error: 'workspaceId is required' }, { status: 400 });
  }

  const isAdmin = Boolean(persona.cartridgeFlags?.isAdmin);
  const origin = resolveRequestOrigin(req);
  const result = await resolveExperimentDossier(admin, { personaId: persona.personaId, isAdmin }, workspaceId, origin);

  if (!result.ok) {
    if (result.reason === 'not-found') {
      return NextResponse.json({ ok: false, error: 'Unknown workspace' }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: 'Not authorized to read this workspace.' }, { status: 403 });
  }

  return NextResponse.json({ ok: true, dossier: result.dossier });
}
