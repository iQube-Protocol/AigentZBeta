/**
 * FS Operate viewport + Focus/Full parity correction (2026-08-25).
 *
 * Closes a live Amplify-visible defect: FinancialServicesBridgeFrontDoor
 * used to build the MoneyPenny Orchestration foreground for Operate as a
 * hand-rolled `<div className="flex h-full flex-col"><iframe
 * className="w-full flex-1">`. JourneyRunSurface wraps a foreground node in
 * ordinary auto-height divs, so there was no resolved ancestor height for
 * `h-full`/`flex-1` to resolve against — the iframe collapsed toward its
 * intrinsic browser height, making MoneyPenny's own modals unusable. It also
 * had no Focus/Full toggle and no "Explore metaMe ↗" affordance, unlike
 * every other focused Bridge embed (KNYT Pulse/Quests/Store, CI/KNYTS
 * myCanvas).
 *
 * The fix: `foregroundSurfaceRefByStage` (renamed from
 * `foregroundSurfacesByStage`) now carries a JOURNEY_SURFACES REF, not a
 * React node. JourneyRunSurface renders that ref through the EXACT SAME
 * `descriptor.kind === 'embed'` switch every ordinary journey surface uses —
 * so the foreground destination inherits the shared Focus/Full toggle,
 * `h-[calc(100vh-200px)]` viewport height, and copilot-suppression handling
 * for free, instead of a second, hand-rolled version of any of them.
 *
 * Covers:
 *   1. The registry entry 'moneypenny-orchestration-focused' exists, is
 *      `kind: 'embed'`, targets the real metame-codex/home tab (navigation/
 *      viewport correction, 2026-09-03 — superseded the retired single-tab
 *      'moneypenny-orchestration' mirror), is focused, suppresses its own
 *      floating copilot, and carries the "Explore metaMe ↗" openLabel +
 *      breadcrumb.
 *   2. Parity canary: its codexSlug/tab match what
 *      resolveOperatorDestination (the catalogue mapping — untouched by this
 *      fix) resolves for the 'moneypenny' catalogue item, so the two can
 *      never silently drift apart.
 *   2b. Expand stays inside metame-codex (2026-09-03 correction of the
 *      2026-08-26 decision below to swap to the standalone moneypenny-codex
 *      cartridge) — no expandedCodexSlug/expandedTab.
 *   3. FinancialServicesBridgeFrontDoor now points 'aigentme' at that ref via
 *      `foregroundSurfaceRefByStage`, and contains no raw hand-built iframe.
 *   4. JourneyRunSurface renders ANY foreground override through the SAME
 *      switch as ordinary surfaces — the structural canary requirement (item
 *      9) — never a parallel raw-node rendering path.
 *   5. The shared embed switch's Focus/Full toolbar row supports a static
 *      `breadcrumb` left-hand label alongside the existing `openLabel`
 *      toggle, backward-compatible with descriptors that set neither.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { JOURNEY_SURFACES, buildEmbedSurfaceSrc } from '@/services/journey/journeySurfaceRegistry';
import { resolveOperatorDestination } from '@/services/journey/catalogueDestinationHelper';
import { buildCodexUrl } from '@/utils/codex-nav';
import { MONEYPENNY_CARTRIDGE, METAME_CODEX } from '@/data/codex-configs';

const FS_BRIDGE_FRONT_DOOR = 'components/journey/FinancialServicesBridgeFrontDoor.tsx';
const JOURNEY_RUN_SURFACE = 'components/journey/JourneyRunSurface.tsx';
const PILOT_JOURNEY_TAB = 'app/triad/components/codex/tabs/PilotJourneyTab.tsx';

describe("registry entry 'moneypenny-orchestration-focused'", () => {
  const descriptor = JOURNEY_SURFACES['moneypenny-orchestration-focused'];

  it('exists and is kind: embed', () => {
    expect(descriptor).toBeTruthy();
    expect(descriptor.kind).toBe('embed');
  });

  it('targets the real metame-codex / home tab (navigation/viewport correction, 2026-09-03 — supersedes the retired single-tab moneypenny-orchestration mirror)', () => {
    if (descriptor.kind !== 'embed') return;
    expect(descriptor.codexSlug).toBe('metame-codex');
    expect(descriptor.tab).toBe('home');
  });

  it('is focused by default, suppresses its own floating copilot, and carries "Explore metaMe ↗"', () => {
    if (descriptor.kind !== 'embed') return;
    expect(descriptor.focused).toBe(true);
    expect(descriptor.suppressFloatingCopilot).toBe(true);
    expect(descriptor.openLabel).toBe('Explore metaMe ↗');
  });

  it('carries the preserved left-hand context breadcrumb', () => {
    if (descriptor.kind !== 'embed') return;
    expect(descriptor.breadcrumb).toBe('Financial Services — Operate → MoneyPenny');
  });

  it('parity: codexSlug/tab match the catalogue mapping for the moneypenny activation — never derived twice without a canary', () => {
    if (descriptor.kind !== 'embed') return;
    const catalogue = resolveOperatorDestination({ catalogueItemRef: 'moneypenny', tabRef: 'home' });
    expect(catalogue.valid).toBe(true);
    if (!catalogue.valid) return;
    expect(catalogue.destination.cartridgeRef).toBe(descriptor.codexSlug);
    expect(catalogue.destination.tabSlug).toBe(descriptor.tab);
  });
});

/**
 * Expanded Operate correction (navigation/viewport correction, 2026-09-03) —
 * REVERSES the 2026-08-26 "Explore-metaMe expand parity" decision this
 * describe block used to cover: expanding no longer swaps the destination to
 * the standalone MONEYPENNY_CARTRIDGE ('moneypenny-codex'). Operator
 * directive: "Reveal the metaMe runtime shell inside the existing bridge
 * frame... Do not expand into the standalone Aigent MoneyPenny shell." Now
 * that metame-codex's own MoneyPenny group carries the real submenu
 * (MONEYPENNY_AREA_TABS), lifting metame-codex's own chrome on expand is
 * sufficient — no cartridge swap needed.
 */
describe("registry entry 'moneypenny-orchestration-focused' — expand stays inside metame-codex", () => {
  const descriptor = JOURNEY_SURFACES['moneypenny-orchestration-focused'];

  it('declares NO expandedCodexSlug/expandedTab — expand lifts metame-codex\'s own chrome instead of swapping cartridges', () => {
    if (descriptor.kind !== 'embed') return;
    expect(descriptor.expandedCodexSlug).toBeUndefined();
    expect(descriptor.expandedTab).toBeUndefined();
  });

  it('focusedNavDepth is 1 — hides metaMe\'s own top-level nav while keeping the MoneyPenny submenu navigable in focused view, matching MoneyPennyBridgeEmbed\'s own depth for the standalone cartridge', () => {
    if (descriptor.kind !== 'embed') return;
    expect(descriptor.focusedNavDepth).toBe(1);
  });

  it('METAME_CODEX\'s MoneyPenny group shares MONEYPENNY_AREA_TABS verbatim with the standalone cartridge — one canonical submenu, not a hand-copied duplicate', () => {
    const groupTabs = METAME_CODEX.tabs.filter((t) => t.group === 'moneypenny');
    const standaloneTabs = MONEYPENNY_CARTRIDGE.tabs.filter((t) => t.group === 'moneypenny');
    expect(groupTabs.map((t) => t.slug)).toEqual(standaloneTabs.map((t) => t.slug));
    expect(groupTabs.map((t) => t.config.component)).toEqual(standaloneTabs.map((t) => t.config.component));
  });

  it('MONEYPENNY_CARTRIDGE exposes exactly one real native tabGroup ("moneypenny") holding all six tabs — the six-item sub-header IS the navigation, not a second, competing bar', () => {
    expect(MONEYPENNY_CARTRIDGE.tabGroups ?? []).toHaveLength(1);
    expect((MONEYPENNY_CARTRIDGE.tabGroups ?? [])[0].id).toBe('moneypenny');
    expect(MONEYPENNY_CARTRIDGE.tabs).toHaveLength(6);
    expect(MONEYPENNY_CARTRIDGE.tabs.every((t) => t.group === 'moneypenny')).toBe(true);
  });

  it('metame-codex no longer carries the retired single-tab "metame-moneypenny-orchestration" mirror', () => {
    const code = stripComments(readSource('data/codex-configs.ts'));
    expect(code).not.toContain("id: 'metame-moneypenny-orchestration'");
  });
});

describe('buildEmbedSurfaceSrc — Focus view (default) vs Explore-metaMe expand, driven by the SAME `focused` signal', () => {
  const descriptor = JOURNEY_SURFACES['moneypenny-orchestration-focused'];
  if (descriptor.kind !== 'embed') throw new Error('expected an embed descriptor');

  it('Focus view (focused: true, the un-toggled default) targets metame-codex/home with chrome suppressed down to depth 1 (submenu visible, metaMe top-level nav hidden)', () => {
    const src = buildEmbedSurfaceSrc(
      { ...descriptor, focused: true },
      { personaId: 'persona-1' },
      buildCodexUrl,
    );
    expect(src).toContain('/triad/embed/codex/metame-codex');
    expect(src).toContain('tab=home');
    expect(src).toContain('chrome=focused');
    expect(src).toContain('depth=1');
    expect(src).not.toContain('moneypenny-codex');
  });

  it('Expand (focused cleared — the exact override JourneyRunSurface applies on openLabel click) STAYS on metame-codex/home, revealing full metaMe chrome — never the standalone moneypenny-codex shell', () => {
    const src = buildEmbedSurfaceSrc(
      { ...descriptor, focused: undefined },
      { personaId: 'persona-1' },
      buildCodexUrl,
    );
    expect(src).toContain('/triad/embed/codex/metame-codex');
    expect(src).toContain('tab=home');
    expect(src).not.toContain('chrome=focused');
    expect(src).not.toContain('depth=');
    expect(src).not.toContain('moneypenny-codex');
  });

  it('a focused descriptor with NO expandedCodexSlug (e.g. KNYT Pulse) is unaffected — expand just lifts its own chrome, codexSlug/tab never change', () => {
    const knytPulse = Object.values(JOURNEY_SURFACES).find(
      (d): d is Extract<typeof d, { kind: 'embed' }> =>
        d.kind === 'embed' && d.codexSlug === 'knyt-codex' && d.tab === 'pulse',
    );
    expect(knytPulse, 'expected a knyt-codex/pulse focused descriptor to exist as the comparison case').toBeTruthy();
    if (!knytPulse) return;
    expect(knytPulse.expandedCodexSlug).toBeUndefined();
    const focusedSrc = buildEmbedSurfaceSrc({ ...knytPulse, focused: true }, {}, buildCodexUrl);
    const expandedSrc = buildEmbedSurfaceSrc({ ...knytPulse, focused: undefined }, {}, buildCodexUrl);
    expect(focusedSrc).toContain('/triad/embed/codex/knyt-codex');
    expect(expandedSrc).toContain('/triad/embed/codex/knyt-codex');
    expect(focusedSrc).toContain('tab=pulse');
    expect(expandedSrc).toContain('tab=pulse');
  });
});

describe('FinancialServicesBridgeFrontDoor — Operate routes through the registry ref, never a raw iframe', () => {
  it('maps the aigentme stage to the moneypenny-orchestration-focused ref via foregroundSurfaceRefByStage', () => {
    const code = stripComments(readSource(FS_BRIDGE_FRONT_DOOR));
    expect(code).toContain("{ aigentme: 'moneypenny-orchestration-focused' }");
    expect(code).toContain('foregroundSurfaceRefByStage={foregroundSurfaceRefByStage}');
  });

  it('contains no hand-built MoneyPenny Orchestration iframe', () => {
    const code = stripComments(readSource(FS_BRIDGE_FRONT_DOOR));
    expect(code).not.toMatch(/<iframe[^>]*src=\{destination\.operatorDestination\.route\}/);
    expect(code).not.toContain('title="MoneyPenny Orchestration"');
  });

  it('still gates the override on resolveJourneyOperatorDestination — the catalogue mapping is untouched, only reused', () => {
    const code = stripComments(readSource(FS_BRIDGE_FRONT_DOOR));
    expect(code).toContain('resolveJourneyOperatorDestination({');
    expect(code).toContain("destination.activationMode === 'CATALOGUE_ACTIVATION'");
  });
});

describe('foregroundSurfaceRefByStage — a REF, threaded through unchanged by PilotJourneyTab', () => {
  it('PilotJourneyTab passes the prop through by the same name, untransformed', () => {
    const code = stripComments(readSource(PILOT_JOURNEY_TAB));
    expect(code).toContain('foregroundSurfaceRefByStage');
    expect(code).toContain('foregroundSurfaceRefByStage={foregroundSurfaceRefByStage}');
    // The old raw-ReactNode prop name must be fully retired, not aliased.
    expect(code).not.toContain('foregroundSurfacesByStage');
  });
});

describe('JourneyRunSurface — foreground override renders through the SAME embed switch as ordinary surfaces', () => {
  it('no parallel raw-node rendering path remains for the override', () => {
    const code = stripComments(readSource(JOURNEY_RUN_SURFACE));
    expect(code).not.toContain('foregroundSurfacesByStage');
    // The old branch rendered the override directly as a node:
    //   <div key={...}>{foregroundSurfacesByStage[activeStage.id]}</div>
    // That pattern must be gone — confirms no lingering parallel path.
    expect(code).not.toMatch(/<div key=\{`foreground-\$\{activeStage\.id\}`\}>/);
  });

  it('computes a synthetic one-element surfaces array from the override ref, fed into the existing surfaces.map switch', () => {
    // MoneyPenny experience-coherence correction (2026-09-03) — this
    // computation was hoisted into an `activeStageSurfaceRefs` memo so the
    // host-copilot suppression check (registryRequestsHostCopilotSuppression)
    // reads the SAME list the render switch below maps over, rather than
    // each recomputing it independently and risking drift. The override
    // logic itself — and the fact the render switch consumes exactly one
    // list, never a parallel path — is unchanged, just named and hoisted.
    const code = stripComments(readSource(JOURNEY_RUN_SURFACE));
    expect(code).toContain('const activeStageSurfaceRefs = useMemo(() => {');
    expect(code).toContain('const overrideRef = foregroundSurfaceRefByStage?.[activeStage.id];');
    expect(code).toContain("? [{ ref: overrideRef, mode: 'iframe' as const }]");
    expect(code).toContain(': activeStage.surfaces;');
    expect(code).toContain('const surfacesToRender: JourneySurfaceRef[] = activeStageSurfaceRefs;');
    expect(code).toContain('return surfacesToRender.map((surfaceRef, i) => {');
  });

  it('the Focus/Full toolbar row supports a static breadcrumb left-slot alongside the existing rootTab/openLabel affordances', () => {
    const code = stripComments(readSource(JOURNEY_RUN_SURFACE));
    expect(code).toContain('descriptor.rootTab || descriptor.breadcrumb || descriptor.focused');
    expect(code).toMatch(/descriptor\.breadcrumb \? \(\s*<span[^>]*>\{descriptor\.breadcrumb\}<\/span>/);
  });

  it('the height class is unchanged — focused/fullscreen embeds still get the full Journey viewport height', () => {
    const code = stripComments(readSource(JOURNEY_RUN_SURFACE));
    expect(code).toContain("fullScreen || shouldFocus ? 'h-[calc(100vh-200px)]' : 'h-[36rem]'");
  });
});
