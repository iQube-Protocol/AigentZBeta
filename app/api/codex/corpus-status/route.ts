/**
 * GET /api/codex/corpus-status[?probe=<pack-relative-path>]
 *
 * Diagnostic for the pack-corpus store — reports whether the remote blob
 * hydrated, how many keys it holds, the resolved URL, and any hydration error,
 * without needing Lambda log access. Exposes only non-sensitive corpus metadata
 * (the corpus is public platform docs). Use ?probe=irl/foundation/experiments/
 * irv-001-invariant-resolution-validation/README.md to check a specific file.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureCorpusHydrated, getCorpusStatus } from '@/services/knowledge/packCorpusStore';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const probe = request.nextUrl.searchParams.get('probe') || undefined;
  await ensureCorpusHydrated();
  return NextResponse.json(getCorpusStatus(probe), {
    headers: { 'cache-control': 'no-store' },
  });
}
