/**
 * GET /api/companion/overlay — Constitutional Overlay data.
 *
 * PRD-MMC-IMPL-002 Increment 2, Step 2 (RATIFIED 2026-07-23).
 * See: codexes/packs/agentiq/updates/2026-07-23_prd-mmc-impl-002-companion-phase3-implementation-plan.md §3.
 *
 * Reads the persona's own latest stored observation (Step 1's
 * `companion_observation_latest`, one row per persona), maps its
 * `currentTabDomain` through the small, explicit domain→shape table
 * (`services/companion/overlayMapping.ts`), and — only on a match — composes
 * a card (`services/companion/overlayComposition.ts`) from existing
 * standing/capability/registry reads. An unmapped domain returns
 * `shape: null`; the client renders "no overlay available for this page"
 * honestly rather than a fabricated generic card (plan §3's own requirement).
 *
 * REVOCATION-LIVE CHECK: a stored observation's `currentTabDomain` is only
 * honored if `'current-tab'` is STILL granted, checked against the
 * persona's CURRENT grant state (not the grant snapshot recorded at
 * observation-write time) — so revoking the capability after an
 * observation was posted immediately stops the Overlay from using that
 * domain, without waiting for a new observation to overwrite the old one.
 * "Observed, never asserted" applies to reads, not just writes.
 *
 * Spine-authenticated, fail-closed — mirrors every other Companion route
 * this session built.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { isCapabilityGranted } from '@/services/companion/observerConsent';
import { loadGrantState } from '@/app/api/companion/observer/_lib/store';
import { loadLatestObservation } from '@/app/api/companion/observer/_lib/observationStore';
import { shapeForDomain } from '@/services/companion/overlayMapping';
import { composeOverlayCard } from '@/services/companion/overlayComposition';

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

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json(
      { error: 'supabase-configuration-missing' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const [observation, grantState] = await Promise.all([
    loadLatestObservation(admin, persona.personaId),
    loadGrantState(admin, persona.personaId),
  ]);

  const domainStillGranted =
    !!observation?.currentTabDomain &&
    isCapabilityGranted(grantState, 'current-tab', observation.currentTabDomain);

  const domain = domainStillGranted ? observation!.currentTabDomain! : null;
  const shape = shapeForDomain(domain);

  if (!shape) {
    return NextResponse.json(
      { ok: true, domain, shape: null, card: null },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const card = await composeOverlayCard(shape, persona, observation?.currentTabTitle);

  return NextResponse.json(
    { ok: true, domain, shape, card },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
