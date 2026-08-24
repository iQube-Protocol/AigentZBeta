/**
 * MoneyPenny metaMe Catalogue card + Operate destination projection
 * (Financial Services / AEE reference-surface closeout, 2026-08-24).
 *
 * Covers the four pieces this closeout added:
 *   1. ACTIVATION_CATALOG has a first-class 'moneypenny' entry.
 *   2. metame-codex mirrors MoneyPenny's real Orchestration console via the
 *      SAME MoneyPennyPanelTab component — never a bespoke card.
 *   3. operateDestinationProjection.ts's generic journeyId lookup resolves
 *      correctly for the Horizen journey and returns null for an
 *      unregistered one.
 *   4. Horizen's 'aigentme' stage was deliberately NOT swapped onto the new
 *      destination — its own completion evidence (focusDispositionRecorded)
 *      is only recordable inside the aigentme-welcome shell, so swapping the
 *      surface would have made the stage permanently uncompletable. This
 *      test pins that the stage still uses 'aigentme-welcome' so a future
 *      change doesn't reintroduce that regression silently.
 */

import { describe, it, expect } from 'vitest';
import { ACTIVATION_CATALOG, getActivationEntry } from '@/data/activation-catalog';
import { METAME_CODEX } from '@/data/codex-configs';
import { resolveOperateDestination } from '@/services/journey/operateDestinationProjection';
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

describe('operateDestinationProjection — generic journeyId lookup', () => {
  it('resolves the Horizen / Financial Services journey to the MoneyPenny catalogue destination', () => {
    const dest = resolveOperateDestination(HORIZEN_MONEYPENNY_JOURNEY.id);
    expect(dest).toEqual({
      catalogueItemId: 'moneypenny',
      defaultTab: 'moneypenny-orchestration',
      availableModes: ['advisor', 'architect', 'runtime'],
    });
  });

  it('returns null for a journey with no registered destination, never a guess', () => {
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
