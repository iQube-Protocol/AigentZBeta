/**
 * First live AEE convergence acceptance (AEE-XP-001 §6, XP-1, 2026-09-01) —
 * the canonical loop:
 *
 *   authoritative state -> AdaptiveInteractionContext -> AEE/NBE
 *     -> ExperienceProjection -> surface -> evidence/state change
 *     -> re-evaluation
 *
 * exercised end-to-end via `computeJourneyAeeOutcome`
 * (services/adaptive/journeyAeeOrchestrator.ts), the first live caller of
 * services/adaptive/* (Phase 0 audit found zero outside its own test).
 *
 * Case A is proven against the REAL, deployed KNYTS Bridge journey
 * (services/journey/knytsBridgeCrossingJourney.ts) — it needs no evidence
 * source, since "first relevant FS stage is DISCOVER" holds the moment the
 * branch activates with zero prior evidence, and DISCOVER/LEARN/EXPLORE/
 * PREPARE on the live FS branch are all independently declared with empty
 * `prerequisites` (an honest, gate-less on-ramp — AEE-XP-001 §4 Main Spine
 * correction's own header) — array order alone makes DISCOVER first.
 *
 * Cases B/C/D need REAL prerequisite-gated satisfaction to prove — the
 * live FS branch stages deliberately declare NO completionEvidence (there
 * is no honest signal to gate an informational on-ramp page on yet, and
 * this task's own scope explicitly excludes changing the FS constitutional
 * journey). Proving "Discover satisfied -> LEARN is next" therefore uses a
 * FIXTURE journey with the same activationBranch/prerequisite grammar the
 * real FS branch already uses, so the MECHANISM is proven for real, without
 * fabricating evidence sources the live journey doesn't have. See this
 * file's own report to the operator for the exact gap this leaves open.
 */
import { describe, it, expect } from 'vitest';
import { resolveJourneyState, type AuthoritativePlatformState } from '@/services/journey/resolveJourneyState';
import { KNYTS_BRIDGE_CROSSING_JOURNEY } from '@/services/journey/knytsBridgeCrossingJourney';
import { computeJourneyAeeOutcome } from '@/services/adaptive/journeyAeeOrchestrator';
import type { JourneyDefinition } from '@/types/journey';
import type { AdaptiveExperienceProvider, ExperienceProjection } from '@/types/adaptiveExperience';
import { readSource, importAuthority } from './_lib/sourceAuthority';

const NOW = '2026-09-01T00:00:00.000Z';
const EMPTY_STATE: AuthoritativePlatformState = { stages: {} };

describe('Case A — JOIN_FINANCIAL_SERVICES declared, no prior evidence -> first relevant FS stage is DISCOVER', () => {
  it('on the real, deployed KNYTS Bridge journey', async () => {
    const runtimeState = resolveJourneyState(KNYTS_BRIDGE_CROSSING_JOURNEY, EMPTY_STATE, {
      'financial-services': 'JOIN_FINANCIAL_SERVICES',
    });
    const outcome = await computeJourneyAeeOutcome({
      journeyDefinition: KNYTS_BRIDGE_CROSSING_JOURNEY,
      runtimeState,
      hostId: 'knyts-bridge',
      participantRef: 'test-visitor',
      generatedAt: NOW,
    });
    expect(outcome.nbe.targetStageId).toBe('fs-discover');
    expect(outcome.nbe.source).toBe('aee');
    expect(outcome.nbe.disposition).toBe('act');
    expect(outcome.crossingRecommended).toBe(false);
    expect(outcome.projection.fellBackToNative).toBe(false);
  });

  it('with NO branch declared at all, DISCOVER is never offered (still dormant)', async () => {
    const runtimeState = resolveJourneyState(KNYTS_BRIDGE_CROSSING_JOURNEY, EMPTY_STATE);
    const outcome = await computeJourneyAeeOutcome({
      journeyDefinition: KNYTS_BRIDGE_CROSSING_JOURNEY,
      runtimeState,
      hostId: 'knyts-bridge',
      participantRef: 'test-visitor',
      generatedAt: NOW,
    });
    expect(outcome.nbe.targetStageId).not.toBe('fs-discover');
  });
});

// ── Fixture journey for B/C/D — same grammar as the real FS branch, but
//    WITH real completionEvidence, so genuine prerequisite-gated
//    advancement can be proven. See file header for why the live FS branch
//    itself cannot prove these cases today.
const FS_LIKE_FIXTURE: JourneyDefinition = {
  id: 'fs-like-fixture',
  version: '1.0.0',
  label: 'FS-like Fixture',
  subjectRef: 'visitor',
  copilot: { cartridgeSlug: 'agentiq-os' },
  stages: [
    {
      id: 'choose', label: 'Choose', description: '', actor: 'operator', subjectRef: 'visitor',
      surfaces: [], prerequisites: [], permittedActions: [], completionEvidence: [], receiptTypes: [],
      companion: { before: '', complete: '' },
    },
    {
      id: 'fs-discover', label: 'Discover', description: '', actor: 'operator', subjectRef: 'visitor',
      surfaces: [], prerequisites: [], permittedActions: [], completionEvidence: ['discoverAcknowledged'], receiptTypes: [],
      companion: { before: '', complete: '' }, activationBranch: 'financial-services',
    },
    {
      id: 'fs-learn', label: 'Learn', description: '', actor: 'operator', subjectRef: 'visitor',
      surfaces: [], prerequisites: ['fs-discover'], permittedActions: [], completionEvidence: ['learnAcknowledged'], receiptTypes: [],
      companion: { before: '', complete: '' }, activationBranch: 'financial-services',
    },
    {
      id: 'fs-explore', label: 'Explore', description: '', actor: 'operator', subjectRef: 'visitor',
      surfaces: [], prerequisites: ['fs-learn'], permittedActions: [], completionEvidence: ['exploreAcknowledged'], receiptTypes: [],
      companion: { before: '', complete: '' }, activationBranch: 'financial-services',
    },
    {
      id: 'fs-prepare', label: 'Prepare', description: '', actor: 'operator', subjectRef: 'visitor',
      surfaces: [], prerequisites: ['fs-explore'], permittedActions: ['select-agent-candidate'], completionEvidence: ['agentCandidateSelected'], receiptTypes: [],
      companion: { before: '', complete: '' }, activationBranch: 'financial-services',
    },
    {
      id: 'fs-cross', label: 'Cross', description: '', actor: 'operator', subjectRef: 'visitor',
      surfaces: [], prerequisites: ['fs-prepare'], permittedActions: ['cross-to-financial-services'], completionEvidence: [], receiptTypes: [],
      companion: { before: '', complete: '' }, activationBranch: 'financial-services',
    },
  ],
};

const ACTIVATED = { 'financial-services': 'JOIN_FINANCIAL_SERVICES' };

async function outcomeFor(evidence: AuthoritativePlatformState) {
  const runtimeState = resolveJourneyState(FS_LIKE_FIXTURE, evidence, ACTIVATED);
  return computeJourneyAeeOutcome({
    journeyDefinition: FS_LIKE_FIXTURE,
    runtimeState,
    hostId: 'fs-like-fixture',
    participantRef: 'test-visitor',
    generatedAt: NOW,
  });
}

describe('Case B — Discover satisfied -> next appropriate stage is LEARN', () => {
  it('proven on the fixture (mechanism-level, real prerequisite-gated advancement)', async () => {
    const outcome = await outcomeFor({ stages: { 'fs-discover': { discoverAcknowledged: true } } });
    expect(outcome.nbe.targetStageId).toBe('fs-learn');
    expect(outcome.crossingRecommended).toBe(false);
  });
});

describe('Case C — Discover + Learn + Explore satisfied -> PREPARE', () => {
  it('proven on the fixture', async () => {
    const outcome = await outcomeFor({
      stages: {
        'fs-discover': { discoverAcknowledged: true },
        'fs-learn': { learnAcknowledged: true },
        'fs-explore': { exploreAcknowledged: true },
      },
    });
    expect(outcome.nbe.targetStageId).toBe('fs-prepare');
    expect(outcome.crossingRecommended).toBe(false);
  });
});

describe('Case D — PREPARE satisfied with a valid agent candidate -> CROSS (existing ExperienceHandoff stays client-owned)', () => {
  it('proven on the fixture; crossingRecommended flags the boundary, AEE never constructs the handoff itself', async () => {
    const outcome = await outcomeFor({
      stages: {
        'fs-discover': { discoverAcknowledged: true },
        'fs-learn': { learnAcknowledged: true },
        'fs-explore': { exploreAcknowledged: true },
        'fs-prepare': { agentCandidateSelected: true },
      },
    });
    expect(outcome.nbe.targetStageId).toBe('fs-cross');
    expect(outcome.crossingRecommended).toBe(true);
  });
});

describe('Case E — no AEE/provider result or invalid projection -> existing deterministic native behavior continues', () => {
  const throwingProvider: AdaptiveExperienceProvider = {
    id: 'broken-throws',
    async capabilities() {
      return {
        providerId: 'broken-throws', canRender: false, canHost: false, canComposeComponents: false,
        canResolveRoutes: false, canPersistPresentationState: false, supportedProjectionLevels: [],
        supportedSurfaceTypes: [], dataBoundary: 'projection-only', verified: false,
      };
    },
    async project(): Promise<never> {
      throw new Error('simulated provider failure');
    },
  };

  const invalidProvider: AdaptiveExperienceProvider = {
    id: 'broken-invalid',
    async capabilities() {
      return {
        providerId: 'broken-invalid', canRender: false, canHost: false, canComposeComponents: false,
        canResolveRoutes: false, canPersistPresentationState: false, supportedProjectionLevels: [1],
        supportedSurfaceTypes: [], dataBoundary: 'projection-only', verified: false,
      };
    },
    async project(input) {
      const bogus: ExperienceProjection = {
        projectionId: 'bogus', contextId: input.context.contextId, provider: 'broken-invalid',
        layout: { mode: 'linear', density: 'normal' },
        surfaces: [{ capabilityId: 'not-a-real-stage', surfaceType: 'component', emphasis: 'primary' }],
        primaryAction: { capabilityId: 'not-a-real-stage', label: 'Fabricated' },
        constraintsApplied: [], level: 1,
      };
      return { projection: bogus };
    },
  };

  it('a throwing provider falls back to native — same correct DISCOVER recommendation as case A', async () => {
    const runtimeState = resolveJourneyState(KNYTS_BRIDGE_CROSSING_JOURNEY, EMPTY_STATE, {
      'financial-services': 'JOIN_FINANCIAL_SERVICES',
    });
    const outcome = await computeJourneyAeeOutcome({
      journeyDefinition: KNYTS_BRIDGE_CROSSING_JOURNEY,
      runtimeState,
      hostId: 'knyts-bridge',
      participantRef: 'test-visitor',
      generatedAt: NOW,
      provider: throwingProvider,
    });
    expect(outcome.projection.fellBackToNative).toBe(true);
    expect(outcome.projection.fallbackReason).toContain('simulated provider failure');
    expect(outcome.nbe.targetStageId).toBe('fs-discover');
  });

  it('a provider returning a postflight-invalid projection (fabricated capability) falls back to native', async () => {
    const runtimeState = resolveJourneyState(KNYTS_BRIDGE_CROSSING_JOURNEY, EMPTY_STATE, {
      'financial-services': 'JOIN_FINANCIAL_SERVICES',
    });
    const outcome = await computeJourneyAeeOutcome({
      journeyDefinition: KNYTS_BRIDGE_CROSSING_JOURNEY,
      runtimeState,
      hostId: 'knyts-bridge',
      participantRef: 'test-visitor',
      generatedAt: NOW,
      provider: invalidProvider,
    });
    expect(outcome.projection.fellBackToNative).toBe(true);
    expect(outcome.nbe.targetStageId).toBe('fs-discover');
  });
});

describe('AEE never marks a stage complete — structurally, not by convention', () => {
  it('journeyAeeOrchestrator.ts imports no mutation/persistence function and no Supabase client', () => {
    const src = readSource('services/adaptive/journeyAeeOrchestrator.ts');
    const graph = importAuthority(src);
    for (const record of graph.records) {
      expect(record.specifier).not.toMatch(/supabaseServer|supabase-js/i);
      for (const name of [...record.names, record.defaultName].filter(Boolean)) {
        expect(String(name)).not.toMatch(/^(debit|credit|write|persist|insert|update|delete|mutate|convert)/i);
      }
    }
  });

  it('recomputing the outcome after calling it once produces an IDENTICAL nbe.targetStageId for identical inputs — no hidden state mutation across calls', async () => {
    const runtimeState = resolveJourneyState(KNYTS_BRIDGE_CROSSING_JOURNEY, EMPTY_STATE, {
      'financial-services': 'JOIN_FINANCIAL_SERVICES',
    });
    const first = await computeJourneyAeeOutcome({
      journeyDefinition: KNYTS_BRIDGE_CROSSING_JOURNEY, runtimeState, hostId: 'knyts-bridge',
      participantRef: 'test-visitor', generatedAt: NOW,
    });
    const second = await computeJourneyAeeOutcome({
      journeyDefinition: KNYTS_BRIDGE_CROSSING_JOURNEY, runtimeState, hostId: 'knyts-bridge',
      participantRef: 'test-visitor', generatedAt: NOW,
    });
    expect(second.nbe.targetStageId).toBe(first.nbe.targetStageId);
  });
});
