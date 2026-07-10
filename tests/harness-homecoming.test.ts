/**
 * Harness Homecoming — native delegate conversation pure-core canaries (CFS-023 W3).
 *
 * Pins identity resolution (authored vs generic-but-true fallback) and the
 * system-prompt assembly: the NATIVE-operation framing (provider is swappable),
 * the bounded-delegation constraints, and conditional invariant/knowledge
 * grounding. The inference call (callSovereign) is impure and not exercised.
 */

import { describe, it, expect } from 'vitest';
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

  it('falls back to a generic-but-true identity for un-authored delegates', () => {
    const id = resolveDelegateIdentity('moneypenny');
    expect(id.label).toBe('moneypenny');
    expect(id.description).toContain('bounded delegation');
    expect(id.agentClass).toBe('guide-agent'); // from the charter roster, not invented
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
