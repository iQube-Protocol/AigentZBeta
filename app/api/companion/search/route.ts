/**
 * GET /api/companion/search — Universal Search façade.
 *
 * PRD-MMC-IMPL-002 Increment 1 (RATIFIED 2026-07-23).
 * See: codexes/packs/agentiq/updates/2026-07-23_prd-mmc-impl-002-companion-phase3-implementation-plan.md §3.
 *
 * Thin spine-authenticated shell around `services/companion/searchFederation.ts`'s
 * `federateSearch()` — the fan-out/rank/merge core, which is ALSO reused by
 * the Constitutional Overlay's registry-match lookup (Increment 2, Step 2).
 * This route contains no federation logic of its own; see the service
 * module for the full source-by-source documentation.
 *
 * Spine-authenticated, fail-closed — mirrors
 * `app/api/companion/observer/grants/route.ts` exactly: `getActivePersona`
 * returning null produces a 401 with no reads attempted, `Cache-Control:
 * no-store` on every response, `dynamic = 'force-dynamic'`.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { federateSearch } from '@/services/companion/searchFederation';

export const dynamic = 'force-dynamic';

function unauthenticated(): NextResponse {
  return NextResponse.json(
    { error: 'unauthenticated' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(request);
  if (!persona?.personaId) return unauthenticated();

  const query = (new URL(request.url).searchParams.get('q') ?? '').trim();
  if (query.length === 0) {
    return NextResponse.json(
      { query, results: [] },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const results = await federateSearch(query, persona.personaId, request.nextUrl.origin);

  return NextResponse.json(
    { query, results },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
