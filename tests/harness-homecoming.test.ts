/**
 * Harness Homecoming — native delegate conversation pure-core canaries (CFS-023 W3).
 *
 * Pins identity resolution (authored vs generic-but-true fallback) and the
 * system-prompt assembly: the NATIVE-operation framing (provider is swappable),
 * the bounded-delegation constraints, and conditional invariant/knowledge
 * grounding. The inference call (callSovereign) is impure and not exercised.
 */

import { describe, it, expect } from 'vitest';
import { HOMECOMING_DELEGATE_SPECS } from '@/services/homecoming/agentHomecoming';
import { HOMECOMING_DELEGATES, type HomecomingDelegateId } from '@/types/homecoming';
import {
  resolveDelegateIdentity,
  buildDelegateSystemPrompt,
} from '@/services/homecoming/delegateConverse';

describe('resolveDelegateIdentity', () => {
  it('uses the card-grounded identity for an authored delegate (Aletheon)', () => {
    const id = resolveDelegateIdentity('aletheon');
    expect(id.label).toBe('Aletheon');
    expect(id.description).toContain('Constitutional Companion');
    expect(id.agentClass).toBe('specialist');
  });

  it('every roster delegate resolves; an un-authored one would fall back, not crash', () => {
    // The original test used 'moneypenny' as its un-authored example. All three
    // roster delegates (aletheon, moneypenny, nakamoto) have since been
    // AUTHORED, so no id exercises the fallback any more.
    //
    // A fictitious id is NOT a valid substitute: `resolveDelegateIdentity` takes
    // a `HomecomingDelegateId`, and an off-roster string throws on the charter
    // metadata lookup. That crash is unreachable by contract, so testing it
    // would assert behaviour the type system already forbids.
    //
    // So this asserts the real state and stays correct either way: every roster
    // delegate resolves to a usable identity, and IF one ever lacks a spec, the
    // generic-but-true description is used rather than an invented one.
    const roster = Object.keys(HOMECOMING_DELEGATE_SPECS) as HomecomingDelegateId[];
    expect(roster.length).toBeGreaterThan(0);
    for (const slug of HOMECOMING_DELEGATES) {
      const id = resolveDelegateIdentity(slug);
      expect(id.label.trim().length, `${slug} has no label`).toBeGreaterThan(0);
      expect(id.description).toContain('bounded delegation');
      expect(id.agentClass.trim().length).toBeGreaterThan(0);
      if (!HOMECOMING_DELEGATE_SPECS[slug]) {
        // The fallback path: true, generic, never invented.
        expect(id.label).toBe(slug);
      }
    }
  });

  it('an AUTHORED delegate keeps its card identity (regression: moneypenny was authored)', () => {
    // The other half of the same change, now asserted rather than assumed --
    // authoring a delegate must actually take effect.
    const id = resolveDelegateIdentity('moneypenny');
    expect(id.label).toBe('MoneyPenny');
    expect(id.description.trim().length).toBeGreaterThan(0);
  });
});

describe('buildDelegateSystemPrompt — native framing + constitutional constraints', () => {
  const identity = { label: 'Aletheon', description: 'A companion.', agentClass: 'specialist' };

  it('always frames native operation (the provider is swappable) and the delegate', () => {
    const p = buildDelegateSystemPrompt(identity);
    expect(p).toContain('You are Aletheon');
    expect(p).toContain('interchangeable inference provider');
    expect(p).toContain('operate NATIVELY');
    expect(p).toContain('Authority may be delegated; sovereignty may not');
  });

  it('includes invariants and knowledge sections only when provided', () => {
    const bare = buildDelegateSystemPrompt(identity);
    expect(bare).not.toContain('Governing invariants');
    expect(bare).not.toContain('Relevant sovereign knowledge');

    const grounded = buildDelegateSystemPrompt(identity, {
      invariants: ['Minimum disclosure is the default.'],
      knowledge: ['The operator prefers slate surfaces.'],
    });
    expect(grounded).toContain('Governing invariants');
    expect(grounded).toContain('- Minimum disclosure is the default.');
    expect(grounded).toContain('Relevant sovereign knowledge');
    expect(grounded).toContain('- The operator prefers slate surfaces.');
  });

  it('filters out empty/blank grounding entries', () => {
    const p = buildDelegateSystemPrompt(identity, { invariants: ['', '  '], knowledge: [] });
    expect(p).not.toContain('Governing invariants');
    expect(p).not.toContain('Relevant sovereign knowledge');
  });
});
