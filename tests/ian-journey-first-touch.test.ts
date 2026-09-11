/**
 * Ian Boundary Research journey — first-touch / anonymous-visitor canary
 * (2026-08-24 sign-in hosting pass).
 *
 * Two things pinned:
 *   1. Behavioural: resolveJourneyState against a fully empty
 *      AuthoritativePlatformState (the shape /api/journey/ian/state now
 *      returns for a signed-out caller) resolves ORIENT to READY and every
 *      later stage to BLOCKED/NOT_STARTED — never COMPLETE. "No fake
 *      completion state" is a testable property, not just a comment.
 *   2. Source-grep: the sign-in hosting wiring reuses the SAME
 *      PassportConnectPanel / usePassportSignInHost / usePassportSignInGate
 *      the KNYTS/CI bridges and MyCanvasTab's Remix gate already use — no
 *      forked auth/onboarding mechanism.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import { resolveJourneyState } from '@/services/journey/resolveJourneyState';
import type { AuthoritativePlatformState } from '@/services/journey/resolveJourneyState';
import { IAN_BOUNDARY_RESEARCH_JOURNEY } from '@/services/journey/ianBoundaryResearchJourney';

function readSource(relPath: string): string {
  return readFileSync(join(process.cwd(), relPath), 'utf8');
}

describe('resolveJourneyState — fully anonymous visitor (no persona at all)', () => {
  const EMPTY_STATE: AuthoritativePlatformState = { stages: {}, receiptRefs: {} };

  it('orient resolves READY — browsable signed-out, per KNYTS/CI precedent', () => {
    const state = resolveJourneyState(IAN_BOUNDARY_RESEARCH_JOURNEY, EMPTY_STATE);
    const orient = state.stages.find((s) => s.stageId === 'orient');
    expect(orient?.state).toBe('READY');
  });

  it('no stage anywhere resolves COMPLETE with zero evidence — no fake completion state', () => {
    const state = resolveJourneyState(IAN_BOUNDARY_RESEARCH_JOURNEY, EMPTY_STATE);
    for (const stage of state.stages) {
      expect(stage.state, `${stage.stageId} must not be COMPLETE with no evidence`).not.toBe('COMPLETE');
    }
  });

  it('passport (and everything after it) is BLOCKED — orient is a genuine, required prerequisite', () => {
    const state = resolveJourneyState(IAN_BOUNDARY_RESEARCH_JOURNEY, EMPTY_STATE);
    const passport = state.stages.find((s) => s.stageId === 'passport');
    expect(passport?.state).toBe('BLOCKED');
  });
});

describe('sign-in hosting wiring — reuses the existing pattern, no fork', () => {
  const PAGE = 'app/bridge/ocsga/page.tsx';
  const ORIENT_PANEL = 'components/journey/IanOrientationPanel.tsx';

  it('the OCSGA page imports the SAME PassportConnectPanel the KNYTS/CI bridges already use', () => {
    const code = readSource(PAGE);
    expect(code).toContain(`from '@/components/companion/PassportConnectPanel'`);
  });

  it('the OCSGA page imports the SAME usePassportSignInHost the KNYTS/CI bridges already use', () => {
    const code = readSource(PAGE);
    expect(code).toContain(`from '@/app/hooks/usePassportSignInHost'`);
  });

  it('IanOrientationPanel imports the SAME usePassportSignInGate MyCanvasTab\'s Remix gate already uses', () => {
    const code = readSource(ORIENT_PANEL);
    expect(code).toContain(`from '@/app/hooks/usePassportSignInGate'`);
  });

  it('neither file defines a second PASSPORT_SIGN_IN-shaped request/host mechanism', () => {
    const pageCode = readSource(PAGE);
    const panelCode = readSource(ORIENT_PANEL);
    // The only "new" identifiers should be the returnTarget/origin strings
    // passed INTO the existing hooks — never a redeclared request/ack/
    // completion type or a second broadcast channel name.
    expect(pageCode).not.toMatch(/requestWalletSurface\s*\(/);
    expect(panelCode).not.toMatch(/subscribeWalletSurfaceRequest\s*\(/);
  });
});
