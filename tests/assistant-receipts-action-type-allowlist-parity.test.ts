/**
 * /api/assistant/receipts VALID_ACTION_TYPES allowlist parity — regression
 * guard for the "no receipts recorded for this stage" defect (2026-08-08).
 *
 * ── THE DEFECT THIS CLOSES ─────────────────────────────────────────────────
 *
 * `StageReceiptsDrawer` asks `GET /api/assistant/receipts?actionType=<stage's
 * receiptTypes>` to show the evidence for a Horizen journey stage. That route
 * filters the caller's requested `actionType` list through a hardcoded
 * `VALID_ACTION_TYPES` allowlist (app/api/assistant/receipts/route.ts) before
 * querying. When a journey stage's `receiptTypes` (declared in
 * services/journey/horizenMoneyPennyJourney.ts) names an action type that
 * allowlist doesn't have, the drawer's query silently drops it — the receipt
 * was written correctly, `agentsInvoked` was correct, the journey's OWN state
 * resolution (which reads `activity_receipts` directly, with no allowlist)
 * showed the ceremony progressing correctly, and the drawer still said
 * "No receipts recorded for this stage yet."
 *
 * Found live for MoneyPenny's Register stage (five ceremony-step receipt
 * types shipped 2026-08-01, never added to the allowlist), and — auditing the
 * REST of the journey definition for the same gap — found again on Passport,
 * Delegate, aigentMe, Ratify's agreement receipts, Deploy, and Standing. This
 * is the third occurrence of the general "union/allowlist/constraint drift"
 * defect class in this codebase (see
 * tests/activity-receipts-action-type-parity.test.ts's header for the first
 * two), so the fix here is the SAME shape: a canary that walks every
 * `receiptTypes` entry in the journey definition and asserts it against the
 * allowlist, rather than trusting a human to remember the next time a stage's
 * receiptTypes list grows.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const ROUTE_PATH = 'app/api/assistant/receipts/route.ts';
const JOURNEY_PATH = 'services/journey/horizenMoneyPennyJourney.ts';

/** The exact runtime allowlist — parsed from source, not hand-copied, so this
 *  canary can never itself drift from what the route actually enforces. */
function extractAllowlist(): Set<string> {
  const code = stripComments(readSource(ROUTE_PATH));
  const start = code.indexOf('const VALID_ACTION_TYPES');
  expect(start, 'VALID_ACTION_TYPES must still be declared in the receipts route').toBeGreaterThan(-1);
  const end = code.indexOf(']);', start);
  expect(end, 'VALID_ACTION_TYPES literal must be closed with "]);"').toBeGreaterThan(start);
  const body = code.slice(start, end);
  return new Set([...body.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]));
}

/** Every action type named in ANY stage's `receiptTypes` array, with the
 *  stage id(s) it came from, for a useful failure message. Comment-stripped
 *  so a doc comment naming a type isn't mistaken for a declaration. */
function extractJourneyReceiptTypes(): Map<string, string[]> {
  const code = stripComments(readSource(JOURNEY_PATH));
  const found = new Map<string, string[]>();
  // Each stage object is `{ id: 'xxx', ... receiptTypes: [...], ... }` — walk
  // stage-by-stage so a failure message can name which stage owns each type.
  const stageMatches = [...code.matchAll(/id:\s*'([a-z_]+)'/g)];
  for (let i = 0; i < stageMatches.length; i++) {
    const stageId = stageMatches[i][1];
    const stageStart = stageMatches[i].index!;
    const stageEnd = i + 1 < stageMatches.length ? stageMatches[i + 1].index! : code.length;
    const stageSlice = code.slice(stageStart, stageEnd);
    const rtStart = stageSlice.indexOf('receiptTypes:');
    if (rtStart === -1) continue;
    const rtEnd = stageSlice.indexOf(']', rtStart);
    const rtBody = stageSlice.slice(rtStart, rtEnd + 1);
    for (const m of rtBody.matchAll(/'([a-z0-9_]+)'/g)) {
      if (!found.has(m[1])) found.set(m[1], []);
      if (!found.get(m[1])!.includes(stageId)) found.get(m[1])!.push(stageId);
    }
  }
  return found;
}

describe('every journey-stage receiptTypes entry is in the receipts route allowlist', () => {
  it('finds stages with receiptTypes at all — guards against a vacuous pass', () => {
    // The journey has 9 stages and at least 7 declare receiptTypes; a broken
    // extraction would silently pass the assertion below by finding nothing.
    expect(extractJourneyReceiptTypes().size).toBeGreaterThan(10);
  });

  it('VALID_ACTION_TYPES parses to a non-trivial set — guards against a vacuous pass', () => {
    expect(extractAllowlist().size).toBeGreaterThan(15);
  });

  it('every receiptTypes entry across every stage is allowlisted', () => {
    const allowlist = extractAllowlist();
    const journeyTypes = extractJourneyReceiptTypes();
    const missing = [...journeyTypes.entries()]
      .filter(([type]) => !allowlist.has(type))
      .map(([type, stages]) => `'${type}' (stage(s): ${stages.join(', ')})`);
    expect(
      missing,
      "Journey-declared receiptTypes missing from VALID_ACTION_TYPES in " +
        ROUTE_PATH +
        ' — StageReceiptsDrawer will silently show "No receipts recorded for this stage" ' +
        'for these even when the underlying receipts were written correctly. Add each to ' +
        'the allowlist.',
    ).toEqual([]);
  });
});
