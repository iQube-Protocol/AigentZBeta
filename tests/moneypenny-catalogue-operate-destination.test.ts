/**
 * MoneyPenny metaMe Catalogue card + metaMe Catalogue Destination Helper
 * (Financial Services / AEE reference-surface closeout, 2026-08-24 —
 * generalized into a first-class runtime adapter per operator direction).
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
 */

import { describe, it, expect } from 'vitest';
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
    expect(matches[0].tabSlug).toBe('moneypenny-orchestration');
  });

  it('no other entry already covers MoneyPenny under a different id', () => {
    const suspicious = ACTIVATION_CATALOG.filter(
      (e) => e.id !== 'moneypenny' && /moneypenny/i.test(`${e.id} ${e.label}`),
    );
    expect(suspicious).toEqual([]);
  });

  it('getActivationEntry resolves it', () => {
    expect(getActivationEntry('moneypenny')?.tabSlug).toBe('moneypenny-orchestration');
  });
});

describe('metame-codex — MoneyPenny tab wiring', () => {
  it('has a tabGroup gated on the moneypenny activation', () => {
    const group = METAME_CODEX.tabGroups?.find((g) => g.activationId === 'moneypenny');
    expect(group).toBeTruthy();
  });

  it('mirrors the real MoneyPennyPanelTab / service-orchestration panel — never a bespoke component', () => {
    const tab = METAME_CODEX.tabs.find((t) => t.slug === 'moneypenny-orchestration');
    expect(tab).toBeTruthy();
    expect(tab?.activationId).toBe('moneypenny');
    expect(tab?.config.component).toBe('MoneyPennyPanelTab');
    expect((tab?.config.props as { panel?: string } | undefined)?.panel).toBe('service-orchestration');
  });

  it('does not default straight into Advisor, Architect, or Runtime', () => {
    const tab = METAME_CODEX.tabs.find((t) => t.slug === 'moneypenny-orchestration');
    const panel = (tab?.config.props as { panel?: string } | undefined)?.panel;
    expect(panel).not.toBe('advisor');
    expect(panel).not.toBe('architect');
    expect(panel).not.toBe('runtime');
  });
});

describe('catalogueDestinationHelper — generic resolveOperatorDestination', () => {
  it('resolves MoneyPenny Orchestration to a real, routable destination', () => {
    const result = resolveOperatorDestination({ catalogueItemRef: 'moneypenny', tabRef: 'moneypenny-orchestration' });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.destination.catalogueItemId).toBe('moneypenny');
    expect(result.destination.cartridgeRef).toBe(METAME_CODEX.id);
    expect(result.destination.tabSlug).toBe('moneypenny-orchestration');
    expect(result.destination.activationIntent).toBe('self-activate');
    expect(result.destination.route).toContain('tab=moneypenny-orchestration');
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
    expect(result.operatorDestination.tabSlug).toBe('moneypenny-orchestration');
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
      defaultTab: 'moneypenny-orchestration',
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
