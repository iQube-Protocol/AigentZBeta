/**
 * MoneyPenny metaMe Catalogue card + metaMe Catalogue Destination Helper
 * (Financial Services / AEE reference-surface closeout, 2026-08-24 —
 * generalized into a first-class runtime adapter, then refined per operator
 * direction to separate metaMe activation from aigentMe activation).
 *
 * Covers:
 *   1. ACTIVATION_CATALOG has a first-class 'moneypenny' entry.
 *   2. metame-codex mirrors MoneyPenny's real Orchestration console via the
 *      SAME MoneyPennyPanelTab component — never a bespoke card.
 *   3. catalogueDestinationHelper.ts's generic resolver correctly resolves
 *      catalogue item + tab -> route for the Horizen journey, AND for an
 *      unrelated pre-existing catalogue item (mycanvas, the KNYTS/CI
 *      precedent) — proving the resolver generalizes rather than being
 *      MoneyPenny-specific.
 *   4. Fail-visibly behavior: an unregistered journey, catalogue item, or
 *      tab all return `valid: false` with a named `failedLookup` — never a
 *      silent fallback.
 *   5. The build/test-time validation gate the closeout brief asked for:
 *      every journeyId registered in the helper must resolve to a real
 *      catalogue item and tab.
 *   6. Horizen's 'aigentme' stage was NOT modified — its own completion
 *      evidence (focusDispositionRecorded) is only recordable inside the
 *      aigentme-welcome shell, so the direct-to-Orchestration deep-link is
 *      implemented at the bridge-page level (FinancialServicesBridgeFrontDoor),
 *      never by swapping the stage's own surface.
 *   7. The resolved MoneyPenny route never suppresses metaMe's navigation
 *      chrome — the 0/1/2/Full navigation-depth mechanics (and aigentMe's
 *      reachability through them) stay exactly as they are elsewhere.
 *   8. No MoneyPenny-side source file references `focusDispositionRecorded`
 *      — MoneyPenny never records, derives, or synthesizes that evidence.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ACTIVATION_CATALOG, getActivationEntry } from '@/data/activation-catalog';
import { METAME_CODEX } from '@/data/codex-configs';
import {
  resolveOperatorDestination,
  resolveJourneyOperatorDestination,
  resolveOperateDestination,
  registeredJourneyIds,
} from '@/services/journey/catalogueDestinationHelper';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import { JOURNEY_SURFACES } from '@/services/journey/journeySurfaceRegistry';

describe('ACTIVATION_CATALOG — moneypenny entry', () => {
  it('exists exactly once and is open-gate', () => {
    const matches = ACTIVATION_CATALOG.filter((e) => e.id === 'moneypenny');
    expect(matches).toHaveLength(1);
    expect(matches[0].gate).toBe('open');
    // 'home' (navigation/viewport correction, 2026-09-03) — supersedes the
    // retired single-tab 'moneypenny-orchestration' mirror; see
    // MONEYPENNY_AREA_TABS's own header in data/codex-configs.ts.
    expect(matches[0].tabSlug).toBe('home');
  });

  it('no other entry already covers MoneyPenny under a different id', () => {
    const suspicious = ACTIVATION_CATALOG.filter(
      (e) => e.id !== 'moneypenny' && /moneypenny/i.test(`${e.id} ${e.label}`),
    );
    expect(suspicious).toEqual([]);
  });

  it('getActivationEntry resolves it', () => {
    expect(getActivationEntry('moneypenny')?.tabSlug).toBe('home');
  });
});

describe('metame-codex — MoneyPenny tab wiring', () => {
  it('has a tabGroup gated on the moneypenny activation', () => {
    const group = METAME_CODEX.tabGroups?.find((g) => g.activationId === 'moneypenny');
    expect(group).toBeTruthy();
  });

  // Navigation/viewport correction (2026-09-03) — supersedes the retired
  // single fixed 'moneypenny-orchestration' mirror ('mirrors the real
  // MoneyPennyPanelTab / service-orchestration panel' above): metame-codex's
  // MoneyPenny group now carries the SAME real Home/My Money/Plan/Markets/
  // Activity/Admin submenu the standalone cartridge does (MONEYPENNY_AREA_TABS,
  // data/codex-configs.ts) — this is the fix for "the MoneyPenny tab shows the
  // copilot/orchestration workspace without its domain submenu."
  it('mirrors the real MoneyPennyPanelTab component for all six grouped tabs — never a bespoke component', () => {
    const groupTabs = METAME_CODEX.tabs.filter((t) => t.group === 'moneypenny');
    expect(groupTabs).toHaveLength(6);
    for (const tab of groupTabs) {
      expect(['MoneyPennyPanelTab', 'MoneyPennyAdminTab']).toContain(tab.config.component);
    }
  });

  it('has a real Home tab as the default landing destination, with a distinct props.area per tab', () => {
    const home = METAME_CODEX.tabs.find((t) => t.slug === 'home' && t.group === 'moneypenny');
    expect(home).toBeTruthy();
    expect(home?.config.component).toBe('MoneyPennyPanelTab');
    expect((home?.config.props as { area?: string } | undefined)?.area).toBe('home');
  });

  it('the Admin tab is grouped immediately after Activity and adminOnly — never a bespoke component either', () => {
    const admin = METAME_CODEX.tabs.find((t) => t.slug === 'admin' && t.group === 'moneypenny');
    const activity = METAME_CODEX.tabs.find((t) => t.slug === 'activity' && t.group === 'moneypenny');
    expect(admin).toBeTruthy();
    expect(admin?.adminOnly).toBe(true);
    expect(admin!.order).toBeGreaterThan(activity!.order);
    expect(admin?.config.component).toBe('MoneyPennyAdminTab');
  });

  it('does not default straight into Advisor, Architect, or Runtime', () => {
    const home = METAME_CODEX.tabs.find((t) => t.slug === 'home' && t.group === 'moneypenny');
    const panel = (home?.config.props as { panel?: string } | undefined)?.panel;
    expect(panel).not.toBe('advisor');
    expect(panel).not.toBe('architect');
    expect(panel).not.toBe('runtime');
  });
});

describe('catalogueDestinationHelper — generic resolveOperatorDestination', () => {
  it('resolves MoneyPenny Home to a real, routable destination', () => {
    const result = resolveOperatorDestination({ catalogueItemRef: 'moneypenny', tabRef: 'home' });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.destination.catalogueItemId).toBe('moneypenny');
    expect(result.destination.cartridgeRef).toBe(METAME_CODEX.id);
    expect(result.destination.tabSlug).toBe('home');
    expect(result.destination.activationIntent).toBe('self-activate');
    expect(result.destination.route).toContain('tab=home');
  });

  it('resolves a pre-existing, unrelated catalogue item (mycanvas — the KNYTS/CI precedent) proving this generalizes', () => {
    const result = resolveOperatorDestination({ catalogueItemRef: 'mycanvas', tabRef: 'mycanvas' });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.destination.catalogueItemId).toBe('mycanvas');
    expect(result.destination.cartridgeRef).toBe(METAME_CODEX.id);
    expect(result.destination.tabSlug).toBe('mycanvas');
  });

  it('fails visibly on an unregistered catalogue item — never a silent fallback', () => {
    const result = resolveOperatorDestination({ catalogueItemRef: 'not-a-real-activation', tabRef: 'whatever' });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.failedLookup).toBe('catalogueItem');
    expect(result.reason).toMatch(/not-a-real-activation/);
  });

  it('fails visibly on a tab that does not exist in the resolved cartridge', () => {
    const result = resolveOperatorDestination({ catalogueItemRef: 'moneypenny', tabRef: 'no-such-tab' });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.failedLookup).toBe('tab');
  });

  it('fails visibly on a tab that belongs to a DIFFERENT activation than requested', () => {
    // 'mycanvas' tab is real, but gated by activationId 'mycanvas' — requesting
    // it under the 'moneypenny' catalogue item must be refused, not silently allowed.
    const result = resolveOperatorDestination({ catalogueItemRef: 'moneypenny', tabRef: 'mycanvas' });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.failedLookup).toBe('tab');
  });
});

describe('catalogueDestinationHelper — resolveJourneyOperatorDestination (threshold-aware)', () => {
  it('PRE_PASSPORT resolves to PUBLIC_ORIENTATION', () => {
    const result = resolveJourneyOperatorDestination({
      journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
      participantState: { citizenPassportUsable: false },
    });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.thresholdState).toBe('PRE_PASSPORT');
    expect(result.activationMode).toBe('PUBLIC_ORIENTATION');
  });

  it('POST_PASSPORT resolves to CATALOGUE_ACTIVATION with the MoneyPenny Orchestration destination', () => {
    const result = resolveJourneyOperatorDestination({
      journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
      participantState: { citizenPassportUsable: true },
    });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.thresholdState).toBe('POST_PASSPORT');
    expect(result.activationMode).toBe('CATALOGUE_ACTIVATION');
    expect(result.operatorDestination.catalogueItemId).toBe('moneypenny');
    expect(result.operatorDestination.tabSlug).toBe('home');
    expect(result.operatorDestination.serviceModes).toEqual(['advisor', 'architect', 'runtime']);
  });

  it('fails visibly for a journey with no registered destination', () => {
    const result = resolveJourneyOperatorDestination({
      journeyId: 'some-unregistered-journey-id',
      participantState: { citizenPassportUsable: true },
    });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.failedLookup).toBe('journey-not-registered');
  });
});

describe('Validation gate — every registered journey destination must resolve', () => {
  it('resolves for every journeyId the helper declares', () => {
    const ids = registeredJourneyIds();
    expect(ids.length).toBeGreaterThan(0);
    for (const journeyId of ids) {
      const result = resolveJourneyOperatorDestination({ journeyId, participantState: { citizenPassportUsable: true } });
      expect(result.valid, `journeyId '${journeyId}' must resolve through the Catalogue Helper`).toBe(true);
    }
  });
});

describe('resolveOperateDestination — AEE back-compat shape', () => {
  it('returns the plain declared destination for Horizen', () => {
    expect(resolveOperateDestination(HORIZEN_MONEYPENNY_JOURNEY.id)).toEqual({
      catalogueItemId: 'moneypenny',
      defaultTab: 'home',
      availableModes: ['advisor', 'architect', 'runtime'],
    });
  });

  it('returns null for an unregistered journey, never a guess', () => {
    expect(resolveOperateDestination('some-unregistered-journey-id')).toBeNull();
  });
});

describe('Horizen aigentme stage — completion path NOT regressed', () => {
  it('still uses the aigentme-welcome surface (where focusDispositionRecorded is actually recordable)', () => {
    const stage = HORIZEN_MONEYPENNY_JOURNEY.stages.find((s) => s.id === 'aigentme');
    expect(stage).toBeTruthy();
    expect(stage?.completionEvidence).toContain('focusDispositionRecorded');
    expect(stage?.surfaces.map((s) => s.ref)).toContain('aigentme-welcome');
  });

  it('aigentme-welcome descriptor is unchanged (tab aigent-me) — other tests key fixtures on this', () => {
    const descriptor = JOURNEY_SURFACES['aigentme-welcome'];
    expect(descriptor.kind).toBe('embed');
    if (descriptor.kind === 'embed') {
      expect(descriptor.codexSlug).toBe('metame-codex');
      expect(descriptor.tab).toBe('aigent-me');
    }
  });
});

describe('metaMe activation vs aigentMe activation — kept separate (operator direction, 2026-08-24)', () => {
  it('the resolved MoneyPenny route does not suppress metaMe navigation chrome (0/1/2/Full stays available)', () => {
    const result = resolveOperatorDestination({ catalogueItemRef: 'moneypenny', tabRef: 'home' });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    // No ?chrome=focused / ?depth= — an operator inside this embed sees
    // metaMe's full tab strip, including aigentMe, exactly as elsewhere.
    expect(result.destination.route).not.toContain('chrome=focused');
    expect(result.destination.route).not.toContain('depth=');
  });

  it('the aigentMe tabGroup is NOT gated by the moneypenny activation — it stays reachable regardless of MoneyPenny state', () => {
    const aigentmeGroup = METAME_CODEX.tabGroups?.find((g) => g.id === 'aigentme');
    expect(aigentmeGroup).toBeTruthy();
    expect(aigentmeGroup?.activationId).toBeUndefined();
  });

  function collectFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) collectFiles(full, out);
      else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
    }
    return out;
  }

  it('no MoneyPenny-side source file references focusDispositionRecorded — MoneyPenny never synthesizes that evidence', () => {
    const root = process.cwd();
    const candidateDirs = [
      join(root, 'app', '(shell)', 'moneypenny'),
      join(root, 'services', 'financialServices'),
    ];
    const explicitFiles = [
      join(root, 'app', 'triad', 'components', 'codex', 'tabs', 'MoneyPennyPanelTab.tsx'),
      join(root, 'app', 'triad', 'components', 'codex', 'tabs', 'MoneyPennyTab.tsx'),
    ];
    const files = [...candidateDirs.flatMap((d) => collectFiles(d)), ...explicitFiles];
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.filter((f) => readFileSync(f, 'utf-8').includes('focusDispositionRecorded'));
    expect(offenders).toEqual([]);
  });
});
