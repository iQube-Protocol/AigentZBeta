/**
 * POST /api/codex/chat crashed on EVERY request (composer and non-composer
 * alike) before reaching KB search, ontology resolution, or provider
 * routing (2026-08-12, closure pass item 5A).
 *
 * Root cause: `userContext: UserContext = { domain, ... }` and the log line
 * immediately after it referenced `domain` as a shorthand property — but
 * `domain` was only ever DECLARED later, inside the non-composer `else`
 * branch, a block scoped after and separate from this point. TypeScript
 * itself flagged this (`TS18004: No value exists in scope for the
 * shorthand property 'domain'`) but the error was not caught before ship,
 * so every chat turn threw a ReferenceError caught by the route's own
 * outer try/catch and reported as a generic 500 — indistinguishable from a
 * model/grounding failure from the client, and from an empty completion
 * once the client mis-reported it (see the CodexCopilotLayer canary).
 *
 * A second, narrower instance of the exact same class of bug hit a
 * diagnostic checkpoint added for CI Bridge tracing: `kbSearchScope` was
 * declared `const` inside the same non-composer `else` block, then read by
 * a checkpoint AFTER that block closed — crashing specifically for any
 * message containing "personhood" or "identity", the CI Bridge quick
 * prompt this whole trace was supposed to debug.
 *
 * This is a structural/source canary (no network, no Supabase, no LLM
 * provider — matches this file's own established test style in
 * copilot-invariant-grounding.test.ts, and the project's "default suite is
 * unit-only" convention in vitest.config.mjs). The functional HTTP
 * regression — an actual POST that proves the handler now proceeds past
 * this point — lives in codex-chat-domain-resolution-order.integration.test.ts.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const ROUTE = 'app/api/codex/chat/route.ts';

describe('domain + resolvedAgentId are resolved once, before userContext is built', () => {
  it('domain is declared before the userContext literal that shorthand-references it', () => {
    const code = stripComments(readSource(ROUTE));
    const domainDeclIdx = code.indexOf('const domain: ContentDomain');
    const userContextIdx = code.indexOf('const userContext: UserContext = {');
    expect(domainDeclIdx, 'no hoisted `const domain: ContentDomain` declaration found').toBeGreaterThan(-1);
    expect(userContextIdx, 'no userContext construction found').toBeGreaterThan(-1);
    expect(
      domainDeclIdx,
      'domain must be declared BEFORE userContext references it as a shorthand property — this is the exact regression (TS18004)',
    ).toBeLessThan(userContextIdx);
  });

  it('resolvedAgentId is declared before userContext, and only once', () => {
    const code = stripComments(readSource(ROUTE));
    const userContextIdx = code.indexOf('const userContext: UserContext = {');
    const firstDeclIdx = code.indexOf('const resolvedAgentId =');
    expect(firstDeclIdx, 'no hoisted resolvedAgentId declaration found').toBeGreaterThan(-1);
    expect(firstDeclIdx).toBeLessThan(userContextIdx);

    // Exactly one `const resolvedAgentId =` — a second one later in the
    // handler is the duplicate-source-of-truth regression this fix removed
    // (it also happened to compute the exact same value a second time).
    const declCount = (code.match(/const resolvedAgentId =/g) ?? []).length;
    expect(declCount, 'resolvedAgentId must have exactly one declaration — a duplicate is a second source of truth').toBe(1);
  });

  it('the non-composer branch does not shadow domain or resolvedAgentId', () => {
    const code = stripComments(readSource(ROUTE));
    const composerIdx = code.indexOf('if (isComposerMode) {');
    const elseIdx = code.indexOf('} else {', composerIdx);
    const elseBlockEnd = code.indexOf('const requestedProviderId', elseIdx);
    expect(composerIdx, 'composer/non-composer split not found').toBeGreaterThan(-1);
    expect(elseIdx, 'non-composer branch not found').toBeGreaterThan(composerIdx);
    const elseBlock = code.slice(elseIdx, elseBlockEnd);
    expect(elseBlock, 'domain is redeclared inside the non-composer branch — shadowing regression').not.toMatch(
      /const domain: ContentDomain/,
    );
    expect(elseBlock, 'resolvedAgentForFetch reappeared — the pre-fix duplicate variable name').not.toContain(
      'resolvedAgentForFetch',
    );
  });

  it('kbSearchScope is declared with `let` outside the branch, not `const` inside it', () => {
    // The checkpoint that reads kbSearchScope sits AFTER the non-composer
    // branch closes; a `const` declared inside that branch is invisible
    // there. This is the second instance of the same scoping bug class.
    const code = stripComments(readSource(ROUTE));
    expect(code).toMatch(/let kbSearchScope: string \| undefined;/);
    expect(code, 'kbSearchScope is still declared with const inside the branch').not.toMatch(
      /const kbSearchScope =/,
    );
  });

  it('KNYT-focused agents still resolve to the metaKnyts corpus through the ONE hoisted binding', () => {
    const code = stripComments(readSource(ROUTE));
    expect(code).toMatch(/KNYT_FOCUSED_AGENTS\.has\(resolvedAgentId\) \? 'metaKnyts' : 'protocol'/);
  });

  it('an explicit client-supplied domain still wins over the derivation', () => {
    const code = stripComments(readSource(ROUTE));
    expect(code).toMatch(/\(requestedDomain as ContentDomain \| undefined\) \?\?/);
  });
});
