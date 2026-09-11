/**
 * MoneyPenny capability navigation (SPEC-MPY-002 MPY2-1, 2026-09-01;
 * updated 2026-09-03 for the experience-coherence correction).
 *
 * Covers the capability-axis layer:
 *   1. `MONEYPENNY_CAPABILITY_GROUPS` names the six SPEC-MPY-002 §2.1
 *      capability groups, and every `panel` it points at is either null
 *      ("not yet built" — never a fake destination) or a real
 *      `MoneyPennyPanelKey` the dispatcher (`MoneyPennyPanelTab.tsx`)
 *      actually resolves.
 *   2. Every non-null capability item's `mode` (when set) is a real
 *      `MoneyPennyProviderMode` value.
 *
 * SUPERSEDED 2026-09-03 (experience-coherence correction, operator
 * directive: "Remove the competing user-facing navigation layers: HFT /
 * Connect / Service / Administer... Consolidate at the owning
 * configuration/rendering layer"): `MONEYPENNY_CARTRIDGE` previously
 * registered FOURTEEN real `CodexTab` entries across four `tabGroups`
 * (Operate(HFT)/Connect/Service/Administer) — the very "navigation inside
 * navigation" defect this correction fixes, by stacking a competing outer
 * tab bar above the five-area nav (`MoneyPennyAreaNav.tsx`) the workspace
 * already renders. `MONEYPENNY_CARTRIDGE` now registers exactly ONE tab
 * (empty `tabGroups`) — see that constant's own header comment in
 * `data/codex-configs.ts`. The two describe blocks that pinned the old
 * 14-tab/4-group shape (`'moneypenny-overview' tab exists in the operate
 * group`, `tabGroups is STILL exactly operate/connect/service/administer`)
 * are retired below in favour of canaries pinning the NEW single-tab
 * shape; nothing here is deleted silently — see the replacement describe
 * blocks' own comments for what changed and why.
 */

import { describe, it, expect } from 'vitest';
import { MONEYPENNY_CARTRIDGE } from '@/data/codex-configs';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { MONEYPENNY_CAPABILITY_GROUPS, findCapabilityItemsForPanel } from '../app/(shell)/moneypenny/components/moneypennyCapabilities';

// A capability item's `panel` is a MoneyPennyPanelKey, resolved by the
// dispatcher's own PANELS map (app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx)
// — not, since the 2026-09-03 collapse, a dedicated MONEYPENNY_CARTRIDGE
// CodexTab.slug (there is only one such slug now: 'workspace'). Source-read
// rather than re-importing the map, since MoneyPennyPanelTab.tsx is a
// client component this test file should not need to render.
const PANEL_TAB_SRC = stripComments(readSource('app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx'));
function isRealPanelKey(panel: string): boolean {
  return PANEL_TAB_SRC.includes(`"${panel}":`) || PANEL_TAB_SRC.includes(`${panel}: `);
}

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

  it('every item with a non-null panel points at a REAL MoneyPennyPanelKey the dispatcher resolves', () => {
    for (const group of MONEYPENNY_CAPABILITY_GROUPS) {
      for (const item of group.items) {
        if (item.panel === null) continue;
        expect(
          isRealPanelKey(item.panel),
          `capability item '${group.id}/${item.id}' points at panel '${item.panel}', which MoneyPennyPanelTab's PANELS map does not resolve`,
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

describe("MONEYPENNY_CARTRIDGE registers real native tabs — navigation-hierarchy correction (2026-09-03, second pass, supersedes the single-tab collapse this describe block used to pin)", () => {
  it('exactly one tabGroup ("moneypenny") holding the five area tabs plus the admin-gated Admin tab — six tabs total, all grouped', () => {
    expect(MONEYPENNY_CARTRIDGE.tabGroups ?? []).toHaveLength(1);
    const group = (MONEYPENNY_CARTRIDGE.tabGroups ?? [])[0];
    expect(group.id).toBe('moneypenny');
    expect(group.label).toBe('MoneyPenny');
    expect(MONEYPENNY_CARTRIDGE.tabs).toHaveLength(6);
    expect(MONEYPENNY_CARTRIDGE.tabs.every((t) => t.group === 'moneypenny')).toBe(true);
  });

  it('the five area tabs each dispatch through MoneyPennyPanelTab with a distinct props.area, grouped under "moneypenny", in Home/My Money/Plan/Markets/Activity order', () => {
    const areaTabs = MONEYPENNY_CARTRIDGE.tabs.filter((t) => t.group === 'moneypenny' && !t.adminOnly);
    expect(areaTabs).toHaveLength(5);
    const expected: Array<{ slug: string; area: string; label: string }> = [
      { slug: 'home', area: 'home', label: 'Home' },
      { slug: 'my-money', area: 'my-money', label: 'My Money' },
      { slug: 'plan', area: 'plan', label: 'Plan' },
      { slug: 'markets', area: 'markets', label: 'Markets' },
      { slug: 'activity', area: 'activity', label: 'Activity' },
    ];
    const sorted = [...areaTabs].sort((a, b) => a.order - b.order);
    sorted.forEach((tab, i) => {
      expect(tab.slug).toBe(expected[i].slug);
      expect(tab.label).toBe(expected[i].label);
      expect(tab.enabled).toBe(true);
      expect(tab.config.component).toBe('MoneyPennyPanelTab');
      expect((tab.config.props as { area?: string }).area).toBe(expected[i].area);
      expect((tab.config.props as { panel?: string }).panel).toBeUndefined();
      expect(tab.adminOnly).not.toBe(true);
    });
  });

  it('the Admin tab is grouped into "moneypenny" immediately after Activity, adminOnly, and dispatches to MoneyPennyAdminTab — never Qriptopian\'s bridge editorial admin', () => {
    // Navigation/viewport correction (2026-09-03): Admin moved from a
    // standalone/ungrouped top-level tab (rendered BESIDE the MoneyPenny
    // group chip) into the group's own submenu, immediately after Activity
    // — see data/codex-configs.ts's own comment on this tab entry.
    const admin = MONEYPENNY_CARTRIDGE.tabs.find((t) => t.slug === 'admin');
    const activity = MONEYPENNY_CARTRIDGE.tabs.find((t) => t.slug === 'activity');
    expect(admin).toBeDefined();
    expect(admin!.group).toBe('moneypenny');
    expect(admin!.order).toBeGreaterThan(activity!.order);
    expect(admin!.adminOnly).toBe(true);
    expect(admin!.config.component).toBe('MoneyPennyAdminTab');
    expect(admin!.config.component).not.toBe('QriptopianAdminTab');
  });
});
