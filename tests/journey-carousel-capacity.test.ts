/**
 * Carousel capacity contract (2026-09-01 correction). The stage strip's
 * `overflow-x-auto` (2026-08-02) was purely content-width-driven: `flex-1`
 * connectors stretch to fill any viewport, so a journey whose stage COUNT
 * fits a wide desktop screen never actually overflows. The AEE-XP-001
 * Financial Sovereignty branch made this visible — KNYTS/CI journeys reach
 * twelve stages, which fit uncompressed on a desktop screen, so the
 * carousel never engaged and all twelve rendered compressed into one strip.
 *
 * The fix: MAX_VISIBLE_SPINE_STAGES (a minimum width on the strip's INNER
 * content, proportional to visibleStageUnitCount/cap, so the browser's own
 * overflow-x-auto on the OUTER scroll container actually engages once a
 * journey exceeds the cap). No virtualization — every stage stays mounted
 * in the same rail.
 *
 * Set to 7 (operator correction, same day): both KNYTS and CI's ambient
 * pre-FS spine is exactly seven stages, so the default resting view ends
 * at CHOOSE — never bleeding into fs-discover before the branch is
 * actually activated.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { KNYTS_BRIDGE_CROSSING_JOURNEY } from '@/services/journey/knytsBridgeCrossingJourney';
import { CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY } from '@/services/journey/constitutionalInternetBridgeJourney';

describe('MAX_VISIBLE_SPINE_STAGES — the carousel capacity cap', () => {
  const src = stripComments(readSource('components/journey/JourneyRunSurface.tsx'));

  it('is declared as exactly 7 — matching both bridges\' seven-stage ambient pre-FS spine, so CHOOSE is the last stage visible by default', () => {
    expect(src).toMatch(/const MAX_VISIBLE_SPINE_STAGES = 7;/);
  });

  it('visibleStageUnitCount counts spine stages plus one unit for the fork (if present), never per-prong', () => {
    expect(src).toMatch(/const visibleStageUnitCount = spineStages\.length \+ \(forkStages\.length \? 1 : 0\);/);
  });

  it('the strip scroll container (stripRef) no longer carries `flex` itself — layout moved to an inner wrapper', () => {
    const stripAt = src.indexOf('ref={stripRef}');
    const classNameAt = src.indexOf('className=', stripAt);
    const section = src.slice(classNameAt, classNameAt + 200);
    expect(section).toMatch(/w-full overflow-x-auto/);
    expect(section).not.toMatch(/\bflex\b/);
  });

  it('the inner content wrapper carries the flex layout AND a conditional minWidth keyed off the cap', () => {
    const wrapperAt = src.indexOf('className="flex items-center"');
    expect(wrapperAt).toBeGreaterThan(-1);
    const section = src.slice(wrapperAt, wrapperAt + 400);
    expect(section).toMatch(/visibleStageUnitCount > MAX_VISIBLE_SPINE_STAGES/);
    expect(section).toMatch(/minWidth:\s*`\$\{\(visibleStageUnitCount \/ MAX_VISIBLE_SPINE_STAGES\) \* 100\}%`/);
  });

  it('below the cap, minWidth is undefined — original full-width flex distribution is unchanged for short journeys', () => {
    const wrapperAt = src.indexOf('className="flex items-center"');
    const section = src.slice(wrapperAt, wrapperAt + 400);
    expect(section).toMatch(/:\s*undefined/);
  });

  it('never virtualizes or slices the stage list — every stage stays mounted in the same rail', () => {
    expect(src).not.toMatch(/spineStages\.slice\(/);
    expect(src).not.toMatch(/\.slice\(0,\s*(MAX_VISIBLE_SPINE_STAGES|8)\)/);
  });

  it('preserves JOURNEY_CONNECTOR_CLASS and the existing arrow/scrollIntoView mechanics — this is a capacity fix, not a stepper rewrite', () => {
    expect(src).toMatch(/const JOURNEY_CONNECTOR_CLASS = 'h-px flex-1 min-w-\[40px\]';/);
    expect(src).toMatch(/scrollIntoView\(/);
    expect(src).toMatch(/scrollStrip/);
  });
});

describe.each([
  ['KNYTS Bridge', KNYTS_BRIDGE_CROSSING_JOURNEY],
  ['Constitutional Internet Bridge', CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY],
])('%s — the FS branch actually exceeds the carousel cap (proves the fix is load-bearing, not decorative)', (_label, journey) => {
  it('total non-fork stage count exceeds MAX_VISIBLE_SPINE_STAGES once the FS branch is counted', () => {
    const spineStageCount = journey.stages.filter((s) => !s.forkPosition).length;
    expect(spineStageCount).toBeGreaterThan(7);
  });

  it('the pre-FS stage count (everything before fs-discover) is EXACTLY the cap (7) — CHOOSE is the last stage visible by default, never bleeding into fs-discover pre-activation', () => {
    const fsDiscoverIndex = journey.stages.findIndex((s) => s.id === 'fs-discover');
    expect(fsDiscoverIndex).toBeGreaterThan(-1);
    const ambientStageCount = journey.stages.slice(0, fsDiscoverIndex).filter((s) => !s.forkPosition).length;
    expect(ambientStageCount).toBe(7);
  });
});
