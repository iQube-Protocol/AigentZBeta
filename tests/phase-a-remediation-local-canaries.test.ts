/**
 * Phase A Remediation — Local Regression Canaries
 *
 * These tests exercise BRANCH CODE, not the deployed live environment.
 * They guard all six remediation invariants from the four Phase A commits:
 *
 *   Commit 1: agent-generic subjectRef in state route response
 *   Commit 2: registration Standing seed award retired
 *   Commit 3: hidden Deploy prerequisite removed from Standing
 *   Commit 4: SmartWallet completed-act correlation schema seam
 *
 * The companion live smoke tests (phase-a-baseline-canaries.test.ts)
 * test the deployed environment; these guard the branch code itself.
 * Both must pass before any merge.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import { resolveMonotonicJourneyState } from '@/services/journey/stageResolution';
import type { AuthoritativePlatformState } from '@/services/journey/resolveJourneyState';

const ROOT = join(import.meta.dirname, '..');

function readSrc(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf8');
}

// Minimal empty platform state — no evidence for any stage
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

// ─────────────────────────────────────────────────────────────────────────────
// INVARIANT 1 — agent-generic subjectRef (Commit 1)
// ─────────────────────────────────────────────────────────────────────────────
describe('Commit 1 — agent-generic subjectRef in state route response', () => {
  it('route file substitutes agent.slug for state.subjectRef before serializing', () => {
    const route = readSrc('app/api/journey/moneypenny-horizen/state/route.ts');
    // Must contain the agent.slug override in the response shape
    expect(route).toMatch(/subjectRef:\s*agent\.slug/);
  });

  it('JourneyStageRuntimeState type has no subjectRef field (stage-level leakage impossible)', () => {
    const journeyTypes = readSrc('types/journey.ts');
    // Find the JourneyStageRuntimeState interface block
    const match = journeyTypes.match(/interface JourneyStageRuntimeState\s*\{([^}]+)\}/s);
    expect(match).not.toBeNull();
    const interfaceBody = match![1];
    // Confirm subjectRef is NOT in the per-stage runtime type
    expect(interfaceBody).not.toMatch(/subjectRef/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// INVARIANT 2 — registration Standing seed retired (Commit 2)
// ─────────────────────────────────────────────────────────────────────────────
describe('Commit 2 — registration Standing seed award retired', () => {
  it('awardRegistrationStandingSeedIfEligible import is commented out in the state route', () => {
    const route = readSrc('app/api/journey/moneypenny-horizen/state/route.ts');
    // The live import must NOT exist — it must be commented out
    expect(route).not.toMatch(/^import.*awardRegistrationStandingSeedIfEligible/m);
    // The commented form SHOULD exist (audit trail)
    expect(route).toMatch(/\/\/.*awardRegistrationStandingSeedIfEligible/);
  });

  it('award call site is absent from the route (no active call)', () => {
    const route = readSrc('app/api/journey/moneypenny-horizen/state/route.ts');
    // No active (un-commented) call to the award function
    expect(route).not.toMatch(/^\s*await awardRegistrationStandingSeedIfEligible/m);
    expect(route).not.toMatch(/^\s*awardRegistrationStandingSeedIfEligible\(/m);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// INVARIANT 3 — Standing independent of Deploy (Commit 3)
// ─────────────────────────────────────────────────────────────────────────────
describe('Commit 3 — Standing does not gate on Deploy', () => {
  it("Standing stage definition has prerequisites: [] (not ['deploy'] and not undefined)", () => {
    const standingStage = HORIZEN_MONEYPENNY_JOURNEY.stages.find((s) => s.id === 'standing');
    expect(standingStage).toBeDefined();
    expect(standingStage!.prerequisites).toBeDefined();
    expect(Array.isArray(standingStage!.prerequisites)).toBe(true);
    expect(standingStage!.prerequisites).not.toContain('deploy');
    expect(standingStage!.prerequisites).toHaveLength(0);
  });

  it('resolver does not block Standing when Deploy is NOT complete but aigentme IS complete', () => {
    // Platform state: aigentme evidence present; deploy evidence absent
    const resolution = resolveMonotonicJourneyState(
      HORIZEN_MONEYPENNY_JOURNEY,
      emptyPlatformState({
        register: { aigentQubeResolved: true, agentCardPresent: true, agentCapabilityRegistered: true },
        claim: { agentClaimTokenConfirmed: true },
        orient: { orientationCompleted: true },
        passport: { operatorPolityCitizenPassportValid: true, sponsorBinding: true, delegatePassportIssued: true },
        activate: { activationBridgeLinked: true },
        delegate: {
          delegatePassportIssued: true,
          authorizedDelegateBinding: true,
          delegatePrincipalSigned: true,
        },
        aigentme: { aigentMeDeployed: true, aigentMeOperational: true },
        // deploy: empty — no factory ingestion
        standing: { standingGatewayEnabled: true },
      }),
      { subjectAgentRef: 'test-agent', subjectAigentQubeId: null, principalPersonaId: 'test-persona' },
    );

    const standingStatus = stageStatus(resolution, 'standing');
    // Standing must not be BLOCKED by Deploy when standing has its own completion evidence
    expect(standingStatus).not.toBe('BLOCKED_BY_PREREQUISITES');
    expect(standingStatus).toBe('COMPLETE');
  });

  it('resolver does not throw when Standing stage is evaluated (prerequisites: [] safe)', () => {
    // This guards against the runtime crash: stage.prerequisites.every() on undefined
    expect(() => {
      resolveMonotonicJourneyState(
        HORIZEN_MONEYPENNY_JOURNEY,
        emptyPlatformState(),
        { subjectAgentRef: 'test-agent', subjectAigentQubeId: null, principalPersonaId: 'test-persona' },
      );
    }).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// INVARIANT 4 — SmartWallet durable correlation schema seam (Commit 4)
// ─────────────────────────────────────────────────────────────────────────────
describe('Commit 4 — SmartWallet durable correlation schema seam', () => {
  it('SigningRequest type has relatedActivityReceiptId field', () => {
    const signingRequestTypes = readSrc('types/signingRequest.ts');
    expect(signingRequestTypes).toMatch(/relatedActivityReceiptId:\s*string\s*\|\s*null/);
  });

  it('signingRequestStore DbRow has related_activity_receipt_id column', () => {
    const store = readSrc('services/signing/signingRequestStore.ts');
    expect(store).toMatch(/related_activity_receipt_id:\s*string\s*\|\s*null/);
  });

  it('signingRequestStore rowToRecord maps related_activity_receipt_id', () => {
    const store = readSrc('services/signing/signingRequestStore.ts');
    expect(store).toMatch(/relatedActivityReceiptId:\s*row\.related_activity_receipt_id/);
  });

  it('migration file for correlation FK exists', () => {
    const migration = readSrc(
      'supabase/migrations/20260930002700_signing_requests_activity_receipt_correlation.sql',
    );
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS related_activity_receipt_id/);
    expect(migration).toMatch(/REFERENCES public\.activity_receipts\(id\)/);
  });

  it('correlation writer is NOT yet implemented (documents missing pieces)', () => {
    // The approval path does not yet write related_activity_receipt_id.
    // This test documents the gap — it must be replaced (not deleted) when
    // the writer is implemented. A passing test here means the seam exists
    // but the gap is acknowledged. A future commit must flip this to a real
    // writer canary.
    const approveRoute = readSrc('app/api/journey/moneypenny-horizen/state/route.ts');
    // Confirm the field name is NOT yet referenced in the approval/execution path
    // (it's only in the type/store reads). When the writer lands, this assertion
    // must be replaced with a positive test.
    const correlationWriterPattern = /related_activity_receipt_id[^;]*=\s*(await|receipt)/;
    // If this assertion starts failing, the writer has been implemented — update the test.
    expect(approveRoute).not.toMatch(correlationWriterPattern);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CROSS-INVARIANT — resolver does not throw on any agent (not MoneyPenny-specific)
// ─────────────────────────────────────────────────────────────────────────────
describe('Resolver stability — all stages resolve without throwing', () => {
  it('resolves a fully-empty agent without throwing', () => {
    expect(() =>
      resolveMonotonicJourneyState(
        HORIZEN_MONEYPENNY_JOURNEY,
        emptyPlatformState(),
        { subjectAgentRef: 'generic-agent', subjectAigentQubeId: null, principalPersonaId: 'generic-persona' },
      ),
    ).not.toThrow();
  });

  it('all stages have a defined prerequisites array (no undefined runtime crash)', () => {
    for (const stage of HORIZEN_MONEYPENNY_JOURNEY.stages) {
      expect(
        Array.isArray(stage.prerequisites),
        `stage '${stage.id}' has prerequisites: ${JSON.stringify(stage.prerequisites)}`,
      ).toBe(true);
    }
  });
});
