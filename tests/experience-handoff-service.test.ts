/**
 * ExperienceHandoff (types/experienceHandoff.ts) + experienceHandoffService —
 * AEE-XP-001 §5, Phase 1 main-spine connection (2026-09-01). Pure round-trip
 * behaviour: no DB, no admin client — this is deliberately a token, not a
 * new persistence engine (see experienceHandoffService.ts's own header).
 */
import { describe, it, expect } from 'vitest';
import { createExperienceHandoff, encodeExperienceHandoff, decodeExperienceHandoff } from '@/services/journey/experienceHandoffService';

describe('createExperienceHandoff + encode/decode round-trip', () => {
  it('round-trips every field through encode/decode unchanged', () => {
    const handoff = createExperienceHandoff({
      sourceJourneyId: 'knyts-bridge-crossing',
      sourceStageId: 'fs-cross',
      targetJourneyId: 'horizen-moneypenny',
      targetSurfaceRef: 'register-agent-panel',
      intent: 'financial-services-registration',
      agentCandidateRef: 'moneypenny',
      returnJourneyId: 'knyts-bridge-crossing',
      returnStageId: 'choose',
      rationale: 'test',
    });
    expect(handoff.handoffId).toMatch(/^xh-/);
    expect(handoff.createdAt).toBeTruthy();

    const token = encodeExperienceHandoff(handoff);
    const decoded = decodeExperienceHandoff(token);
    expect(decoded).toEqual(handoff);
  });

  it('never asserts authority — the type carries no credential/authorization field', () => {
    const handoff = createExperienceHandoff({
      sourceJourneyId: 'a',
      targetJourneyId: 'b',
    });
    // A handoff is exactly its declared fields — nothing else rides along.
    const keys = Object.keys(handoff);
    for (const forbidden of ['authorization', 'authority', 'credential', 'token', 'grant']) {
      expect(keys.map((k) => k.toLowerCase())).not.toContain(forbidden);
    }
  });
});

describe('decodeExperienceHandoff — never throws, fails closed', () => {
  it('returns null for a malformed (non-base64/non-JSON) token', () => {
    expect(decodeExperienceHandoff('not-a-real-token!!!')).toBeNull();
  });

  it('returns null for valid JSON missing a required field', () => {
    const token = Buffer.from(JSON.stringify({ handoffId: 'xh-1', sourceJourneyId: 'a' }), 'utf8').toString('base64url');
    expect(decodeExperienceHandoff(token)).toBeNull();
  });

  it('returns null for an expired handoff', () => {
    const handoff = createExperienceHandoff({
      sourceJourneyId: 'a',
      targetJourneyId: 'b',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    const token = encodeExperienceHandoff(handoff);
    expect(decodeExperienceHandoff(token)).toBeNull();
  });

  it('accepts a handoff with no expiresAt (open-ended) and one still in the future', () => {
    const noExpiry = createExperienceHandoff({ sourceJourneyId: 'a', targetJourneyId: 'b' });
    expect(decodeExperienceHandoff(encodeExperienceHandoff(noExpiry))).not.toBeNull();

    const future = createExperienceHandoff({
      sourceJourneyId: 'a',
      targetJourneyId: 'b',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(decodeExperienceHandoff(encodeExperienceHandoff(future))).not.toBeNull();
  });
});
