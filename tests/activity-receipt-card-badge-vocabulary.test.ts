/**
 * DVN / BTC RECEIPT BADGE VOCABULARY — operator ruling, 2026-08-08
 * ("Horizen Journey — Simplify DVN / Bitcoin Receipt Badges").
 *
 * Canonical mapping this canary enforces:
 *
 *   receiptStatus (DVN leg)        badge label
 *   ------------------------------  -----------------
 *   local                           "Receipt Created"
 *   dvn_pending                     "DVN Pending"
 *   dvn_recorded                    "DVN Minted"
 *   dvn_failed                      "DVN Failed"
 *
 *   posStatus (Bitcoin/PoS leg)     badge label
 *   ------------------------------  -----------------
 *   null / "not_started"            "BTC Pending"
 *   pending / batched / broadcast   "BTC Pending"
 *   anchored                        "BTC Anchored"
 *   failed                          "BTC Failed"
 *
 * Two independent compact badges — never a single compound badge, never
 * "DVN Bitcoin Anchored" (Bitcoin is a separate finality layer, not a DVN
 * state). Precise underlying values stay in the data model / receipt JSON /
 * tooltips; only the LABEL text is being simplified here.
 *
 * Source-scan style — this repo has no React rendering harness set up
 * (see tests/observability-does-not-provide-liveness.test.ts's header).
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const RELATIVE_PATH = 'components/metame/cards/ActivityReceiptCard.tsx';
const source = readSource(RELATIVE_PATH);
/** Code only, no doc comments — see the grep-vs-comment note in sourceAuthority.ts. */
const code = stripComments(source);

/** Pulls the object-literal body of a `const NAME: ... = { ... };` block. */
function extractConstBlock(name: string): string {
  const startMarker = `const ${name}`;
  const start = source.indexOf(startMarker);
  expect(start, `${name} must be declared`).toBeGreaterThan(-1);
  const braceOpen = source.indexOf('= {', start);
  expect(braceOpen, `${name} must be an object literal`).toBeGreaterThan(-1);
  const end = source.indexOf('\n};', braceOpen);
  expect(end, `${name} object literal must be closed with "};" on its own line`).toBeGreaterThan(braceOpen);
  return source.slice(braceOpen, end);
}

describe('DVN badge vocabulary (STATUS_META) — four non-conflatable stages', () => {
  const block = extractConstBlock('STATUS_META');

  it('local -> "Receipt Created" (not "DVN Pending" — it has not been submitted yet)', () => {
    expect(block).toMatch(/local:\s*{\s*label:\s*"Receipt Created"/);
  });

  it('dvn_pending -> "DVN Pending"', () => {
    expect(block).toMatch(/dvn_pending:\s*{\s*label:\s*"DVN Pending"/);
  });

  it('dvn_recorded -> "DVN Minted" (never "DVN recorded" or "DVN Local")', () => {
    expect(block).toMatch(/dvn_recorded:\s*{\s*label:\s*"DVN Minted"/);
    expect(block).not.toMatch(/DVN [Ll]ocal/);
  });

  it('dvn_failed -> "DVN Failed"', () => {
    expect(block).toMatch(/dvn_failed:\s*{\s*label:\s*"DVN Failed"/);
  });
});

describe('BTC badge vocabulary (BTC_STATUS_META) — collapses to Pending/Anchored/Failed', () => {
  const block = extractConstBlock('BTC_STATUS_META');

  it('not_started, pending, batched, and broadcast all collapse to "BTC Pending"', () => {
    for (const key of ['not_started', 'pending', 'batched', 'broadcast']) {
      expect(block, `${key} should map to BTC Pending`).toMatch(
        new RegExp(`${key}:\\s*{\\s*label:\\s*"BTC Pending"`),
      );
    }
  });

  it('anchored -> "BTC Anchored"', () => {
    expect(block).toMatch(/anchored:\s*{\s*label:\s*"BTC Anchored"/);
  });

  it('failed -> "BTC Failed"', () => {
    expect(block).toMatch(/failed:\s*{\s*label:\s*"BTC Failed"/);
  });

  it('never exposes "batch"/"broadcast" as a first-class label — those stay implementation detail', () => {
    expect(block).not.toMatch(/label:\s*"[^"]*[Bb]atch/);
    expect(block).not.toMatch(/label:\s*"[^"]*[Bb]roadcast/);
  });
});

describe('the two rails never conflate into one compound badge', () => {
  it('no label anywhere reads "DVN Bitcoin Anchored" or similar — Bitcoin is a separate finality layer', () => {
    // Code only — doc comments are allowed to NAME the forbidden pattern
    // while explaining why it's forbidden (this file's own header does).
    expect(code).not.toMatch(/DVN\s+Bitcoin/i);
    expect(code).not.toMatch(/Bitcoin\s+DVN/i);
  });

  it('the DVN badge and the BTC badge remain two separate <span> elements, not one concatenated string', () => {
    // The BTC badge is rendered from BTC_STATUS_META in the footer, entirely
    // independent of `status.label` (the DVN badge) used in the header.
    expect(source).toMatch(/\{status\.label\}/);
    expect(source).toMatch(/BTC_STATUS_META\[data\.posStatus \?\? "not_started"\]\.label/);
  });
});

describe('underlying state is preserved — only the label vocabulary changed', () => {
  it('ActivityReceiptData still carries posStatus, btcAnchorTxid, and dvnStatus untouched', () => {
    expect(source).toMatch(/posStatus\?:\s*"pending"\s*\|\s*"batched"\s*\|\s*"broadcast"\s*\|\s*"anchored"\s*\|\s*"failed"\s*\|\s*null;/);
    expect(source).toMatch(/btcAnchorTxid\?:\s*string\s*\|\s*null;/);
    expect(source).toMatch(/dvnStatus\?:\s*"submitted"\s*\|\s*"ready"\s*\|\s*"failed"\s*\|\s*null;/);
  });

  it('receiptStatus keeps its full four-value union — no state was dropped from the type', () => {
    expect(source).toMatch(/receiptStatus:\s*"local"\s*\|\s*"dvn_pending"\s*\|\s*"dvn_recorded"\s*\|\s*"dvn_failed";/);
  });

  it('the DVN badge tooltip carries the precise receiptStatus/dvnStatus value', () => {
    expect(source).toMatch(/receiptStatus:\s*\$\{effectiveStatus\}/);
  });

  it('the BTC badge tooltip carries the precise posStatus value', () => {
    expect(source).toMatch(/posStatus:\s*\$\{\s*data\.posStatus\s*\?\?\s*"not started"\s*\}/);
  });

  it('the raw receipt JSON viewer still serialises the full data object, including both leg statuses', () => {
    expect(source).toMatch(/JSON\.stringify\(data, null, 2\)/);
  });
});
