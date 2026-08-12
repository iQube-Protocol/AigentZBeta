/**
 * POST /api/codex/chat — CI Bridge copilot canary. INTEGRATION.
 *
 * Crosses a real network boundary (issues HTTP requests against
 * TEST_BASE_URL, the deployed dev host) — moved here per this project's
 * "default suite is unit-only, network-crossing tests are *.integration"
 * convention (vitest.config.mjs).
 *
 * Proves the concrete fix in app/api/codex/chat/route.ts (2026-08-12,
 * closure pass item 5): `domain` was referenced as a shorthand property in
 * `userContext` before it was ever declared in scope, throwing a
 * ReferenceError on EVERY request — caught by the route's own outer
 * try/catch and reported as a generic 500. This canary sends the exact
 * shape the CI Bridge copilot sends (aigentId: 'aigent-me', contextId:
 * 'ci-bridge', groundContext.surface: 'ci-bridge') and proves the handler
 * proceeds past userContext construction to a real response — 200, with a
 * `response` field, never the crash-500 `{ error: 'Failed to process chat
 * request' }` envelope.
 *
 * Deliberately does NOT assert a specific answer or hardcode a canned
 * response for "Why personhood before identity?" — that would defeat the
 * purpose (the prompt must traverse the normal aigentMe constitutional
 * intelligence path, not a special-cased shortcut). It asserts only the
 * class of failure this fix targets: a request that failed before
 * inference ever ran.
 */

import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL || 'https://dev-beta.aigentz.me';

async function postChat(body: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}/api/codex/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

describe('POST /api/codex/chat — anonymous CI Bridge copilot request', () => {
  it('does not crash before userContext construction (the domain-scope regression)', async () => {
    const { status, data } = await postChat({
      message: 'Why personhood before identity?',
      aigentId: 'aigent-me',
      persona: 'kn0w1',
      contextId: 'ci-bridge',
      chatHistory: [],
      groundContext: {
        surface: 'ci-bridge',
        bridgeTitle: 'The Constitutional Internet Bridge',
        stageContent: [],
      },
    });

    // The regression this test guards: a ReferenceError thrown before
    // inference, caught by the outer try/catch, surfaced as exactly this
    // envelope with no HTTP-level distinction from a real server fault.
    expect(
      data,
      'handler crashed before reaching userContext / KB / provider routing — the domain-scope regression is back',
    ).not.toEqual({ error: 'Failed to process chat request' });
    expect(status, `expected 200, got ${status}: ${JSON.stringify(data).slice(0, 300)}`).toBe(200);
    expect(typeof data?.response, 'response field missing or not a string').toBe('string');
    expect((data?.response as string)?.length, 'response is empty — handler ran but produced nothing').toBeGreaterThan(0);
  });

  it('a message with no CI-specific content also proceeds past userContext (regression is not message-keyed)', async () => {
    // The kbSearchScope half of the same bug class fired ONLY for messages
    // containing "personhood"/"identity". A plain message proves the
    // baseline userContext/domain fix independent of that second bug.
    const { status, data } = await postChat({ message: 'hello' });
    expect(data).not.toEqual({ error: 'Failed to process chat request' });
    expect(status).toBe(200);
    expect(typeof data?.response).toBe('string');
  });
});
