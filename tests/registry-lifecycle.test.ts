/**
 * Lifecycle state machine tests.
 *
 * Stage 3 C17. Covers:
 *   - Every transition in the graph has a corresponding rule
 *   - Every rule corresponds to a graph edge (no orphan rules)
 *   - validateTransition behaves correctly on legal + illegal + terminal
 *     transitions
 *   - Surface mapping is total + deterministic
 *   - ContentQube substate mapping covers every CQ-internal value
 *   - Canonical pairs round-trip (where the universal state has no
 *     ambiguity in the reverse direction)
 */

import { describe, expect, it } from 'vitest';

import {
  validateTransition,
  isTerminalState,
  allowedTransitionsFrom,
  transitionRule,
  decideTransition,
  TRANSITION_RULES,
  UNIVERSAL_TO_SURFACE_MAP,
  CONTENT_QUBE_TO_UNIVERSAL_MAP,
  internalToSurface,
  mapContentQubeInternalToUniversal,
  type ContentQubeInternalLifecycleState,
} from '@/services/registry/lifecycle';

import type { IQubeInternalLifecycleState } from '@/types/registry-canonical';

const UNIVERSAL_STATES: ReadonlyArray<IQubeInternalLifecycleState> = [
  'draft',
  'wip',
  'review_pending',
  'published',
  'canonized',
  'deprecated',
  'revoked',
  'new_version_pending',
  'abandoned',
];

const CONTENT_QUBE_STATES: ReadonlyArray<ContentQubeInternalLifecycleState> = [
  'draft',
  'semi_minted',
  'review_ready',
  'canon_pending',
  'canonized',
  'chain_minted',
  'superseded',
  'archived',
];

describe('lifecycle: graph + rules consistency', () => {
  it('every UNIVERSAL state has a defined allowed-transitions list', () => {
    for (const s of UNIVERSAL_STATES) {
      expect(allowedTransitionsFrom(s)).toBeDefined();
    }
  });

  it('every transition in the rules table corresponds to a graph edge', () => {
    for (const rule of TRANSITION_RULES) {
      const v = validateTransition(rule.from, rule.to);
      expect(
        v.allowed,
        `Rule for ${rule.from} → ${rule.to} exists but the graph rejects it`,
      ).toBe(true);
    }
  });

  it('every graph edge has a corresponding rule entry', () => {
    for (const from of UNIVERSAL_STATES) {
      for (const to of allowedTransitionsFrom(from)) {
        const rule = transitionRule(from, to);
        expect(
          rule,
          `Graph allows ${from} → ${to} but TRANSITION_RULES has no entry`,
        ).not.toBeNull();
      }
    }
  });

  it('terminal states have no outgoing transitions', () => {
    expect(isTerminalState('revoked')).toBe(true);
    expect(isTerminalState('abandoned')).toBe(true);
    expect(allowedTransitionsFrom('revoked')).toEqual([]);
    expect(allowedTransitionsFrom('abandoned')).toEqual([]);
  });

  it('non-terminal states have at least one outgoing transition', () => {
    for (const s of UNIVERSAL_STATES) {
      if (s === 'revoked' || s === 'abandoned') continue;
      expect(allowedTransitionsFrom(s).length).toBeGreaterThan(0);
    }
  });
});

describe('lifecycle: validateTransition', () => {
  it('allows draft → wip and draft → abandoned', () => {
    expect(validateTransition('draft', 'wip').allowed).toBe(true);
    expect(validateTransition('draft', 'abandoned').allowed).toBe(true);
  });

  it('rejects draft → canonized (must go through wip/review/published first)', () => {
    const r = validateTransition('draft', 'canonized');
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toMatch(/not in the allowed set/);
  });

  it('rejects canonized → wip (cannot "uncanonize"; PRD §6.2)', () => {
    const r = validateTransition('canonized', 'wip');
    expect(r.allowed).toBe(false);
  });

  it('rejects canonized → published (forward-only from canonized)', () => {
    expect(validateTransition('canonized', 'published').allowed).toBe(false);
  });

  it('allows review_pending ↔ wip (the only two-way pair)', () => {
    expect(validateTransition('review_pending', 'wip').allowed).toBe(true);
    expect(validateTransition('wip', 'review_pending').allowed).toBe(true);
  });

  it('rejects any transition from a terminal state', () => {
    for (const s of UNIVERSAL_STATES) {
      const r = validateTransition('revoked', s);
      expect(r.allowed, `revoked → ${s} should be rejected`).toBe(false);
      const r2 = validateTransition('abandoned', s);
      expect(r2.allowed, `abandoned → ${s} should be rejected`).toBe(false);
    }
  });
});

describe('lifecycle: per-rule contracts', () => {
  it('canonization requires human approval AND a sync canonize receipt', () => {
    const rule = transitionRule('published', 'canonized');
    expect(rule).not.toBeNull();
    expect(rule?.human_approval_required).toBe(true);
    expect(rule?.receipt.action).toBe('canonize');
    expect(rule?.receipt.mode).toBe('sync');
  });

  it('revocation is platform_admin only', () => {
    expect(transitionRule('canonized', 'revoked')?.initiator).toBe('platform_admin');
    expect(transitionRule('published', 'revoked')?.initiator).toBe('platform_admin');
    expect(transitionRule('deprecated', 'revoked')?.initiator).toBe('platform_admin');
  });

  it('every state-change to a tombstone surface ALWAYS emits a sync receipt', () => {
    for (const rule of TRANSITION_RULES) {
      if (rule.descriptor_side_effect === 'tombstone') {
        expect(
          rule.receipt.mode,
          `Tombstone transition ${rule.from} → ${rule.to} must emit sync receipt`,
        ).toBe('sync');
      }
    }
  });

  it('chain_interaction=true transitions involve mint/canonize/transfer or revoke', () => {
    for (const rule of TRANSITION_RULES) {
      if (rule.chain_interaction) {
        expect(
          ['canonize', 'mint', 'transfer', 'policy-escalation'].includes(rule.receipt.action),
          `Chain-interaction transition ${rule.from} → ${rule.to} has receipt.action=${rule.receipt.action} — must be canonize/mint/transfer/policy-escalation`,
        ).toBe(true);
      }
    }
  });

  it('payload_access_change=true only on revocations + new mints (Stage 5 spec)', () => {
    for (const rule of TRANSITION_RULES) {
      if (rule.payload_access_change) {
        expect(['revoked'].includes(rule.to)).toBe(true);
      }
    }
  });
});

describe('lifecycle: surface mapping', () => {
  it('covers every UNIVERSAL state', () => {
    for (const s of UNIVERSAL_STATES) {
      expect(UNIVERSAL_TO_SURFACE_MAP).toHaveProperty(s);
    }
  });

  it('internalToSurface is total + returns a valid surface state', () => {
    const validSurface = ['draft', 'wip', 'canonized', 'deprecated', 'archived'];
    for (const s of UNIVERSAL_STATES) {
      expect(validSurface).toContain(internalToSurface(s));
    }
  });

  it('published AND canonized both surface as canonized (governance distinction is internal-only)', () => {
    expect(internalToSurface('published')).toBe('canonized');
    expect(internalToSurface('canonized')).toBe('canonized');
  });

  it('review_pending surfaces as wip (no separate review state at the surface)', () => {
    expect(internalToSurface('review_pending')).toBe('wip');
  });

  it('new_version_pending surfaces as wip until the new version canonizes', () => {
    expect(internalToSurface('new_version_pending')).toBe('wip');
  });

  it('revoked AND abandoned both surface as archived', () => {
    expect(internalToSurface('revoked')).toBe('archived');
    expect(internalToSurface('abandoned')).toBe('archived');
  });
});

describe('lifecycle: ContentQube substate mapping', () => {
  it('covers every CQ-internal state', () => {
    for (const s of CONTENT_QUBE_STATES) {
      expect(CONTENT_QUBE_TO_UNIVERSAL_MAP).toHaveProperty(s);
    }
  });

  it('maps semi_minted / review_ready / canon_pending into the review_pending bucket region', () => {
    expect(mapContentQubeInternalToUniversal('semi_minted')).toBe('wip');
    expect(mapContentQubeInternalToUniversal('review_ready')).toBe('review_pending');
    expect(mapContentQubeInternalToUniversal('canon_pending')).toBe('review_pending');
  });

  it('chain_minted collapses to canonized (chain anchor lives on the record, not the state)', () => {
    expect(mapContentQubeInternalToUniversal('chain_minted')).toBe('canonized');
  });

  it('superseded maps to deprecated (typical case; new_version_pending only set during a live bump)', () => {
    expect(mapContentQubeInternalToUniversal('superseded')).toBe('deprecated');
  });

  it('archived maps to abandoned (terminal soft-delete)', () => {
    expect(mapContentQubeInternalToUniversal('archived')).toBe('abandoned');
  });

  it('defaults to draft for unknown / null / undefined input', () => {
    expect(mapContentQubeInternalToUniversal(null)).toBe('draft');
    expect(mapContentQubeInternalToUniversal(undefined)).toBe('draft');
    expect(mapContentQubeInternalToUniversal('not_a_state')).toBe('draft');
  });
});

describe('lifecycle: decideTransition composite', () => {
  it('returns rule + surface_after on allowed transitions', () => {
    const d = decideTransition('published', 'canonized');
    expect(d.allowed).toBe(true);
    if (d.allowed) {
      expect(d.rule.receipt.action).toBe('canonize');
      expect(d.surface_after).toBe('canonized');
    }
  });

  it('returns reason on illegal transitions', () => {
    const d = decideTransition('canonized', 'wip');
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toMatch(/not in the allowed set/);
  });

  it('returns reason on terminal-state attempts', () => {
    const d = decideTransition('revoked', 'canonized');
    expect(d.allowed).toBe(false);
  });
});
