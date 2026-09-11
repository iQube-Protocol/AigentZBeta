/**
 * CI Bridge gating polish pass (2026-08-12) — two corrections:
 *   1. Personify's Passport-required gate dismiss button reads "Later" and
 *      never navigates away from Personify (was "Back" + selectStage('view')).
 *   2. Choose is available without a Passport (Continue reading / Meet
 *      aigentMe / Join IRL / Partner with metaMe / Share the Bridge are all
 *      selectable pre-Passport) — only Personify and Stand are personhood-
 *      bound. Choose was wrongly included in the Passport-dependent branch.
 *
 * Plus: Qriptopian Codex hides the non-consumer Protocols scope from the
 * public Papers projection without deleting the underlying rows or
 * affecting the admin/dev listing.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

describe('Personify Passport gate — "Later" dismisses locally, never navigates', () => {
  const PAGE = 'app/bridge/ci/page.tsx';
  const PERSONIFY = 'components/journey/ConstitutionalInternetBridgePersonifyMyCanvas.tsx';
  // Generalized into a bridge-neutral component (2026-08-12, KNYTS↔CI
  // parity pass) — CI's own file is now a thin indigo-preset wrapper around
  // it, so the dismissLabel mechanism itself lives here.
  const GATE = 'components/journey/BridgePassportGate.tsx';
  const CI_GATE_WRAPPER = 'components/journey/ConstitutionalInternetBridgePassportGate.tsx';

  it('the shared gate component supports a dismissLabel override, defaulting to Back', () => {
    const code = stripComments(readSource(GATE));
    expect(code).toContain('dismissLabel?: string');
    expect(code).toMatch(/dismissLabel = 'Back'/);
    expect(code).toContain('{dismissLabel}');
  });

  it("CI's wrapper forwards dismissLabel through to the shared component, preset to indigo", () => {
    const code = stripComments(readSource(CI_GATE_WRAPPER));
    expect(code).toContain('accent="indigo"');
    expect(code).toContain('{...props}');
  });

  it("Personify's gate mount passes dismissLabel=\"Later\"", () => {
    const code = stripComments(readSource(PERSONIFY));
    expect(code).toMatch(/dismissLabel=["']Later["']/);
  });

  it('Personify dismiss never calls selectStage — it only closes local gate state', () => {
    const code = stripComments(readSource(PERSONIFY));
    // The prior (wrong) behavior called selectStage('view') on dismiss —
    // that is page navigation, which "Later" must never be.
    expect(code, '"Later" still navigates via selectStage — it must only close the local gate').not.toMatch(
      /onDismiss=\{\(\) => selectStage\(/,
    );
    expect(code).toMatch(/onDismiss=\{\(\) => setGateOpen\(false\)\}/);
    expect(code).toContain('const [gateOpen, setGateOpen] = useState(true)');
  });

  it("the page-level gate mount (a different caller) keeps the default 'Back' wording", () => {
    // Only Personify's OWN mount should override the label — the
    // page-level modal (triggered by the racy event listener) is a
    // different caller and this pass does not touch its wording.
    const code = stripComments(readSource(PAGE));
    expect(code, 'the page-level PassportGate mount unexpectedly passes dismissLabel').not.toMatch(
      /<ConstitutionalInternetBridgePassportGate[\s\S]{0,300}dismissLabel/,
    );
  });
});

describe('Choose is available without a Passport — only Personify/Stand are personhood-bound', () => {
  const PAGE = 'app/bridge/ci/page.tsx';

  it('emphasizeAvailableStage no longer gates choose on citizenPassportUsable', () => {
    const code = stripComments(readSource(PAGE));
    const idx = code.indexOf('emphasizeAvailableStage={(stageId)');
    expect(idx, 'emphasizeAvailableStage callback not found').toBeGreaterThan(-1);
    const end = code.indexOf('}}', idx);
    const callback = code.slice(idx, end);
    expect(
      callback,
      "choose must not appear in the citizenPassportUsable-gated branch — it is available without a Passport",
    ).not.toMatch(/stageId === 'choose'/);
    expect(callback).toMatch(/stageId === 'personify' \|\| stageId === 'stand'/);
  });
});

describe('Qriptopian Papers — Protocols hidden from the consumer projection, not deleted', () => {
  const ROUTE = 'app/api/codex/qripto/papers/route.ts';

  it('papers/protocols is excluded from the consumer-facing papers array', () => {
    const code = stripComments(readSource(ROUTE));
    expect(code).toContain("CONSUMER_HIDDEN_SCOPES = new Set(['papers/protocols'])");
    expect(code).toContain('if (CONSUMER_HIDDEN_SCOPES.has(scope)) continue;');
  });

  it('the skip sits in the papers-building loop, AFTER assets was already populated from the same buckets', () => {
    const code = stripComments(readSource(ROUTE));
    const assetsBuiltIdx = code.indexOf('const assets: AdminAsset[] = [];');
    const skipIdx = code.indexOf('if (CONSUMER_HIDDEN_SCOPES.has(scope)) continue;');
    expect(assetsBuiltIdx, 'assets construction not found').toBeGreaterThan(-1);
    expect(skipIdx, 'consumer-hiding skip not found').toBeGreaterThan(-1);
    expect(
      assetsBuiltIdx,
      'assets must be populated BEFORE the papers-array skip, so hiding a scope from papers never touches the admin listing',
    ).toBeLessThan(skipIdx);
  });

  it('no destructive delete/update of the underlying protocol rows was introduced', () => {
    const code = stripComments(readSource(ROUTE));
    expect(code).not.toMatch(/\.delete\(\)/);
    expect(code).not.toMatch(/\.update\(/);
  });
});
