/**
 * substrateState.ts — SPEC-COS-001 Phase 1: the substrate-state resolver +
 * the progressive surface activation seam.
 *
 * SPEC-COS-001 ("The Constitutional Onboarding Specification", operator-ratified
 * 2026-07-25) states one governing principle: **there is only one onboarding
 * substrate, and specialist journeys diverge only after Agent Me.** Every
 * arrival — through a third-party agent (PRD-THR-001's Threshold Companion) or
 * directly in a browser (SPEC-COS-001 §2.3) — crosses the same layers:
 *
 *     Claude → MCP → Passport → Delegation → Agent Me → Experience Qubes → Journey
 *
 * This module answers exactly two questions and nothing else:
 *
 *   1. **Where on the substrate does this caller currently stand?**
 *      (`getSubstrateState` — composes existing readers, resolves nothing itself)
 *   2. **Given that, which surfaces may be active?**
 *      (`activeSurfaces` — PURE, the §4 progressive-surface-activation doctrine
 *      expressed as one testable function)
 *
 * ── What this module COMPOSES (and therefore does NOT re-implement) ──────────
 *
 *   - identity          → `getActivePersona` (the spine; caller-resolved by the route)
 *   - passport/access/  → `resolveParticipationSelfView` (services/passport) — itself
 *     delegation          the extracted body of GET /api/participation/my-access,
 *                         so this resolver and the accession progress bar can never
 *                         disagree about the same caller (2026-07-20 incident class)
 *   - experience state  → `getExperienceQube` (services/iqube/experienceQube.ts)
 *   - journeys          → `journeyRegistry` (services/threshold) — PRD-THR-001 §9.1's
 *                         pure-data source of truth; NOT re-listed here
 *   - passport surfaces → `passportDeepLinks` (services/constitutional/guidedOnboarding.ts),
 *                         CFS-043a's shipped deep-link builder
 *
 * ── The Principal–Delegate Separation is structural here, as it is upstream ──
 *
 * This module is READ-ONLY. It resolves and describes; it never forms, accepts,
 * authorizes, grants, or mutates anything. There is deliberately no code path
 * through which an agent could advance a layer — advancing the Delegation layer
 * is `authorizeAgreement`, which refuses anyone but the owning human persona
 * (CFS-043 §2). `tests/onboarding-substrate.test.ts` is the canary for both that
 * absence and the progressive-activation ordering.
 *
 * ── Honesty about what is NOT resolvable today ───────────────────────────────
 *
 * Two layers have no platform state to resolve against, and this module says so
 * rather than inventing a signal (CLAUDE.md "No Guessing or Hallucinating"):
 *
 *   - **Agent Me** — aigentMe reachability is DERIVED from passport issuance
 *     (§2.2: aigentMe is the operating home of the Constitutional Persona the
 *     Passport establishes). Actual *engagement* with the four Capsules is not
 *     persisted on any surface today.
 *   - **Journey** — `journey.select` exists as a constitutional-root capability
 *     (`CONSTITUTIONAL_ROOT_CAPABILITIES`), but NO store persists a selected
 *     journey for a persona. This layer therefore never reads as `crossed`, and
 *     the downstream `specialist-journey` surface consequently never activates.
 *     A journey *recommendation* is derivable from the ExperienceQube's
 *     `operatorArchetype`; a *selection* is not.
 */

import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveParticipationSelfView } from '@/services/passport/participationSelfView';
import { getExperienceQube, type OperatorArchetype } from '@/services/iqube/experienceQube';
import { getJourney, isJourneyId, type ConstitutionalJourney, type JourneyId } from '@/services/threshold/journeyRegistry';
import { passportDeepLinks, type DeepLinkOptions } from '@/services/constitutional/guidedOnboarding';

// ─────────────────────────────────────────────────────────────────────────────
// The substrate — layers, surfaces, and their gates (SPEC-COS-001 §1, §4)
// ─────────────────────────────────────────────────────────────────────────────

/** The seven layers of SPEC-COS-001 §1, in crossing order. */
export type SubstrateLayerId =
  | 'companion'
  | 'gateway'
  | 'passport'
  | 'delegation'
  | 'agent-me'
  | 'experience-qubes'
  | 'journey';

/**
 * `crossed`        — the caller has crossed this layer.
 * `available`      — reachable now; the caller's next move may be here.
 * `blocked`        — an upstream required layer is not yet crossed.
 * `not-applicable` — absent for this arrival channel (§2.3: a direct human
 *                    arrival simply has no third-party-agent layer; it is absent,
 *                    not replaced).
 */
export type SubstrateLayerStatus = 'crossed' | 'available' | 'blocked' | 'not-applicable';

/**
 * How the status was arrived at — the epistemic honesty dial.
 * `observed`             — read from real platform state.
 * `declared`             — asserted by the caller/channel, not observed.
 * `derived`              — inferred from another observed layer; stated as such.
 * `not-resolvable-today` — no platform state exists for this; never claimed crossed.
 */
export type SubstrateResolution = 'observed' | 'declared' | 'derived' | 'not-resolvable-today';

export interface SubstrateLayer {
  id: SubstrateLayerId;
  title: string;
  status: SubstrateLayerStatus;
  resolution: SubstrateResolution;
  /** Plain-language statement of exactly what was and was not observed. */
  evidence: string;
  /**
   * Optional layers never gate a downstream layer. Delegation is optional for a
   * direct human arrival (§2.3) — the ratified accession ladder already treats
   * it as "optional, never gates" (AccessionProgressBar, operator 2026-07-20).
   */
  optional: boolean;
}

/** The surfaces progressive activation governs (§4's table, as ids). */
export type SubstrateSurfaceId =
  | 'threshold-discovery'
  | 'passport-apply'
  | 'delegation-authorize'
  | 'aigentme-capsules'
  | 'experience-qube-recommendations'
  | 'journey-selection'
  | 'specialist-journey';

interface SurfaceSpec {
  id: SubstrateSurfaceId;
  title: string;
  /**
   * The layer whose crossing REVEALS this surface. §4's doctrine: "Each layer's
   * crossing reveals the next layer's surface; it does not pre-activate
   * downstream surfaces 'just in case.'"
   */
  revealedBy: SubstrateLayerId;
}

/**
 * The single ordered table of surfaces and the layer whose crossing reveals
 * each. `activeSurfaces` is nothing but a filter over this — so adding a surface
 * means adding one row here, never a new branch of activation logic.
 */
export const SUBSTRATE_SURFACES: readonly SurfaceSpec[] = [
  { id: 'threshold-discovery', title: 'Read-only resource discovery', revealedBy: 'companion' },
  { id: 'passport-apply', title: 'Apply for a Polity Passport', revealedBy: 'gateway' },
  { id: 'delegation-authorize', title: 'Authorize a bounded delegation', revealedBy: 'passport' },
  { id: 'aigentme-capsules', title: 'The aigentMe Capsules', revealedBy: 'passport' },
  { id: 'experience-qube-recommendations', title: 'Experience Qube recommendations', revealedBy: 'agent-me' },
  { id: 'journey-selection', title: 'Choose a constitutional journey', revealedBy: 'experience-qubes' },
  { id: 'specialist-journey', title: "The selected journey's own ladder", revealedBy: 'journey' },
] as const;

/**
 * ExperienceQube `operatorArchetype` → the Journey Registry journey it biases
 * toward. Two independently-defined unions, mapped once, here.
 *
 * Not a duplicate of either source: `Record<OperatorArchetype, JourneyId>` makes
 * the key side exhaustive at compile time, and the canary in
 * `tests/onboarding-substrate.test.ts` asserts every value still resolves in the
 * live journey registry (`isJourneyId` / `getJourney`) — so a journey renamed or
 * removed upstream fails the build rather than silently recommending nothing.
 */
export const ARCHETYPE_JOURNEY: Record<OperatorArchetype, JourneyId> = {
  citizen: 'citizen',
  entrepreneurial: 'entrepreneur',
  technical: 'technical',
  creative: 'creative',
  research: 'researcher',
};

// ─────────────────────────────────────────────────────────────────────────────
// PURE core — no I/O, fully unit-testable
// ─────────────────────────────────────────────────────────────────────────────

/** How the caller reached the substrate (§1.1, §2.3). */
export type ArrivalChannel = 'threshold-companion' | 'direct';

/** The raw signals the layer resolver consumes. Every field is a fact someone
 *  else observed — this module reads none of them itself. */
export interface SubstrateObservation {
  arrivalChannel: ArrivalChannel;
  /** The spine resolved an active persona for this caller. */
  authenticated: boolean;
  passportIssued: boolean;
  delegationActive: boolean;
  experienceQubeConfigured: boolean;
  operatorArchetype: OperatorArchetype | null;
}

const CROSSED = (l: SubstrateLayer | undefined) => l?.status === 'crossed';

/**
 * Resolve the caller's position on the substrate. PURE.
 *
 * Ordering law: a layer is `blocked` unless every REQUIRED layer above it is
 * crossed. Optional layers (Delegation) are skipped when testing whether a
 * downstream layer is reachable — a direct human who never delegates still
 * reaches aigentMe, Experience Qubes, and journey selection (§2.3).
 */
export function resolveSubstrateLayers(o: SubstrateObservation): SubstrateLayer[] {
  const layers: SubstrateLayer[] = [];

  // 1. Claude / the Threshold Companion — the arrival channel itself.
  layers.push(
    o.arrivalChannel === 'threshold-companion'
      ? {
          id: 'companion',
          title: 'Threshold Companion',
          status: 'crossed',
          resolution: 'declared',
          evidence:
            'The arrival channel is declared by the caller, not observed: the Companion is the external agent itself (SPEC-COS-001 §2.1) and metaMe holds no platform state about it.',
          optional: false,
        }
      : {
          id: 'companion',
          title: 'Threshold Companion',
          status: 'not-applicable',
          resolution: 'declared',
          evidence:
            'Direct arrival — no third-party agent mediates this crossing. Per SPEC-COS-001 §2.3 layer 1 is ABSENT, not replaced; everything from Passport onward is identical.',
          optional: false,
        },
  );

  // 2. MCP / the in-app copilot surface — reachable once the spine has a caller.
  layers.push({
    id: 'gateway',
    title: o.arrivalChannel === 'threshold-companion' ? 'Threshold Gateway (MCP)' : 'In-app copilot surface',
    status: o.authenticated ? 'crossed' : 'blocked',
    resolution: 'observed',
    evidence: o.authenticated
      ? 'The identity spine resolved an active persona for this caller (getActivePersona).'
      : 'The identity spine resolved no active persona — nothing below this layer can be observed.',
    optional: false,
  });
  const gateway = layers[1];

  // 3. Passport — personhood continuity. Observed person-level, never flattened
  //    onto the active persona (the 2026-07-20 DidQube observation ratification).
  layers.push({
    id: 'passport',
    title: 'Polity Passport',
    status: o.passportIssued ? 'crossed' : CROSSED(gateway) ? 'available' : 'blocked',
    resolution: 'observed',
    evidence: o.passportIssued
      ? 'A polity_passport_record exists for this person (observed across the kybe chain and the person\'s spine personas).'
      : 'No polity_passport_record found for this person.',
    optional: false,
  });
  const passport = layers[2];

  // 4. Delegation — the human-only gate. OPTIONAL: it never blocks a downstream
  //    layer (§2.3; ratified accession ladder 2026-07-20).
  layers.push({
    id: 'delegation',
    title: 'Bounded delegation',
    status: o.delegationActive ? 'crossed' : CROSSED(passport) ? 'available' : 'blocked',
    resolution: 'observed',
    evidence: o.delegationActive
      ? 'An active delegation grant exists for this person. Only the human authorized it — authorizeAgreement refuses anyone but the owning persona (CFS-043 §2).'
      : 'No active delegation grant. This layer is OPTIONAL and never gates a later layer; it becomes required the moment an external agent needs bounded authority.',
    optional: true,
  });

  // 5. Agent Me — DERIVED, and said so. aigentMe is the operating home of the
  //    Constitutional Persona the Passport establishes (§2.2); engagement with
  //    the four Capsules is not persisted anywhere today.
  layers.push({
    id: 'agent-me',
    title: 'aigentMe',
    status: CROSSED(passport) ? 'crossed' : 'blocked',
    resolution: 'derived',
    evidence: CROSSED(passport)
      ? 'DERIVED from passport issuance: aigentMe is the operating home of the Constitutional Persona the Passport establishes (SPEC-COS-001 §2.2). Engagement with the four Capsules is NOT separately observed on any platform surface today.'
      : 'Blocked: aigentMe is where the Constitutional Persona operates, and no Passport has established one yet.',
    optional: false,
  });
  const agentMe = layers[4];

  // 6. Experience Qubes — the recommendation layer. Genuinely observed.
  layers.push({
    id: 'experience-qubes',
    title: 'Experience Qube',
    status: o.experienceQubeConfigured ? 'crossed' : CROSSED(agentMe) ? 'available' : 'blocked',
    resolution: 'observed',
    evidence: o.experienceQubeConfigured
      ? 'An ExperienceQube record exists for the active persona (T1 meta slice only was read; the BlakQube slice was not touched).'
      : 'No ExperienceQube record for the active persona — nothing has been observed or declared to recommend from yet.',
    optional: false,
  });
  const eq = layers[5];

  // 7. Journey — NOT RESOLVABLE TODAY. `journey.select` is a constitutional-root
  //    capability, but no store persists a selected journey, so this layer can
  //    never honestly read as `crossed`.
  layers.push({
    id: 'journey',
    title: 'Journey recommendation',
    status: CROSSED(eq) ? 'available' : 'blocked',
    resolution: 'not-resolvable-today',
    evidence:
      'NOT RESOLVABLE TODAY: `journey.select` exists as a constitutional-root capability (services/threshold/serviceRegistry.ts) but no store persists a selected journey for a persona. A recommendation is derivable from the ExperienceQube archetype; a selection is not observable, so this layer never reads as crossed and the downstream specialist-journey surface never activates.',
    optional: false,
  });

  return layers;
}

/**
 * Progressive surface activation (SPEC-COS-001 §4), as one pure function.
 *
 * > At every layer of the onboarding substrate the arriving person is granted
 * > the MINIMUM surface needed to take their next action — never the union of
 * > everything the platform could eventually show them.
 *
 * A surface is active iff the layer that reveals it is `crossed`. A layer that
 * is `not-applicable` (the absent Companion layer on a direct arrival) still
 * reveals its surface — absence of a third-party agent must not withhold
 * read-only discovery from a direct arrival (§2.3: the substrate does not fork
 * by channel, only its topmost rung does).
 *
 * The law this function must always satisfy, and the canary asserts: a
 * downstream surface NEVER appears while its gate layer is uncrossed.
 */
export function activeSurfaces(layers: SubstrateLayer[]): SubstrateSurfaceId[] {
  const byId = new Map(layers.map((l) => [l.id, l]));
  return SUBSTRATE_SURFACES.filter((s) => {
    const gate = byId.get(s.revealedBy);
    if (!gate) return false;
    return gate.status === 'crossed' || gate.status === 'not-applicable';
  }).map((s) => s.id);
}

export interface SubstrateNextAction {
  layer: SubstrateLayerId;
  surface: SubstrateSurfaceId | null;
  title: string;
  /** A verified in-app deep link, or null. Never a guessed URL. */
  deepLink: string | null;
}

/**
 * The SINGLE next action (§4: "the minimum surface needed to take their next
 * action"). PURE.
 *
 * The first REQUIRED layer that is not yet crossed. Optional layers are skipped
 * — a citizen is never told "authorize a delegation" as their one next step when
 * nothing needs bounded authority yet. Because the Journey layer can never read
 * as crossed (see above), a fully-crossed caller's next action terminates at
 * "choose a journey" — the same terminal step PRD-THR-001's crossing receipt
 * states (`nextStep: 'choose a journey'`).
 */
export function nextAction(
  layers: SubstrateLayer[],
  deepLinks: { apply: string; delegation: string },
): SubstrateNextAction | null {
  const open = layers.find((l) => !l.optional && l.status !== 'crossed' && l.status !== 'not-applicable');
  if (!open) return null;
  const surface = LAYER_ACTION_SURFACE[open.id];
  const titles: Record<SubstrateLayerId, string> = {
    companion: 'Bring the agent you already use, or continue directly in the browser',
    gateway: 'Sign in, so the identity spine can resolve you',
    passport: 'Apply for a Polity Passport',
    delegation: 'Authorize a bounded delegation (you authorize — nobody else can)',
    'agent-me': "Engage aigentMe — your Constitutional Persona's operating home",
    'experience-qubes': 'Set up your Experience Qube, so recommendations have something to read',
    journey: 'Choose a constitutional journey',
  };
  const deepLink = open.id === 'passport' ? deepLinks.apply : open.id === 'delegation' ? deepLinks.delegation : null;
  return { layer: open.id, surface, title: titles[open.id], deepLink };
}

/**
 * The surface on which a person ACTS to cross each layer. Distinct from
 * `SUBSTRATE_SURFACES[].revealedBy` (which says what a crossing REVEALS): you
 * act on the aigentMe surface — revealed by the Passport crossing — in order to
 * cross the Agent Me layer.
 */
const LAYER_ACTION_SURFACE: Record<SubstrateLayerId, SubstrateSurfaceId | null> = {
  companion: 'threshold-discovery',
  gateway: null, // signing in is not a substrate surface
  passport: 'passport-apply',
  delegation: 'delegation-authorize',
  'agent-me': 'aigentme-capsules',
  'experience-qubes': 'experience-qube-recommendations',
  journey: 'journey-selection',
};

/**
 * Derive the recommended journey from the ExperienceQube archetype. PURE.
 * Returns null when no archetype has been observed or declared — §6's
 * "observed, never asserted" discipline: the recommendation layer has no
 * authority to fast-track a persona past a gate, and no authority to invent a
 * preference the persona never expressed.
 */
export function recommendJourney(archetype: OperatorArchetype | null): ConstitutionalJourney | null {
  if (!archetype) return null;
  const id = ARCHETYPE_JOURNEY[archetype];
  return id && isJourneyId(id) ? getJourney(id) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// I/O — compose the observation, then hand it to the pure core
// ─────────────────────────────────────────────────────────────────────────────

export interface SubstrateState {
  arrivalChannel: ArrivalChannel;
  layers: SubstrateLayer[];
  activeSurfaces: SubstrateSurfaceId[];
  nextAction: SubstrateNextAction | null;
  recommendedJourney: { id: JourneyId; title: string; goal: string; ladder: string[] } | null;
  /** The layers with no platform state to resolve against, named honestly. */
  notResolvable: SubstrateLayerId[];
}

/**
 * Resolve where the caller stands on the substrate.
 *
 * The caller MUST already be spine-resolved — this function takes the resolved
 * persona rather than re-resolving it, so the whole request has exactly ONE
 * persona resolution (the 2026-07-20 lesson: two transports resolving two
 * personas is the inconsistency the spine exists to abolish).
 *
 * Every read here is delegated. Nothing about passport, access, delegation,
 * experience state, or the journey catalogue is derived in this file.
 */
export async function getSubstrateState(
  request: NextRequest,
  admin: SupabaseClient,
  persona: { personaId: string; authProfileId: string },
  opts: { arrivalChannel?: ArrivalChannel; link?: DeepLinkOptions } = {},
): Promise<SubstrateState> {
  const arrivalChannel: ArrivalChannel = opts.arrivalChannel ?? 'direct';

  const participation = await resolveParticipationSelfView(request, admin, persona);

  // ExperienceQube: T1 meta slice only. A missing table degrades to null inside
  // getExperienceQube; a genuine DB error is caught here so the substrate still
  // reports its lower layers honestly rather than 500-ing the whole read.
  let experienceQubeConfigured = false;
  let operatorArchetype: OperatorArchetype | null = null;
  try {
    const record = await getExperienceQube(persona.personaId);
    experienceQubeConfigured = record !== null;
    operatorArchetype = record?.meta.operatorArchetype ?? null;
  } catch {
    /* observation unavailable → reads as not configured */
  }

  const layers = resolveSubstrateLayers({
    arrivalChannel,
    authenticated: true,
    passportIssued: participation.passportIssued,
    delegationActive: participation.delegationActive,
    experienceQubeConfigured,
    operatorArchetype,
  });

  const links = passportDeepLinks(opts.link);
  const journey = recommendJourney(operatorArchetype);

  return {
    arrivalChannel,
    layers,
    activeSurfaces: activeSurfaces(layers),
    nextAction: nextAction(layers, links),
    recommendedJourney: journey
      ? { id: journey.id, title: journey.title, goal: journey.goal, ladder: journey.ladder }
      : null,
    notResolvable: layers.filter((l) => l.resolution === 'not-resolvable-today').map((l) => l.id),
  };
}

/** The unauthenticated substrate state — everything below the gateway is
 *  unobservable, so nothing below it is claimed. */
export function unauthenticatedSubstrateState(arrivalChannel: ArrivalChannel = 'direct'): SubstrateState {
  const layers = resolveSubstrateLayers({
    arrivalChannel,
    authenticated: false,
    passportIssued: false,
    delegationActive: false,
    experienceQubeConfigured: false,
    operatorArchetype: null,
  });
  return {
    arrivalChannel,
    layers,
    activeSurfaces: activeSurfaces(layers),
    nextAction: nextAction(layers, passportDeepLinks()),
    recommendedJourney: null,
    notResolvable: layers.filter((l) => l.resolution === 'not-resolvable-today').map((l) => l.id),
  };
}
