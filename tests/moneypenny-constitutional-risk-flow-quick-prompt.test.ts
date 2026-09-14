/**
 * Use Case Zero build-order item 11, Part 4 — proves the EXISTING
 * `[layout:constitutional-risk-flow|...]` suggestion mechanism
 * (`app/api/codex/chat/route.ts`'s `inferSuggestedLayouts`) actually
 * round-trips for the new 'mpy-constitutional-risk-flow' quick prompt added
 * to `MoneyPennyCopilotWorkspace.tsx`'s `MONEYPENNY_QUICK_PROMPTS`. No
 * existing test covered `inferSuggestedLayouts` at all (verified: a
 * repo-wide grep of `tests/` found no reference to it before this file).
 */
import { describe, expect, it, beforeAll } from 'vitest';

// app/api/codex/chat/route.ts constructs a real Supabase client at MODULE
// SCOPE (`createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, ...)`), which
// throws at import time when those env vars are unset — the reason no
// existing unit test imports this file directly (they use source-text
// static assertions instead, e.g. tests/codex-chat-domain-resolution-order.test.ts).
// A well-formed but fake URL/key is sufficient here: this test never makes a
// network call, it only needs the module to finish loading so
// `inferSuggestedLayouts` (a pure function) can be called directly — a
// stronger proof than a source-text grep that the real keyword-sweep regex
// actually fires.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://fixture.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'fixture-service-role-key';

let inferSuggestedLayouts: typeof import('@/app/api/codex/chat/route').inferSuggestedLayouts;

beforeAll(async () => {
  ({ inferSuggestedLayouts } = await import('@/app/api/codex/chat/route'));
});

// Mirrors the exact prompt string this build item adds to
// MONEYPENNY_QUICK_PROMPTS — kept as a literal here (not an import) so this
// test fails loudly if the two ever drift, rather than silently importing
// a moved/renamed constant.
const QUICK_PROMPT_TEXT = 'Can you show me the constitutional risk flow for an underwriting request?';

describe('constitutional-risk-flow quick prompt round-trips through inferSuggestedLayouts', () => {
  it('the quick prompt text alone (no LLM tag) lights the constitutional-risk-flow suggestion via keyword sweep', () => {
    const hints = inferSuggestedLayouts(QUICK_PROMPT_TEXT, 'Sure — here is a summary.');
    const hint = hints.find((h) => h.layoutId === 'constitutional-risk-flow');
    expect(hint).toBeDefined();
    expect(hint?.reason).toBe('Operator wants the constitutional risk flow for an underwriting request');
  });

  it('an explicit LLM [layout:constitutional-risk-flow|...] tag also registers, with its own substance', () => {
    const hints = inferSuggestedLayouts(
      'anything',
      'Sure, let me pull that up. [layout:constitutional-risk-flow|demo-use-case-zero-arkagent-nakamoto-kn0w1-001]',
    );
    const hint = hints.find((h) => h.layoutId === 'constitutional-risk-flow');
    expect(hint).toBeDefined();
    expect(hint?.reason).toBe('LLM-tagged layout suggestion');
    expect(hint?.promptHint).toBe('demo-use-case-zero-arkagent-nakamoto-kn0w1-001');
  });

  it('unrelated text does not spuriously light the constitutional-risk-flow suggestion', () => {
    const hints = inferSuggestedLayouts('What is my portfolio doing today?', 'Here is your portfolio summary.');
    expect(hints.find((h) => h.layoutId === 'constitutional-risk-flow')).toBeUndefined();
  });
});
