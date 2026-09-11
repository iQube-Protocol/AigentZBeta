/**
 * Dual grant-gate canary — the DELEGATE side (operator decision 2026-07-12,
 * option (c) + admin accelerator).
 *
 * Pins the PURE gate helpers in services/homecoming/delegateStanding.ts:
 * the band ladder order, the bootstrap floor (L1/L2 grantable on grantor
 * reputation alone so a new agent can be delegated at all), and the earned
 * requirement for L3+ (the delegate's own trust-band ceiling must reach the
 * requested band). The ceiling function itself is pinned so the accelerator's
 * math stays honest (+CVS moves the SAME scale the gate reads).
 */

import { describe, it, expect } from 'vitest';
import {
  TRUST_BAND_ORDER,
  trustBandRank,
  trustBandCeilingFor,
  delegateStandingAllowsBand,
} from '@/services/homecoming/delegateStanding';

describe('trust band ladder', () => {
  it('orders the five bands lowest → highest', () => {
    expect(TRUST_BAND_ORDER).toEqual([
      'L1_EXPERIMENTAL',
      'L2_VERIFIED_COMMUNITY',
      'L3_PRODUCTION_CANDIDATE',
      'L4_PRODUCTION_APPROVED',
      'L5_CORE_SOVEREIGN',
    ]);
    expect(trustBandRank('L1_EXPERIMENTAL')).toBe(0);
    expect(trustBandRank('L5_CORE_SOVEREIGN')).toBe(4);
    expect(trustBandRank('L9_INVENTED')).toBe(-1);
  });

  it('standing earns the ceiling on the ratified thresholds', () => {
    expect(trustBandCeilingFor(0)).toBe('L1_EXPERIMENTAL');
    expect(trustBandCeilingFor(20)).toBe('L2_VERIFIED_COMMUNITY');
    expect(trustBandCeilingFor(50)).toBe('L3_PRODUCTION_CANDIDATE');
    expect(trustBandCeilingFor(75)).toBe('L4_PRODUCTION_APPROVED');
    expect(trustBandCeilingFor(100)).toBe('L5_CORE_SOVEREIGN');
  });
});

describe('delegateStandingAllowsBand — the (c) gate', () => {
  it('bootstrap floor: L1/L2 grantable regardless of earned standing', () => {
    expect(delegateStandingAllowsBand('L1_EXPERIMENTAL', 'L1_EXPERIMENTAL')).toBe(true);
    expect(delegateStandingAllowsBand('L2_VERIFIED_COMMUNITY', 'L1_EXPERIMENTAL')).toBe(true);
  });

  it('L3+ requires the earned ceiling to reach the requested band', () => {
    expect(delegateStandingAllowsBand('L3_PRODUCTION_CANDIDATE', 'L1_EXPERIMENTAL')).toBe(false);
    expect(delegateStandingAllowsBand('L3_PRODUCTION_CANDIDATE', 'L2_VERIFIED_COMMUNITY')).toBe(false);
    expect(delegateStandingAllowsBand('L3_PRODUCTION_CANDIDATE', 'L3_PRODUCTION_CANDIDATE')).toBe(true);
    expect(delegateStandingAllowsBand('L4_PRODUCTION_APPROVED', 'L3_PRODUCTION_CANDIDATE')).toBe(false);
    expect(delegateStandingAllowsBand('L4_PRODUCTION_APPROVED', 'L5_CORE_SOVEREIGN')).toBe(true);
  });

  it('an unknown requested band is never allowed by this gate', () => {
    expect(delegateStandingAllowsBand('L9_INVENTED', 'L5_CORE_SOVEREIGN')).toBe(false);
  });

  it('the accelerator moves the same scale the gate reads (+50 clears L3)', () => {
    // A fresh delegate (0) boosted by the accelerator's max single grant (+50)
    // earns exactly the L3 ceiling — the gate then admits an L3 grant.
    const boosted = trustBandCeilingFor(0 + 50);
    expect(boosted).toBe('L3_PRODUCTION_CANDIDATE');
    expect(delegateStandingAllowsBand('L3_PRODUCTION_CANDIDATE', boosted)).toBe(true);
  });
});
