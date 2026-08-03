/**
 * Settled Fact Non-Reconsideration — pre-paid reasoning.
 *
 * ── THE OPERATOR'S RULING (2026-08-03) ───────────────────────────────────
 *
 *   > "It's already been reasoned. Why is it re-reasoning again as to whether
 *   >  Nakamoto is registered or not? That's an invariant now. It's proven,
 *   >  we have the proof, it's been registered. … It's exactly the same thing
 *   >  we're talking about with the LLMs constantly re-reasoning over facts
 *   >  that have already been established, and then diverging because it's
 *   >  non-deterministic."
 *
 * "Nakamoto is registered" was established once and then independently
 * re-derived by five observers, each mixing receipts, registry reads and UI
 * state differently — so each could reach a different answer, and each
 * disagreement was reported as a separate bug. They were one bug.
 *
 * These canaries pin the properties that make a settlement a settlement
 * rather than a cache: it is idempotent, an evidence gap cannot un-settle it,
 * and only a listed invalidation event may reopen it.
 */

import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  settleFact,
  readSettledFact,
  invalidateSettledFact,
  isSettled,
  settledFactKey,
  INVALIDATION_EVENTS,
} from '@/services/journey/settledFacts';

/** A registry_assets row that records what was written to it. */
function fakeAdmin(initialMetadata: Record<string, unknown> = {}) {
  const row = { metadata: initialMetadata as Record<string, unknown> };
  const updates: Record<string, unknown>[] = [];
  const admin = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: row }) }),
      }),
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        row.metadata = patch.metadata as Record<string, unknown>;
        return { eq: async () => ({ error: null }) };
      },
    }),
  };
  return { admin: admin as never, row, updates };
}

const NAKAMOTO = {
  subject: 'aigent-nakamoto',
  predicate: 'is_registered' as const,
  object: { standard: 'ERC-8004', network: 'base-sepolia', tokenId: '8798', registryId: '0x225e' },
  evidenceRefs: ['registration-transaction', 'registry-binding', 'confirmation-receipt'],
  resolutionAuthority: 'test',
};

describe('a fact is settled once, and re-settling cannot change it', () => {
  it('records the settlement with its evidence and authority', async () => {
    const { admin } = fakeAdmin();
    const result = await settleFact(admin, 'aigentqube-nakamoto', NAKAMOTO);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.alreadySettled).toBe(false);
    expect(result.fact.status).toBe('settled');
    expect(result.fact.object.tokenId).toBe('8798');
    expect(result.fact.evidenceRefs).toContain('registration-transaction');
    expect(result.fact.resolvedAt).toBeTruthy();
  });

  it('a SECOND settlement returns the first — two racing surfaces cannot produce two truths', async () => {
    /*
     * THE PROPERTY THAT MAKES THIS NOT A CACHE. A cache write overwrites; a
     * settlement does not. Five observers each resolving concurrently must
     * converge on one answer, not the last writer's answer.
     */
    const { admin } = fakeAdmin();
    const first = await settleFact(admin, 'aigentqube-nakamoto', NAKAMOTO);
    const second = await settleFact(admin, 'aigentqube-nakamoto', {
      ...NAKAMOTO,
      object: { ...NAKAMOTO.object, tokenId: '9999' }, // a divergent re-derivation
      resolutionAuthority: 'a different observer',
    });

    expect(second.ok).toBe(true);
    if (!second.ok || !first.ok) return;
    expect(second.alreadySettled, 'the second settlement must be recognised as already settled').toBe(true);
    expect(second.fact.object.tokenId, 'a later divergent derivation must NOT overwrite').toBe('8798');
    expect(second.fact.resolvedAt).toBe(first.fact.resolvedAt);
  });

  it('reads back as settled', async () => {
    const { admin } = fakeAdmin();
    await settleFact(admin, 'aigentqube-nakamoto', NAKAMOTO);
    const read = await readSettledFact(admin, 'aigentqube-nakamoto', 'aigent-nakamoto', 'is_registered');
    expect(isSettled(read)).toBe(true);
  });

  it('unsettled is not the same answer as settled-false', async () => {
    // "Never asked" must be distinguishable from "asked and answered no",
    // because they call for different next acts.
    const { admin } = fakeAdmin();
    expect(await readSettledFact(admin, 'aigentqube-nakamoto', 'someone-else', 'is_registered')).toBeNull();
    expect(isSettled(null)).toBe(false);
  });
});

describe('only a listed invalidation event may reopen a settled fact', () => {
  it('the vocabulary is exactly the five the operator named', () => {
    expect([...INVALIDATION_EVENTS].sort()).toEqual(
      [
        'binding-revoked',
        'chain-reorg-past-registration',
        'evidence-shown-invalid',
        'governed-correction-supersedes',
        'registry-proves-token-nonexistent',
      ].sort(),
    );
  });

  it('an evidence gap is NOT among them — a failed reread cannot un-settle anything', () => {
    /*
     * The operator, verbatim: "Evidence absence in a downstream observer is
     * not evidence that a settled fact has ceased to be true."
     *
     * These are the four things that DID cause the journey to report Nakamoto
     * unregistered. None of them may ever appear in this list.
     */
    for (const nonEvent of ['receipt-missing', 'reread-failed', 'migration-missing', 'observer-error']) {
      expect(INVALIDATION_EVENTS as readonly string[]).not.toContain(nonEvent);
    }
  });

  it('invalidation records the event, and supersedes rather than erases', async () => {
    const { admin } = fakeAdmin();
    await settleFact(admin, 'aigentqube-nakamoto', NAKAMOTO);
    const out = await invalidateSettledFact(
      admin,
      'aigentqube-nakamoto',
      'aigent-nakamoto',
      'is_registered',
      'binding-revoked',
      'the operator revoked the binding',
      'operator',
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.fact.status).toBe('invalidated');
    expect(out.fact.invalidatedBy).toBe('binding-revoked');
    // The original evidence is retained — an invalidated fact is still a record.
    expect(out.fact.evidenceRefs).toContain('registration-transaction');
    expect(isSettled(out.fact)).toBe(false);
  });

  it('a re-settlement after invalidation supersedes rather than silently replaces', async () => {
    const { admin } = fakeAdmin();
    await settleFact(admin, 'aigentqube-nakamoto', NAKAMOTO);
    await invalidateSettledFact(admin, 'aigentqube-nakamoto', 'aigent-nakamoto', 'is_registered', 'binding-revoked', 'x', 'operator');
    const again = await settleFact(admin, 'aigentqube-nakamoto', NAKAMOTO);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.alreadySettled).toBe(false);
    expect(again.fact.supersedes.length, 'the prior settlement must be named, not dropped').toBe(1);
    expect(again.fact.supersedes[0]).toContain(settledFactKey('aigent-nakamoto', 'is_registered'));
  });
});

describe('a failed settlement never becomes a failed fact', () => {
  it('reports a write failure without claiming the fact is untrue', async () => {
    const admin = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { metadata: {} } }) }) }),
        update: () => ({ eq: async () => ({ error: { message: 'permission denied' } }) }),
      }),
    } as never;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = await settleFact(admin, 'aigentqube-nakamoto', NAKAMOTO);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe('write-failed');
    // Named, not swallowed — the silent-write defect that produced the whole
    // observer-disagreement class in the first place.
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('the registration resolver retrieves before it reasons', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'services/horizen/agentRegistrationBinding.ts'), 'utf8');

  it('reads the settled fact BEFORE consulting the binding ladder', () => {
    const settledAt = source.indexOf('readSettledFact');
    const ladderAt = source.indexOf('const { binding, fromReceiptFallback, fallbackSource } = await resolveHorizenRegistrationBinding');
    expect(settledAt).toBeGreaterThan(-1);
    expect(ladderAt).toBeGreaterThan(-1);
    expect(settledAt, 'retrieval must precede re-derivation').toBeLessThan(ladderAt);
  });

  it('settles the fact once it derives it, so the next caller retrieves', () => {
    expect(source).toContain("predicate: 'is_registered'");
    expect(source).toMatch(/await settleFact\(/);
  });

  it('an unresolved read is never reported as a settled negative', () => {
    /*
     * Anchored on the RETURN, not on the phrase. Written first as
     * `indexOf("source: 'unresolved'")` it matched the doc comment above the
     * function — the second time in this session a canary was tripped by
     * prose it was quoting. Anchor on code.
     */
    const at = source.indexOf("auditGaps: ['no registration binding");
    expect(at, 'the unresolved return block is missing').toBeGreaterThan(-1);
    const unresolvedBlock = source.slice(at - 400, at + 200);
    expect(unresolvedBlock).toContain("source: 'unresolved'");
    expect(unresolvedBlock).toContain('settled: false');
  });

  it('a failed settlement is an audit gap, not a demotion to unregistered', () => {
    const failureBlock = source.slice(source.indexOf('if (!settled.ok)'), source.indexOf('if (!settled.ok)') + 500);
    expect(failureBlock).toContain('auditGaps.push');
    expect(failureBlock).not.toMatch(/registered:\s*false/);
  });
});
