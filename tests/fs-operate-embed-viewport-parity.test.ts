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
import { JOURNEY_SURFACES } from '@/services/journey/journeySurfaceRegistry';
import { resolveOperatorDestination } from '@/services/journey/catalogueDestinationHelper';

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
    const code = stripComments(readSource(JOURNEY_RUN_SURFACE));
    expect(code).toContain('const overrideRef = foregroundSurfaceRefByStage?.[activeStage.id];');
    expect(code).toMatch(/const surfacesToRender: JourneySurfaceRef\[\] = overrideRef/);
    expect(code).toContain("? [{ ref: overrideRef, mode: 'iframe' }]");
    expect(code).toContain(': activeStage.surfaces;');
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
