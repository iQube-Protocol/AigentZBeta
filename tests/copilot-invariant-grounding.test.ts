/**
 * The global copilot is invariant-aware and not KNYT-pinned.
 *
 * Two defects, both of which looked like "the invariant work never shipped"
 * when in fact it shipped correctly into the shared route and was then closed
 * off by two literals (operator report + trace, 2026-07-26).
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const ROUTE = 'app/api/codex/chat/route.ts';

describe('invariant grounding is gated on HAVING a ground context, not on being one surface', () => {
  it('no gate compares surface to the smart-triad literal', () => {
    // The original gate was `groundContext.surface === 'smart-triad'`, checked
    // in four places. Only ONE mount in the repo produced that value, so IRE
    // invariants, constitutional memory and the resolved_invariants echo
    // reached one surface. Dev Command Center, IRL Research, aigentMe Welcome,
    // Composer Studio and Registry Asset Detail all send a ground context and
    // all failed the check — the richest surfaces, excluded by a string
    // comparison.
    const code = stripComments(readSource(ROUTE));
    expect(code, "a surface-literal gate is back").not.toMatch(/surface\s*===\s*['"]smart-triad['"]/);
    expect(code).not.toMatch(/surface\s*!==\s*['"]smart-triad['"]/);
  });

  it('every gate routes through the one predicate', () => {
    const code = stripComments(readSource(ROUTE));
    expect(code).toContain('function isConstitutionallyGrounded(');
    // Four gates + the definition. Fewer means a gate went back to a literal.
    const uses = code.match(/isConstitutionallyGrounded\(/g) ?? [];
    expect(uses.length, 'a gate stopped using the shared predicate').toBeGreaterThanOrEqual(5);
  });

  it('the predicate admits any self-naming surface and refuses an absent one', () => {
    // Fail-closed still matters: a turn with no ground context must not be
    // treated as grounded, or the prompt would claim invariants it never had.
    const src = readSource(ROUTE);
    const body = src.slice(src.indexOf('function isConstitutionallyGrounded('));
    expect(body).toContain("if (!groundContext || typeof groundContext !== 'object') return false");
    expect(body).toMatch(/typeof surface === 'string' && surface\.trim\(\)\.length > 0/);
  });
});

describe('the corpus is derived from the agent, never pinned to KNYT', () => {
  it('the request body no longer defaults domain to metaKnyts', () => {
    // No copilot mount sends `domain`, so `domain = 'metaKnyts'` loaded the
    // KNYT corpus and KB on every turn of every cartridge. It also made the
    // `if (domain !== 'metaKnyts')` guard at fetchCodexMetadata dead code — the
    // default was precisely the value that passed it.
    const code = stripComments(readSource(ROUTE));
    expect(code, 'the KNYT corpus default is back').not.toMatch(/domain\s*=\s*['"]metaKnyts['"]\s*,/);
    expect(code).toContain('domain: requestedDomain');
  });

  it('KNYT agents still get the KNYT corpus — this is a redirect, not a removal', () => {
    // The fix must not strip KNYT surfaces of their legitimate grounding.
    // KnytTab and friends send no `domain` either, so the derivation has to
    // carry them, or "fixing" the leak would break the cartridge it came from.
    const code = stripComments(readSource(ROUTE));
    expect(code).toMatch(
      /KNYT_FOCUSED_AGENTS\.has\(resolvedAgentForFetch\) \? 'metaKnyts' : 'protocol'/,
    );
  });

  it('an explicit client domain still wins over the derivation', () => {
    const code = stripComments(readSource(ROUTE));
    expect(code).toMatch(/\(requestedDomain as ContentDomain \| undefined\) \?\?/);
  });
});
