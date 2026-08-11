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

const STAGE_SURFACE_COMPONENTS = [
  'BridgeMediaStage',
  'ConstitutionalInternetBridgeViewSequence',
  'ConstitutionalFrontierOrientSurface',
  'ConstitutionalInternetBridgePassportRoom',
  'ConstitutionalAgentFieldEntrySurface',
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

  it('the seven public stages map onto exactly the seven CI registry surfaces', () => {
    const expectedRefs = [
      'ci-bridge-home',
      'ci-bridge-view',
      'ci-bridge-orient',
      'ci-bridge-passport-room',
      'ci-bridge-act-field-entry',
      'ci-bridge-stand',
      'ci-bridge-choose',
    ];
    const actualRefs = CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY.stages.map((s) => s.surfaces[0]?.ref);
    expect(actualRefs).toEqual(expectedRefs);
  });
});
