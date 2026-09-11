/**
 * /api/admin/registry/score-backfill
 *
 *   GET                          → coverage status per primitive
 *   POST                         → backfill all primitives
 *   POST ?source=<primitive>     → backfill one primitive
 *
 * Admin-gated. Idempotent. Operator overrides on individual axes are
 * preserved on re-run.
 *
 * Per the 2026-05-31 score-data-backfill backlog item. Surfaces in the
 * cartridge RegistryHealthTab.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  backfillPrimitive,
  backfillAllPrimitives,
  getCoverageStatus,
  type PrimitiveSource,
} from '@/services/registry/scoreBackfill/runBackfill';

const VALID_PRIMITIVES: ReadonlyArray<PrimitiveSource> = [
  'ContentQube',
  'ToolQube',
  'AigentQube',
  'DataQube',
  'ClusterQube',
];

async function requireAdmin(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  if (!persona.cartridgeFlags?.isAdmin) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { persona };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;

  const coverage = await getCoverageStatus();
  return NextResponse.json({
    coverage,
    total_iqubes: coverage.reduce((n, c) => n + c.total_iqubes, 0),
    total_scored: coverage.reduce((n, c) => n + c.scored_iqubes, 0),
    total_with_overrides: coverage.reduce((n, c) => n + c.with_overrides, 0),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;

  const url = new URL(request.url);
  const sourceParam = url.searchParams.get('source');

  if (sourceParam) {
    if (!VALID_PRIMITIVES.includes(sourceParam as PrimitiveSource)) {
      return NextResponse.json(
        { error: 'invalid_source', allowed: VALID_PRIMITIVES },
        { status: 400 },
      );
    }
    const report = await backfillPrimitive(sourceParam as PrimitiveSource);
    return NextResponse.json(report);
  }

  const report = await backfillAllPrimitives();
  return NextResponse.json(report);
}
