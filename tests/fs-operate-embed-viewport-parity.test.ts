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
 *      `kind: 'embed'`, targets the real metame-codex/moneypenny-orchestration
 *      tab, is focused, suppresses its own floating copilot, and carries the
 *      "Explore metaMe ↗" openLabel + breadcrumb.
 *   2. Parity canary: its codexSlug/tab match what
 *      resolveOperatorDestination (the catalogue mapping — untouched by this
 *      fix) resolves for the 'moneypenny' catalogue item, so the two can
 *      never silently drift apart.
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
import { MONEYPENNY_CARTRIDGE } from '@/data/codex-configs';

const FS_BRIDGE_FRONT_DOOR = 'components/journey/FinancialServicesBridgeFrontDoor.tsx';
const JOURNEY_RUN_SURFACE = 'components/journey/JourneyRunSurface.tsx';
const PILOT_JOURNEY_TAB = 'app/triad/components/codex/tabs/PilotJourneyTab.tsx';

describe("registry entry 'moneypenny-orchestration-focused'", () => {
  const descriptor = JOURNEY_SURFACES['moneypenny-orchestration-focused'];

  it('exists and is kind: embed', () => {
    expect(descriptor).toBeTruthy();
    expect(descriptor.kind).toBe('embed');
  });

  it('targets the real metame-codex / moneypenny-orchestration tab', () => {
    if (descriptor.kind !== 'embed') return;
    expect(descriptor.codexSlug).toBe('metame-codex');
    expect(descriptor.tab).toBe('moneypenny-orchestration');
  });

  it('is focused by default, suppresses its own floating copilot, and carries "Explore metaMe ↗"', () => {
    if (descriptor.kind !== 'embed') return;
    expect(descriptor.focused).toBe(true);
    expect(descriptor.suppressFloatingCopilot).toBe(true);
    expect(descriptor.openLabel).toBe('Explore metaMe ↗');
  });

  it('carries the preserved left-hand context breadcrumb', () => {
    if (descriptor.kind !== 'embed') return;
    expect(descriptor.breadcrumb).toBe('Financial Services — Operate → MoneyPenny Orchestration');
  });

  it('parity: codexSlug/tab match the catalogue mapping for the moneypenny activation — never derived twice without a canary', () => {
    if (descriptor.kind !== 'embed') return;
    const catalogue = resolveOperatorDestination({ catalogueItemRef: 'moneypenny', tabRef: 'moneypenny-orchestration' });
    expect(catalogue.valid).toBe(true);
    if (!catalogue.valid) return;
    expect(catalogue.destination.cartridgeRef).toBe(descriptor.codexSlug);
    expect(catalogue.destination.tabSlug).toBe(descriptor.tab);
  });
});

/**
 * Explore-metaMe expand parity (operator decision, 2026-08-26) — supersedes
 * the 2026-08-24 "Orchestration is the ONLY mirrored panel" pinning for the
 * FS Bridge's own Explore-metaMe expand affordance specifically. Covers both
 * required contexts: the focused/default state (unchanged) and the expanded
 * state (now the real MONEYPENNY_CARTRIDGE, not the metame-codex mirror).
 */
describe("registry entry 'moneypenny-orchestration-focused' — expandedCodexSlug/expandedTab", () => {
  const descriptor = JOURNEY_SURFACES['moneypenny-orchestration-focused'];

  it('declares an expandedCodexSlug/expandedTab pointing at the real MoneyPenny cartridge, not the metame-codex mirror', () => {
    if (descriptor.kind !== 'embed') return;
    expect(descriptor.expandedCodexSlug).toBe('moneypenny-codex');
    expect(descriptor.expandedTab).toBe('service-orchestration');
  });

  it('parity: expandedCodexSlug matches MONEYPENNY_CARTRIDGE.id; expandedTab is a real legacy MoneyPennyPanelKey that self-heals into the correct native area tab (navigation-hierarchy correction, 2026-09-03, second pass)', () => {
    if (descriptor.kind !== 'embed') return;
    expect(descriptor.expandedCodexSlug).toBe(MONEYPENNY_CARTRIDGE.id);
    // MONEYPENNY_CARTRIDGE now registers five real native area tabs (group
    // 'moneypenny') plus a standalone Admin tab — 'service-orchestration'
    // is NOT one of their slugs (those are home/my-money/plan/markets/
    // activity/admin). `expandedTab`'s legacy panel-key value still opens
    // the correct panel: CodexPanelDynamic lands on the cartridge's first
    // native tab (Home) since the value matches no real slug, and Home's
    // own mount effect self-heals into the Activity tab showing Service
    // Orchestration (see MoneyPennyPanelTab.tsx's own header for the
    // mechanism). Confirmed here at both ends: the value is still a real,
    // recognized MoneyPennyPanelKey, and its area is a real native tab.
    const panelTabSrc = stripComments(readSource('app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx'));
    expect(panelTabSrc).toContain(`"${descriptor.expandedTab}":`);
    const nativeSlugs = new Set(MONEYPENNY_CARTRIDGE.tabs.map((t) => t.slug));
    expect(nativeSlugs.has(descriptor.expandedTab as string)).toBe(false);
    const capsSrc = stripComments(readSource('app/(shell)/moneypenny/components/moneypennyCapabilities.ts'));
    const areaMatch = capsSrc.match(new RegExp(`"?${descriptor.expandedTab}"?:\\s*"([a-z-]+)"`));
    expect(areaMatch).not.toBeNull();
    expect(nativeSlugs.has(areaMatch![1])).toBe(true);
  });

  it('MONEYPENNY_CARTRIDGE exposes exactly one real native tabGroup ("moneypenny") — the five-area sub-header IS the navigation, not a second, competing bar (navigation-hierarchy correction, 2026-09-03, second pass, supersedes the retired single-tab/empty-tabGroups pinning)', () => {
    expect(MONEYPENNY_CARTRIDGE.tabGroups ?? []).toHaveLength(1);
    expect((MONEYPENNY_CARTRIDGE.tabGroups ?? [])[0].id).toBe('moneypenny');
    expect(MONEYPENNY_CARTRIDGE.tabs).toHaveLength(6);
    // No SECOND group and no ungrouped area tab masquerading as a
    // standalone top-level item — only the one admin tab is ungrouped.
    const ungrouped = MONEYPENNY_CARTRIDGE.tabs.filter((t) => !t.group);
    expect(ungrouped.map((t) => t.slug)).toEqual(['admin']);
  });

  it('does NOT alter metame-codex\'s own "metame-moneypenny-orchestration" tab entry — that pinning stays intact for every other path into it', () => {
    const code = stripComments(readSource('data/codex-configs.ts'));
    const entryAt = code.indexOf("id: 'metame-moneypenny-orchestration'");
    expect(entryAt).toBeGreaterThan(-1);
    const entryEnd = code.indexOf('\n    },', entryAt);
    const entryBody = code.slice(entryAt, entryEnd);
    expect(entryBody).toContain("props: { panel: 'service-orchestration' }");
  });
});

describe('buildEmbedSurfaceSrc — Focus view (default) vs Explore-metaMe expand, driven by the SAME `focused` signal', () => {
  const descriptor = JOURNEY_SURFACES['moneypenny-orchestration-focused'];
  if (descriptor.kind !== 'embed') throw new Error('expected an embed descriptor');

  it('Focus view (focused: true, the un-toggled default) still targets metame-codex/moneypenny-orchestration with chrome suppressed', () => {
    const src = buildEmbedSurfaceSrc(
      { ...descriptor, focused: true },
      { personaId: 'persona-1' },
      buildCodexUrl,
    );
    expect(src).toContain('/triad/embed/codex/metame-codex');
    expect(src).toContain('tab=moneypenny-orchestration');
    expect(src).toContain('chrome=focused');
    expect(src).toContain('depth=0');
    expect(src).not.toContain('moneypenny-codex');
  });

  it('Explore-metaMe expand (focused cleared — the exact override JourneyRunSurface applies on openLabel click) targets the real moneypenny-codex cartridge, landing on service-orchestration, with no chrome suppression', () => {
    const src = buildEmbedSurfaceSrc(
      { ...descriptor, focused: undefined },
      { personaId: 'persona-1' },
      buildCodexUrl,
    );
    expect(src).toContain('/triad/embed/codex/moneypenny-codex');
    expect(src).toContain('tab=service-orchestration');
    expect(src).not.toContain('chrome=focused');
    expect(src).not.toContain('depth=');
    expect(src).not.toContain('metame-codex');
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
