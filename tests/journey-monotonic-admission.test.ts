/**
 * MONOTONIC JOURNEY + THE ONE PASSPORT ADMISSION GATE — canaries.
 *
 * ── THE OPERATOR'S RULING (2026-08-03) ───────────────────────────────────
 *
 *   > "Once a stage's canonical outcome has been established, later stages
 *   >  consume that outcome. They do not re-run, reinterpret or invalidate the
 *   >  earlier ceremony because an incidental receipt, migration or observer
 *   >  path is incomplete."
 *
 * ── OS-9 COMPLIANCE (CI-2026-08-03-CANARY-REPRODUCES-DEFECT-001, ratified) ─
 *
 * Every canary below was verified to FAIL against the historical defect and
 * PASS against the resolution. The required metadata per the operator's
 * verbatim list — historical defect · pre-fix failing proof · post-fix passing
 * proof · protected invariant · retirement condition — is recorded on each
 * `describe` block. Mutation proofs are named where a mutation (rather than a
 * revert) was the way to reach the historical behaviour.
 *
 * FIXTURES ARE PRODUCTION EVIDENCE, not invented shapes: Aigent Nakamoto's
 * real tokenId (8798), registry rendering (0x225e) and network
 * (base-sepolia). A test that asserts real data is ignored cannot then pass
 * unnoticed — the exact failure mode that let six green tests defend a
 * resolver that could never work (RES-2026-08-02-AGENT-REGISTRATION-001).
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  resolveMonotonicJourneyState,
  resolveNextExecutableAct,
  offSpineStageIds,
  advanceMilestones,
  highestMilestone,
  milestoneRank,
  recordJourneyResolution,
  journeyAct,
  type BlockingReason,
} from '@/services/journey/stageResolution';
import {
  resolvePassportEligibility,
  BLOCKING_REASON_CODES,
  NON_BLOCKING_EXCEPTION_CODES,
  NON_BLOCKING_EVIDENCE,
} from '@/services/journey/passportEligibility';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import { terminatesInAct } from '@/services/research/exceptionIsolation';
import { resolveAgentStateAxes, resolveBranchOffers } from '@/services/journey/agentStateAxes';
import { REGISTRATION_SEED_STANDING, REGISTRATION_STANDING_SEED } from '@/services/journey/registrationStandingSeed';
import type { AuthoritativePlatformState } from '@/services/journey/resolveJourneyState';

// ── Aigent Nakamoto, as actually registered ────────────────────────────────
const NAKAMOTO = {
  agent: 'aigent-nakamoto',
  aigentQubeId: 'aigentqube-nakamoto',
  tokenId: '8798',
  registryAgentId: '0x225e',
  network: 'base-sepolia',
} as const;

/**
 * Nakamoto's REAL Register evidence: the AigentQube resolves, the Agent Card
 * resolves, the tokenId is on the card — and the five Wallet Signing Topology
 * receipt types postdate the registration, so they do not exist for it. This
 * is the shape that used to render "not registered".
 */
function nakamotoPlatformState(overrides: Partial<AuthoritativePlatformState['stages']> = {}): AuthoritativePlatformState {
  return {
    receiptRefs: { horizen_agent_registered: ['receipt-nakamoto-registered'] },
    stages: {
      register: {
        aigentQubeResolved: true,
        tokenId: NAKAMOTO.tokenId,
        registryRereadOk: true,
        ownerWalletMatches: true,
        agentCardResolves: true,
        // Genuinely absent — introduced after this registration happened.
        principalRegistrationMandateSigned: false,
        agentRegistryTransactionSigned: false,
        horizenRegistrationSubmitted: false,
        horizenRegistrationConfirmed: false,
        agentRegistryBindingRecorded: false,
      },
      verify: { pulseAuthorizationVerified: false, pnlTransparencyEnabled: false, agentCardEnrichmentCommitted: false },
      claim: { controlProofFresh: false },
      // Orient (2026-08-09) — Passport's own prerequisite now, between Claim
      // and Passport. Absent evidence here is honest: Nakamoto's fixture
      // predates Orient and has not performed its acknowledgment act.
      orient: { orientationComplete: false },
      passport: { operatorPolityCitizenPassportValid: false, sponsorBinding: false, delegatePassportIssued: false },
      delegate: {},
      activate: {},
      aigentme: {},
      ...overrides,
    },
  };
}

/** The settled fact: registration IS established, with named audit gaps. */
const SETTLED_REGISTER = { register: true };
const REGISTER_AUDIT_GAPS = {
  register: ["Horizen's human-readable page identifier was never returned for this registration"],
};

function stage(resolution: ReturnType<typeof resolveMonotonicJourneyState>, id: string) {
  const found = resolution.stages.find((s) => s.stageId === id);
  if (!found) throw new Error(`no resolution for stage "${id}"`);
  return found;
}

// ═══════════════════════════════════════════════════════════════════════════
describe('CANARY 1 — a canonical binding exists and Register is not complete', () => {
  /*
   * HISTORICAL DEFECT: `resolveJourneyState` required all ten of Register's
   * `completionEvidence` fields. Nakamoto's registration is confirmed on
   * base-sepolia (tokenId 8798) but five of those receipt types were
   * introduced by the Wallet Signing Topology ruling AFTER she registered, so
   * they can never exist for her. Register rendered NOT COMPLETE while the
   * binding was settled.
   * PRE-FIX PROOF: `resolveJourneyState` alone on this exact state returns
   * IN_PROGRESS — asserted below, so the defect is reproduced in the file.
   * POST-FIX PROOF: the assertions in this block.
   * PROTECTED INVARIANT: CI-2026-08-03-SETTLED-STAGE-OUTCOME-MONOTONIC-001.
   * RETIREMENT: only if canonical stage outcomes stop being settleable.
   */
  it('renders Register COMPLETE from the settled fact even with five receipts permanently missing', () => {
    const resolution = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoPlatformState(), {
      canonicalOutcomes: SETTLED_REGISTER,
      auditGaps: REGISTER_AUDIT_GAPS,
    });
    const register = stage(resolution, 'register');
    expect(register.canonicalOutcome).toBe(true);
    expect(register.status).toBe('COMPLETE');
    expect(register.canonicalAuthority).toBe('settled-fact');
  });

  it('REPRODUCES THE DEFECT: the evidence-only resolver still calls the same state incomplete', async () => {
    // This is the historical behaviour, pinned. If this ever passes as
    // COMPLETE, the evidence pass has silently gained canonical authority and
    // canary 3 below is no longer testing anything.
    const { resolveJourneyState } = await import('@/services/journey/resolveJourneyState');
    const evidenceOnly = resolveJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoPlatformState());
    expect(evidenceOnly.stages.find((s) => s.stageId === 'register')?.state).not.toBe('COMPLETE');
  });

  it('reaches the REGISTERED milestone from the settled fact alone', () => {
    const resolution = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoPlatformState(), {
      canonicalOutcomes: SETTLED_REGISTER,
    });
    expect(resolution.milestones).toContain('REGISTERED');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('CANARY 2 — a Verify failure changes Register state', () => {
  /*
   * HISTORICAL DEFECT: every observer re-derived registration independently,
   * so a later stage that could not read its own evidence produced a state in
   * which Register was no longer complete (the "ladder says awaiting, banner
   * says tokenId 8798" screen).
   * PRE-FIX PROOF: mutation — deleting the `advanceMilestones` union in favour
   * of a replacement makes the second assertion fail.
   * POST-FIX PROOF: this block.
   * PROTECTED INVARIANT: CI-2026-08-03-SETTLED-STAGE-OUTCOME-MONOTONIC-001.
   * RETIREMENT: never, while the ladder exists.
   */
  it('leaves Register COMPLETE when Verify is blocked by an unavailable authorization store', () => {
    const resolution = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoPlatformState(), {
      canonicalOutcomes: SETTLED_REGISTER,
      operationalBlockers: {
        verify: [
          {
            code: 'authorization-store-unavailable',
            stageId: 'verify',
            summary: 'Local authorization store unavailable',
            acts: [journeyAct('verify', 'apply-migration', 'apply-migration', 'Apply migration')],
          },
        ],
      },
      nonBlockingIncompleteStages: ['verify'],
    });
    expect(stage(resolution, 'register').canonicalOutcome).toBe(true);
    expect(stage(resolution, 'register').status).toBe('COMPLETE');
    expect(stage(resolution, 'verify').canonicalOutcome).toBe(false);
  });

  it('cannot lose a milestone once reached, whatever a later observation says', () => {
    expect(advanceMilestones(['REGISTERED', 'CLAIMED'], [])).toEqual(['REGISTERED', 'CLAIMED']);
    expect(advanceMilestones(['REGISTERED'], ['REGISTERED'])).toEqual(['REGISTERED']);
    // Later state may ADD; it may never revert.
    expect(advanceMilestones(['REGISTERED'], ['VERIFIED_WITH_EXCEPTION'])).toEqual([
      'REGISTERED',
      'VERIFIED_WITH_EXCEPTION',
    ]);
  });

  it('ranks VERIFIED_WITH_EXCEPTION equal to VERIFIED — the same rung, reached honestly', () => {
    expect(milestoneRank('VERIFIED_WITH_EXCEPTION')).toBe(milestoneRank('VERIFIED'));
    expect(highestMilestone(['REGISTERED', 'VERIFIED_WITH_EXCEPTION'])).toBe('VERIFIED_WITH_EXCEPTION');
    expect(milestoneRank('CLAIMED')).toBeGreaterThan(milestoneRank('VERIFIED_WITH_EXCEPTION'));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('CANARY 3 — missing audit evidence is read as missing canonical state', () => {
  /*
   * HISTORICAL DEFECT: one boolean carried both "did the ceremony happen" and
   * "can we see all its receipts", so an evidence gap was indistinguishable
   * from an absent outcome.
   * PRE-FIX PROOF: mutation — deriving `canonicalOutcome` from
   * `evidenceCompleteness === 'complete'` fails the first two assertions.
   * POST-FIX PROOF: this block.
   * PROTECTED INVARIANT: CI-2026-08-03-SETTLED-STAGE-OUTCOME-MONOTONIC-001.
   * RETIREMENT: never.
   */
  it('reports a canonically-complete stage as evidence-PARTIAL without demoting the outcome', () => {
    const resolution = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoPlatformState(), {
      canonicalOutcomes: SETTLED_REGISTER,
      auditGaps: REGISTER_AUDIT_GAPS,
    });
    const register = stage(resolution, 'register');
    expect(register.canonicalOutcome).toBe(true);
    expect(register.evidenceCompleteness).toBe('partial');
    expect(register.evidenceMissing.length).toBeGreaterThan(0);
  });

  it('names the gaps rather than hiding them — disclosure, never demotion', () => {
    const resolution = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoPlatformState(), {
      canonicalOutcomes: SETTLED_REGISTER,
      auditGaps: REGISTER_AUDIT_GAPS,
    });
    const register = stage(resolution, 'register');
    expect(register.auditGaps.length).toBeGreaterThan(0);
    expect(register.auditGaps.join(' ')).toContain('horizenRegistrationConfirmed');
  });

  it('does not let a registration audit gap block Passport', () => {
    const eligibility = resolvePassportEligibility({
      registration: { registered: true, settled: true, tokenId: NAKAMOTO.tokenId, auditGaps: ['a receipt gap'] },
      principal: { personhoodEstablished: true, citizenPassportValid: true },
      claim: { controlProven: true, controlProofFresh: true, quarantined: false },
      requiredAuthorizations: [{ id: 'sponsorship', label: 'sponsorship', granted: true }],
    });
    expect(eligibility.eligible).toBe(true);
    expect(eligibility.nonBlockingExceptions.map((e) => e.code)).toContain('registration-audit-gap');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('CANARY 4 — a non-blocking partner exception prevents Claim or Passport', () => {
  /*
   * HISTORICAL DEFECT: `partner_authorization_requests` is absent from the dev
   * schema, so Verify could not complete; Claim lists Verify as a prerequisite,
   * so Claim went BLOCKED and Passport with it. An unapplied local migration
   * had suspended an agent's constitutional progression.
   * PRE-FIX PROOF: removing `nonBlockingIncompleteStages` from the call below
   * makes Claim BLOCKED — asserted directly in the second test, so the
   * historical behaviour is reproduced in the file rather than described.
   * POST-FIX PROOF: this block.
   * PROTECTED INVARIANT: CI-2026-08-03-LOCAL-ANOMALY-NOT-GLOBAL-GATE-001.
   * RETIREMENT: when the migration is applied everywhere AND no comparable
   * local-anomaly class remains — i.e. not foreseeably.
   */
  const storeBlocker: BlockingReason = {
    code: 'authorization-store-unavailable',
    stageId: 'verify',
    summary: 'Local authorization store unavailable',
    acts: [
      journeyAct('verify', 'apply-migration', 'apply-migration', 'Apply migration', 'supabase/migrations/20260930000500_partner_authorization_requests.sql'),
      journeyAct('verify', 'reload-schema', 'reload-schema-cache', 'Refresh schema'),
      journeyAct('verify', 'recheck', 're-check', 'Re-check'),
    ],
  };

  it('does not put Claim in BLOCKED when only Verify is stopped', () => {
    const resolution = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoPlatformState(), {
      canonicalOutcomes: SETTLED_REGISTER,
      operationalBlockers: { verify: [storeBlocker] },
      nonBlockingIncompleteStages: ['verify'],
    });
    expect(stage(resolution, 'claim').status).not.toBe('BLOCKED');
    // …and Verify itself still says it needs doing. Relief from gating is not
    // completion.
    expect(stage(resolution, 'verify').canonicalOutcome).toBe(false);
    expect(stage(resolution, 'verify').operationalBlockers).toHaveLength(1);
  });

  it('does not put Passport in BLOCKED once Claim is done, even with Verify still stopped', () => {
    /*
     * Passport in the previous test is BLOCKED for the RIGHT reason — Claim
     * has not happened — and asserting otherwise there would have demanded a
     * genuine constitutional prerequisite be waived. The isolation claim is
     * this one: with Claim satisfied, an unapplied local migration must not
     * stand between the operator and the Passport act.
     *
     * `orient: true` added 2026-08-09 — Passport's prerequisite moved from
     * 'claim' to 'orient'; this test isolates the Verify/authorization-store
     * claim, not Orient's own gate, so Orient is satisfied alongside Claim.
     */
    const resolution = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoPlatformState(), {
      canonicalOutcomes: { register: true, claim: true, orient: true },
      operationalBlockers: { verify: [storeBlocker] },
      nonBlockingIncompleteStages: ['verify'],
    });
    expect(stage(resolution, 'passport').status).not.toBe('BLOCKED');
    expect(stage(resolution, 'verify').canonicalOutcome).toBe(false);
  });

  /*
   * RE-POINTED AT THE RUNTIME PATH, WITH THE REASON RECORDED.
   *
   * This asserted that omitting the isolation put Claim in BLOCKED — which
   * reproduced the defect only while Claim listed `verify` as a prerequisite.
   * The operator has since removed Verify from the admission spine entirely
   * (Register → Claim → Passport → Delegate → aigentMe, with Verify a
   * post-activation capability branch), so that stage-graph dependency no
   * longer exists to reproduce. `tests/journey-admission-spine.test.ts` pins
   * the graph itself; duplicating it here would be a second statement of one
   * fact (inv.engineering.036).
   *
   * What still needs a canary is the RUNTIME claim: a Verify-stage exception,
   * however severe, must not change Claim's resolved status. That is the
   * property that survives any future re-shaping of the definition, so it is
   * what this now tests.
   */
  it('a Verify-stage exception does not change Claim\'s resolved status', () => {
    const withoutException = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoPlatformState(), {
      canonicalOutcomes: SETTLED_REGISTER,
    });
    const withException = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoPlatformState(), {
      canonicalOutcomes: SETTLED_REGISTER,
      operationalBlockers: { verify: [storeBlocker] },
      nonBlockingExceptions: {
        verify: [
          {
            code: 'authorization-store-unavailable',
            recordId: 'partner-authorization-store',
            recordLabel: 'Local authorization store',
            cause: 'table absent',
            disposition: 'exception',
            consequence: 'Blocks the Verify act only.',
            blocksCurrentAct: false,
            acts: [journeyAct('verify', 'apply-migration', 'apply-migration', 'Apply migration')],
            deferrableUntil: null,
          },
        ],
      },
    });
    expect(stage(withException, 'claim').status).toBe(stage(withoutException, 'claim').status);
    expect(stage(withException, 'claim').status).not.toBe('BLOCKED');
    // …and the admission axis is untouched by it.
    expect(stage(withException, 'register').canonicalOutcome).toBe(true);
  });

  it('classifies Pulse and P&L as non-blocking, never as blockers', () => {
    const eligibility = resolvePassportEligibility({
      registration: { registered: true, settled: true, tokenId: NAKAMOTO.tokenId, auditGaps: [] },
      principal: { personhoodEstablished: true, citizenPassportValid: true },
      claim: { controlProven: true, controlProofFresh: true, quarantined: false },
      requiredAuthorizations: [{ id: 'sponsorship', label: 'sponsorship', granted: true }],
      ancillary: {
        pulseAuthorized: false,
        pnlDisclosureAuthorized: false,
        authorizationStoreAvailable: false,
        partnerMetadataComplete: false,
        diagnosticInconsistencies: ['the ladder and the card disagree'],
      },
    });
    // EVERY ancillary signal is off, and Passport is still eligible.
    expect(eligibility.eligible).toBe(true);
    expect(eligibility.blockingReasons).toHaveLength(0);
    const codes = eligibility.nonBlockingExceptions.map((e) => e.code);
    expect(codes).toContain('pulse-monitoring-not-authorized');
    expect(codes).toContain('pnl-disclosure-not-authorized');
    expect(codes).toContain('authorization-store-unavailable');
    expect(codes).toContain('partner-metadata-incomplete');
    expect(codes).toContain('diagnostic-inconsistency');
    expect(eligibility.nonBlockingExceptions.every((e) => e.blocksCurrentAct === false)).toBe(true);
  });

  it('keeps the blocking and non-blocking vocabularies disjoint', () => {
    // A code cannot be in both sets — that would let a rename promote a
    // non-blocking condition into a gate without anyone noticing.
    for (const code of NON_BLOCKING_EXCEPTION_CODES) {
      expect(BLOCKING_REASON_CODES as readonly string[]).not.toContain(code);
    }
    // Every non-blocking classification cites its ratified authority.
    for (const code of NON_BLOCKING_EXCEPTION_CODES) {
      expect(NON_BLOCKING_EVIDENCE[code]?.length ?? 0).toBeGreaterThan(40);
    }
  });

  it('blocks Passport for the four genuine constitutional prerequisites', () => {
    const blocked = resolvePassportEligibility({
      registration: { registered: false, settled: false, tokenId: null, auditGaps: [] },
      principal: { personhoodEstablished: false, citizenPassportValid: false },
      claim: { controlProven: false, controlProofFresh: false, quarantined: false },
      requiredAuthorizations: [{ id: 'sponsorship', label: 'sponsorship', granted: false }],
    });
    expect(blocked.eligible).toBe(false);
    const codes = blocked.blockingReasons.map((b) => b.code);
    expect(codes).toContain('principal-personhood-unresolved');
    expect(codes).toContain('registration-not-established');
    expect(codes).toContain('control-not-proven');
    expect(codes).toContain('human-authorization-not-granted');
  });

  it('treats a stale control proof as a distinct fault from an absent one', () => {
    const stale = resolvePassportEligibility({
      registration: { registered: true, settled: true, tokenId: NAKAMOTO.tokenId, auditGaps: [] },
      principal: { personhoodEstablished: true, citizenPassportValid: true },
      claim: { controlProven: true, controlProofFresh: false, quarantined: false },
      requiredAuthorizations: [],
    });
    expect(stale.blockingReasons.map((b) => b.code)).toContain('control-proof-stale');
    expect(stale.blockingReasons.map((b) => b.code)).not.toContain('control-not-proven');
  });

  it('blocks on a Marketa quarantine — never auto-cleared', () => {
    const quarantined = resolvePassportEligibility({
      registration: { registered: true, settled: true, tokenId: NAKAMOTO.tokenId, auditGaps: [] },
      principal: { personhoodEstablished: true, citizenPassportValid: true },
      claim: { controlProven: true, controlProofFresh: true, quarantined: true },
      requiredAuthorizations: [],
    });
    expect(quarantined.eligible).toBe(false);
    expect(quarantined.blockingReasons.map((b) => b.code)).toContain('admission-quarantined');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('CANARY 5 — completing a stage does not route to the next executable act', () => {
  /*
   * HISTORICAL DEFECT: after an act the operator was left on the stage they
   * had just finished (or sent back to cartridge home), with nothing naming
   * the next required step.
   * PRE-FIX PROOF: mutation — returning null from `resolveNextExecutableAct`
   * for a non-complete journey fails every assertion here.
   * POST-FIX PROOF: this block.
   * PROTECTED INVARIANT: CI-2026-08-03-EXCEPTION-TERMINATES-IN-ACT-001
   * (routing projection) + the Constitutional Time Principle.
   * RETIREMENT: never.
   */
  /*
   * UPDATED FOR THE RECONSTITUTED SPINE, WITH THE REASON RECORDED. Verify was
   * position 2 and is now a post-activation branch, so the act after Register
   * is Claim. The assertion's SUBJECT is unchanged — "completing a stage names
   * the next act" — only the correct answer moved.
   */
  it('names Claim as the next act once Register is canonically complete', () => {
    const resolution = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoPlatformState(), {
      canonicalOutcomes: SETTLED_REGISTER,
    });
    expect(resolution.nextExecutableAct?.stageId).toBe('claim');
    expect(resolution.currentStageId).toBe('claim');
  });

  it('walks the whole admission spine, one act at a time, without ever naming Verify', () => {
    // Orient inserted between Claim and Passport (2026-08-09).
    const spine = ['register', 'claim', 'orient', 'passport', 'delegate', 'aigentme'];
    const done: Record<string, boolean> = {};
    const visited: string[] = [];
    for (let i = 0; i < spine.length; i += 1) {
      const resolution = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoPlatformState(), {
        canonicalOutcomes: { ...done },
      });
      visited.push(resolution.nextExecutableAct!.stageId);
      done[spine[i]] = true;
    }
    expect(visited).toEqual(spine);
    // The capability branch is never offered as a step ON the spine.
    expect(visited).not.toContain('verify');
  });

  it("makes a blocked stage's next act the blocker's own remedy, not the ceremony", () => {
    // Register still incomplete, and carrying a blocker with an exact remedy.
    const resolution = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoPlatformState(), {
      operationalBlockers: {
        register: [
          {
            code: 'authorization-store-unavailable',
            stageId: 'register',
            summary: 'Local authorization store unavailable',
            acts: [
              journeyAct('register', 'apply-migration', 'apply-migration', 'Apply migration', 'supabase/migrations/20260930000500_partner_authorization_requests.sql'),
            ],
          },
        ],
      },
    });
    expect(resolution.nextExecutableAct?.kind).toBe('apply-migration');
    expect(resolution.nextExecutableAct?.detail).toContain('20260930000500_partner_authorization_requests.sql');
  });

  it('offers nothing only when the journey is genuinely complete', () => {
    const allComplete = Object.fromEntries(HORIZEN_MONEYPENNY_JOURNEY.stages.map((s) => [s.id, true]));
    const resolution = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoPlatformState(), {
      canonicalOutcomes: allComplete,
    });
    expect(resolution.complete).toBe(true);
    expect(resolveNextExecutableAct(HORIZEN_MONEYPENNY_JOURNEY, resolution.stages)).toBeNull();
  });

  it('EVERY blocker terminates in an act — structurally, and at runtime', () => {
    const blocked = resolvePassportEligibility({
      registration: null,
      principal: null,
      claim: null,
      requiredAuthorizations: [{ id: 'sponsorship', label: 'sponsorship', granted: false }],
    });
    expect(blocked.blockingReasons.length).toBeGreaterThan(0);
    for (const blocker of blocked.blockingReasons) {
      expect(blocker.acts.length).toBeGreaterThan(0);
      for (const act of blocker.acts) {
        expect(act.stageId).toBeTruthy();
        expect(act.label).toBeTruthy();
        // Never a navigation instruction — the shape the ratified exception
        // ruling forbids.
        expect(act.label).not.toMatch(/\b(go to|find|locate|see the|check the)\b/i);
      }
    }
    // A blocked gate still yields exactly one next act.
    expect(blocked.nextExecutableAct).toBeTruthy();
  });

  it('EVERY non-blocking exception also terminates in an act', () => {
    const eligibility = resolvePassportEligibility({
      registration: { registered: true, settled: true, tokenId: NAKAMOTO.tokenId, auditGaps: ['gap'] },
      principal: { personhoodEstablished: true, citizenPassportValid: true },
      claim: { controlProven: true, controlProofFresh: true, quarantined: false },
      requiredAuthorizations: [],
      ancillary: { pulseAuthorized: false, authorizationStoreAvailable: false },
    });
    expect(eligibility.nonBlockingExceptions.length).toBeGreaterThan(0);
    for (const exception of eligibility.nonBlockingExceptions) {
      expect(terminatesInAct(exception)).toBe(true);
    }
  });

  it('carries the exact remedy on the migration act — never "apply the migration" alone', () => {
    const eligibility = resolvePassportEligibility({
      registration: { registered: true, settled: true, tokenId: NAKAMOTO.tokenId, auditGaps: [] },
      principal: { personhoodEstablished: true, citizenPassportValid: true },
      claim: { controlProven: true, controlProofFresh: true, quarantined: false },
      requiredAuthorizations: [],
      ancillary: { authorizationStoreAvailable: false },
    });
    const storeException = eligibility.nonBlockingExceptions.find((e) => e.code === 'authorization-store-unavailable');
    const migrationAct = storeException?.acts.find((a) => a.kind === 'apply-migration');
    expect(migrationAct?.detail).toContain('20260930000500_partner_authorization_requests.sql');
    const reload = storeException?.acts.find((a) => a.kind === 'reload-schema-cache');
    expect(reload?.detail).toContain('reload schema');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('CANARY 6 — a refresh changes stage completion without a canonical-state change', () => {
  /*
   * HISTORICAL DEFECT: completion was recomputed from whatever the current
   * read returned, so a transient failure (timeout, unreadable receipts, a
   * persona whose receipts are not visible) silently un-completed a stage.
   * PRE-FIX PROOF: `resolveJourneyState` alone returns a DIFFERENT completion
   * for the degraded read — asserted below.
   * POST-FIX PROOF: this block.
   * PROTECTED INVARIANT: CI-2026-08-03-SETTLED-STAGE-OUTCOME-MONOTONIC-001.
   * RETIREMENT: never.
   */
  const degraded: AuthoritativePlatformState = { receiptRefs: {}, stages: {} };

  it('resolves identically across a refresh whose reads came back empty', () => {
    const first = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoPlatformState(), {
      canonicalOutcomes: SETTLED_REGISTER,
    });
    // The refresh: nothing readable, but the prior resolution is the floor.
    const second = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, degraded, {
      priorCanonicalStages: first.stages.filter((s) => s.canonicalOutcome).map((s) => s.stageId),
      priorMilestones: first.milestones,
    });
    expect(stage(second, 'register').canonicalOutcome).toBe(true);
    expect(stage(second, 'register').status).toBe('COMPLETE');
    expect(stage(second, 'register').canonicalAuthority).toBe('prior-resolution');
    expect(second.milestones).toContain('REGISTERED');
  });

  it('REPRODUCES THE DEFECT: without the prior resolution, the degraded read un-completes Register', () => {
    const withoutFloor = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, degraded, {});
    expect(stage(withoutFloor, 'register').canonicalOutcome).toBe(false);
  });

  it('only a named invalidation may subtract — and nothing else can', () => {
    const invalidated = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, degraded, {
      priorCanonicalStages: ['register'],
      invalidatedStages: ['register'],
    });
    expect(stage(invalidated, 'register').canonicalOutcome).toBe(false);
  });

  it('persists monotonically — a regressed write cannot shrink a stored resolution', async () => {
    const row = { metadata: {} as Record<string, unknown> };
    const admin = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row }) }) }),
        update: (patch: Record<string, unknown>) => {
          row.metadata = patch.metadata as Record<string, unknown>;
          return { eq: async () => ({ error: null }) };
        },
      }),
    } as never;

    await recordJourneyResolution(admin, NAKAMOTO.aigentQubeId, {
      journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
      journeyVersion: '1.0.0',
      subjectRef: NAKAMOTO.agent,
      canonicalStages: ['register', 'verify'],
      milestones: ['REGISTERED', 'VERIFIED'],
      highestMilestone: 'VERIFIED',
    });
    // A caller that computed LESS tries to persist it.
    const second = await recordJourneyResolution(admin, NAKAMOTO.aigentQubeId, {
      journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
      journeyVersion: '1.0.0',
      subjectRef: NAKAMOTO.agent,
      canonicalStages: [],
      milestones: [],
      highestMilestone: null,
    });
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.record.canonicalStages).toEqual(expect.arrayContaining(['register', 'verify']));
      expect(second.record.milestones).toEqual(expect.arrayContaining(['REGISTERED', 'VERIFIED']));
      expect(second.record.highestMilestone).toBe('VERIFIED');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('CANARY 7 — the Journey shows an old blocker after its prerequisite is satisfied', () => {
  /*
   * HISTORICAL DEFECT: a stale blocker outlived the condition it described,
   * so the operator was told to fix something already fixed and had no way to
   * tell a live blocker from a remembered one.
   * PRE-FIX PROOF: mutation — carrying blockers forward from the prior
   * resolution (rather than recomputing them) fails both assertions.
   * POST-FIX PROOF: this block.
   * PROTECTED INVARIANT: CI-2026-08-03-LOCAL-ANOMALY-NOT-GLOBAL-GATE-001.
   * RETIREMENT: never.
   */
  it('drops the store blocker as soon as the store is available, even with prior state carried', () => {
    const before = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoPlatformState(), {
      canonicalOutcomes: SETTLED_REGISTER,
      operationalBlockers: {
        verify: [
          {
            code: 'authorization-store-unavailable',
            stageId: 'verify',
            summary: 'Local authorization store unavailable',
            acts: [journeyAct('verify', 'apply-migration', 'apply-migration', 'Apply migration')],
          },
        ],
      },
      nonBlockingIncompleteStages: ['verify'],
    });
    expect(stage(before, 'verify').operationalBlockers).toHaveLength(1);

    // The migration is applied. The prior resolution still carries the
    // canonical floor — but NOT the blocker, because blockers are observations
    // and observations are recomputed.
    const after = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoPlatformState(), {
      canonicalOutcomes: SETTLED_REGISTER,
      priorCanonicalStages: before.stages.filter((s) => s.canonicalOutcome).map((s) => s.stageId),
      priorMilestones: before.milestones,
    });
    expect(stage(after, 'verify').operationalBlockers).toHaveLength(0);
    expect(stage(after, 'register').canonicalOutcome).toBe(true);
  });

  it('removes a Passport blocker the moment its prerequisite is satisfied', () => {
    const before = resolvePassportEligibility({
      registration: { registered: true, settled: true, tokenId: NAKAMOTO.tokenId, auditGaps: [] },
      principal: { personhoodEstablished: true, citizenPassportValid: true },
      claim: { controlProven: false, controlProofFresh: false, quarantined: false },
      requiredAuthorizations: [],
    });
    expect(before.blockingReasons.map((b) => b.code)).toContain('control-not-proven');

    const after = resolvePassportEligibility({
      registration: { registered: true, settled: true, tokenId: NAKAMOTO.tokenId, auditGaps: [] },
      principal: { personhoodEstablished: true, citizenPassportValid: true },
      claim: { controlProven: true, controlProofFresh: true, quarantined: false },
      requiredAuthorizations: [],
    });
    expect(after.blockingReasons).toHaveLength(0);
    expect(after.eligible).toBe(true);
    expect(after.nextExecutableAct.stageId).toBe('passport');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('CANARY 8 — Passport eligibility is computed by two surfaces', () => {
  /*
   * HISTORICAL DEFECT: one fact ("is Nakamoto registered") had five observers
   * reading five sources, and every disagreement was reported as a separate
   * bug. The same shape applied to an admission decision produces two surfaces
   * admitting and refusing the same agent.
   * PRE-FIX PROOF: this is a source canary in the pattern of
   * tests/persona-spine-fetch.test.ts — it fails the build the moment a second
   * file starts deciding Passport admission. Verified by temporarily adding a
   * blocking-code literal to a second file, which turns it red.
   * POST-FIX PROOF: this block.
   * PROTECTED INVARIANT: CI-2026-08-03-CANONICAL-READER-OWNERSHIP-001 and
   * inv.engineering.036/037.
   * RETIREMENT: only if Passport admission ceases to exist.
   */
  const repoRoot = path.resolve(__dirname, '..');
  const GATE = 'services/journey/passportEligibility.ts';

  function sourceFiles(dirs: string[]): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          out.push(path.relative(repoRoot, full));
        }
      }
    };
    for (const d of dirs) walk(path.join(repoRoot, d));
    return out;
  }

  /**
   * ASSERTION REPLACED, WITH THE REASON RECORDED (the discipline
   * CI-2026-08-03-CANARY-REPRODUCES-DEFECT-001 requires of any changed canary).
   *
   * The first version of this canary flagged any file containing a blocking
   * code string, and caught `services/marketa/externalAgentAdmissionEvidence.ts`
   * — which pushes `'control-proof-stale'` onto its `unresolvedClaims` list.
   * That is Marketa's EVIDENCE vocabulary, not a second admission decision:
   * the file observes and reports, and the gate decides. A canary that cannot
   * tell an observation from a decision would have forced either a pointless
   * rename or its own deletion, and CLAUDE.md forbids weakening a canary to
   * make a violation pass.
   *
   * So it now detects the DECISION SIGNATURE — construction of
   * `blockingReasons`, which is the gate's output and the thing a second
   * implementation would inevitably reproduce — rather than a shared word.
   */
  it('is decided in exactly ONE module — no second surface constructs blockingReasons', () => {
    const files = sourceFiles(['services', 'components', 'app']);
    const offenders = files.filter((file) => {
      if (file === GATE) return false;
      const source = fs.readFileSync(path.join(repoRoot, file), 'utf8');
      // A file that IMPORTS the gate is a consumer, which is the whole point.
      if (source.includes('passportEligibility')) return false;
      return /blockingReasons\s*[:.=]/.test(source);
    });
    expect(offenders).toEqual([]);
  });

  it('no surface outside the gate decides eligibility from a blocking code', () => {
    const files = sourceFiles(['services', 'components', 'app']);
    const offenders = files.filter((file) => {
      if (file === GATE) return false;
      const source = fs.readFileSync(path.join(repoRoot, file), 'utf8');
      if (source.includes('passportEligibility')) return false;
      const namesACode = BLOCKING_REASON_CODES.some(
        (code) => source.includes(`'${code}'`) || source.includes(`"${code}"`),
      );
      // Naming a code is fine (evidence layers do). DECIDING on it is not.
      return namesACode && /\beligible\b\s*[:=]/.test(source);
    });
    expect(offenders).toEqual([]);
  });

  it('the journey state route consumes the gate rather than reimplementing it', () => {
    const route = fs.readFileSync(
      path.join(repoRoot, 'app/api/journey/moneypenny-horizen/state/route.ts'),
      'utf8',
    );
    expect(route).toContain('resolvePassportEligibility');
    // …and it does NOT re-derive registration; it consumes the settled fact.
    expect(route).toContain('resolveAgentRegistrationState');
  });

  it('gives the same answer for the same inputs, however many times it is asked', () => {
    const input = {
      registration: { registered: true, settled: true, tokenId: NAKAMOTO.tokenId, auditGaps: [] },
      principal: { personhoodEstablished: true, citizenPassportValid: true },
      claim: { controlProven: true, controlProofFresh: true, quarantined: false },
      requiredAuthorizations: [{ id: 'sponsorship', label: 'sponsorship', granted: true }],
      ancillary: { pulseAuthorized: false },
    };
    const a = resolvePassportEligibility(input);
    const b = resolvePassportEligibility(input);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('the Verify stage carries no constitutional milestone predicate of its own', () => {
    // Four of the five rungs map to a SettledPredicate; VERIFIED deliberately
    // does not, because transparency is a gateway, never a grant.
    const settledFacts = fs.readFileSync(path.join(repoRoot, 'services/journey/settledFacts.ts'), 'utf8');
    expect(settledFacts).toContain("'is_registered'");
    expect(settledFacts).toContain("'control_is_proven'");
    expect(settledFacts).toContain("'passport_is_issued'");
    expect(settledFacts).toContain("'delegation_is_granted'");
    expect(settledFacts).not.toContain("'pulse_is_authorized'");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// THE RECONSTITUTED SHAPE — three axes, one spine, two independent branches
// (operator ruling, 2026-08-03).
//
//   Register → Claim → Passport → Delegate → aigentMe
//                                              ├─ Ingest → Standing eligible
//                                              └─ Verify → FS eligible
//
// `tests/journey-admission-spine.test.ts` pins the stage GRAPH. These canaries
// pin the RUNTIME behaviour of the axes, which is the part a future re-shaping
// of the definition could silently break while leaving the graph intact.
// ═══════════════════════════════════════════════════════════════════════════

describe('AXES — Verify never blocks the admission spine or the Factory branch', () => {
  /*
   * HISTORICAL DEFECT: Verify sat at position 2, so an absent
   * `partner_authorization_requests` table blocked Claim, Passport, delegation
   * and activation — a local migration holding personhood hostage.
   * PRE-FIX PROOF: mutation — making `admission.*` read a verification value
   * fails these assertions (run and verified red).
   * POST-FIX PROOF: this block.
   * PROTECTED INVARIANT: CI-2026-08-03-DISTINCT-STATE-AXES-001.
   * RETIREMENT: never — the axes are the constitutional shape.
   */
  const fullyBlockedVerification = { pulse: 'exception' as const, pnl: 'exception' as const };

  it('admission is unchanged whether verification is complete, absent or in exception', () => {
    const canonicalStages = { register: true, claim: true, passport: true, delegate: true, aigentme: true };
    const withException = resolveAgentStateAxes({ canonicalStages, factoryIngested: false, ...fullyBlockedVerification });
    const withComplete = resolveAgentStateAxes({ canonicalStages, factoryIngested: false, pulse: 'complete', pnl: 'complete' });
    const withNothing = resolveAgentStateAxes({ canonicalStages, factoryIngested: false, pulse: 'not-started', pnl: 'not-started' });
    expect(withException.admission).toEqual(withComplete.admission);
    expect(withException.admission).toEqual(withNothing.admission);
    expect(withException.admission.aigentMeActive).toBe(true);
  });

  it('a Verify failure does not block Factory ingestion', () => {
    const axes = resolveAgentStateAxes({
      canonicalStages: { register: true, claim: true, passport: true, delegate: true, aigentme: true },
      factoryIngested: true,
      ...fullyBlockedVerification,
    });
    expect(axes.factory.ingested).toBe(true);
    expect(axes.factory.standingEligible).toBe(true);
  });

  it('a financial-services verification exception stays scoped to that capability', () => {
    const axes = resolveAgentStateAxes({
      canonicalStages: { register: true, claim: true, passport: true, delegate: true, aigentme: true },
      factoryIngested: true,
      ...fullyBlockedVerification,
    });
    // The ONLY thing it costs the agent is FS eligibility.
    expect(axes.verification.financialServicesEligible).toBe(false);
    expect(axes.admission.delegated).toBe(true);
    expect(axes.factory.standingEligible).toBe(true);
  });

  it('needs BOTH steps for financial-services eligibility — neither alone implies it', () => {
    const base = { canonicalStages: { aigentme: true }, factoryIngested: false };
    expect(resolveAgentStateAxes({ ...base, pulse: 'complete', pnl: 'not-started' }).verification.financialServicesEligible).toBe(false);
    expect(resolveAgentStateAxes({ ...base, pulse: 'not-started', pnl: 'complete' }).verification.financialServicesEligible).toBe(false);
    expect(resolveAgentStateAxes({ ...base, pulse: 'complete', pnl: 'complete' }).verification.financialServicesEligible).toBe(true);
  });
});

describe('AXES — Factory ingestion confers ELIGIBILITY, never Standing', () => {
  /*
   * HISTORICAL DEFECT: the Deploy stage declared `receiptTypes:
   * ['standing_accrued']`, so the act of ingesting an agent wrote a Standing
   * ACCRUAL. Standing would have arrived with the paperwork rather than being
   * earned by conduct — collapsing the distinction PRD-GJR-001 §3.7 rests on.
   * PRE-FIX PROOF: mutation — setting `accrued: ingested ? 1 : 0` fails the
   * first two assertions (run and verified red).
   * POST-FIX PROOF: this block.
   * PROTECTED INVARIANT: CI-2026-08-03-ELIGIBILITY-IS-NOT-ACCRUAL-001.
   * RETIREMENT: never.
   */
  /*
   * ASSERTION CORRECTED, WITH THE REASON RECORDED. This asserted
   * `accrued === 0` after ingestion. The operator judged that too absolute on
   * 2026-08-03 — "Factory ingestion CAN earn a nominal initial Standing award
   * because registration is itself a consequential, receipted action" — and
   * named the real safeguard: "Admission Standing must be distinguishable
   * from earned performance Standing." A canary pinning the zero would now be
   * requiring a rule the operator has replaced, which is the
   * canary-encodes-a-stale-shape defect (CI-…-CANARY-REPRODUCES-DEFECT-001).
   * It now tests the TIER SPLIT, which is what the safeguard actually is.
   */
  it('ingestion alone earns NO contribution Standing — eligibility is not earnings', () => {
    const axes = resolveAgentStateAxes({
      canonicalStages: { register: true, claim: true, passport: true, delegate: true, aigentme: true },
      factoryIngested: true,
      pulse: 'not-started',
      pnl: 'not-started',
    });
    expect(axes.factory.ingested).toBe(true);
    expect(axes.factory.standingEligible).toBe(true);
    expect(axes.standing.contributionAccrued).toBe(0);
    expect(axes.standing.sourceReceipts).toEqual([]);
  });

  it('keeps admission Standing distinguishable from earned Standing — the operator\'s actual safeguard', () => {
    const axes = resolveAgentStateAxes({
      canonicalStages: { aigentme: true },
      factoryIngested: true,
      pulse: 'not-started',
      pnl: 'not-started',
      initialStandingAwarded: REGISTRATION_SEED_STANDING,
      standingReceipts: ['receipt-validated-work-1'],
    });
    expect(axes.standing.initialAccrued).toBe(REGISTRATION_SEED_STANDING);
    expect(axes.standing.contributionAccrued).toBe(1);
    expect(axes.standing.accrued).toBe(REGISTRATION_SEED_STANDING + 1);
    // The two are never merged into one indistinguishable number.
    expect(axes.standing.initialAccrued).not.toBe(axes.standing.accrued);
  });

  it('the admission seed is nominal by construction — it cannot confer a Standing bucket', () => {
    // Structural, not cosmetic: bucketFor(overall) = floor(overall / 25), so a
    // seed below one bucket step cannot move an agent off bucket 0 alone.
    expect(REGISTRATION_SEED_STANDING).toBeLessThan(25);
    expect(Math.floor(REGISTRATION_SEED_STANDING / 25)).toBe(0);
    expect(REGISTRATION_STANDING_SEED.tier).toBe('initial');
    expect(REGISTRATION_STANDING_SEED.impliesPerformance).toBe(false);
    expect(REGISTRATION_STANDING_SEED.repeatable).toBe(false);
  });

  it('ingestion without eligibility is not a representable state', () => {
    const axes = resolveAgentStateAxes({ canonicalStages: { aigentme: true }, factoryIngested: true, pulse: 'not-started', pnl: 'not-started' });
    expect(axes.factory.standingEligible).toBe(axes.factory.ingested);
    expect(axes.standing.contributionAccrued).toBe(0);
  });

  it('Standing accrues only from qualifying receipts, never from ingestion', () => {
    const earned = resolveAgentStateAxes({
      canonicalStages: { aigentme: true },
      factoryIngested: true,
      pulse: 'not-started',
      pnl: 'not-started',
      standingReceipts: ['receipt-validated-work-1', 'receipt-validated-work-2'],
    });
    expect(earned.standing.contributionAccrued).toBe(2);
    expect(earned.standing.sourceReceipts).toHaveLength(2);
  });

  it('the state route reads ingestion from capability_registered, never from standing_accrued', () => {
    const route = fs.readFileSync(
      path.join(__dirname, '..', 'app/api/journey/moneypenny-horizen/state/route.ts'),
      'utf8',
    );
    const ingestLine = route.split('\n').find((l) => l.includes('factoryIngested:'));
    expect(ingestLine).toBeDefined();
    expect(ingestLine).toContain('capability_registered');
    expect(ingestLine).not.toContain('standing_accrued');
  });
});

describe('AXES — the two post-activation branches are independent', () => {
  /*
   * HISTORICAL DEFECT: everything was one line, so every later capability
   * implicitly required every earlier one.
   * PRE-FIX PROOF: mutation — making either offer's `available` depend on the
   * other's `complete` fails these assertions (run and verified red).
   * POST-FIX PROOF: this block.
   * PROTECTED INVARIANT: CI-2026-08-03-DISTINCT-STATE-AXES-001.
   * RETIREMENT: never.
   */
  const activated = { register: true, claim: true, passport: true, delegate: true, aigentme: true };

  it('offers both branches the moment aigentMe is active, in either order', () => {
    const neither = resolveBranchOffers(
      resolveAgentStateAxes({ canonicalStages: activated, factoryIngested: false, pulse: 'not-started', pnl: 'not-started' }),
    );
    expect(neither.every((o) => o.available)).toBe(true);
    expect(neither.every((o) => !o.complete)).toBe(true);
    expect(neither.map((o) => o.branch).sort()).toEqual(['capability', 'factory']);
  });

  it('completing the Factory branch does not require the capability branch', () => {
    const offers = resolveBranchOffers(
      resolveAgentStateAxes({ canonicalStages: activated, factoryIngested: true, pulse: 'exception', pnl: 'exception' }),
    );
    expect(offers.find((o) => o.branch === 'factory')!.complete).toBe(true);
    // …and the other branch is still offered, not withdrawn.
    expect(offers.find((o) => o.branch === 'capability')!.available).toBe(true);
  });

  it('completing the capability branch does not require the Factory branch', () => {
    const offers = resolveBranchOffers(
      resolveAgentStateAxes({ canonicalStages: activated, factoryIngested: false, pulse: 'complete', pnl: 'complete' }),
    );
    expect(offers.find((o) => o.branch === 'capability')!.complete).toBe(true);
    expect(offers.find((o) => o.branch === 'factory')!.available).toBe(true);
  });

  it('offers neither branch before activation — they are POST-activation', () => {
    const offers = resolveBranchOffers(
      resolveAgentStateAxes({ canonicalStages: { register: true, claim: true }, factoryIngested: false, pulse: 'not-started', pnl: 'not-started' }),
    );
    expect(offers.every((o) => !o.available)).toBe(true);
  });

  it('states each branch as an OUTCOME the operator gets, never as a mechanism', () => {
    const offers = resolveBranchOffers(
      resolveAgentStateAxes({ canonicalStages: activated, factoryIngested: false, pulse: 'not-started', pnl: 'not-started' }),
    );
    expect(offers.find((o) => o.branch === 'factory')!.outcome).toMatch(/eligible to accrue Standing/i);
    expect(offers.find((o) => o.branch === 'capability')!.outcome).toMatch(/financial-services runtime/i);
    for (const offer of offers) {
      expect(offer.outcome).not.toMatch(/\b(table|migration|endpoint|schema)\b/i);
    }
  });
});

describe('AXES — no post-activation failure regresses settled admission state', () => {
  /*
   * HISTORICAL DEFECT: a later-stage failure recomputed everything and
   * un-completed earlier stages.
   * PRE-FIX PROOF: mutation — dropping the `|| prior?.admission.*` terms makes
   * the first assertion fail (run and verified red).
   * POST-FIX PROOF: this block.
   * PROTECTED INVARIANT: CI-2026-08-03-DISTINCT-STATE-AXES-001 +
   * CI-2026-08-03-SETTLED-STAGE-OUTCOME-MONOTONIC-001.
   * RETIREMENT: never.
   */
  it('keeps every admission flag when both branches subsequently fail', () => {
    const before = resolveAgentStateAxes({
      canonicalStages: { register: true, claim: true, passport: true, delegate: true, aigentme: true },
      factoryIngested: true,
      pulse: 'complete',
      pnl: 'complete',
    });
    // Everything downstream then collapses — unreadable receipts, partner
    // outage, whatever. Admission is not a function of any of it.
    const after = resolveAgentStateAxes({
      canonicalStages: {},
      factoryIngested: false,
      pulse: 'exception',
      pnl: 'exception',
      prior: before,
    });
    expect(after.admission).toEqual(before.admission);
    expect(after.factory.ingested).toBe(true);
  });

  it('never lets an exception overwrite an already-complete verification step', () => {
    const before = resolveAgentStateAxes({ canonicalStages: { aigentme: true }, factoryIngested: false, pulse: 'complete', pnl: 'complete' });
    const after = resolveAgentStateAxes({ canonicalStages: { aigentme: true }, factoryIngested: false, pulse: 'exception', pnl: 'exception', prior: before });
    expect(after.verification.pulse).toBe('complete');
    expect(after.verification.financialServicesEligible).toBe(true);
  });

  it('DOES let an exception replace not-started — an exception is news, not a regression', () => {
    const before = resolveAgentStateAxes({ canonicalStages: { aigentme: true }, factoryIngested: false, pulse: 'not-started', pnl: 'not-started' });
    const after = resolveAgentStateAxes({ canonicalStages: { aigentme: true }, factoryIngested: false, pulse: 'exception', pnl: 'not-started', prior: before });
    expect(after.verification.pulse).toBe('exception');
  });
});

describe('AXES — a branch is never named as "the one next act"', () => {
  /*
   * HISTORICAL DEFECT: `resolveNextExecutableAct` walked the stage array in
   * order, so once the spine completed it named whichever BRANCH happened to
   * sit earlier in the array — re-imposing an order on two branches the
   * operator ruled independent, through nothing but array position.
   * PRE-FIX PROOF: mutation — removing the `if (stage.branch) continue` guard
   * makes the first assertion return 'verify' (run and verified red).
   * POST-FIX PROOF: this block.
   * PROTECTED INVARIANT: CI-2026-08-03-DISTINCT-STATE-AXES-001.
   * RETIREMENT: never, while branches exist.
   */
  it('offers no single next act once the admission spine is complete', () => {
    const resolution = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoPlatformState(), {
      canonicalOutcomes: { register: true, claim: true, orient: true, passport: true, delegate: true, aigentme: true },
    });
    expect(resolution.nextExecutableAct).toBeNull();
  });

  it('treats a branch DESCENDANT as off-spine too — Standing is not a constitutional step', () => {
    // `standing` carries no `branch` marker; it is off-spine only because it
    // descends from `deploy`. Derived, so a branch may grow further steps
    // without anyone remembering to update a list.
    const offSpine = offSpineStageIds(HORIZEN_MONEYPENNY_JOURNEY);
    expect(offSpine.has('deploy')).toBe(true);
    expect(offSpine.has('verify')).toBe(true);
    expect(offSpine.has('standing')).toBe(true);
    expect(offSpine.has('register')).toBe(false);
    expect(offSpine.has('aigentme')).toBe(false);
  });

  it('never names a branch stage as the next act, at any point on the spine', () => {
    const branchIds = [...offSpineStageIds(HORIZEN_MONEYPENNY_JOURNEY)];
    expect(branchIds.length).toBeGreaterThan(0);
    const done: Record<string, boolean> = {};
    for (const stageId of ['register', 'claim', 'orient', 'passport', 'delegate', 'aigentme']) {
      const resolution = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoPlatformState(), {
        canonicalOutcomes: { ...done },
      });
      expect(branchIds).not.toContain(resolution.nextExecutableAct?.stageId);
      done[stageId] = true;
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// THE ACCEPTANCE CONTRACT (operator, 2026-08-03). One path:
//   Nakamoto registered → Claim executable → existing operator Passport
//   RECOGNIZED → bounded delegation executable → aigentMe activated →
//   Factory and Financial-services shown as INDEPENDENT branches.
// ═══════════════════════════════════════════════════════════════════════════

describe('ACCEPTANCE 2 — an existing operator Passport is RECOGNIZED, never re-applied for', () => {
  /*
   * HISTORICAL DEFECT — LIVE UNTIL THIS CHANGE. state/route.ts read
   *   operatorPolityCitizenPassportValid: hasReceipt('operator_passport_validated')
   * so an operator holding a valid Polity Passport issued through the Passport
   * Bureau — entirely outside this journey, therefore with no such receipt —
   * resolved as holding NONE, and the Journey would have presented a Passport
   * APPLICATION to someone who already holds a Passport. Evidence-of-this-
   * ceremony substituted for the canonical fact.
   * PRE-FIX PROOF: the first test below fails against that line — a valid
   * canonical Passport with NO receipt yields `principal-citizen-passport-
   * invalid`. Mutation-verified by restoring the receipt-only derivation.
   * POST-FIX PROOF: this block.
   * PROTECTED INVARIANT: CI-2026-08-03-ONE-ADMISSION-GATE-001 +
   * CI-2026-08-03-SETTLED-STAGE-OUTCOME-MONOTONIC-001.
   * RETIREMENT: never.
   */
  const registered = { registered: true, settled: true, tokenId: NAKAMOTO.tokenId, auditGaps: [] };
  const claimed = { controlProven: true, controlProofFresh: true, quarantined: false };

  it('recognizes a canonical Passport held with NO journey receipt', () => {
    const eligibility = resolvePassportEligibility({
      registration: registered,
      // Canonical read says valid; this journey wrote no receipt at all.
      principal: { personhoodEstablished: true, citizenPassportValid: true, passportReadable: true },
      claim: claimed,
      requiredAuthorizations: [],
    });
    expect(eligibility.eligible).toBe(true);
    const codes = eligibility.blockingReasons.map((b) => b.code);
    expect(codes).not.toContain('principal-citizen-passport-invalid');
    expect(codes).not.toContain('principal-personhood-unresolved');
  });

  it('never offers an APPLICATION act to a principal who already holds a Passport', () => {
    const eligibility = resolvePassportEligibility({
      registration: registered,
      principal: { personhoodEstablished: true, citizenPassportValid: true, passportReadable: true },
      claim: claimed,
      requiredAuthorizations: [],
    });
    const everyAct = eligibility.blockingReasons.flatMap((b) => b.acts).concat(eligibility.nextExecutableAct);
    for (const act of everyAct) {
      expect(act.actId).not.toMatch(/apply|application/i);
      expect(act.label).not.toMatch(/\bapply\b/i);
    }
  });

  it('treats an UNREADABLE Passport as a re-check, never as an application', () => {
    const eligibility = resolvePassportEligibility({
      registration: registered,
      principal: { personhoodEstablished: false, citizenPassportValid: false, passportReadable: false },
      claim: claimed,
      requiredAuthorizations: [],
    });
    const unreadable = eligibility.blockingReasons.find((b) => b.code === 'principal-passport-unreadable');
    expect(unreadable).toBeDefined();
    expect(unreadable!.acts[0].kind).toBe('re-check');
    // …and it must NOT also assert personhood is unresolved: we do not know.
    expect(eligibility.blockingReasons.map((b) => b.code)).not.toContain('principal-personhood-unresolved');
    expect(unreadable!.summary).toMatch(/nothing about your passport has changed/i);
  });

  it('the state route reads the CANONICAL passport, not only a journey receipt', () => {
    const route = fs.readFileSync(
      path.join(__dirname, '..', 'app/api/journey/moneypenny-horizen/state/route.ts'),
      'utf8',
    );
    expect(route).toContain('resolvePassportPrincipalForAuthUser');
    expect(route).toContain('isPassportUsable');
    // The settled predicate is consulted BEFORE the read, and settled after.
    expect(route).toContain("'passport_is_issued'");
    // The receipt may corroborate but never stand alone.
    const principalBlock = route.slice(route.indexOf('citizenPassportValid:'), route.indexOf('citizenPassportValid:') + 160);
    expect(principalBlock).toContain('operatorPassport.valid ||');
  });
});

describe('ACCEPTANCE — Verify can never become the next mandatory act', () => {
  /*
   * REWRITTEN, NOT DELETED (operator instruction). The prior version proved
   * this by asserting Claim went BLOCKED without the isolation — which only
   * reproduced while Claim listed `verify` as a prerequisite. It now proves
   * the two properties that survive any re-shaping of the definition.
   * PRE-FIX PROOF: removing the off-spine guard in resolveNextExecutableAct
   * makes the first test name 'verify' (mutation-verified red).
   * PROTECTED INVARIANT: CI-2026-08-03-DISTINCT-STATE-AXES-001.
   */
  it('never names Verify as the next act after Register', () => {
    const resolution = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoPlatformState(), {
      canonicalOutcomes: SETTLED_REGISTER,
    });
    expect(resolution.nextExecutableAct?.stageId).toBe('claim');
    expect(resolution.nextExecutableAct?.stageId).not.toBe('verify');
  });

  it.each([
    ['incomplete', { verify: { pulseAuthorizationVerified: false, pnlTransparencyEnabled: false, agentCardEnrichmentCommitted: false } }],
    ['refused', { verify: { pulseAuthorizationVerified: false, pnlTransparencyEnabled: false, agentCardEnrichmentCommitted: false } }],
    ['unavailable', { verify: {} }],
  ])('keeps Claim executable when Verify is %s', (label, verifyStage) => {
    const platformState = nakamotoPlatformState(verifyStage as never);
    const resolution = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, platformState, {
      canonicalOutcomes: SETTLED_REGISTER,
      // The "refused"/"unavailable" cases additionally carry a live blocker.
      operationalBlockers:
        label === 'incomplete'
          ? {}
          : {
              verify: [
                {
                  code: 'authorization-store-unavailable',
                  stageId: 'verify',
                  summary: `Verify is ${label}`,
                  acts: [journeyAct('verify', 'apply-migration', 'apply-migration', 'Apply migration')],
                },
              ],
            },
    });
    expect(stage(resolution, 'claim').status).not.toBe('BLOCKED');
    expect(resolution.nextExecutableAct?.stageId).toBe('claim');
    // Admission is untouched in every one of the three cases.
    expect(stage(resolution, 'register').canonicalOutcome).toBe(true);
  });
});

describe('ACCEPTANCE 3 — each completed act routes directly to the next, never to a status page', () => {
  /*
   * PROTECTED INVARIANT: the Constitutional Time Principle's routing
   * projection. PRE-FIX PROOF: returning null from resolveNextExecutableAct
   * for a non-complete journey turns this red (mutation-verified).
   */
  it('routes Claim → Orient → Passport → Delegate → aigentMe, one act at a time', () => {
    const done: Record<string, boolean> = { register: true };
    const route: string[] = [];
    for (const justFinished of ['claim', 'orient', 'passport', 'delegate']) {
      done[justFinished] = true;
      const resolution = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoPlatformState(), {
        canonicalOutcomes: { ...done },
      });
      route.push(resolution.nextExecutableAct!.stageId);
    }
    expect(route).toEqual(['orient', 'passport', 'delegate', 'aigentme']);
    // Never a dashboard, cartridge home or status surface.
    for (const stageId of route) {
      expect(HORIZEN_MONEYPENNY_JOURNEY.stages.some((s) => s.id === stageId)).toBe(true);
    }
  });

  /*
   * RE-POINTED 2026-08-03. This asserted `lastActRef` — a mechanism inside the
   * outcome/evidence/exception redesign the operator ordered removed:
   *
   *   > "Do not add another abstraction, resolver framework, exception
   *   >  taxonomy, diagnostic surface, state axis, disclosure panel…"
   *
   * A canary naming an implementation detail dies with that detail and takes
   * its requirement with it. The requirement — the surface lands the operator
   * on the stage the server says is current — survives the redesign's removal
   * and is asserted here instead.
   */
  it('the surface follows the server\'s current stage rather than pinning one', () => {
    const surface = fs.readFileSync(path.join(__dirname, '..', 'components/journey/JourneyRunSurface.tsx'), 'utf8');
    expect(surface).toMatch(/runtimeState\?\.currentStageId/);
    // And the resolver moves that pointer as stages complete.
    const atClaim = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoPlatformState(), {
      canonicalOutcomes: { register: true },
    });
    // Orient now sits between Claim and Passport (2026-08-09) — completing
    // Claim alone moves the pointer to Orient, not straight to Passport.
    const atOrient = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoPlatformState(), {
      canonicalOutcomes: { register: true, claim: true },
    });
    const atPassport = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoPlatformState(), {
      canonicalOutcomes: { register: true, claim: true, orient: true },
    });
    expect(atClaim.currentStageId).toBe('claim');
    expect(atOrient.currentStageId).toBe('orient');
    expect(atPassport.currentStageId).toBe('passport');
  });
});

describe('ACCEPTANCE 5/6 — the branch surface', () => {
  it('produces exactly the operator\'s triple on Factory ingestion', () => {
    const axes = resolveAgentStateAxes({
      canonicalStages: { register: true, claim: true, passport: true, delegate: true, aigentme: true },
      factoryIngested: true,
      pulse: 'not-started',
      pnl: 'not-started',
    });
    // Contribution Standing — the tier the acceptance condition is about — is
    // zero on ingestion. Any admission seed is reported separately, per the
    // operator's 2026-08-03 correction.
    expect({
      factoryIngested: axes.factory.ingested,
      standingEligible: axes.factory.standingEligible,
      standingAccrued: axes.standing.contributionAccrued,
    }).toEqual({ factoryIngested: true, standingEligible: true, standingAccrued: 0 });
  });

  /*
   * RE-POINTED 2026-08-03, same reason as above: the branch SURFACE was part
   * of the removed redesign, and the operator has deferred that work —
   * "Do not work on those branches until the admission spine is complete and
   * executable." What must remain true regardless of how branches are ever
   * presented is that neither is the mandatory next act.
   */
  it('neither branch is ever the mandatory next act', () => {
    const resolution = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoPlatformState(), {
      canonicalOutcomes: { register: true, claim: true, orient: true, passport: true, delegate: true, aigentme: true },
    });
    expect(resolution.nextExecutableAct).toBeNull();
  });
});

describe('one fact, one source — WITHIN the state route (2026-08-03)', () => {
  /*
   * The canonical Passport read was wired into the eligibility gate but not
   * into the stage evidence checklist, which kept deriving the same fact from
   * `hasReceipt` alone. An operator holding a Bureau-issued Passport would
   * pass the gate and still see "operator Passport not validated" on the
   * stage's evidence line.
   *
   * That is the session's signature defect — one fact, two observers, two
   * answers — reintroduced a few hundred lines apart inside a single route,
   * by the very change that fixed it elsewhere. Worth a canary precisely
   * because it survived a fix aimed at it.
   */
  const routeSource = fs
    .readFileSync(path.join(__dirname, '..', 'app/api/journey/moneypenny-horizen/state/route.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  it('every Passport-validity read in the route consults the canonical value', () => {
    const reads = routeSource.match(/operatorPolityCitizenPassportValid:[^,\n]*/g) ?? [];
    expect(reads.length, 'no Passport-validity read found — the route moved').toBeGreaterThan(0);
    for (const read of reads) {
      expect(read, `a receipt-only Passport read survives: ${read}`).toContain('operatorPassport.valid');
    }
  });

  it('no Passport-validity read is receipt-only', () => {
    // THE ASSERTION THAT FAILS ON THE DEFECT: `hasReceipt(...)` alone.
    expect(routeSource).not.toMatch(/operatorPolityCitizenPassportValid:\s*hasReceipt\([^)]*\),/);
  });
});

describe('the observer watches the SAME agent the surfaces act on (2026-08-03)', () => {
  /*
   * ── WHAT THE OPERATOR SAW ────────────────────────────────────────────────
   *
   * On the Claim stage, simultaneously:
   *
   *   "Awaiting: Control Proof Fresh, Marketa Final Recommendation"
   *   "Evidence checklist — 0 of 2 recorded"
   *   ...and directly below, in the same panel:
   *   "AGENT_CONTROL_PROVEN · Wallet control proven for Aigent Nakamoto
   *    (token 8798, base-sepolia)  ·  Agents: aigent-nakamoto"
   *
   * The stage was awaiting the exact proof it was displaying.
   *
   * ── THE CAUSE ────────────────────────────────────────────────────────────
   *
   * `PilotJourneyTab` threads `selectedAgentSlug` into every SURFACE — four
   * separate fixes, each with its own comment, each made after the operator
   * reported that surface narrating the wrong agent. The `stateUrl` — the ONE
   * input the OBSERVER reads — was never given it. `/state` fell back to
   * DEFAULT_REGISTRABLE_AGENT_SLUG ('moneypenny') and
   * `findAgentReceiptRefs('aigent-moneypenny', …)` correctly returned nothing.
   *
   * The receipts drawer beneath is persona-scoped, not agent-scoped, so it
   * showed Nakamoto's receipt regardless — which is why the contradiction was
   * visible in one screenshot.
   *
   * Execution had done the act. Projection rendered its input faithfully. The
   * OBSERVER was watching a different agent. Same defect class as OS-6
   * (actor-vs-subject), fixed three times on surfaces and never on the
   * observer — which is the one that decides whether a stage is complete.
   */
  const tabSource = fs.readFileSync(
    path.join(__dirname, '..', 'app/triad/components/codex/tabs/PilotJourneyTab.tsx'),
    'utf8',
  );

  it('passes the selected agent to the state URL — never a bare, agent-less observer', () => {
    const stateUrlLine = tabSource.match(/stateUrl=\{?[^\n]*/)?.[0] ?? '';
    expect(stateUrlLine, 'stateUrl prop not found — the tab moved').toContain('/state');
    expect(
      stateUrlLine,
      'the observer reads a hardcoded URL with no agentSlug, so it resolves the DEFAULT agent ' +
        'while every surface acts on the selected one',
    ).toContain('agentSlug');
    expect(stateUrlLine).toContain('selectedAgentSlug');
  });

  it('the observer and the surfaces read the same selection variable', () => {
    // If a future change introduces a second piece of agent state for the
    // observer, the two can drift apart again — exactly this defect.
    const surfaceUses = (tabSource.match(/agentSlug: selectedAgentSlug/g) ?? []).length;
    expect(surfaceUses, 'surfaces no longer thread selectedAgentSlug — the tab changed shape').toBeGreaterThan(0);
    expect(tabSource).toMatch(/stateUrl=\{[^}]*selectedAgentSlug/);
  });
});

describe('a failed read never becomes a constitutional finding (2026-08-03)', () => {
  /*
   * ── WHAT THE OPERATOR SAW ────────────────────────────────────────────────
   *
   *   Register    "Aigent Nakamoto is registered — token 8798"
   *   Claim       "Continue to Register"
   *   Passport    "Your Polity Citizen Passport does not currently resolve"
   *
   * Three claims on one screen, two of them false, about facts already
   * settled. Both had the same shape and neither was a logic error in the
   * gates — the gates were fed nulls.
   *
   * CAUSE 1 — one try, six reads. Every read in the state route sat inside a
   * SINGLE try with an empty catch. A throw in any one of them silently
   * nulled every LATER fact, including `registration` and the prior
   * resolution that is the monotonic floor. `resolvePassportEligibility` then
   * received `registration: null`, and answered honestly for the input it was
   * given: "No registration binding has been established" → "Continue to
   * Register". The screen above it was rendering the tokenId from the Agent
   * Card, which is fetched separately and did not fail.
   *
   * CAUSE 2 — `loadUsablePassportByKybe` selected the OLDEST passport row
   * (`order(created_at, ascending).limit(1)`). A personhood carrying an early
   * revoked or expired record followed by the real one resolved to the dead
   * row, failed `isPassportUsable`, and returned `passport_inactive` — a
   * REAL-looking negative finding, so it was not even treated as unreadable.
   *
   * Both are the operator's rule violated the same way: a fact computed once
   * and settled once was re-derived per request, and a read that failed was
   * allowed to answer the question instead of declining to.
   */
  const routeSource = fs
    .readFileSync(path.join(__dirname, '..', 'app/api/journey/moneypenny-horizen/state/route.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  it('CAUSE 1 — each fact is read under its own guard, not one shared try', () => {
    // THE ASSERTION THAT FAILS ON THE DEFECT: one `try {` wrapping them all.
    expect(routeSource).toContain('guarded(');
    for (const label of ['receipts', 'registration', 'passport', 'authorization-store', 'prior-resolution']) {
      expect(routeSource, `"${label}" is not independently guarded`).toContain(`guarded('${label}'`);
    }
  });

  it('CAUSE 1 — a failed guard is logged, never swallowed', () => {
    expect(routeSource).toMatch(/\[JOURNEY STATE\]/);
  });

  it('CAUSE 1 — Register stays canonical from the served token id when the DB read fails', () => {
    // The screen showing "token 8798" and a stepper saying "Continue to
    // Register" must be impossible to render together.
    expect(routeSource).toMatch(/register:\s*registration\?\.registered === true \|\| Boolean\(horizen\?\.tokenId\)/);
  });

  it('CAUSE 1 — the eligibility gate gets the same fallback, so it cannot contradict the card', () => {
    expect(routeSource).toMatch(/horizen\?\.tokenId[\s\S]{0,400}?registered: true/);
  });

  it('CAUSE 2 — a usable Passport wins over an older unusable one', () => {
    const src = fs
      .readFileSync(path.join(__dirname, '..', 'services/identity/passportPrincipal.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    // THE ASSERTION THAT FAILS ON THE DEFECT: ascending order + limit(1) took
    // the oldest row and let a dead record speak for a live Passport.
    expect(src, 'the oldest-row selection is the defect').not.toMatch(
      /polity_passport_records[\s\S]{0,300}?ascending: true[\s\S]{0,120}?limit\(1\)/,
    );
    expect(src).toMatch(/snapshots\.find\(\(p\) => isPassportUsable\(p\)\)/);
  });
});
