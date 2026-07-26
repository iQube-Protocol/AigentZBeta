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
import { resolveDomainFromAnySource } from '@/services/resolution/domainResolver';
import { decidePresentation } from '@/services/resolution/presentationPolicy';
import { recordPresentationEvent } from '@/services/resolution/domainProfileStore';
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

  // P5 — the full resolution path: ratified code seed, then promoted profile,
  // then abstention. `shapeForDomain` remains the pure seed-only path used by
  // canaries and any sync caller; this route needs the storage tier too.
  const resolution = await resolveDomainFromAnySource(domain);
  const shape = resolution.assert ? resolution.overlayContext : shapeForDomain(domain);

  // P5 — L3. A provisional profile NEVER asserts (§6.2). It may, when its
  // confidence clears the applied presentation threshold, be OFFERED in
  // hedged form. Below threshold the runtime stays silent -- and records the
  // silence, because an abstention nobody counted is an abstention nobody can
  // calibrate (§6.3: the rate is a metric to publish, not a defect to hide).
  const provisional =
    resolution.level === 'L3' && resolution.profile && resolution.stored
      ? (() => {
          const confidence =
            resolution.profile!.assertionProvenance === 'discovered'
              ? resolution.profile!.confidence
              : null;
          const decision = decidePresentation(
            confidence,
            resolution.stored!.presentationThreshold,
          );
          void recordPresentationEvent({
            profileId: resolution.stored!.id,
            subjectType: resolution.profile!.subjectType,
            resolutionLevel: 'L3',
            confidence,
            appliedPresentationThreshold: decision.appliedThreshold,
            outcome: decision.eligible ? 'offered' : 'silent_abstention',
          });
          return decision.eligible
            ? {
                profileId: resolution.stored!.id,
                overlayContext: resolution.profile!.overlayContext,
                confidence,
                appliedThreshold: decision.appliedThreshold,
              }
            : null;
        })()
      : null;

  if (provisional) {
    // The hedged offer, and nothing else. No card is composed and no context
    // is stated -- the citizen decides whether to look. Presenting the card
    // here would be the assertion L3 forbids.
    return NextResponse.json(
      { ok: true, domain, shape: null, card: null, reason: null, provisional },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

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


/**
 * POST — record the citizen's response to a hedged provisional offer.
 *
 * `viewed` / `dismissed` only. The server already recorded `offered` or
 * `silent_abstention` when it made the decision, so this closes the loop
 * without letting the client assert anything: the body carries a profile id
 * and an outcome, never a classification.
 *
 * Instrumentation, not authority — it soft-fails and always returns ok.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(request);
  if (!persona) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    profileId?: unknown;
    outcome?: unknown;
    confidence?: unknown;
    appliedThreshold?: unknown;
  } | null;

  const profileId = typeof body?.profileId === 'string' ? body.profileId : null;
  const outcome = body?.outcome === 'viewed' || body?.outcome === 'dismissed' ? body.outcome : null;
  if (!profileId || !outcome) {
    return NextResponse.json({ ok: false, error: 'profileId and outcome required' }, { status: 400 });
  }

  await recordPresentationEvent({
    profileId,
    subjectType: 'hostname',
    resolutionLevel: 'L3',
    confidence: typeof body?.confidence === 'number' ? body.confidence : null,
    appliedPresentationThreshold:
      typeof body?.appliedThreshold === 'number' ? body.appliedThreshold : null,
    outcome,
  });

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
