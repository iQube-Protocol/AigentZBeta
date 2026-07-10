/**
 * Agent Homecoming — stand-up spec canaries (CFS-023, Workstream 2).
 *
 * Pins the PURE stand-up specs: Aletheon (the archetype/first-mover) is present,
 * grounded in its card, slug-valid, and a BOUNDED delegate (never autonomous —
 * its charter forbids independent authority). Only carded delegates are standable
 * (No-Guessing: MoneyPenny/Nakamoto have no invented spec). The genesis call
 * itself is impure and not exercised here.
 */

import { describe, it, expect } from 'vitest';
import { HOMECOMING_DELEGATE_SPECS, getDelegateSpec } from '@/services/homecoming/agentHomecoming';
import { SLUG_RE } from '@/services/agents/sponsorPolityAgent';

describe('Agent Homecoming — stand-up specs', () => {
  it('Aletheon is standable, slug-valid, and a bounded (non-autonomous) delegate', () => {
    const spec = getDelegateSpec('aletheon');
    expect(spec).not.toBeNull();
    expect(spec!.slug).toBe('aletheon');
    expect(SLUG_RE.test(spec!.slug)).toBe(true);
    expect(spec!.autonomous).toBe(false); // bounded companion, per its charter
    expect(spec!.description.length).toBeGreaterThan(40);
  });

  it('every authored spec has a valid slug and a non-empty description', () => {
    for (const spec of Object.values(HOMECOMING_DELEGATE_SPECS)) {
      expect(SLUG_RE.test(spec!.slug)).toBe(true);
      expect(spec!.displayName.trim().length).toBeGreaterThan(0);
      expect(spec!.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('un-authored delegates are not standable (no invented spec)', () => {
    expect(getDelegateSpec('moneypenny')).toBeNull();
    expect(getDelegateSpec('nakamoto')).toBeNull();
  });
});
