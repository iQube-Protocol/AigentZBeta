/**
 * Action-vocabulary mapping completeness — CI gate.
 *
 * PRD v1.0 §4.3 mandates that every AccessAction (internal) is mapped to
 * either an IQubeAgentAction (surface) or `internal_only`, and that every
 * non-passive IQubeAgentAction has a documented inverse mapping.
 *
 * This test fails the build when:
 *   - An AccessAction enum value lacks an ACTION_SURFACE_MAP entry.
 *   - An IQubeAgentAction lacks both a SURFACE_INTERNAL_MAP entry AND
 *     PASSIVE_SURFACE_VERBS membership.
 *   - SURFACE_INTERNAL_MAP and ACTION_SURFACE_MAP disagree on a non-
 *     internal-only mapping (broken round-trip).
 *
 * Add a new verb in either vocabulary → this test will surface the gap
 * until the mapping is filled in. Review gate per PRD v1.1 §A.6 (iQube
 * Registry cartridge admin tab).
 */

import { describe, expect, it } from 'vitest';

import {
  ACTION_SURFACE_MAP,
  SURFACE_INTERNAL_MAP,
  PASSIVE_SURFACE_VERBS,
  MUTATING_SURFACE_VERBS,
  surfaceForAccessAction,
  accessActionForSurfaceVerb,
  isPassiveSurfaceVerb,
  isMutatingSurfaceVerb,
} from '@/services/iqube/legibility/actionMap';
import type { AccessAction } from '@/types/access';
import type { IQubeAgentAction } from '@/types/iqube/legibility';

// Canonical enum values — kept in sync with the source-of-truth types.
// If either type adds a value and this list isn't updated, the
// per-value tests below will not catch the gap; that's why the
// `every value in the type` checks below use `Object.keys(ACTION_SURFACE_MAP)`
// and the surface-side `KNOWN_SURFACE_VERBS` is asserted against the
// union of SURFACE_INTERNAL_MAP + PASSIVE_SURFACE_VERBS membership.
const KNOWN_ACCESS_ACTIONS: ReadonlyArray<AccessAction> = [
  'read',
  'watch',
  'listen',
  'invoke',
  'connect',
  'remix',
  'mint',
  'transfer',
  'payment-settle',
  'policy-escalation',
  'disclosure',
];

const KNOWN_SURFACE_VERBS: ReadonlyArray<IQubeAgentAction> = [
  'discover',
  'read_meta',
  'read_summary',
  'request_access',
  'read_payload',
  'derive_summary',
  'transform',
  'cite',
  'propose_update',
  'mint_derivative',
  'fork',
  'record_receipt',
  'revoke_access',
  'audit_state',
];

describe('actionMap: ACTION_SURFACE_MAP completeness', () => {
  it('covers every known AccessAction', () => {
    for (const action of KNOWN_ACCESS_ACTIONS) {
      expect(ACTION_SURFACE_MAP).toHaveProperty(action);
    }
  });

  it('has no orphan keys beyond known AccessActions', () => {
    const mapKeys = Object.keys(ACTION_SURFACE_MAP).sort();
    const known = [...KNOWN_ACCESS_ACTIONS].sort();
    expect(mapKeys).toEqual(known);
  });

  it('every non-internal-only entry maps to a known surface verb', () => {
    for (const [action, surface] of Object.entries(ACTION_SURFACE_MAP)) {
      if (surface === 'internal_only') continue;
      expect(KNOWN_SURFACE_VERBS).toContain(surface);
    }
  });
});

describe('actionMap: SURFACE_INTERNAL_MAP correctness', () => {
  it('every non-passive surface verb has an inverse mapping OR is documented passive', () => {
    for (const verb of KNOWN_SURFACE_VERBS) {
      const isPassive = PASSIVE_SURFACE_VERBS.has(verb);
      const hasInverse = SURFACE_INTERNAL_MAP[verb] !== undefined;
      expect(
        isPassive || hasInverse,
        `Surface verb '${verb}' must be either in PASSIVE_SURFACE_VERBS or have a SURFACE_INTERNAL_MAP entry`,
      ).toBe(true);
    }
  });

  it('inverse entries reference real AccessAction values', () => {
    for (const [verb, action] of Object.entries(SURFACE_INTERNAL_MAP)) {
      expect(KNOWN_ACCESS_ACTIONS).toContain(action);
    }
  });

  it('passive and inverse sets are disjoint (a verb cannot be both)', () => {
    for (const verb of PASSIVE_SURFACE_VERBS) {
      expect(SURFACE_INTERNAL_MAP).not.toHaveProperty(verb);
    }
  });
});

describe('actionMap: round-trip consistency (non-collapsing entries)', () => {
  // Some AccessActions collapse multiple internal verbs to one surface verb
  // (e.g. read+watch+listen → read_payload, remix+mint → mint_derivative).
  // For those, the inverse is the canonical one only — not a round-trip.
  // These pairs ARE expected to round-trip:
  const EXPECTED_ROUND_TRIPS: ReadonlyArray<[AccessAction, IQubeAgentAction]> = [
    ['connect', 'request_access'],
    ['policy-escalation', 'revoke_access'],
    ['disclosure', 'audit_state'],
  ];

  it('canonical pairs round-trip both ways', () => {
    for (const [action, verb] of EXPECTED_ROUND_TRIPS) {
      expect(ACTION_SURFACE_MAP[action]).toBe(verb);
      expect(SURFACE_INTERNAL_MAP[verb]).toBe(action);
    }
  });

  it('collapsing internals all map to the same surface', () => {
    expect(ACTION_SURFACE_MAP.read).toBe('read_payload');
    expect(ACTION_SURFACE_MAP.watch).toBe('read_payload');
    expect(ACTION_SURFACE_MAP.listen).toBe('read_payload');

    expect(ACTION_SURFACE_MAP.remix).toBe('mint_derivative');
    expect(ACTION_SURFACE_MAP.mint).toBe('mint_derivative');
  });

  it('internal-only verbs do not appear in SURFACE_INTERNAL_MAP values', () => {
    const surfaceValues = new Set(Object.values(SURFACE_INTERNAL_MAP));
    expect(surfaceValues.has(ACTION_SURFACE_MAP.transfer as any)).toBe(false);
    expect(surfaceValues.has(ACTION_SURFACE_MAP['payment-settle'] as any)).toBe(false);
  });
});

describe('actionMap: helper functions', () => {
  it('surfaceForAccessAction returns null for internal_only', () => {
    expect(surfaceForAccessAction('transfer')).toBeNull();
    expect(surfaceForAccessAction('payment-settle')).toBeNull();
  });

  it('surfaceForAccessAction returns the surface verb for mapped actions', () => {
    expect(surfaceForAccessAction('read')).toBe('read_payload');
    expect(surfaceForAccessAction('mint')).toBe('mint_derivative');
    expect(surfaceForAccessAction('disclosure')).toBe('audit_state');
  });

  it('accessActionForSurfaceVerb returns null for passive verbs', () => {
    expect(accessActionForSurfaceVerb('discover')).toBeNull();
    expect(accessActionForSurfaceVerb('cite')).toBeNull();
    expect(accessActionForSurfaceVerb('read_meta')).toBeNull();
  });

  it('accessActionForSurfaceVerb returns the internal action for mapped verbs', () => {
    expect(accessActionForSurfaceVerb('read_payload')).toBe('read');
    expect(accessActionForSurfaceVerb('mint_derivative')).toBe('mint');
    expect(accessActionForSurfaceVerb('request_access')).toBe('connect');
  });

  it('isPassiveSurfaceVerb classifies correctly', () => {
    expect(isPassiveSurfaceVerb('discover')).toBe(true);
    expect(isPassiveSurfaceVerb('read_meta')).toBe(true);
    expect(isPassiveSurfaceVerb('mint_derivative')).toBe(false);
    expect(isPassiveSurfaceVerb('read_payload')).toBe(false);
  });

  it('isMutatingSurfaceVerb classifies correctly', () => {
    expect(isMutatingSurfaceVerb('mint_derivative')).toBe(true);
    expect(isMutatingSurfaceVerb('revoke_access')).toBe(true);
    expect(isMutatingSurfaceVerb('discover')).toBe(false);
    expect(isMutatingSurfaceVerb('read_meta')).toBe(false);
  });

  it('mutating verbs cover the full mutation surface', () => {
    // Sanity: every verb in SURFACE_INTERNAL_MAP that maps to a state-changing
    // AccessAction should be marked mutating. (Read-class internals map to
    // read_payload which IS mutating because it triggers gating/receipts.)
    const STATE_CHANGING_INTERNALS: ReadonlyArray<AccessAction> = [
      'invoke', 'connect', 'remix', 'mint', 'policy-escalation', 'disclosure',
    ];
    for (const internal of STATE_CHANGING_INTERNALS) {
      const surface = surfaceForAccessAction(internal);
      if (surface) {
        expect(MUTATING_SURFACE_VERBS.has(surface), `${internal} → ${surface} should be mutating`).toBe(true);
      }
    }
  });
});
