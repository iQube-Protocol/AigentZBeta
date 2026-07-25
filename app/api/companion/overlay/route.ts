/**
 * GET /api/companion/overlay — Constitutional Overlay data.
 *
 * PRD-MMC-IMPL-002 Increment 2, Step 2 (RATIFIED 2026-07-23).
 * See: codexes/packs/agentiq/updates/2026-07-23_prd-mmc-impl-002-companion-phase3-implementation-plan.md §3.
 *
 * Reads the persona's own latest stored observation (Step 1's
 * `companion_observation_latest`, one row per persona), maps its
 * `currentTabDomain` through the small, explicit domain→shape table
 * (`services/companion/overlayMapping.ts`), and — on a match — composes a
 * card (`services/companion/overlayComposition.ts`) from existing
 * standing/capability/registry reads.
 *
 * UNMAPPED-DOMAIN FALLBACK (operator-directed, 2026-07-25). A domain with no
 * dedicated shape no longer means an empty panel BY ITSELF — it means the
 * generic card (`composeGenericOverlayCard`): persona-level standing/
 * delegations (true on every page, never page-specific data pretending to
 * be) plus a best-effort registry/research search using the page's own
 * title, via the SAME federation functions the github-repo card already
 * calls. This is deliberately NOT a fourth hand-classified shape — it never
 * fabricates page-specific data for a page that has none (plan §3's original
 * requirement still holds for THAT).
 *
 * The honest empty state is still returned, unchanged, for the other three
 * reasons — `no-observation`, `no-domain-observed`, `grant-revoked` — because
 * those are consent problems, not classification problems: composing any
 * card there would use an observation the route has no legitimate basis to
 * act on. Only `domain-unmapped` (a real, currently-granted domain with no
 * shape) gets the generic card.
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
import { composeOverlayCard, composeGenericOverlayCard } from '@/services/companion/overlayComposition';

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

  // Distinguishes WHY there's no card — "domain isn't in the illustrative
  // demo set" (expected, working as scoped) reads identically to "you never
  // granted Current-tab observation" without this, leaving the operator no
  // way to discover the fix from the Overlay panel alone.
  const reason: 'no-observation' | 'no-domain-observed' | 'grant-revoked' | 'domain-unmapped' | null = shape
    ? null
    : !observation
      ? 'no-observation'
      : !observation.currentTabDomain
        ? 'no-domain-observed'
        : !domainStillGranted
          ? 'grant-revoked'
          : 'domain-unmapped';

  if (!shape) {
    // A real, currently-granted domain with no dedicated shape gets the
    // generic fallback card. The other three reasons are consent problems,
    // not classification problems — genuinely nothing to compose.
    if (reason === 'domain-unmapped' && domain) {
      const card = await composeGenericOverlayCard(persona, observation?.currentTabTitle, domain);
      return NextResponse.json(
        { ok: true, domain, shape: 'generic', card, reason: null },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.json(
      { ok: true, domain, shape: null, card: null, reason },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const card = await composeOverlayCard(shape, persona, observation?.currentTabTitle, domain);

  return NextResponse.json(
    { ok: true, domain, shape, card, reason: null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
