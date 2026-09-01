/**
 * MoneyPenny capability navigation (SPEC-MPY-002 MPY2-1, 2026-09-01).
 *
 * Covers the additive capability-axis layer added this tranche:
 *   1. `MONEYPENNY_CAPABILITY_GROUPS` names the six SPEC-MPY-002 §2.1
 *      capability groups, and every `panel` it points at is either null
 *      ("not yet built" — never a fake destination) or a real
 *      `MONEYPENNY_CARTRIDGE` tab slug that actually exists.
 *   2. The new `moneypenny-overview` tab exists, dispatches through the
 *      unchanged `MoneyPennyPanelTab` component, and does not disturb tab
 *      ordering assumptions for the pre-existing tabs.
 *   3. Regression guard: `MONEYPENNY_CARTRIDGE.tabGroups` is UNCHANGED —
 *      this tranche deliberately did not touch it (see the MPY2-0 donor
 *      harvest audit's §4 discrepancy note); this canary fails loudly if a
 *      future change re-keys it without updating
 *      tests/fs-operate-embed-viewport-parity.test.ts's own pinned canary
 *      in the same change.
 *   4. Every non-null capability item's `mode` (when set) is a real
 *      `MoneyPennyProviderMode` value.
 */

import { describe, it, expect } from 'vitest';
import { MONEYPENNY_CARTRIDGE } from '@/data/codex-configs';
import { MONEYPENNY_CAPABILITY_GROUPS, findCapabilityItemsForPanel } from '../app/(shell)/moneypenny/components/moneypennyCapabilities';

const REAL_PANEL_SLUGS = new Set(MONEYPENNY_CARTRIDGE.tabs.map((t) => t.slug));

describe('MONEYPENNY_CAPABILITY_GROUPS (SPEC-MPY-002 §2.1)', () => {
  it('names exactly the five spec capability groups, in spec order', () => {
    expect(MONEYPENNY_CAPABILITY_GROUPS.map((g) => g.id)).toEqual([
      'understand',
      'design',
      'markets',
      'operate',
      'monitor',
    ]);
  });

  it('every item with a non-null panel points at a REAL MONEYPENNY_CARTRIDGE tab slug', () => {
    for (const group of MONEYPENNY_CAPABILITY_GROUPS) {
      for (const item of group.items) {
        if (item.panel === null) continue;
        expect(
          REAL_PANEL_SLUGS.has(item.panel),
          `capability item '${group.id}/${item.id}' points at panel '${item.panel}', which is not a real MONEYPENNY_CARTRIDGE tab slug`,
        ).toBe(true);
      }
    }
  });

  it('every item mode, when set, is a real MoneyPennyProviderMode value', () => {
    const validModes = new Set(['ADVISOR', 'ARCHITECT', 'RUNTIME']);
    for (const group of MONEYPENNY_CAPABILITY_GROUPS) {
      for (const item of group.items) {
        if (item.mode === null) continue;
        expect(validModes.has(item.mode)).toBe(true);
      }
    }
  });

  it('at least one item per group is available today (panel !== null) — the grouping is not entirely vaporware', () => {
    for (const group of MONEYPENNY_CAPABILITY_GROUPS) {
      const anyAvailable = group.items.some((item) => item.panel !== null);
      expect(anyAvailable, `capability group '${group.id}' has no available items`).toBe(true);
    }
  });

  it('findCapabilityItemsForPanel resolves the Strategy Lab item for the strategies panel', () => {
    const items = findCapabilityItemsForPanel('strategies');
    expect(items.some((item) => item.id === 'strategy-lab')).toBe(true);
  });
});

describe("MONEYPENNY_CARTRIDGE tab 'moneypenny-overview' (new this tranche)", () => {
  const tab = MONEYPENNY_CARTRIDGE.tabs.find((t) => t.id === 'moneypenny-overview');

  it('exists, is enabled, and dispatches through MoneyPennyPanelTab with panel "overview"', () => {
    expect(tab).toBeTruthy();
    expect(tab?.enabled).toBe(true);
    expect(tab?.slug).toBe('overview');
    expect(tab?.config.component).toBe('MoneyPennyPanelTab');
    expect((tab?.config.props as { panel?: string } | undefined)?.panel).toBe('overview');
  });

  it('belongs to the EXISTING "operate" group — no new tabGroup was introduced for it', () => {
    expect(tab?.group).toBe('operate');
  });

  it('does not collide in order with the pre-existing HFT Console tab (order 0)', () => {
    const hft = MONEYPENNY_CARTRIDGE.tabs.find((t) => t.id === 'moneypenny-hft-console');
    expect(hft?.order).toBe(0);
    expect(tab?.order).toBeLessThan(hft!.order as number);
  });
});

describe('regression guard: tabGroups left untouched by this tranche (MPY2-0 §4 decision)', () => {
  it('MONEYPENNY_CARTRIDGE.tabGroups is STILL exactly operate/connect/service/administer', () => {
    const groupIds = (MONEYPENNY_CARTRIDGE.tabGroups ?? []).map((g) => g.id);
    expect(groupIds).toEqual(['operate', 'connect', 'service', 'administer']);
  });
});
