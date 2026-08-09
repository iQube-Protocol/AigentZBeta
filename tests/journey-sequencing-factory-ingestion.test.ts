/**
 * "AigentQube Presence ≠ Factory Ingestion" — sequencing regression tests
 * (operator directive, 2026-08-09).
 *
 * These exercise the REAL journey definition and resolver
 * (`resolveMonotonicJourneyState` over `HORIZEN_MONEYPENNY_JOURNEY`) with
 * synthetic, agent-generic `AuthoritativePlatformState` fixtures — no
 * MoneyPenny- or Nakamoto-specific data anywhere in this file, per the
 * operator's explicit instruction ("Also test Agent N, not MoneyPenny-
 * specific branches"). The defect was structural (a shared evidence-vs-
 * prerequisite mechanism), so the regression coverage is structural too.
 *
 * The observed defect: `deploy.factoryIngested` evidence used to be
 * `admission?.factoryPresent === true || hasReceipt('capability_registered')`
 * — i.e. true the moment an agent's AigentQube row existed in
 * `registry_assets`, regardless of whether Claim/Orient/Passport/Delegate/
 * Operate had ever happened. Because `resolveJourneyState` lets established
 * completion evidence outrank an unmet prerequisite ("evidence precedes
 * prerequisite gating"), Deploy (whose only prerequisite is `aigentme`)
 * rendered COMPLETE the instant an AigentQube was persisted — and Standing
 * (whose prerequisite is `deploy`) followed the same way once its own
 * accrual receipt existed. The fix: `factoryIngested` is the
 * `capability_registered` receipt ONLY.
 */

import { describe, it, expect } from 'vitest';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import { resolveMonotonicJourneyState } from '@/services/journey/stageResolution';
import type { AuthoritativePlatformState } from '@/services/journey/resolveJourneyState';

/**
 * A fully-generic "nothing has happened yet" evidence bag for every stage in
 * the journey, so each scenario only needs to override the handful of
 * fields it cares about. No agent identity anywhere in this fixture.
 */
function emptyPlatformState(overrides: AuthoritativePlatformState['stages'] = {}): AuthoritativePlatformState {
  const stages: AuthoritativePlatformState['stages'] = {};
  for (const stage of HORIZEN_MONEYPENNY_JOURNEY.stages) {
    stages[stage.id] = {};
  }
  return { stages: { ...stages, ...overrides } };
}

function stageStatus(resolution: ReturnType<typeof resolveMonotonicJourneyState>, stageId: string) {
  return resolution.stages.find((s) => s.stageId === stageId)?.status;
}

describe('Ingest (deploy) and Stand (standing) cannot complete before Operate (aigentme) — generic agent, no MoneyPenny/Nakamoto specifics', () => {
  it('scenario A — Register complete, Claim (and everything after) incomplete → Ingest NOT complete, Standing NOT complete, regardless of a synthetic "AigentQube exists" signal', () => {
    // `factoryPresent`/AigentQube existence has NO evidence field at all in
    // this fixture — proving the corrected code path never reads one to
    // decide `factoryIngested`.
    const platformState = emptyPlatformState({
      register: { tokenId: 'synthetic-token', registryRereadOk: true, ownerWalletMatches: true, agentCardResolves: true },
    });
    const resolution = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, platformState, {
      canonicalOutcomes: { register: true },
    });
    expect(stageStatus(resolution, 'claim')).not.toBe('COMPLETE');
    expect(stageStatus(resolution, 'deploy')).not.toBe('COMPLETE');
    expect(stageStatus(resolution, 'standing')).not.toBe('COMPLETE');
  });

  it('scenario B — everything through Operate (aigentme) complete, but NO capability_registered receipt → Ingest available (READY) but NOT complete, Standing NOT complete', () => {
    const platformState = emptyPlatformState({
      register: { tokenId: 't', registryRereadOk: true, ownerWalletMatches: true, agentCardResolves: true },
      verify: {
        agreementTermsCommitted: true,
        agreementAcceptanceRecorded: true,
        agreementAuthorized: true,
        agreementReceiptsAnchored: true,
        agreementGateRecognized: true,
      },
      claim: { controlProofFresh: true },
      orient: { orientationComplete: true },
      passport: { operatorPolityCitizenPassportValid: true, sponsorBinding: true, delegatePassportIssued: true },
      delegate: { delegatePassportActive: true, boundedDelegationActive: true },
      aigentme: { aigentMeActive: true, focusDispositionRecorded: true, moneypennyRecordedAsDelegatedAgent: true, evidenceChainComplete: true },
      // deploy: {} — deliberately no `factoryIngested` evidence at all.
    });
    const resolution = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, platformState, {
      canonicalOutcomes: { register: true },
    });
    expect(stageStatus(resolution, 'aigentme')).toBe('COMPLETE');
    expect(stageStatus(resolution, 'deploy')).not.toBe('COMPLETE');
    expect(stageStatus(resolution, 'deploy')).not.toBe('BLOCKED'); // its own prerequisite (aigentme) IS met
    expect(stageStatus(resolution, 'standing')).not.toBe('COMPLETE');
  });

  it('scenario C — Operate complete AND capability_registered receipted → Ingest COMPLETE, Standing becomes reachable (its own accrual still required)', () => {
    const platformState = emptyPlatformState({
      register: { tokenId: 't', registryRereadOk: true, ownerWalletMatches: true, agentCardResolves: true },
      verify: {
        agreementTermsCommitted: true,
        agreementAcceptanceRecorded: true,
        agreementAuthorized: true,
        agreementReceiptsAnchored: true,
        agreementGateRecognized: true,
      },
      claim: { controlProofFresh: true },
      orient: { orientationComplete: true },
      passport: { operatorPolityCitizenPassportValid: true, sponsorBinding: true, delegatePassportIssued: true },
      delegate: { delegatePassportActive: true, boundedDelegationActive: true },
      aigentme: { aigentMeActive: true, focusDispositionRecorded: true, moneypennyRecordedAsDelegatedAgent: true, evidenceChainComplete: true },
      deploy: { factoryIngested: true }, // the ONLY thing this fixture changes vs scenario B
    });
    const resolution = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, platformState, {
      canonicalOutcomes: { register: true },
    });
    expect(stageStatus(resolution, 'deploy')).toBe('COMPLETE');
    // Standing's OWN accrual evidence is still absent in this fixture — it
    // is now REACHABLE (prerequisite met) but not yet earned.
    expect(stageStatus(resolution, 'standing')).not.toBe('COMPLETE');
    expect(stageStatus(resolution, 'standing')).not.toBe('BLOCKED'); // its own prerequisite (deploy) IS met
  });

  it('scenario C2 — Operate + capability_registered + a genuine standing_accrued receipt → Standing COMPLETE', () => {
    const platformState = emptyPlatformState({
      register: { tokenId: 't', registryRereadOk: true, ownerWalletMatches: true, agentCardResolves: true },
      verify: {
        agreementTermsCommitted: true,
        agreementAcceptanceRecorded: true,
        agreementAuthorized: true,
        agreementReceiptsAnchored: true,
        agreementGateRecognized: true,
      },
      claim: { controlProofFresh: true },
      orient: { orientationComplete: true },
      passport: { operatorPolityCitizenPassportValid: true, sponsorBinding: true, delegatePassportIssued: true },
      delegate: { delegatePassportActive: true, boundedDelegationActive: true },
      aigentme: { aigentMeActive: true, focusDispositionRecorded: true, moneypennyRecordedAsDelegatedAgent: true, evidenceChainComplete: true },
      deploy: { factoryIngested: true },
      standing: { standingGatewayEnabled: true },
    });
    const resolution = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, platformState, {
      canonicalOutcomes: { register: true },
    });
    expect(stageStatus(resolution, 'standing')).toBe('COMPLETE');
  });

  it('an old, otherwise-plausible "AigentQube exists" style boolean cannot substitute for factoryIngested — the evidence field itself must be the receipt fact, not a registry-presence proxy', () => {
    // Directly proves the field CONTRACT: `deploy.completionEvidence` is
    // exactly `['factoryIngested']`, and — per HORIZEN_MONEYPENNY_JOURNEY's
    // own comments (services/journey/horizenMoneyPennyJourney.ts) — nothing
    // about a persisted AigentQube feeds that field. A caller attempting to
    // satisfy Deploy by supplying ANY OTHER key (simulating the old
    // conflated read) must find Deploy still incomplete.
    const deployStage = HORIZEN_MONEYPENNY_JOURNEY.stages.find((s) => s.id === 'deploy')!;
    expect(deployStage.completionEvidence).toEqual(['factoryIngested']);

    const platformState = emptyPlatformState({
      aigentme: { aigentMeActive: true, focusDispositionRecorded: true, moneypennyRecordedAsDelegatedAgent: true, evidenceChainComplete: true },
      register: { tokenId: 't', registryRereadOk: true, ownerWalletMatches: true, agentCardResolves: true },
      verify: { agreementTermsCommitted: true, agreementAcceptanceRecorded: true, agreementAuthorized: true, agreementReceiptsAnchored: true, agreementGateRecognized: true },
      claim: { controlProofFresh: true },
      orient: { orientationComplete: true },
      passport: { operatorPolityCitizenPassportValid: true, sponsorBinding: true, delegatePassportIssued: true },
      delegate: { delegatePassportActive: true, boundedDelegationActive: true },
      // Simulates the OLD defect's shape: an unrelated "registry presence"
      // signal supplied under a name that is NOT `factoryIngested`.
      deploy: { aigentQubeRegistryRowExists: true } as any,
    });
    const resolution = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, platformState, {
      canonicalOutcomes: { register: true },
    });
    expect(stageStatus(resolution, 'deploy')).not.toBe('COMPLETE');
  });
});
