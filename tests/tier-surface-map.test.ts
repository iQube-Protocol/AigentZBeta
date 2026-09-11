/**
 * Tier→Surface map canaries — Horizen audit Amendment F (operator ruling,
 * 2026-07-27).
 *
 * Amendment B defined the four tiers as information boundaries. Amendment F
 * says WHERE each lives:
 *
 *   Internal workspace  → Venture Lab cartridge, admin-gated          (Tier 0)
 *   Partner space       → Venture Lab → Partner group, split          (Tier 0+2)
 *   Project space       → Participate group in IRL · IRL OS · MVL     (Tier 2)
 *   Commons             → AgentiQ (home) + 4 mirrors                  (Tier 3)
 *
 * WHY THIS NEEDS A CANARY AT ALL. The audit found the Project space already
 * existed in all three cartridges — nothing had to be built. That is exactly
 * what makes it fragile: three near-identical config blocks that nobody
 * declared as ONE space read like incidental duplication, and the obvious
 * "tidy-up" is to delete two of them. After Amendment F they are ratified
 * structure, and removing an entrance is a constitutional change.
 *
 * The Commons does not exist yet (Phase 5). This file deliberately does NOT
 * assert that it does — a canary that fails for unbuilt work teaches everyone
 * to ignore it. What it asserts instead is that the RULING is recorded, so the
 * specification cannot be lost between now and Phase 5.
 */

import { describe, it, expect } from 'vitest';
import { readSource } from './_lib/sourceAuthority';

/** The three cartridges that carry the Project space, and their group id. */
const PROJECT_SPACE = [
  { config: 'IRL_CARTRIDGE', group: 'participation', label: 'mIRL' },
  { config: 'IRL_OS_CARTRIDGE', group: 'participation', label: 'IRL OS' },
  { config: 'VENTURE_LAB_CODEX', group: 'participate', label: 'MVL' },
] as const;

/**
 * The surfaces every entrance must carry. Deliberately NOT the full tab list:
 * IRL's Passport Registry and the two different Steward components are
 * legitimate institutional differences (audit §F.2), and pinning the full list
 * would force a false symmetry.
 */
const SHARED_SURFACES = ['Overview', 'Apply', 'Delegation', 'Locker', 'Standing'] as const;

const AUDIT_PATH = 'codexes/packs/agentiq/updates/2026-07-27_horizen-workspace-phase0-audit.md';

describe('the Project space has three entrances, and keeps them', () => {
  it('every cartridge in the ruling carries the participation group', async () => {
    const configs = await import('../data/codex-configs');
    for (const entrance of PROJECT_SPACE) {
      const codex = (configs as Record<string, { tabs: Array<{ group?: string; label: string }>; tabGroups?: Array<{ id: string }> }>)[
        entrance.config
      ];
      expect(codex, `${entrance.config} does not exist`).toBeTruthy();
      const group = (codex.tabGroups ?? []).find((g) => g.id === entrance.group);
      expect(group, `${entrance.label} has no '${entrance.group}' group — an entrance was removed`).toBeTruthy();
      const tabs = codex.tabs.filter((t) => t.group === entrance.group);
      expect(tabs.length, `${entrance.label}'s participation group is empty`).toBeGreaterThan(3);
    }
  });

  it('the five shared surfaces are present at every entrance', async () => {
    // One space, three entrances: a participant must find the same things
    // whichever cartridge they arrive through.
    const configs = await import('../data/codex-configs');
    for (const entrance of PROJECT_SPACE) {
      const codex = (configs as Record<string, { tabs: Array<{ group?: string; label: string }> }>)[entrance.config];
      const labels = codex.tabs.filter((t) => t.group === entrance.group).map((t) => t.label);
      for (const surface of SHARED_SURFACES) {
        expect(labels, `${entrance.label} is missing the ${surface} surface`).toContain(surface);
      }
    }
  });

  it('every entrance keeps a steward, and it stays admin-gated', async () => {
    // The two Labs steward different things (participation grants vs the
    // passport bureau) — that difference is recorded as legitimate. What is
    // NOT negotiable is that a steward exists and is not open.
    const configs = await import('../data/codex-configs');
    for (const entrance of PROJECT_SPACE) {
      const codex = (configs as Record<string, { tabs: Array<{ group?: string; label: string; adminOnly?: boolean }> }>)[
        entrance.config
      ];
      const steward = codex.tabs.find((t) => t.group === entrance.group && t.label === 'Steward');
      expect(steward, `${entrance.label} has no Steward surface`).toBeTruthy();
      expect(steward!.adminOnly, `${entrance.label}'s Steward is not admin-gated`).toBe(true);
    }
  });
});

describe('the Internal workspace and Partner space sit where the ruling puts them', () => {
  it('the Venture Lab keeps an admin-gated internal group', async () => {
    const { VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const administer = (VENTURE_LAB_CODEX.tabGroups ?? []).find(
      (g: { id: string }) => g.id === 'administer',
    );
    expect(administer, 'the Venture Lab has no internal (administer) group').toBeTruthy();
    expect(administer!.adminOnly, 'the internal workspace is not admin-gated').toBe(true);
  });

  it('the Partner space is the Partner group, still split across two tiers', async () => {
    const { VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const tabs = VENTURE_LAB_CODEX.tabs.filter((t: { group?: string }) => t.group === 'partner');
    const tier2 = tabs.filter((t: { participationDomain?: string }) => Boolean(t.participationDomain));
    const tier0 = tabs.filter((t: { adminOnly?: boolean }) => t.adminOnly === true);
    // Both tiers must remain populated: an all-Tier-0 Partner group restores
    // the hard blocker, an all-Tier-2 one publishes internal material.
    expect(tier2.length, 'the Partner space has no Tier 2 views').toBeGreaterThan(0);
    expect(tier0.length, 'the Partner space has no Tier 0 views').toBeGreaterThan(0);
    expect(tier2.length + tier0.length).toBe(tabs.length);
  });
});

describe('the Commons specification survives until Phase 5 builds it', () => {
  it('the ruling records AgentiQ as the home and names every mirror', () => {
    // The Commons does not exist yet. This asserts the SPECIFICATION is not
    // lost — the failure mode for a ruling given in passing ("before I forget")
    // is that it is never written down and Phase 5 re-decides it differently.
    const audit = readSource(AUDIT_PATH);
    const section = audit.slice(audit.indexOf('# Amendment F'));
    expect(section.length, 'Amendment F is not recorded in the audit').toBeGreaterThan(500);
    expect(section).toMatch(/AgentiQ \(home\)/);
    for (const mirror of ['AgentiQ OS', 'IRL', 'IRL OS', 'Venture Lab']) {
      expect(section, `the Commons mirror ${mirror} is not named`).toContain(mirror);
    }
    // And the discipline that governs a mirror, so Phase 5 cannot fork the data.
    expect(section).toMatch(/second ENTRANCE, never a second copy/);
  });
});
