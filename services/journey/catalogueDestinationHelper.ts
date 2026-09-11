/**
 * metaMe Catalogue Destination Helper (Financial Services / AEE closeout,
 * 2026-08-24 — promoted from a one-off Operate destination map to a
 * first-class runtime adapter, per operator direction: "this is exactly the
 * seam where the model can otherwise become brittle").
 *
 * The seam between Journey Spine (which decides a journey's contextual
 * destination) and the metaMe Catalogue/cartridge/tab topology (which owns
 * the real capability registrations that destination has to resolve to):
 *
 *   Journey Spine     -> declares intent: "this journey continues at
 *                         catalogue item X, tab Y"
 *   Catalogue Helper   -> resolves that intent against REAL catalogue/
 *                         cartridge/tab registrations, validates it, and
 *                         returns a route the caller can render
 *   Operator/Capability   -> takes over from there (MoneyPenny owns its own
 *   Runtime                  Advisor/Architect/Runtime surfaces, etc.)
 *
 * Hard rules (operator-ratified, 2026-08-24):
 *   1. Never creates catalogue truth — reads data/activation-catalog.ts and
 *      data/codex-configs.ts only; never invents an id, slug, or tab.
 *   2. Fails visibly — an unresolvable request returns `valid: false` with
 *      the exact lookup that failed (`failedLookup`), never a silent
 *      fallback to some generic tab.
 *   3. Journey-scoped only — returns a value for the caller to render;
 *      writes nothing, mutates no persona preference or global config.
 *   4. Canonical IDs over labels — resolution keys on catalogue ids and
 *      codex/tab ids/slugs, never on display labels.
 *   5. One helper for all journeys — JOURNEY_OPERATOR_DESTINATIONS below is
 *      the ONLY per-journey data; resolveJourneyOperatorDestination's own
 *      logic is completely journey-agnostic. Financial Services is just the
 *      first consumer.
 *   6. Catalogue-validated before activation — see
 *      tests/moneypenny-catalogue-operate-destination.test.ts's "every
 *      registered journey destination resolves" canary, which iterates
 *      registeredJourneyIds() and fails the build if any entry stops
 *      resolving.
 *
 * What this helper does NOT own (deliberately): Passport/personhood truth,
 * Journey stage/evidence truth, authorization, MoneyPenny's own runtime
 * state, or any live per-persona activation status. `participantState` is
 * accepted as an ALREADY-RESOLVED signal from the caller (the same
 * citizenPassportUsable-style value CI/KNYTS bridge pages already derive
 * from their own runtime-state reads) — this module only branches
 * PRESENTATION on it, never derives it.
 */

import { getActivationEntry, embedSlugForSourceCartridge } from '@/data/activation-catalog';
import { getCodexBySlug, resolveLegacyTabSlug } from '@/data/codex-configs';
import { buildCodexUrl, type CodexNavOptions } from '@/utils/codex-nav';

export type ParticipantThresholdState = 'PRE_PASSPORT' | 'POST_PASSPORT';

export interface RequestedOperatorDestination {
  /** ACTIVATION_CATALOG id (data/activation-catalog.ts), e.g. 'moneypenny'. */
  catalogueItemRef: string;
  /** Tab slug within the codex that catalogue item mirrors into. */
  tabRef: string;
  /**
   * Sub-modes reachable FROM the resolved tab — declared per-journey DATA
   * (never generic helper logic), for AEE/Experience Guide context only.
   * Never a hint to default into one of them directly.
   */
  serviceModes?: string[];
}

export interface ResolvedOperatorDestination {
  catalogueItemId: string;
  /** The catalogue entry's own sourceCartridge value (informational). */
  catalogueSourceCartridge: string;
  /** The real codex id hosting the resolved tab. */
  cartridgeRef: string;
  /** The real codex slug (for embed URLs). */
  cartridgeSlug: string;
  /** The resolved CodexTab.id. */
  tabId: string;
  /** The resolved CodexTab.slug (post legacy-alias resolution). */
  tabSlug: string;
  /** Deep-link embed URL — buildCodexUrl(cartridgeSlug, {tab: tabSlug, ...navOptions}). */
  route: string;
  /** Derived purely from the catalogue entry's `gate` — never live persona state. */
  activationIntent: 'self-activate' | 'request-access';
  serviceModes?: string[];
}

export type DestinationLookupFailure = 'journey-not-registered' | 'catalogueItem' | 'cartridge' | 'tab';

export interface JourneyOperatorDestinationInput {
  journeyId: string;
  /** Caller-resolved threshold signal — this module never derives it. */
  participantState: { citizenPassportUsable: boolean };
  /** Extra buildCodexUrl options to carry through (personaId, agentSlug, etc). */
  navOptions?: CodexNavOptions;
}

export type JourneyOperatorDestinationResolution =
  | {
      valid: true;
      journeyId: string;
      thresholdState: ParticipantThresholdState;
      /** PUBLIC_ORIENTATION: stay inside the journey's own pre-Passport stages. CATALOGUE_ACTIVATION: render operatorDestination.route directly. */
      activationMode: 'PUBLIC_ORIENTATION' | 'CATALOGUE_ACTIVATION';
      operatorDestination: ResolvedOperatorDestination;
    }
  | {
      valid: false;
      journeyId: string;
      failedLookup: DestinationLookupFailure;
      reason: string;
    };

/**
 * Declared journey intent — the ONLY per-journey data in this module.
 * Adding a destination for a new journey is a new entry here, never new
 * branching logic in resolveOperatorDestination /
 * resolveJourneyOperatorDestination.
 */
const JOURNEY_OPERATOR_DESTINATIONS: Record<string, RequestedOperatorDestination> = {
  // Financial Services / Horizen Constitutional Admission Journey
  // (services/journey/horizenMoneyPennyJourney.ts).
  'horizen-moneypenny-admission': {
    catalogueItemRef: 'moneypenny',
    // 'home' (navigation/viewport correction, 2026-09-03) — see
    // ACTIVATION_CATALOG's 'moneypenny' entry's own comment on why the old
    // 'moneypenny-orchestration' tabSlug no longer exists; 'home' is the
    // real, current default landing tab in METAME_CODEX's MoneyPenny group.
    tabRef: 'home',
    serviceModes: ['advisor', 'architect', 'runtime'],
  },
};

/**
 * Pure resolution: a requested catalogue item + tab -> a validated,
 * routable destination, or a named failure. Reads data/activation-catalog.ts
 * and data/codex-configs.ts ONLY — never invents catalogue/cartridge/tab
 * truth, and never falls back to a generic surface on failure.
 */
export function resolveOperatorDestination(
  requested: RequestedOperatorDestination,
  navOptions: CodexNavOptions = {},
):
  | { valid: true; destination: ResolvedOperatorDestination }
  | { valid: false; failedLookup: 'catalogueItem' | 'cartridge' | 'tab'; reason: string } {
  const entry = getActivationEntry(requested.catalogueItemRef);
  if (!entry) {
    return {
      valid: false,
      failedLookup: 'catalogueItem',
      reason: `No ACTIVATION_CATALOG entry with id '${requested.catalogueItemRef}'.`,
    };
  }

  const cartridgeSlug = embedSlugForSourceCartridge(entry.sourceCartridge);
  const cartridge = getCodexBySlug(cartridgeSlug);
  if (!cartridge) {
    return {
      valid: false,
      failedLookup: 'cartridge',
      reason: `No registered codex for slug '${cartridgeSlug}' (resolved from catalogue entry '${entry.id}''s sourceCartridge '${entry.sourceCartridge}').`,
    };
  }

  const resolvedTabSlug = resolveLegacyTabSlug(requested.tabRef);
  const tab = cartridge.tabs.find((t) => t.slug === resolvedTabSlug);
  if (!tab) {
    return {
      valid: false,
      failedLookup: 'tab',
      reason: `No tab with slug '${resolvedTabSlug}' in codex '${cartridge.id}' (catalogue entry '${entry.id}').`,
    };
  }
  if (tab.activationId && tab.activationId !== entry.id) {
    return {
      valid: false,
      failedLookup: 'tab',
      reason: `Tab '${tab.slug}' in codex '${cartridge.id}' is gated by activation '${tab.activationId}', not the requested '${entry.id}'.`,
    };
  }

  return {
    valid: true,
    destination: {
      catalogueItemId: entry.id,
      catalogueSourceCartridge: entry.sourceCartridge,
      cartridgeRef: cartridge.id,
      cartridgeSlug: cartridge.slug,
      tabId: tab.id,
      tabSlug: tab.slug,
      route: buildCodexUrl(cartridge.slug, { ...navOptions, tab: tab.slug }),
      activationIntent: entry.gate === 'open' ? 'self-activate' : 'request-access',
      ...(requested.serviceModes ? { serviceModes: requested.serviceModes } : {}),
    },
  };
}

/**
 * journeyId + caller-resolved participant threshold state -> the full
 * resolution the caller renders. Fails visibly (`valid: false` +
 * `failedLookup`) rather than falling back to a generic surface — a
 * journey with no registered destination, or a registered destination that
 * no longer resolves, is reported, never silently swallowed.
 */
export function resolveJourneyOperatorDestination(
  input: JourneyOperatorDestinationInput,
): JourneyOperatorDestinationResolution {
  const requested = JOURNEY_OPERATOR_DESTINATIONS[input.journeyId];
  if (!requested) {
    return {
      valid: false,
      journeyId: input.journeyId,
      failedLookup: 'journey-not-registered',
      reason: `No Operate destination is registered for journeyId '${input.journeyId}'.`,
    };
  }

  const resolved = resolveOperatorDestination(requested, input.navOptions);
  if (!resolved.valid) {
    return { valid: false, journeyId: input.journeyId, failedLookup: resolved.failedLookup, reason: resolved.reason };
  }

  const thresholdState: ParticipantThresholdState = input.participantState.citizenPassportUsable
    ? 'POST_PASSPORT'
    : 'PRE_PASSPORT';

  return {
    valid: true,
    journeyId: input.journeyId,
    thresholdState,
    activationMode: thresholdState === 'POST_PASSPORT' ? 'CATALOGUE_ACTIVATION' : 'PUBLIC_ORIENTATION',
    operatorDestination: resolved.destination,
  };
}

/**
 * Every journeyId with a registered Operate destination — the build/test-
 * time validation gate (closeout brief item 6) iterates this to assert each
 * one still resolves. Also used by the AEE adapter to decide when to
 * populate JourneyProjectionContext.operateDestination. Never used to
 * render anything itself.
 */
export function registeredJourneyIds(): string[] {
  return Object.keys(JOURNEY_OPERATOR_DESTINATIONS);
}

/** Back-compat shape for the AEE adapter/manifest — the plain declared destination, without threshold resolution. Returns null (never a guess) when the journey has none registered. */
export function resolveOperateDestination(
  journeyId: string,
): { catalogueItemId: string; defaultTab: string; availableModes?: string[] } | null {
  const requested = JOURNEY_OPERATOR_DESTINATIONS[journeyId];
  if (!requested) return null;
  return {
    catalogueItemId: requested.catalogueItemRef,
    defaultTab: requested.tabRef,
    ...(requested.serviceModes ? { availableModes: requested.serviceModes } : {}),
  };
}
