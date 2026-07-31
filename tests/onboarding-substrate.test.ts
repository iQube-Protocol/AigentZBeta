/**
 * SPEC-COS-001 substrate canary (Phase 1) — the peer of
 * `tests/threshold-gateway.test.ts`, guarding the same two constitutional
 * properties one layer up the substrate:
 *
 *  1. **Progressive surface activation is a law, not a convention** (§4) — a
 *     downstream surface must NEVER be revealed before the layer that reveals it
 *     is crossed. Asserted exhaustively over every reachable observation, not
 *     just the happy path.
 *  2. **No auto-authorize path exists** (CFS-043 §2, Principal–Delegate
 *     Separation) — the resolver and its route are read-only by construction;
 *     neither imports, references, or could reach `authorizeAgreement`, and the
 *     route exposes no mutating method.
 *
 * Plus the two disciplines this module is most likely to drift on:
 *  - **T1 exposure** — the browser-bound state carries no T0 identifier.
 *  - **Source-of-truth parity** (inv.engineering.036/037) — ARCHETYPE_JOURNEY
 *    stays a live projection of the Threshold Journey Registry.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  resolveSubstrateLayers,
  activeSurfaces,
  nextAction,
  recommendJourney,
  unauthenticatedSubstrateState,
  SUBSTRATE_SURFACES,
  ARCHETYPE_JOURNEY,
  type SubstrateObservation,
  type SubstrateLayer,
  type SubstrateSurfaceId,
} from '../services/onboarding/substrateState';
import { getJourney, isJourneyId } from '../services/threshold/journeyRegistry';
import { CONSTITUTIONAL_ROOT_CAPABILITIES } from '../services/threshold/serviceRegistry';

const REPO = join(__dirname, '..');
const RESOLVER_SRC = readFileSync(join(REPO, 'services/onboarding/substrateState.ts'), 'utf8');
const ROUTE_SRC = readFileSync(join(REPO, 'app/api/onboarding/substrate-state/route.ts'), 'utf8');

const BOOLS = [false, true];

/** Every reachable observation — the full cross-product, so the activation law
 *  is proven over the space rather than sampled. */
function everyObservation(): SubstrateObservation[] {
  const out: SubstrateObservation[] = [];
  for (const arrivalChannel of ['direct', 'threshold-companion'] as const)
    for (const authenticated of BOOLS)
      for (const passportIssued of BOOLS)
        for (const delegationActive of BOOLS)
          for (const experienceQubeConfigured of BOOLS)
            for (const operatorArchetype of [null, 'technical', 'citizen'] as const)
              out.push({
                arrivalChannel,
                authenticated,
                passportIssued,
                delegationActive,
                experienceQubeConfigured,
                operatorArchetype,
              });
  return out;
}

const layersFor = (o: Partial<SubstrateObservation>): SubstrateLayer[] =>
  resolveSubstrateLayers({
    arrivalChannel: 'direct',
    authenticated: true,
    passportIssued: false,
    delegationActive: false,
    experienceQubeConfigured: false,
    operatorArchetype: null,
    ...o,
  });

const surfacesFor = (o: Partial<SubstrateObservation>): SubstrateSurfaceId[] => activeSurfaces(layersFor(o));

describe('Progressive surface activation (SPEC-COS-001 §4) — the law', () => {
  it('NEVER reveals a surface whose gate layer is not crossed — over every observation', () => {
    for (const o of everyObservation()) {
      const layers = resolveSubstrateLayers(o);
      const byId = new Map(layers.map((l) => [l.id, l]));
      const active = new Set(activeSurfaces(layers));
      for (const surface of SUBSTRATE_SURFACES) {
        if (!active.has(surface.id)) continue;
        const gate = byId.get(surface.revealedBy);
        // The ONLY two states that may reveal a surface: the gate was crossed,
        // or the gate is constitutionally absent for this arrival channel
        // (§2.3 — layer 1 absent, not replaced). Anything else is a leak.
        expect(
          gate?.status === 'crossed' || gate?.status === 'not-applicable',
          `surface '${surface.id}' leaked while gate '${surface.revealedBy}' was '${gate?.status}' (${JSON.stringify(o)})`,
        ).toBe(true);
      }
    }
  });

  it('an unauthenticated arrival gets read-only discovery and nothing more', () => {
    const state = unauthenticatedSubstrateState('direct');
    expect(state.activeSurfaces).toEqual(['threshold-discovery']);
    expect(state.activeSurfaces).not.toContain('passport-apply');
    expect(state.nextAction?.layer).toBe('gateway');
  });

  it('signing in reveals the Passport surface — and NOT delegation, aigentMe, or anything below', () => {
    const s = surfacesFor({ authenticated: true, passportIssued: false });
    expect(s).toContain('passport-apply');
    expect(s).not.toContain('delegation-authorize');
    expect(s).not.toContain('aigentme-capsules');
    expect(s).not.toContain('experience-qube-recommendations');
    expect(s).not.toContain('journey-selection');
  });

  it('the Passport crossing reveals delegation AND aigentMe — but not the recommendation layer', () => {
    const s = surfacesFor({ passportIssued: true });
    expect(s).toContain('delegation-authorize');
    expect(s).toContain('aigentme-capsules');
    // agent-me is crossed (derived from passport), so its OWN surface is revealed
    expect(s).toContain('experience-qube-recommendations');
    // …but journey selection waits on a configured ExperienceQube
    expect(s).not.toContain('journey-selection');
  });

  it('journey selection is revealed only once the ExperienceQube is configured', () => {
    expect(surfacesFor({ passportIssued: true, experienceQubeConfigured: false })).not.toContain('journey-selection');
    expect(surfacesFor({ passportIssued: true, experienceQubeConfigured: true })).toContain('journey-selection');
  });

  it('the specialist-journey surface NEVER activates today (journey selection is not resolvable)', () => {
    for (const o of everyObservation()) {
      expect(activeSurfaces(resolveSubstrateLayers(o))).not.toContain('specialist-journey');
    }
  });
});

describe('Layer ordering + optionality (§2.3)', () => {
  it('delegation is OPTIONAL and never gates aigentMe or anything below it', () => {
    const withoutDelegation = surfacesFor({ passportIssued: true, delegationActive: false, experienceQubeConfigured: true });
    const withDelegation = surfacesFor({ passportIssued: true, delegationActive: true, experienceQubeConfigured: true });
    expect(withoutDelegation).toEqual(withDelegation);
    expect(withoutDelegation).toContain('aigentme-capsules');
    expect(withoutDelegation).toContain('journey-selection');
  });

  it('delegation is never offered as the SINGLE next action (it is optional, not the ladder)', () => {
    for (const o of everyObservation()) {
      const layers = resolveSubstrateLayers(o);
      expect(nextAction(layers, { apply: '/apply', delegation: '/delegate' })?.layer).not.toBe('delegation');
    }
  });

  it('a direct arrival marks the Companion layer ABSENT, not crossed and not blocked (§2.3)', () => {
    const companion = layersFor({ arrivalChannel: 'direct' }).find((l) => l.id === 'companion');
    expect(companion?.status).toBe('not-applicable');
    expect(companion?.evidence).toMatch(/ABSENT, not replaced/);
  });

  it('everything below the gateway is blocked when the spine resolves no caller', () => {
    const layers = layersFor({ authenticated: false });
    for (const id of ['passport', 'delegation', 'agent-me', 'experience-qubes', 'journey']) {
      expect(layers.find((l) => l.id === id)?.status, id).toBe('blocked');
    }
  });

  it('walks the ladder to its honest terminus: passport → experience qube → choose a journey', () => {
    const links = { apply: '/apply', delegation: '/delegate' };
    expect(nextAction(layersFor({ passportIssued: false }), links)).toMatchObject({
      layer: 'passport',
      deepLink: '/apply',
    });
    expect(nextAction(layersFor({ passportIssued: true }), links)?.layer).toBe('experience-qubes');
    expect(nextAction(layersFor({ passportIssued: true, experienceQubeConfigured: true }), links)?.layer).toBe('journey');
  });
});

describe('Honest gaps — layers with no platform state to resolve against', () => {
  it('names Journey as not-resolvable-today and never claims it crossed', () => {
    for (const o of everyObservation()) {
      const journey = resolveSubstrateLayers(o).find((l) => l.id === 'journey');
      expect(journey?.resolution).toBe('not-resolvable-today');
      expect(journey?.status).not.toBe('crossed');
    }
    // The capability exists; the STORE does not. That asymmetry is the gap.
    expect(CONSTITUTIONAL_ROOT_CAPABILITIES).toContain('journey.select');
  });

  it('marks Agent Me as DERIVED, and says engagement itself is not observed', () => {
    const agentMe = layersFor({ passportIssued: true }).find((l) => l.id === 'agent-me');
    expect(agentMe?.resolution).toBe('derived');
    expect(agentMe?.evidence).toMatch(/NOT separately observed/);
  });

  it('reports the Companion layer as declared, never observed', () => {
    for (const arrivalChannel of ['direct', 'threshold-companion'] as const) {
      expect(layersFor({ arrivalChannel }).find((l) => l.id === 'companion')?.resolution).toBe('declared');
    }
  });

  it('surfaces the not-resolvable set on the state object rather than hiding it', () => {
    expect(unauthenticatedSubstrateState().notResolvable).toEqual(['journey']);
  });
});

describe('Recommendation layer — observed, never asserted (§6)', () => {
  it('recommends nothing when no archetype has been observed', () => {
    expect(recommendJourney(null)).toBeNull();
  });

  it('maps the technical archetype onto the Technical journey (Studio en route to Founder Office)', () => {
    const j = recommendJourney('technical');
    expect(j?.id).toBe('technical');
    expect(j?.ladder).toContain('Studio');
    expect(j?.ladder[j.ladder.length - 1]).toBe('Founder Office');
  });

  it('ARCHETYPE_JOURNEY stays a live projection of the Journey Registry (inv.engineering.036/037)', () => {
    for (const [archetype, journeyId] of Object.entries(ARCHETYPE_JOURNEY)) {
      expect(isJourneyId(journeyId), `${archetype} → ${journeyId}`).toBe(true);
      expect(getJourney(journeyId), `${archetype} → ${journeyId}`).not.toBeNull();
    }
  });
});

describe('Constitutional guardrails — read-only, T1-safe', () => {
  it('no auto-authorize path exists: the resolver never reaches the agreement gate', () => {
    // Prose may NAME the gate (the module documents why it must not reach it);
    // what is forbidden is importing or INVOKING it. Both forms are checked.
    for (const [name, src] of [['resolver', RESOLVER_SRC], ['route', ROUTE_SRC]] as const) {
      expect(src, `${name} imports the agreement module`).not.toMatch(/from ['"][^'"]*constitutionalAgreement['"]/);
      expect(src, `${name} imports the delegation grant store`).not.toMatch(/from ['"][^'"]*delegationGrantStore['"]/);
      expect(src, `${name} invokes an authority mutation`).not.toMatch(
        /\b(authorizeAgreement|acceptAgreement|formAgreement|persistDelegationGrant|claimAccessInvitation)\s*\(/,
      );
    }
  });

  it('the route is read-only — no POST/PUT/PATCH/DELETE handler', () => {
    expect(ROUTE_SRC).toMatch(/export async function GET/);
    expect(ROUTE_SRC).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
  });

  it('the browser-bound substrate state carries no T0 identifier', () => {
    const json = JSON.stringify(unauthenticatedSubstrateState('threshold-companion'));
    expect(json).not.toMatch(/personaId|authProfileId|rootDid|fioHandle|kybe/i);
  });

  it('composes the shipped readers instead of re-deriving passport/access/delegation', () => {
    // CS-001 discipline made checkable: this module must IMPORT the shared
    // observation, never query the underlying tables itself.
    expect(RESOLVER_SRC).toMatch(/resolveParticipationSelfView/);
    expect(RESOLVER_SRC).not.toMatch(/polity_passport_records|access_grants|delegation_grants/);
    expect(RESOLVER_SRC).toMatch(/getExperienceQube/);
    expect(RESOLVER_SRC).toMatch(/journeyRegistry/);
  });
});
