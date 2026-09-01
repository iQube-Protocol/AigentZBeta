// @vitest-environment jsdom
/**
 * Immediate re-evaluation wiring (AEE-XP-001 §6 follow-up, 2026-09-01):
 * `activateJourneyBranch(...)` -> persist branch intent -> emit/invoke the
 * existing typed `JourneyReEvaluationTrigger` -> refetch authoritative
 * Journey/AEE state -> updated `reachableStageIds`/`nextReachableStageId`/
 * `aee` -> JourneyRunSurface updates in place, with NO reload/remount/
 * navigation.
 *
 * Exercises the REAL functions the component calls, in the same sequence,
 * rather than a full mocked component render (JourneyRunSurface pulls in
 * StageReceiptsDrawer/JourneyCopilotHost/ActivePersonaControl/JOURNEY_
 * SURFACES/bridgeEmbedNav — a full render would need to mock all of them
 * to prove a data-flow fact this level already proves for real). The
 * companion `journey-branch-immediate-reevaluation-wiring.test.ts`-style
 * source canary below confirms JourneyRunSurface's listener really is
 * wired to what this file proves works.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resolveJourneyState, type AuthoritativePlatformState } from '@/services/journey/resolveJourneyState';
import { KNYTS_BRIDGE_CROSSING_JOURNEY } from '@/services/journey/knytsBridgeCrossingJourney';
import { CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY } from '@/services/journey/constitutionalInternetBridgeJourney';
import { computeJourneyAeeOutcome } from '@/services/adaptive/journeyAeeOrchestrator';
import type { JourneyDefinition } from '@/types/journey';
import { shouldReEvaluateAeeProjection, type JourneyReEvaluationTrigger } from '@/services/adaptive/journeyAeeOrchestrator';
import {
  activateJourneyBranch,
  isJourneyBranchActivated,
  parseActivatedBranchesParam,
  serializeActivatedBranchesForJourney,
} from '@/services/journey/journeyBranchActivation';
import { readSource, stripComments } from './_lib/sourceAuthority';

const EMPTY_STATE: AuthoritativePlatformState = { stages: {} };

/** Mirrors JourneyRunSurface's own spine-visibility predicate exactly. */
function isStageVisible(journeyId: string, s: { activationBranch?: string }): boolean {
  return !s.activationBranch || isJourneyBranchActivated(journeyId, s.activationBranch);
}

beforeEach(() => {
  window.sessionStorage.clear();
});

const BRIDGES: Array<[string, JourneyDefinition, string]> = [
  ['KNYTS Bridge', KNYTS_BRIDGE_CROSSING_JOURNEY, 'knyts-bridge'],
  ['Constitutional Internet Bridge', CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY, 'constitutional-internet-bridge'],
];

/*
 * CI parity (2026-09-01): the SAME describe.each block below proves the
 * full 7-point sequence on BOTH bridges. This is deliberate — the client
 * wiring (activateJourneyBranch, JourneyRunSurface's listener) is already
 * journey-agnostic (JourneyRunSurface is reused by both app/bridge/knyts
 * and app/bridge/ci), so proving it once per journey with IDENTICAL test
 * logic is what "reuse the exact KNYTS pattern, no CI-specific logic"
 * actually means — not a hand-written CI copy that could drift.
 */
describe.each(BRIDGES)(
  '%s — end-to-end: branch click -> immediate re-evaluation -> correct AEE recommendation',
  (_label, journey, hostId) => {
  it('1. starts at CHOOSE with the FS branch dormant', () => {
    const fsDiscover = journey.stages.find((s) => s.id === 'fs-discover')!;
    expect(isStageVisible(journey.id, fsDiscover)).toBe(false);
  });

  it('2-7: selecting JOIN_FINANCIAL_SERVICES reveals the branch, triggers immediate re-evaluation, and returns fs-discover — without touching the source journey or marking anything complete', async () => {
    // 2. User selects JOIN_FINANCIAL_SERVICES — the exact call the CFS Pilot
    //    / "Join Financial Services" cards make.
    let capturedTrigger: JourneyReEvaluationTrigger | undefined;
    const onSelect = (e: Event) => {
      capturedTrigger = (e as CustomEvent<{ trigger?: JourneyReEvaluationTrigger }>).detail?.trigger;
    };
    window.addEventListener('journey:select-stage', onSelect);
    activateJourneyBranch(journey.id, 'financial-services', 'JOIN_FINANCIAL_SERVICES', 'fs-discover');
    window.removeEventListener('journey:select-stage', onSelect);

    // 3. Branch becomes visible.
    const fsDiscover = journey.stages.find((s) => s.id === 'fs-discover')!;
    expect(isStageVisible(journey.id, fsDiscover)).toBe(true);

    // 4. The dispatched event invokes the EXISTING typed re-evaluation
    //    trigger (no second event bus) — and it says yes, refetch.
    expect(capturedTrigger).toBe('branch-intent-change');
    expect(shouldReEvaluateAeeProjection(capturedTrigger!)).toBe(true);

    // The refetch itself: exactly what JourneyRunSurface's fetch effect
    // does — serialize the now-activated branch onto the state request,
    // parse it server-side, resolve, and compute the AEE outcome. Real
    // functions, same sequence, no mocked fetch needed to prove this.
    const activatedBranchesParam = serializeActivatedBranchesForJourney(journey);
    expect(activatedBranchesParam).toBe('financial-services:JOIN_FINANCIAL_SERVICES');
    const activatedBranches = parseActivatedBranchesParam(activatedBranchesParam);
    const runtimeState = resolveJourneyState(journey, EMPTY_STATE, activatedBranches);
    const aee = await computeJourneyAeeOutcome({
      journeyDefinition: journey,
      runtimeState,
      hostId,
      participantRef: 'test-visitor',
      generatedAt: '2026-09-01T00:00:00.000Z',
    });

    // 5. Returned AEE recommendation is fs-discover — the FS branch's own
    //    stages are all independently reachable (empty prerequisites, an
    //    honest gate-less on-ramp), so declared array order is what makes
    //    DISCOVER the canonical "next" — matches
    //    adaptive-fs-branch-acceptance.test.ts's Case A.
    expect(runtimeState.reachableStageIds[0]).toBe('fs-discover');
    expect(runtimeState.nextReachableStageId).toBe('fs-discover');
    expect(aee.nbe.targetStageId).toBe('fs-discover');

    // 6. Current JourneyRun remains the SAME source journey — the refetch
    //    re-resolves the same journeyId, never redirects/switches journeys.
    expect(runtimeState.journeyId).toBe(journey.id);

    // 7. No stage is marked complete by the refetch itself — zero evidence
    //    was supplied, so nothing legitimately completed.
    expect(runtimeState.stages.every((s) => s.state !== 'COMPLETE')).toBe(true);
  });
  },
);

describe('JourneyRunSurface — the immediate-refetch wiring exists structurally', () => {
  const src = stripComments(readSource('components/journey/JourneyRunSurface.tsx'));

  it('the journey:select-stage listener reads detail.trigger and calls refresh via shouldReEvaluateAeeProjection — the SAME event, no second bus', () => {
    expect(src).toMatch(/from '@\/services\/adaptive\/journeyAeeOrchestrator'/);
    const idx = src.indexOf("window.addEventListener('journey:select-stage', onSelect)");
    expect(idx).toBeGreaterThan(-1);
    const before = src.slice(Math.max(0, idx - 700), idx);
    expect(before).toMatch(/detail\?\.trigger/);
    expect(before).toMatch(/shouldReEvaluateAeeProjection\(detail\.trigger\)/);
    expect(before).toMatch(/void refresh\(detail\.trigger\)/);
  });

  it('activateJourneyBranch dispatches the trigger on the SAME journey:select-stage event journeyBranchActivation.ts already used — never a new event name', () => {
    const activationSrc = stripComments(readSource('services/journey/journeyBranchActivation.ts'));
    const eventNames = [...activationSrc.matchAll(/new CustomEvent\('([^']+)'/g)].map((m) => m[1]);
    // Exactly one distinct dispatched event name, and it's the pre-existing one.
    expect(new Set(eventNames)).toEqual(new Set(['journey:select-stage']));
    expect(activationSrc).toMatch(/trigger:\s*'branch-intent-change'/);
  });
});
