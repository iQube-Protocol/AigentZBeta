/**
 * POST /api/admin/registry/backfill
 *
 * Operator-triggered iqube_id_map backfill. Admin-only.
 *
 * Usage:
 *   POST /api/admin/registry/backfill                 → backfill every source
 *   POST /api/admin/registry/backfill?source=triad_meta → backfill one source
 *
 * GET /api/admin/registry/backfill?source=<src>       → verify the gate
 *   (returns { source, source_row_count, map_row_count, ready, detail })
 *
 * Idempotent. Re-runnable. Per PRD v1.1 §B.3, each source must report
 * ready=true before its read path flips to resolveIQube().
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  backfillAll,
  backfillSource,
  verifyBackfill,
} from '@/services/registry/backfill/runBackfill';
import type { IQubeIdMapSource } from '@/types/registry-canonical';

const VALID_SOURCES: ReadonlyArray<IQubeIdMapSource> = [
  'triad_meta',
  'content_qube',
  'registry_asset',
  'code:aigentQubeSource',
  'code:toolQubeSource',
  'code:liquidui-template',
];

async function requireAdmin(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  if (!persona.cartridgeFlags?.isAdmin) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { persona };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;

  const url = new URL(request.url);
  const sourceParam = url.searchParams.get('source');

  if (sourceParam) {
    if (!VALID_SOURCES.includes(sourceParam as IQubeIdMapSource)) {
      return NextResponse.json(
        { error: 'invalid_source', allowed: VALID_SOURCES },
        { status: 400 },
      );
    }
    const report = await backfillSource(sourceParam as IQubeIdMapSource);
    return NextResponse.json(report);
  }

  const report = await backfillAll();
  return NextResponse.json(report);
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;

  const url = new URL(request.url);
  const sourceParam = url.searchParams.get('source');
  if (!sourceParam) {
    return NextResponse.json(
      { error: 'source query param required', allowed: VALID_SOURCES },
      { status: 400 },
    );
  }
  if (!VALID_SOURCES.includes(sourceParam as IQubeIdMapSource)) {
    return NextResponse.json(
      { error: 'invalid_source', allowed: VALID_SOURCES },
      { status: 400 },
    );
  }

  const result = await verifyBackfill(sourceParam as IQubeIdMapSource);
  return NextResponse.json(result);
}
