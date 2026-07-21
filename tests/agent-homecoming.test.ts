/**
 * Agent Homecoming — stand-up spec canaries (CFS-023, Workstream 2).
 *
 * Pins the PURE stand-up specs: Aletheon (the archetype/first-mover) is present,
 * grounded in its card, slug-valid, and a BOUNDED delegate (never autonomous —
 * its charter forbids independent authority). Only carded delegates are standable
 * (No-Guessing: MoneyPenny/Nakamoto have no invented spec). The genesis call
 * itself is impure and not exercised here.
 */

import { describe, it, expect } from 'vitest';
import { HOMECOMING_DELEGATE_SPECS, getDelegateSpec } from '@/services/homecoming/agentHomecoming';
import { SLUG_RE } from '@/services/agents/sponsorPolityAgent';
import { buildParticipantApplication } from '@/services/homecoming/issueDelegatePassport';
import { validateParticipantApplication } from '@/services/passport/participantApplicationValidator';

describe('Agent Homecoming — stand-up specs', () => {
  it('Aletheon is standable, slug-valid, and a bounded (non-autonomous) delegate', () => {
    const spec = getDelegateSpec('aletheon');
    expect(spec).not.toBeNull();
    expect(spec!.slug).toBe('aletheon');
    expect(SLUG_RE.test(spec!.slug)).toBe(true);
    expect(spec!.autonomous).toBe(false); // bounded companion, per its charter
    expect(spec!.description.length).toBeGreaterThan(40);
  });

  it('every authored spec has a valid slug and a non-empty description', () => {
    for (const spec of Object.values(HOMECOMING_DELEGATE_SPECS)) {
      expect(SLUG_RE.test(spec!.slug)).toBe(true);
      expect(spec!.displayName.trim().length).toBeGreaterThan(0);
      expect(spec!.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('un-authored delegates are not standable (no invented spec)', () => {
    expect(getDelegateSpec('moneypenny')).toBeNull();
    expect(getDelegateSpec('nakamoto')).toBeNull();
  });
});

describe('Passport issuance — the built application passes the Bureau validator', () => {
  it('buildParticipantApplication yields a VALID agent_participant application', () => {
    const spec = getDelegateSpec('aletheon')!;
    const app = buildParticipantApplication(spec, 'https://dev-beta.aigentz.me/api/agents/aletheon/agent-card.json');
    const result = validateParticipantApplication(app);
    expect(result.valid).toBe(true);
    expect(result.passportClass).toBe('agent_participant');
  });

  it('rejects a broken card URL (guards the payload builder contract)', () => {
    const spec = getDelegateSpec('aletheon')!;
    const app = buildParticipantApplication(spec, 'not-a-url');
    expect(validateParticipantApplication(app).valid).toBe(false);
  });
});
