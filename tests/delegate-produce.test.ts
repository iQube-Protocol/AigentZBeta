/**
 * delegateProduce — Homecoming↔AR convergence seam canary (CFS-023 Phase 4 / CFS-025).
 *
 * Pins the PURE seam surface: the delegate→InvokingRuntime provenance mapping and
 * the default profile. The production path itself is impure (provider + runtime)
 * and is exercised by a post-deploy drive, not here.
 */

import { describe, it, expect } from 'vitest';
import { invokerForDelegate, DEFAULT_DELEGATE_PROFILE } from '@/services/homecoming/delegateProduce';

describe('delegateProduce — invoker mapping (a provenance label, never ownership)', () => {
  it('maps role-aligned delegates to their runtime', () => {
    expect(invokerForDelegate('aigent-z')).toBe('aigentz');
    expect(invokerForDelegate('marketa')).toBe('agentme');
    expect(invokerForDelegate('kn0w1')).toBe('ccrl');
  });

  it('defaults unmapped delegates to acting on the operator authority', () => {
    expect(invokerForDelegate('aletheon')).toBe('operator');
    expect(invokerForDelegate('moneypenny')).toBe('operator');
    expect(invokerForDelegate('nakamoto')).toBe('operator');
  });

  it('a delegate produces a working document by default', () => {
    expect(DEFAULT_DELEGATE_PROFILE).toBe('documentation');
  });
});
