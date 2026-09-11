/**
 * POST /api/assistant/draft-venture-report
 *
 * Gate D — venture-report deliberation artifact generation. Body:
 *   { briefSpec: VentureReportBriefSpec }
 *
 * Composes the report from the SAME live venture data already backing
 * the Venture Progress cockpit (buildVentureProgress) — reuses that
 * builder rather than the disconnected, ventureId-keyed
 * assembleVentureReportEvidence bundle, which no route resolves a real
 * ventureId for from a plain personaId.
 *
 * personaId comes from the spine, never from the request body.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { buildVentureProgress } from '@/services/orchestration/ventureProgressBuilder';
import { isVentureReportBriefComplete } from '@/services/deliberativeArtifact/deliberationSeam';
import { draftVentureReport } from '@/services/venture/ventureReportDrafter';
import type { VentureReportBriefSpec } from '@/types/deliberativeArtifact';

export const dynamic = 'force-dynamic';

interface PostBody { briefSpec?: VentureReportBriefSpec }

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const body = (raw && typeof raw === 'object' ? raw : {}) as PostBody;
  const briefSpec = (body.briefSpec && typeof body.briefSpec === 'object' ? body.briefSpec : {}) as VentureReportBriefSpec;

  if (!isVentureReportBriefComplete(briefSpec)) {
    return NextResponse.json(
      { error: 'brief-incomplete', detail: 'purpose, disclosure, scope, and a reporting period are required before a report can be drafted' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const progress = await buildVentureProgress({ personaId: context.personaId });
    const draft = draftVentureReport({ briefSpec, progress });
    return NextResponse.json(draft, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[assistant/draft-venture-report] failed: ${msg}`);
    return NextResponse.json(
      { error: 'draft-venture-report-failed', detail: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
