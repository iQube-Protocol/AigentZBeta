/**
 * A canary preventing app/bridge/ci/page.tsx from regressing to stacked
 * manual rendering (operator instruction, 2026-08-10 CI Bridge
 * reconstitution: "Add a canary preventing app/bridge/ci/page.tsx from
 * regressing to stacked manual rendering again").
 *
 * The defect this guards against: an earlier version of this page rendered
 * each stage's surface as a manually-stacked <div> section (HOME, then VIEW,
 * then ORIENT, ...) instead of composing them through JourneyRunSurface's
 * shared Posit Spine — the exact same regression class KNYTS Bridge already
 * corrected once (see knytsBridgeCrossingJourney.ts's own "seven spine
 * nodes, three tracked stages" header). Source-text inspection, same style
 * as tests/dev-merge-message-discipline.test.ts, so a structural regression
 * fails a build rather than living only as a code-review expectation.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY } from '@/services/journey/constitutionalInternetBridgeJourney';
import { JOURNEY_SURFACES } from '@/services/journey/journeySurfaceRegistry';

const REPO = path.join(__dirname, '..');
const PAGE = path.join(REPO, 'app', 'bridge', 'ci', 'page.tsx');

// Evolved 2026-08-11 (experience enrichment pass, not a reconstitution):
// HOME and ORIENT gained self-fetching admin-config wrappers around what
// used to be their bare component mounts. PERSONIFY briefly carried a
// second top-level surface (its supporting-tools surface) but that was
// CONSOLIDATED back into one surface the same day (targeted correction
// pass) — the second surface's own embedded aigent-me iframe brought an
// unrelated Horizen "Focus Check-in" ceremony along with it, producing
// four stacked agent-relationship representations instead of one; its one
// still-needed piece (the "Shape your story" capsule) now renders directly
// inside ConstitutionalInternetBridgePersonifyMyCanvas as a second pane,
// no iframe-in-iframe.
const STAGE_SURFACE_COMPONENTS = [
  'ConstitutionalInternetBridgeMediaStage',
  'ConstitutionalInternetBridgeViewSequence',
  'ConstitutionalInternetBridgeOrientIntro',
  'ConstitutionalInternetBridgePassportRoom',
  'ConstitutionalInternetBridgePersonifyMyCanvas',
  'ConstitutionalInternetBridgeStandPanel',
  'ConstitutionalInternetBridgeChooseSurface',
];

describe('CI Bridge — Threshold Guide architecture canary', () => {
  it('app/bridge/ci/page.tsx composes JourneyRunSurface', () => {
    const src = fs.readFileSync(PAGE, 'utf8');
    expect(src).toMatch(/from ['"]@\/components\/journey\/JourneyRunSurface['"]/);
    expect(src).toMatch(/<JourneyRunSurface\b/);
  });

  it('app/bridge/ci/page.tsx never JSX-renders a stage surface directly — every one is composed through the components map, never stacked', () => {
    const src = fs.readFileSync(PAGE, 'utf8');
    for (const component of STAGE_SURFACE_COMPONENTS) {
      // Importing it is expected (for the CI_BRIDGE_COMPONENTS map); directly
      // invoking it as a JSX tag (`<ComponentName`) is the stacked-page
      // regression this canary exists to catch.
      expect(src, `${component} is JSX-rendered directly in page.tsx — it must be reached only via JourneyRunSurface's components map`).not.toMatch(
        new RegExp(`<${component}[\\s/>]`),
      );
    }
  });

  it('app/bridge/ci/page.tsx does not stack multiple stage sections beneath a hero — no more than one ci-bridge-scoped DOM id', () => {
    const src = fs.readFileSync(PAGE, 'utf8');
    const ciBridgeIds = src.match(/id=["']ci-bridge-[a-z-]+["']/g) ?? [];
    expect(ciBridgeIds, `found stacked section ids: ${ciBridgeIds.join(', ')}`).toHaveLength(0);
  });

  it('every CI stage surface ref resolves to a registered JOURNEY_SURFACES entry', () => {
    for (const stage of CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY.stages) {
      for (const surface of stage.surfaces) {
        expect(JOURNEY_SURFACES[surface.ref], `stage '${stage.id}' surface '${surface.ref}' is not registered`).toBeTruthy();
      }
    }
  });

  it('the twelve public stages map onto exactly the twelve CI registry surfaces (PERSONIFY\'s surfaces[0] is now its primary myCanvas surface; AEE-XP-001 §4 Financial Sovereignty branch added AFTER CHOOSE, Main Spine 2026-09-01 correction)', () => {
    const expectedRefs = [
      'ci-bridge-home',
      'ci-bridge-view',
      'ci-bridge-orient',
      'ci-bridge-passport-room',
      'ci-bridge-personify-mycanvas',
      'ci-bridge-stand',
      'ci-bridge-choose',
      'ci-bridge-fs-discover',
      'ci-bridge-fs-learn',
      'ci-bridge-fs-explore',
      'ci-bridge-fs-prepare',
      'ci-bridge-fs-cross',
    ];
    const actualRefs = CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY.stages.map((s) => s.surfaces[0]?.ref);
    expect(actualRefs).toEqual(expectedRefs);
  });

  it('PERSONIFY carries exactly ONE surface (consolidated 2026-08-11 — no second, iframe-in-iframe supporting surface)', () => {
    const personify = CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY.stages.find((s) => s.id === 'personify');
    expect(personify).toBeTruthy();
    expect(personify!.surfaces.map((s) => s.ref)).toEqual(['ci-bridge-personify-mycanvas']);
  });
});
