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

/**
 * The category error above the coverage bug (operator, 2026-07-26).
 *
 * Widening `isConstitutionallyGrounded` fixed WHICH surfaces were grounded. It
 * did not fix the model: the predicate still decided WHETHER the constitutional
 * substrate existed at all. A cartridge overlay could therefore substitute for
 * the base, and a surface that sent no ground context was grounded on nothing.
 *
 * Base and overlay are different questions:
 *   - L1 common ground  — unconditional. Every copilot is one constitutional
 *                         intelligence; absence of cartridge context must not
 *                         subtract it.
 *   - L2 cartridge      — selects WHICH invariants surface. Narrows, never
 *                         removes.
 */
describe('the constitutional substrate is unconditional — a cartridge narrows it, never removes it', () => {
  it('THE negative canary: common ground resolves with no cartridge context at all', () => {
    // The one assertion that would have caught the original defect. Every
    // other check here can pass while the base is still conditional on an
    // overlay — which is precisely the failure this guards.
    const code = stripComments(readSource(ROUTE));
    const decl = code.indexOf('let constitutionalGround');
    expect(decl, 'the L1 substrate is no longer resolved as its own step').toBeGreaterThan(-1);
    const region = code.slice(decl, code.indexOf('if (isComposerMode)', decl));
    expect(region).toContain('resolveCommonConstitutionalGround(');
    expect(
      region,
      'the substrate is gated on a cartridge overlay again — base and overlay have re-merged',
    ).not.toContain('isConstitutionallyGrounded');
  });

  it('resolution happens before the prompt-path split, so composer is grounded too', () => {
    // Composer builds its prompt through a different builder. That is exactly
    // how it came to stand on nothing: the substrate is not a property of
    // which builder ran.
    const code = stripComments(readSource(ROUTE));
    expect(code.indexOf('let constitutionalGround')).toBeLessThan(code.indexOf('if (isComposerMode)'));
    expect(code).toContain('systemPrompt += constitutionalGroundPromptBlock(constitutionalGround)');
  });

  it('the base block renders outside every groundContext branch, and before the overlay', () => {
    const code = stripComments(readSource(ROUTE));
    expect(code).toContain('const constitutionalGroundBlock = constitutionalGroundPromptBlock(constitutionalGround);');
    expect(code, 'substrate must precede overlay in the prompt').toContain(
      '${constitutionalGroundBlock}${groundContextBlock}',
    );
  });

  it('the invariants echo reads the resolved base, not the overlay copy of it', () => {
    // A surface that sends no overlay still has ground, and still needs its
    // memory to carry to the next turn.
    const code = stripComments(readSource(ROUTE));
    expect(code).toMatch(/resolved_invariants: constitutionalGround\.length > 0/);
  });

  it('a scoped miss falls back to the unscoped field for EVERY scoping signal', () => {
    // A domain-scoped miss that returned [] would make the base conditional on
    // the overlay by a second route — an empty overlay silently subtracting.
    const res = stripComments(readSource('services/invariants/resolution.ts'));
    expect(res).toContain('extra?.domains?.length');
    expect(res).toContain('extra?.ontologyClassIds?.length');
    expect(res).toContain('export async function resolveCommonConstitutionalGround(');
  });
});

describe('one invariant budget, not three independent literals', () => {
  it('the caps live in a single exported constant', () => {
    const res = stripComments(readSource('services/invariants/resolution.ts'));
    expect(res).toContain('export const INVARIANT_BUDGET');
  });

  it('every injection site consumes it rather than a bare number', () => {
    // PRD §5 budgets the SUM ("room for BOTH platform-wide and domain
    // knowledge"). Three literals at three sites bound no sum, and a fourth
    // path could crowd out the cartridge corpus with nowhere to notice.
    const code = stripComments(readSource(ROUTE));
    expect(code).toContain('INVARIANT_BUDGET.currentTurn');
    expect(code).toContain('INVARIANT_BUDGET.withSessionMemory');
    expect(code).toContain('INVARIANT_BUDGET.partnershipMemory');
  });

  it('parity canary: the client cap equals the server ceiling', () => {
    // The hook cannot import the server module (it reaches the invariant
    // store), so the duplication is held by this check, not by convention.
    const server = readSource('services/invariants/resolution.ts').match(/withSessionMemory:\s*(\d+)/);
    const client = readSource('hooks/useSessionInvariants.ts').match(/SESSION_INVARIANT_CAP = (\d+)/);
    expect(server?.[1], 'server ceiling not found').toBeDefined();
    expect(client?.[1], 'client cap not found').toBeDefined();
    expect(client?.[1], 'client and server invariant ceilings have drifted').toBe(server?.[1]);
  });
});

describe('constitutional memory travels for every surface that sends a ground context', () => {
  const CLIENTS = [
    'app/components/codex/CodexCopilotLayer.tsx',
    'components/smarttriad/copilot/SmartTriadCopilotLayer.tsx',
  ];

  it('no client gates memory on the smart-triad literal', () => {
    // The server-side gate was widened first and reported as fixed; this
    // client-side twin stayed live, so memory still reached one surface.
    for (const file of CLIENTS) {
      const code = stripComments(readSource(file));
      expect(code, `${file} gates constitutional memory on a surface literal`).not.toMatch(
        /surface\s*===\s*['"]smart-triad['"]/,
      );
    }
  });

  it('both copilot mounts carry memory through the one shared hook', () => {
    for (const file of CLIENTS) {
      const code = stripComments(readSource(file));
      expect(code, `${file} does not use the shared hook`).toContain('useSessionInvariants()');
      expect(code, `${file} never attaches memory to its outbound ground context`).toContain(
        'sessionInvariants.decorate(',
      );
      expect(code, `${file} never folds the turn's echo back into memory`).toContain(
        'sessionInvariants.ingest(',
      );
    }
  });
});
