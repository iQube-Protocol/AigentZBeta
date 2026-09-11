/**
 * A STALE OBSERVATION MUST NOT RENDER AS CURRENT (operator report, 2026-08-08).
 *
 * ── THE DEFECT THIS CLOSES ─────────────────────────────────────────────────
 *
 * `/ops`'s "Recent Delegation Receipts" panel rendered each row's `created_at`
 * with `toLocaleTimeString` ALONE — hour and minute, no date. A receipt created
 * 2026-07-20T06:46 therefore displayed as "06:46", indistinguishable from one
 * created this morning.
 *
 * The panel selects `action_type IN (agent_delegated, agent_delegation_revoked)`
 * ordered by `created_at DESC LIMIT 10` (app/api/ops/dvn/activity-receipts).
 * Because delegation activity had been quiet for weeks, those ten rows were all
 * from 2026-07-19/20 — and several were `dvn_failed`. The operator, reading
 * `failed 06:46` on 2026-08-07, reasonably reported a live DVN failure. The
 * rows were nineteen days old. The DVN investigation that followed was real
 * and found real defects, but this specific alarm was a rendering artifact.
 *
 * This is the same shape as Companion invariant MS-10 ("a stale observation
 * must never render as current") and observer invariant OS-2 — the third
 * instance in this codebase. It belongs with the liveness canary as a sibling:
 * that one stops the console from PROVIDING state, this one stops it from
 * MISREPRESENTING state.
 *
 * Source-scan style, matching tests/observability-does-not-provide-liveness.ts
 * and this repo's wider canary convention — no React rendering harness exists
 * in this codebase.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

/**
 * CODE, NOT PROSE ABOUT CODE — same reasoning as the liveness canary's own
 * note. This file's subject matter means the panel's source now carries a doc
 * comment that QUOTES `toLocaleTimeString`, the very call the regression
 * assertion below forbids as a sole formatter. Matching raw text would make
 * the explanation indistinguishable from the defect it explains.
 */
const opsSource = stripComments(readSource('app/(shell)/ops/page.tsx'));

/** The body of the receipts panel alone — not the whole 2000-line Ops page. */
function panelBody(): string {
  const start = opsSource.indexOf('function ActivityReceiptsDvnPanel()');
  expect(start, 'ops/page.tsx must still declare ActivityReceiptsDvnPanel').toBeGreaterThan(-1);
  const end = opsSource.indexOf('export default function OpsPage', start);
  expect(end, 'OpsPage must follow ActivityReceiptsDvnPanel').toBeGreaterThan(start);
  return opsSource.slice(start, end);
}

describe('Ops "Recent Delegation Receipts" — a row\'s age must be visible', () => {
  it('does not format the timestamp with toLocaleTimeString as the ONLY formatter', () => {
    const body = panelBody();
    const usesTime = body.includes('toLocaleTimeString');
    const usesDate = body.includes('toLocaleDateString') || body.includes('toDateString');
    expect(
      usesTime && !usesDate,
      'The panel formats created_at with time only. A receipt weeks old then renders as a bare ' +
        '"06:46" and reads as current — the exact defect that turned nineteen-day-old dvn_failed ' +
        'rows into a reported live outage on 2026-08-07.',
    ).toBe(false);
  });

  it('distinguishes today from older rows rather than dating every row identically', () => {
    const body = panelBody();
    // The fix compares the row's own day against today. Whatever the exact
    // shape, SOME same-day comparison must exist — otherwise "older" cannot be
    // told from "today" and the distinction the operator needs is not made.
    expect(
      /toDateString\(\)\s*===|isToday|isSameDay/.test(body),
      'No same-day comparison found. Without one, the panel cannot distinguish a receipt from ' +
        'this morning from one three weeks old, which is the whole point of showing the date.',
    ).toBe(true);
  });

  it('still renders the receipt_status label the age qualifies', () => {
    const body = panelBody();
    // Guards the pairing: the age fix is only meaningful while the status
    // (failed/pending/recorded) is what the operator reads next to it.
    expect(body).toContain('receipt_status');
    expect(body).toContain("replace('dvn_', '')");
  });
});
