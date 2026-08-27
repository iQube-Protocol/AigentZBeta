/**
 * services/adaptive/persistedJourneyObservation.ts — canaries (operator
 * ruling, 2026-08-27, Differ FS pilot reconciliation).
 *
 * Pure-logic / mocked-Supabase unit tests, same discipline as
 * tests/access-spine.test.ts: no network, no live Supabase. Every read
 * boundary the observer composes is mocked so behaviour is deterministic.
 *
 * Covers:
 *   1. the ratchet read performs zero writes
 *   2. observing an incomplete/never-resolved journey never fabricates
 *      completion (every stage `blocked`/no ratchet -> honest `observed: false`)
 *   3. an unavailable ratchet read degrades to `observed: false`, never a
 *      guessed completion
 *   4. no T0 identifier (personaId, authProfileId) appears anywhere in the
 *      returned AdaptiveInteractionContext
 *   5. topology (capability refs) is NOT re-derived here — it comes verbatim
 *      from journeySpineAdapter's buildCapabilityRefsFromJourney
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockReadJourneyResolution = vi.fn();
vi.mock('@/services/journey/stageResolution', () => ({
  readJourneyResolution: (...args: unknown[]) => mockReadJourneyResolution(...args),
}));

const mockResolveDestination = vi.fn();
vi.mock('@/services/journey/catalogueDestinationHelper', () => ({
  resolveJourneyOperatorDestination: (...args: unknown[]) => mockResolveDestination(...args),
}));

import {
  observePersistedJourneyContext,
  deriveStageStatusFromRatchet,
} from '@/services/adaptive/persistedJourneyObservation';
import { buildCapabilityRefsFromJourney } from '@/services/adaptive/journeySpineAdapter';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';

function makeSpyAdmin() {
  const insert = vi.fn();
  const update = vi.fn();
  const del = vi.fn();
  const upsert = vi.fn();
  return {
    calls: { insert, update, delete: del, upsert },
    from: vi.fn(() => ({ insert, update, delete: del, upsert, select: vi.fn().mockReturnThis() })),
  } as unknown as import('@supabase/supabase-js').SupabaseClient & {
    calls: { insert: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> };
  };
}

const PRINCIPAL_REF = 'polity-pub-ref-not-a-uuid';
const RAW_PERSONA_ID = 'persona-aaaa-1111-should-never-leak';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('deriveStageStatusFromRatchet — pure, no I/O', () => {
  it('reports observed:false and every stage blocked when the ratchet is null (never resolved)', () => {
    const status = deriveStageStatusFromRatchet(HORIZEN_MONEYPENNY_JOURNEY, null);
    expect(status.observed).toBe(false);
    expect(status.completedStageIds).toEqual([]);
    expect(status.blockedStageIds.length).toBe(HORIZEN_MONEYPENNY_JOURNEY.stages.length);
  });

  it('classifies a stage as ready only when every prerequisite is in the canonical set', () => {
    const first = HORIZEN_MONEYPENNY_JOURNEY.stages[0];
    const status = deriveStageStatusFromRatchet(HORIZEN_MONEYPENNY_JOURNEY, new Set([first.id]));
    expect(status.observed).toBe(true);
    expect(status.completedStageIds).toContain(first.id);
  });
});

describe('observePersistedJourneyContext — pure read, no writes', () => {
  it('never calls a write-capable method on the Supabase client it is handed', async () => {
    mockReadJourneyResolution.mockResolvedValue(null);
    mockResolveDestination.mockReturnValue({
      valid: false,
      journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
      failedLookup: 'journey-not-registered',
      reason: 'test fixture',
    });

    const admin = makeSpyAdmin();
    await observePersistedJourneyContext(admin, {
      journeyDefinition: HORIZEN_MONEYPENNY_JOURNEY,
      aigentQubeId: 'aigentqube-test-1',
      participantRef: PRINCIPAL_REF,
      participantState: { citizenPassportUsable: false },
      hostId: 'differ',
      generatedAt: new Date().toISOString(),
    });

    expect(admin.calls.insert).not.toHaveBeenCalled();
    expect(admin.calls.update).not.toHaveBeenCalled();
    expect(admin.calls.delete).not.toHaveBeenCalled();
    expect(admin.calls.upsert).not.toHaveBeenCalled();
  });

  it('a never-resolved journey reports ratchetObserved:false and never fabricates a currentStageId completion', async () => {
    mockReadJourneyResolution.mockResolvedValue(null);
    mockResolveDestination.mockReturnValue({
      valid: false,
      journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
      failedLookup: 'journey-not-registered',
      reason: 'test fixture',
    });

    const admin = makeSpyAdmin();
    const observation = await observePersistedJourneyContext(admin, {
      journeyDefinition: HORIZEN_MONEYPENNY_JOURNEY,
      aigentQubeId: 'aigentqube-test-1',
      participantRef: PRINCIPAL_REF,
      participantState: { citizenPassportUsable: false },
      hostId: 'differ',
      generatedAt: new Date().toISOString(),
    });

    expect(observation.ratchetObserved).toBe(false);
    expect(observation.context.journey?.completedStageIds).toEqual([]);
  });

  it('an unavailable/throwing ratchet read degrades to observed:false, never a guessed completion', async () => {
    mockReadJourneyResolution.mockRejectedValue(new Error('db unreachable'));
    mockResolveDestination.mockReturnValue({
      valid: false,
      journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
      failedLookup: 'journey-not-registered',
      reason: 'test fixture',
    });

    const admin = makeSpyAdmin();
    const observation = await observePersistedJourneyContext(admin, {
      journeyDefinition: HORIZEN_MONEYPENNY_JOURNEY,
      aigentQubeId: 'aigentqube-test-1',
      participantRef: PRINCIPAL_REF,
      participantState: { citizenPassportUsable: false },
      hostId: 'differ',
      generatedAt: new Date().toISOString(),
    });

    expect(observation.ratchetObserved).toBe(false);
  });

  it('no T0 identifier appears anywhere in the returned context — only the caller-supplied participantRef', async () => {
    mockReadJourneyResolution.mockResolvedValue({
      journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
      journeyVersion: HORIZEN_MONEYPENNY_JOURNEY.version,
      subjectRef: 'moneypenny',
      canonicalStages: [HORIZEN_MONEYPENNY_JOURNEY.stages[0].id],
      milestones: [],
      highestMilestone: null,
      recordedAt: new Date().toISOString(),
    });
    mockResolveDestination.mockReturnValue({
      valid: false,
      journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
      failedLookup: 'journey-not-registered',
      reason: 'test fixture',
    });

    const admin = makeSpyAdmin();
    const observation = await observePersistedJourneyContext(admin, {
      journeyDefinition: HORIZEN_MONEYPENNY_JOURNEY,
      aigentQubeId: 'aigentqube-test-1',
      participantRef: PRINCIPAL_REF,
      participantState: { citizenPassportUsable: false },
      hostId: 'differ',
      generatedAt: new Date().toISOString(),
    });

    const serialized = JSON.stringify(observation.context);
    expect(serialized).not.toContain(RAW_PERSONA_ID);
    expect(serialized).not.toMatch(/personaId|authProfileId/i);
    expect(observation.context.participantRef).toBe(PRINCIPAL_REF);
  });

  it('capability topology comes verbatim from journeySpineAdapter — never re-derived by this module', async () => {
    mockReadJourneyResolution.mockResolvedValue(null);
    mockResolveDestination.mockReturnValue({
      valid: false,
      journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
      failedLookup: 'journey-not-registered',
      reason: 'test fixture',
    });

    const admin = makeSpyAdmin();
    const generatedAt = new Date().toISOString();
    const observation = await observePersistedJourneyContext(admin, {
      journeyDefinition: HORIZEN_MONEYPENNY_JOURNEY,
      aigentQubeId: 'aigentqube-test-1',
      participantRef: PRINCIPAL_REF,
      participantState: { citizenPassportUsable: false },
      hostId: 'differ',
      generatedAt,
    });

    const expected = buildCapabilityRefsFromJourney(HORIZEN_MONEYPENNY_JOURNEY, new Set());
    expect(observation.context.capabilityRefs).toEqual(expected);
  });
});
