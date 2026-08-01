/**
 * The crystal readiness route and its reader must agree on the success field.
 *
 * ── The defect this exists to prevent, which already happened ──────────────
 *
 * On 2026-08-02 the route's `ok: true` was renamed to `requestSucceeded`, and
 * the rename was correct: `ok` meant "the HTTP request succeeded" and was being
 * read as "the crystal is okay", while every substantive component underneath
 * reported its own `ok: false` for an unpopulated domain. A reader cannot be
 * expected to resolve that contradiction.
 *
 * What was missed is that a wire field has TWO ends. `IndependentReviewPanel`
 * kept testing `d.ok`, so every successful 200 fell into the
 * unrecognised-shape branch and told the operator:
 *
 *   "the server returned a response this page did not understand
 *    (HTTP 200, no result field) … something other than the expected
 *    endpoint answered."
 *
 * Honest about what the client understood; wrong about the world, and it sends
 * whoever reads it hunting an edge interception that never happened.
 *
 * This is `inv.engineering.036`'s shape exactly — two things describing one
 * contract, and the stale one winning — so per the source-of-truth parity rule
 * it gets a canary rather than a promise to be careful.
 */

import { describe, it, expect } from 'vitest';

import { readSource, stripComments } from './_lib/sourceAuthority';

const ROUTE = 'app/api/research/crystal/[experimentId]/route.ts';
const READER = 'components/composer/IndependentReviewPanel.tsx';
const PREVIEW_ROUTE = 'app/api/research/crystal/[experimentId]/freeze-preview/route.ts';

/** The success field name a route's 200 body actually carries. */
function successFieldOfRoute(path: string): string {
  const code = stripComments(readSource(path));
  // The success response is the LAST NextResponse.json in the handler — every
  // earlier one is a refusal with an explicit status.
  const at = code.lastIndexOf('NextResponse.json(');
  expect(at, `${path} returns a JSON response`).toBeGreaterThan(-1);
  const body = code.slice(at, at + 400);
  const m = body.match(/(requestSucceeded|ok)\s*:\s*true/);
  expect(m, `${path}'s success response declares a success field`).toBeTruthy();
  return m![1];
}

describe('the readiness route and its reader use the same success field', () => {
  it('agree, so a 200 is never reported as an unrecognised shape', () => {
    const field = successFieldOfRoute(ROUTE);
    const reader = stripComments(readSource(READER));

    // The guard immediately before the readiness state is set.
    const at = reader.indexOf('"The readiness report"');
    expect(at).toBeGreaterThan(-1);
    const guard = reader.slice(Math.max(0, at - 200), at);
    expect(guard, `reader must test d.${field}`).toMatch(new RegExp(`!d\\?\\.${field}\\b`));
  });

  it('the route does not ALSO emit a bare `ok` — one success field, not two', () => {
    // Emitting both would let the two ends drift apart silently while both
    // "worked", which is worse than the loud failure this replaced.
    const code = stripComments(readSource(ROUTE));
    const at = code.lastIndexOf('NextResponse.json(');
    const body = code.slice(at, at + 400);
    expect(body).toMatch(/requestSucceeded:\s*true/);
    expect(body).not.toMatch(/(^|[^a-zA-Z])ok:\s*true/);
  });

  it('the freeze-preview route and its reader likewise agree', () => {
    const field = successFieldOfRoute(PREVIEW_ROUTE);
    const reader = stripComments(readSource(READER));
    const at = reader.indexOf('"The freeze ceremony preview"');
    expect(at).toBeGreaterThan(-1);
    const guard = reader.slice(Math.max(0, at - 200), at);
    expect(guard, `reader must test d.${field}`).toMatch(new RegExp(`!d\\?\\.${field}\\b`));
  });

  it('a refusal still carries the server\'s own words, on either route', () => {
    for (const path of [ROUTE, PREVIEW_ROUTE]) {
      const code = stripComments(readSource(path));
      expect(code, path).toMatch(/error:\s*'[^']+'|error:\s*result\.error/);
    }
  });

  it('the reader still distinguishes a refusal, a transport failure and a bad shape', () => {
    const reader = stripComments(readSource(READER));
    const at = reader.indexOf('function explainFailedRequest');
    const fn = reader.slice(at, reader.indexOf('\n}', at));
    // The server's own words win; a non-2xx reports the status, which IS the
    // fact; only an unrecognised 2xx body gets the shape message.
    expect(fn).toMatch(/b\?\.error/);
    expect(fn).toMatch(/!res\.ok/);
    expect(fn).toMatch(/no result field/);
  });
});
