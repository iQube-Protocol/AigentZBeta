/**
 * IRL OS / metaMe IRL access-boundary correction (2026-08-26).
 *
 * CANONICAL INVARIANT (operator ruling, 2026-08-26): "IRL OS is the
 * participation boundary; metaMe IRL is the administrative laboratory."
 * Generalized: external IRL participant -> IRL OS; admin/internal lab
 * operator -> metaMe IRL.
 *
 * THE DEFECT THIS CLOSES: the OCSGA Bridge's focused Reciprocal Artifact
 * Exchange embed (irl-exchange-workspace) expanded its "Open full view"
 * affordance into metaMe IRL (irl-cartridge) -- the internal comprehensive
 * laboratory -- not IRL OS. A second, independent leak carried the SAME
 * defect: BoundaryResearchProgressPanel's "Explore IRL OS" link (the
 * research-active terminal stage's own affordance) was labeled IRL OS but
 * wired to irl-cartridge. A third leak lived in ocsga-boundary-research's own
 * workspace links (services/research/researchWorkspace.ts), which pointed
 * Protocols/Records at irl-cartridge tabs that are now admin-gated.
 *
 * THE FIX, surgical and Ian-scoped (no redesign of the universal invitation
 * router):
 *   1. journeySurfaceRegistry.ts's 'irl-exchange-workspace' descriptor gained
 *      expandedCodexSlug/expandedTab -> irl-os-cartridge/irl-os-workspace,
 *      the SAME mechanism 'moneypenny-orchestration-focused' established the
 *      same day (fs-operate-embed-viewport-parity.test.ts is that
 *      mechanism's own canary). The focused embed itself (irl-cartridge's
 *      irl-exchange tab) is UNCHANGED -- that tab is deliberately not
 *      admin-gated, per its own comment, so an invited counterparty still
 *      reaches it directly.
 *   2. BoundaryResearchProgressPanel.tsx's exploreIrlOsLink now actually
 *      points at irl-os-cartridge/irl-os-workspace.
 *   3. ocsga-boundary-research's Protocols link repointed at its irl-os-*
 *      mirror; its Records link is DROPPED (irl-os-records is deliberately
 *      disabled -- "the constitutional record lives in the metaMe IRL
 *      edition only" -- a pre-existing decision this pass did not touch);
 *      its Exchange link stays irl-cartridge/irl-exchange (no IRL OS
 *      equivalent exists, and none is needed).
 *   4. data/codex-configs.ts's IRL_CARTRIDGE: every INSTITUTION/RESEARCH/
 *      LABORATORY(minus Exchange)/PUBLICATIONS tab (welcome, dashboard,
 *      research copilot, charter, the three layers, protocols, invariant
 *      field/registry, glossary, records, reports, programmes) is now
 *      adminOnly: true -- these had NO pre-existing test asserting non-admin
 *      reachability, and are the actual internal-lab content the invariant
 *      targets.
 *
 *      NOT touched, and deliberately so -- two categories of SHARED
 *      infrastructure, discovered by pre-existing test suites catching
 *      over-broad drafts of this fix, not invented by it:
 *        - irl-exchange (see (1)) -- the concrete OCSGA collaboration surface.
 *        - irl-workspace AND THE WHOLE 'participation' GROUP
 *          (irl-participation-overview/-standing, irl-passport-apply/
 *          -delegation/-locker) -- a delegated steward and ordinary
 *          research-lab participants (Autonomi reviewers, capstone faculty/
 *          students, institutional observers, PIs) already reach these
 *          directly in metaMe IRL, predating and extending beyond OCSGA.
 *          tests/research-workspace-spec.test.ts,
 *          tests/research-lab-workspace.test.ts and
 *          tests/lab-tab-restructure-and-locker-ux.test.ts all assert
 *          exactly this reachability; gating any of them regressed those
 *          suites and was reverted. Widening the boundary to cover them too
 *          would be the "redesign of the universal invitation router" this
 *          pass was explicitly told to defer -- flagged in the closeout
 *          report as a real, adjacent leak (per the same invariant) left
 *          for a deliberate, separately-scoped follow-up.
 *
 * Covers the five required proofs plus the exhaustive canary:
 *   1. OCSGA Full View resolves to IRL OS (buildEmbedSurfaceSrc, both states).
 *   2. External research invitation grants do not authorize metaMe IRL's
 *      INTERNAL-LAB tabs (getEnabledTabs with a loaded research-lab grant,
 *      non-admin) -- irl-exchange, irl-workspace and the Participation group
 *      remain reachable (pre-existing, untouched), everything else does not.
 *   3. Non-admin direct access to metaMe IRL's internal-lab tabs is refused/
 *      hidden (getEnabledTabs, no grants at all).
 *   4. Admin access to metaMe IRL remains intact (getEnabledTabs, isAdmin).
 *   5. Existing IRL OS participation flows remain unchanged (IRL OS tabs
 *      un-gated, IRL OS call site of buildResearchWorkspaceTab untouched).
 *   6. Exhaustive canary -- every metaMe IRL tab outside the shared-
 *      infrastructure exception list is adminOnly, so a future tab added to
 *      IRL_CARTRIDGE without an explicit adminOnly decision fails red.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { IRL_CARTRIDGE, IRL_OS_CARTRIDGE } from '@/data/codex-configs';
import { JOURNEY_SURFACES, buildEmbedSurfaceSrc } from '@/services/journey/journeySurfaceRegistry';
import { buildCodexUrl } from '@/utils/codex-nav';
import { getEnabledTabs } from '@/app/hooks/useCodexConfig';
import type { ParticipationAccessState } from '@/services/passport/participationTabGate';
import { RESEARCH_WORKSPACES } from '@/services/research/researchWorkspace';

/** See the file header's "NOT touched, and deliberately so" section. */
const SHARED_NON_ADMIN_TAB_IDS = new Set([
  'irl-exchange',
  'irl-workspace',
  'irl-participation-overview',
  'irl-participation-standing',
  'irl-passport-apply',
  'irl-passport-delegation',
  'irl-passport-locker',
]);

/** The actual internal-lab tabs this pass admin-gates -- used to prove they
 *  stay closed under every non-admin condition tested below. */
const INTERNAL_LAB_TAB_IDS = [
  'irl-welcome',
  'irl-dashboard',
  'irl-research-copilot',
  'irl-charter',
  'layer-i',
  'layer-ii',
  'layer-iii',
  'irl-protocols',
  'irl-invariant-field',
  'irl-invariant-registry',
  'irl-glossary',
  'irl-records',
  'irl-reports',
  'irl-programmes',
];

const RESEARCH_LAB_GRANT: ParticipationAccessState = {
  loaded: true,
  grants: [{ accessDomain: 'research-lab', role: 'reviewer', allowedScopes: ['ocsga-boundary-research'] }],
};

describe('1. OCSGA Bridge Full View resolves to IRL OS', () => {
  const descriptor = JOURNEY_SURFACES['irl-exchange-workspace'];

  it('descriptor exists, is kind: embed, and the focused embed itself is unchanged', () => {
    expect(descriptor).toBeTruthy();
    expect(descriptor.kind).toBe('embed');
    if (descriptor.kind !== 'embed') return;
    expect(descriptor.codexSlug).toBe('irl-cartridge');
    expect(descriptor.tab).toBe('irl-exchange');
    expect(descriptor.focused).toBe(true);
  });

  it('declares expandedCodexSlug/expandedTab pointing at IRL OS, never metaMe IRL', () => {
    if (descriptor.kind !== 'embed') return;
    expect(descriptor.expandedCodexSlug).toBe('irl-os-cartridge');
    // CONTAINED 2026-08-27 (docs/security/2026-08-27_irl-os-containment-breach-audit.md,
    // operator-approved Phase 1 disposition): repointed from the now-disabled
    // irl-os-workspace (which shared PartnerProgrammesTab/DeepLinkCard
    // rendering with metaMe IRL's own Workspace tab) to the always-enabled
    // Welcome tab, so this affordance never dangles onto a hidden tab.
    expect(descriptor.expandedTab).toBe('irl-os-welcome');
  });

  it('parity: expandedCodexSlug matches IRL_OS_CARTRIDGE.id, expandedTab is a real, non-admin-gated, ENABLED tab on it', () => {
    if (descriptor.kind !== 'embed') return;
    expect(descriptor.expandedCodexSlug).toBe(IRL_OS_CARTRIDGE.id);
    const tab = IRL_OS_CARTRIDGE.tabs.find((t) => t.slug === descriptor.expandedTab);
    expect(tab, `expandedTab '${descriptor.expandedTab}' must be a real IRL_OS_CARTRIDGE tab`).toBeTruthy();
    expect(tab?.adminOnly).toBeFalsy();
    // Strengthened 2026-08-27: a dangling expandedTab pointing at a
    // disabled tab is exactly the defect this containment pass fixed
    // elsewhere (BoundaryResearchProgressPanel, QuickLinksCard) -- this
    // parity check now also catches a regression back into that shape.
    expect(tab?.enabled, `expandedTab '${descriptor.expandedTab}' must be enabled`).toBe(true);
  });

  it('buildEmbedSurfaceSrc: Focus view (un-toggled default) still targets irl-cartridge/irl-exchange', () => {
    if (descriptor.kind !== 'embed') return;
    const src = buildEmbedSurfaceSrc({ ...descriptor, focused: true }, { personaId: 'persona-1' }, buildCodexUrl);
    expect(src).toContain('/triad/embed/codex/irl-cartridge');
    expect(src).toContain('tab=irl-exchange');
    expect(src).not.toContain('irl-os-cartridge');
  });

  it('buildEmbedSurfaceSrc: Full View (focused cleared -- the exact override JourneyRunSurface applies on openLabel click) targets irl-os-cartridge/irl-os-welcome, never irl-cartridge', () => {
    if (descriptor.kind !== 'embed') return;
    const src = buildEmbedSurfaceSrc({ ...descriptor, focused: undefined }, { personaId: 'persona-1' }, buildCodexUrl);
    expect(src).toContain('/triad/embed/codex/irl-os-cartridge');
    expect(src).toContain('tab=irl-os-welcome');
    expect(src).not.toContain('/codex/irl-cartridge');
  });
});

describe('2. External research invitation grants do not authorize metaMe IRL internal-lab tabs', () => {
  it('a loaded research-lab grant (Ian-shaped) opens none of the internal-lab tabs', () => {
    const enabled = new Set(
      getEnabledTabs(IRL_CARTRIDGE, false, false, false, new Set(), undefined, RESEARCH_LAB_GRANT).map((t) => t.id),
    );
    for (const id of INTERNAL_LAB_TAB_IDS) {
      expect(enabled.has(id), `'${id}' must not open for a research-lab grant`).toBe(false);
    }
  });

  it('the SAME grant still reaches the pre-existing shared entrances (irl-exchange, irl-workspace, Participation) -- unchanged by this pass', () => {
    const enabled = new Set(
      getEnabledTabs(IRL_CARTRIDGE, false, false, false, new Set(), undefined, RESEARCH_LAB_GRANT).map((t) => t.id),
    );
    for (const id of SHARED_NON_ADMIN_TAB_IDS) {
      expect(enabled.has(id), `'${id}' should remain reachable -- pre-existing shared infrastructure`).toBe(true);
    }
  });

  it('the SAME grant opens the participant-appropriate set in IRL_OS_CARTRIDGE (participation flow unaffected)', () => {
    const enabled = getEnabledTabs(IRL_OS_CARTRIDGE, false, false, false, new Set(), undefined, RESEARCH_LAB_GRANT);
    const ids = enabled.map((t) => t.id);
    expect(ids).toContain('irl-os-welcome');
    // CONTAINED 2026-08-27 (docs/security/2026-08-27_irl-os-containment-breach-audit.md,
    // operator-approved Phase 1 disposition): irl-os-workspace and
    // irl-os-protocols are now `enabled: false` -- irl-os-workspace shared
    // PartnerProgrammesTab/DeepLinkCard rendering with metaMe IRL's own
    // Workspace tab, which constructed live irl-cartridge deep links
    // (personaId/isAdmin as query params) directly in the public
    // cartridge; irl-os-protocols served col_experiments via a route that
    // (before the same pass) had no access control for the irl pack. Both
    // are disabled, not removed, pending a Phase 2 IRL OS-native projection.
    expect(ids).not.toContain('irl-os-workspace');
    expect(ids).not.toContain('irl-os-protocols');
    // irl-os-records is `enabled: false` by pre-existing design ("the
    // constitutional record lives in the metaMe IRL edition only") -- not
    // part of this pass, and correctly absent from the enabled set either way.
    expect(ids).not.toContain('irl-os-records');
  });
});

describe('3. Non-admin direct access to metaMe IRL internal-lab tabs is refused/hidden', () => {
  it('with no grants loaded at all, none of the internal-lab tabs are reachable', () => {
    const enabled = new Set(getEnabledTabs(IRL_CARTRIDGE, false).map((t) => t.id));
    for (const id of INTERNAL_LAB_TAB_IDS) {
      expect(enabled.has(id), `'${id}' must not be reachable by a non-admin with no grants`).toBe(false);
    }
  });

  it('with no grants loaded at all, exactly irl-exchange (+ Participation, which carries no gate of its own) is reachable -- irl-workspace fails closed on its own participationDomain gate', () => {
    const enabled = new Set(getEnabledTabs(IRL_CARTRIDGE, false).map((t) => t.id));
    expect(enabled.has('irl-exchange')).toBe(true);
    expect(enabled.has('irl-workspace')).toBe(false);
    for (const id of ['irl-participation-overview', 'irl-participation-standing', 'irl-passport-apply', 'irl-passport-delegation', 'irl-passport-locker']) {
      expect(enabled.has(id), `'${id}' has no gate of its own -- reachable even signed out, unchanged by this pass`).toBe(true);
    }
  });
});

describe('4. Admin access to metaMe IRL remains intact', () => {
  it('an admin sees every tab', () => {
    const enabled = getEnabledTabs(IRL_CARTRIDGE, true);
    expect(enabled.length).toBe(IRL_CARTRIDGE.tabs.filter((t) => t.enabled).length);
    const ids = new Set(enabled.map((t) => t.id));
    expect(ids.has('irl-welcome')).toBe(true);
    expect(ids.has('irl-experiment-lab')).toBe(true);
    expect(ids.has('irl-workspace')).toBe(true);
    expect(ids.has('irl-exchange')).toBe(true);
  });

  it("an admin's irl-workspace still exposes the TIER 0 admin-programme-space subTab", () => {
    const workspaceTab = IRL_CARTRIDGE.tabs.find((t) => t.id === 'irl-workspace');
    expect(workspaceTab).toBeTruthy();
    const subTabs = workspaceTab?.subTabs ?? [];
    const adminSubTab = subTabs.find((t) => /administer|administration/i.test(t.label));
    expect(adminSubTab, 'expected a TIER 0 admin subTab under irl-workspace').toBeTruthy();
    expect(adminSubTab?.adminOnly).toBe(true);
  });
});

describe('5. Existing IRL OS participation flows remain unchanged', () => {
  it("IRL_OS_CARTRIDGE's call to buildResearchWorkspaceTab is untouched -- irl-os-workspace and its subTabs are NOT adminOnly", () => {
    const workspaceTab = IRL_OS_CARTRIDGE.tabs.find((t) => t.id === 'irl-os-workspace');
    expect(workspaceTab).toBeTruthy();
    expect(workspaceTab?.adminOnly).toBeFalsy();
    for (const sub of workspaceTab?.subTabs ?? []) {
      if (/administer|administration/i.test(sub.label)) continue; // TIER 0 stays admin-only in both
      expect(sub.adminOnly, `IRL OS workspace subTab '${sub.id}' must stay reachable`).toBeFalsy();
    }
  });

  it('the participant-facing IRL OS tabs stay ungated', () => {
    for (const id of [
      'irl-os-welcome',
      'irl-os-protocols',
      'irl-os-participation-overview',
      'irl-os-passport-apply',
      'irl-os-passport-delegation',
      'irl-os-passport-locker',
    ]) {
      const tab = IRL_OS_CARTRIDGE.tabs.find((t) => t.id === id);
      expect(tab, `expected IRL_OS_CARTRIDGE to still declare '${id}'`).toBeTruthy();
      expect(tab?.adminOnly, `'${id}' must not be newly admin-gated`).toBeFalsy();
    }
  });

  it('deliberately-internal IRL OS instruments stay admin-only, unaffected either way', () => {
    for (const id of ['irl-os-corpus-scout', 'irl-os-exp-p1-readiness']) {
      const tab = IRL_OS_CARTRIDGE.tabs.find((t) => t.id === id);
      expect(tab?.adminOnly).toBe(true);
    }
  });

  it('irl-os-experiment-lab stays reachable, gated server-side rather than by adminOnly (pre-existing design, untouched by this pass)', () => {
    const tab = IRL_OS_CARTRIDGE.tabs.find((t) => t.id === 'irl-os-experiment-lab');
    expect(tab?.adminOnly).toBeFalsy();
  });
});

describe('6. Exhaustive canary -- every metaMe IRL tab outside the shared-infrastructure list is adminOnly', () => {
  it('no tab silently escapes the boundary (fails red the moment a new IRL_CARTRIDGE tab omits adminOnly)', () => {
    const offenders = IRL_CARTRIDGE.tabs
      .filter((t) => !SHARED_NON_ADMIN_TAB_IDS.has(t.id))
      .filter((t) => !t.adminOnly);
    expect(
      offenders.map((t) => t.id),
      'every metaMe IRL tab must be adminOnly except the declared shared-infrastructure exceptions',
    ).toEqual([]);
  });

  it('the exception list is EXACTLY irl-exchange + irl-workspace + the Participation group -- nothing more', () => {
    const nonAdminTabs = IRL_CARTRIDGE.tabs.filter((t) => !t.adminOnly).map((t) => t.id);
    expect(new Set(nonAdminTabs)).toEqual(SHARED_NON_ADMIN_TAB_IDS);
  });

  it('irl-exchange itself is confirmed unchanged -- not admin-gated, still the real IRLExchangeTab', () => {
    const tab = IRL_CARTRIDGE.tabs.find((t) => t.id === 'irl-exchange');
    expect(tab).toBeTruthy();
    expect(tab?.adminOnly).toBeFalsy();
    expect(tab?.config.component).toBe('IRLExchangeTab');
    expect(tab?.group).toBe('laboratory');
  });

  it('irl-workspace itself is confirmed unchanged -- gated by participationDomain, not adminOnly', () => {
    const tab = IRL_CARTRIDGE.tabs.find((t) => t.id === 'irl-workspace');
    expect(tab).toBeTruthy();
    expect(tab?.adminOnly).toBeFalsy();
    expect(tab?.participationDomain).toBe('research-lab');
  });
});

describe('ocsga-boundary-research workspace links -- Protocols points at IRL OS, Records dropped, Exchange stays put', () => {
  const workspace = RESEARCH_WORKSPACES.find((w) => w.id === 'ocsga-boundary-research');

  it('workspace is registered exactly as expected', () => {
    expect(workspace).toBeTruthy();
  });

  it('Protocols & Articles link points at irl-os-cartridge / irl-os-protocols', () => {
    const link = workspace?.links?.find((l) => l.id === 'irl-protocols');
    expect(link).toBeTruthy();
    expect(link?.codexSlug).toBe('irl-os-cartridge');
    expect(link?.tab).toBe('irl-os-protocols');
  });

  it('Records & Findings link is DROPPED, not repointed -- irl-os-records is `enabled: false` by pre-existing design ("the constitutional record lives in the metaMe IRL edition only"); no safe participant-facing destination exists', () => {
    const link = workspace?.links?.find((l) => l.id === 'irl-records');
    expect(link).toBeUndefined();
    const target = IRL_OS_CARTRIDGE.tabs.find((t) => t.id === 'irl-os-records');
    expect(target?.enabled).toBe(false);
  });

  it('Exchange link is UNCHANGED -- irl-cartridge / irl-exchange (no IRL OS equivalent exists)', () => {
    const link = workspace?.links?.find((l) => l.id === 'irl-exchange');
    expect(link).toBeTruthy();
    expect(link?.codexSlug).toBe('irl-cartridge');
    expect(link?.tab).toBe('irl-exchange');
  });

  it('every linked destination is real and correctly gated (no dangling or wrongly-gated link)', () => {
    for (const link of workspace?.links ?? []) {
      const cartridge = link.codexSlug === 'irl-os-cartridge' ? IRL_OS_CARTRIDGE : IRL_CARTRIDGE;
      const tab = cartridge.tabs.find((t) => t.slug === link.tab);
      expect(tab, `link '${link.id}' -> ${link.codexSlug}/${link.tab} must resolve to a real tab`).toBeTruthy();
      if (link.codexSlug === 'irl-os-cartridge') {
        expect(tab?.adminOnly, `IRL OS link target '${link.tab}' must not be admin-gated`).toBeFalsy();
      }
    }
  });
});

describe('BoundaryResearchProgressPanel -- "Explore IRL OS" now actually links to IRL OS', () => {
  const SOURCE = 'components/journey/BoundaryResearchProgressPanel.tsx';

  it('buildCodexUrl targets irl-os-cartridge / irl-os-welcome (repointed 2026-08-27 off the now-disabled irl-os-workspace)', () => {
    const code = stripComments(readSource(SOURCE));
    expect(code).toContain("buildCodexUrl('irl-os-cartridge', { tab: 'irl-os-welcome', personaId })");
  });

  it('no remaining reference to irl-cartridge anywhere in this file (source code, not comments)', () => {
    const code = stripComments(readSource(SOURCE));
    expect(code).not.toContain("'irl-cartridge'");
  });
});

describe('journeySurfaceRegistry.ts -- no other OCSGA/Ian surface silently targets metaMe IRL', () => {
  it('the only irl-cartridge embed descriptor left is irl-exchange-workspace itself', () => {
    const embedsIntoIrlCartridge = Object.entries(JOURNEY_SURFACES).filter(
      ([, d]) => d.kind === 'embed' && d.codexSlug === 'irl-cartridge',
    );
    expect(embedsIntoIrlCartridge.map(([key]) => key)).toEqual(['irl-exchange-workspace']);
  });
});
