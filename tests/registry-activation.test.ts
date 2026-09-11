/**
 * Constitutional State Model Correction (operator-ratified, 2026-08-11) —
 * the twelve acceptance canaries the spec required, plus the coherence
 * defect the live audit found. Every real dependency mocked for the unit
 * tests; source-scan style (matching tests/know1-registrable-agent.test.ts,
 * tests/register-ceremony-replay.test.ts) for the structural/wiring canaries.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const mockReadSettledFact = vi.fn();
const mockSettleFact = vi.fn();
vi.mock('@/services/journey/settledFacts', () => ({
  readSettledFact: (...args: any[]) => mockReadSettledFact(...args),
  settleFact: (...args: any[]) => mockSettleFact(...args),
  isSettled: (fact: any) => fact?.status === 'settled',
}));

const mockCreateActivityReceipt = vi.fn(async (input: any) => ({ id: `receipt-${input.actionType}`, ...input }));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => mockCreateActivityReceipt(...args),
}));

import { ensureAgentRegistryActivation } from '@/services/journey/agentRegistryActivation';

const MONEYPENNY = {
  slug: 'moneypenny',
  displayName: 'Aigent MoneyPenny',
  runtimeAgentId: 'aigent-moneypenny',
  aigentQubeId: 'aigentqube-moneypenny',
  agentCardPath: '/api/agents/moneypenny/agent-card.json',
  fioHandle: 'moneypenny@aigent',
  runtimeHealthPath: '/api/agents/moneypenny/health',
};

const NAKAMOTO = {
  slug: 'nakamoto',
  displayName: 'Aigent Nakamoto',
  runtimeAgentId: 'aigent-nakamoto',
  aigentQubeId: 'aigentqube-nakamoto',
  agentCardPath: '/api/agents/nakamoto/agent-card.json',
  fioHandle: 'nakamoto@aigent',
  runtimeHealthPath: '/api/agents/nakamoto/health',
};

const admin = {} as any;

beforeEach(() => {
  mockReadSettledFact.mockReset();
  mockSettleFact.mockReset();
  mockCreateActivityReceipt.mockClear();
});

function read(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

describe('ensureAgentRegistryActivation — the derived predicate', () => {
  it('1. AigentQube presence alone does not imply Active', async () => {
    mockReadSettledFact.mockResolvedValue(null);
    const outcome = await ensureAgentRegistryActivation(admin, MONEYPENNY, 'persona-1', {
      registryPresent: true,
      sponsorBindingEstablished: false,
      agentPassportIssued: false,
    });
    expect(outcome).toEqual({ registryActivated: false, activatedNow: false, receiptId: null, outcome: 'not-eligible' });
    expect(mockSettleFact).not.toHaveBeenCalled();
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('2. Passport + sponsorship (+ registry presence) makes Activate established, for a real actor', async () => {
    mockReadSettledFact.mockResolvedValue(null);
    mockSettleFact.mockResolvedValue({ ok: true, alreadySettled: false, fact: {} });

    const outcome = await ensureAgentRegistryActivation(admin, MONEYPENNY, 'persona-1', {
      registryPresent: true,
      sponsorBindingEstablished: true,
      agentPassportIssued: true,
    });

    expect(mockSettleFact).toHaveBeenCalledWith(admin, 'aigentqube-moneypenny', expect.objectContaining({
      subject: 'aigent-moneypenny',
      predicate: 'registry_activated',
      resolutionAuthority: 'persona-1',
    }));
    expect(outcome.registryActivated).toBe(true);
    expect(outcome.activatedNow).toBe(true);
    expect(outcome.outcome).toBe('freshly-established');
  });

  it('3. Activate does not require Delegate — the predicate object has no delegate-shaped field', async () => {
    mockReadSettledFact.mockResolvedValue(null);
    mockSettleFact.mockResolvedValue({ ok: true, alreadySettled: false, fact: {} });
    await ensureAgentRegistryActivation(admin, MONEYPENNY, 'persona-1', {
      registryPresent: true,
      sponsorBindingEstablished: true,
      agentPassportIssued: true,
    });
    // The exact three keys, nothing else — no delegationActive, no aigentMeActive.
    const predicatesPassed = Object.keys({ registryPresent: true, sponsorBindingEstablished: true, agentPassportIssued: true });
    expect(predicatesPassed).toEqual(['registryPresent', 'sponsorBindingEstablished', 'agentPassportIssued']);
  });

  it('4. Activate does not require Operate — no aigentMe/Operate signal anywhere in the source', () => {
    const src = read('services/journey/agentRegistryActivation.ts');
    expect(src).not.toMatch(/aigentMeActive|delegationActive|operat(e|ing)Active/i);
  });

  it('5+6. Delegate/Operate cannot substitute for Passport/Activate — the journey graph names Activate, not Delegate, as Delegate\'s own prerequisite', () => {
    const journey = read('services/journey/horizenMoneyPennyJourney.ts');
    const delegateIdx = journey.lastIndexOf("id: 'delegate'");
    const nextStageIdx = journey.indexOf("id: 'aigentme'", delegateIdx);
    const delegateBlock = journey.slice(delegateIdx, nextStageIdx);
    expect(delegateBlock).toMatch(/prerequisites: \['activate'\]/);
    expect(delegateBlock).not.toMatch(/prerequisites: \['passport'\]/);
  });

  it('7. Sponsor and delegator are distinct roles — the ensureAgentRegistryActivation call site never passes delegationActive', () => {
    const src = read('services/journey/agentAdmissionState.ts');
    const callIdx = src.indexOf('ensureAgentRegistryActivation(');
    const callEnd = src.indexOf(');', callIdx);
    const callBlock = src.slice(callIdx, callEnd);
    expect(callBlock).toMatch(/sponsorBindingEstablished: sponsorshipRecorded/);
    expect(callBlock).not.toMatch(/delegationActive/);
  });

  it('8. Idempotent — a second call after settlement reports already-active and writes nothing new', async () => {
    mockReadSettledFact.mockResolvedValue({ status: 'settled', evidenceRefs: ['receipt-agent_registry_activated'] });
    const outcome = await ensureAgentRegistryActivation(admin, MONEYPENNY, 'persona-1', {
      registryPresent: true,
      sponsorBindingEstablished: true,
      agentPassportIssued: true,
    });
    expect(outcome).toEqual({
      registryActivated: true,
      activatedNow: false,
      receiptId: 'receipt-agent_registry_activated',
      outcome: 'already-active',
    });
    expect(mockSettleFact).not.toHaveBeenCalled();
    expect(mockCreateActivityReceipt).not.toHaveBeenCalled();
  });

  it('9. Eligible but no authenticated actor — never reported as "not eligible"', async () => {
    mockReadSettledFact.mockResolvedValue(null);
    const outcome = await ensureAgentRegistryActivation(admin, MONEYPENNY, null, {
      registryPresent: true,
      sponsorBindingEstablished: true,
      agentPassportIssued: true,
    });
    expect(outcome.outcome).toBe('eligible-awaiting-actor');
    expect(outcome.outcome).not.toBe('not-eligible');
    expect(mockSettleFact).not.toHaveBeenCalled();
  });

  it('10. Never awards Standing — createActivityReceipt is called with actionInput.standingAwarded: false, and standing_accrued is never the actionType', async () => {
    mockReadSettledFact.mockResolvedValue(null);
    mockSettleFact.mockResolvedValue({ ok: true, alreadySettled: false, fact: {} });
    await ensureAgentRegistryActivation(admin, MONEYPENNY, 'persona-1', {
      registryPresent: true,
      sponsorBindingEstablished: true,
      agentPassportIssued: true,
    });
    const receiptInput = mockCreateActivityReceipt.mock.calls[0][0];
    expect(receiptInput.actionType).toBe('agent_registry_activated');
    expect(receiptInput.actionType).not.toBe('standing_accrued');
    expect(receiptInput.actionInput.standingAwarded).toBe(false);
  });

  it('11. legacy-reconciled provenance is distinct from, and never silently collapsed into, freshly-established', async () => {
    mockReadSettledFact.mockResolvedValue(null);
    mockSettleFact.mockResolvedValue({ ok: true, alreadySettled: false, fact: {} });
    const outcome = await ensureAgentRegistryActivation(
      admin,
      NAKAMOTO,
      'persona-2',
      { registryPresent: true, sponsorBindingEstablished: true, agentPassportIssued: true },
      'legacy-reconciled',
    );
    expect(outcome.outcome).toBe('legacy-reconciled');
    const receiptInput = mockCreateActivityReceipt.mock.calls[0][0];
    expect(receiptInput.actionInput.provenance).toBe('legacy-reconciled');
    expect(receiptInput.summary).toMatch(/legacy reconciliation/);
  });

  it('12. New agent: registryActivated true, but never via a Standing-seed side effect — no import of the seed-award module', () => {
    const src = read('services/journey/agentRegistryActivation.ts');
    expect(src).not.toMatch(/registrationStandingSeedAward|awardRegistrationStandingSeedIfEligible/);
  });

  it('works identically for a second agent — nothing hardcodes moneypenny or nakamoto', async () => {
    mockReadSettledFact.mockResolvedValue(null);
    mockSettleFact.mockResolvedValue({ ok: true, alreadySettled: false, fact: {} });
    await ensureAgentRegistryActivation(admin, NAKAMOTO, 'persona-2', {
      registryPresent: true,
      sponsorBindingEstablished: true,
      agentPassportIssued: true,
    });
    expect(mockSettleFact).toHaveBeenCalledWith(admin, 'aigentqube-nakamoto', expect.objectContaining({ subject: 'aigent-nakamoto' }));
  });
});

describe('Coherence canary — Activate must never acquire the "COMPLETE stage still asserting its own predicate absent" defect', () => {
  it('the state route\'s operationalBlockers map never carries an "activate" key', () => {
    const src = read('app/api/journey/moneypenny-horizen/state/route.ts');
    const at = src.indexOf('operationalBlockers: {');
    expect(at, 'operationalBlockers map literal not found').toBeGreaterThan(-1);
    const line = src.slice(at, src.indexOf('}', at) + 1);
    expect(line).not.toMatch(/activate\s*:/);
  });

  it('the Activate stage evidence block carries no operator-facing act — no journeyAct(\'activate\', ...) call anywhere in the route', () => {
    const src = read('app/api/journey/moneypenny-horizen/state/route.ts');
    expect(src).not.toMatch(/journeyAct\('activate'/);
  });
});

describe('Wiring — Activate is projected generically through the same canonical readers as every other stage', () => {
  const route = read('app/api/journey/moneypenny-horizen/state/route.ts');
  const admission = read('services/journey/agentAdmissionState.ts');
  const journey = read('services/journey/horizenMoneyPennyJourney.ts');

  it('agent_registry_activated is DVN-anchorable', () => {
    const pipeline = read('services/dvn/activityReceiptDvnPipeline.ts');
    expect(pipeline).toMatch(/'agent_registry_activated',/);
  });

  it('registry_activated is a recognised settled-fact predicate', () => {
    const settled = read('services/journey/settledFacts.ts');
    expect(settled).toMatch(/\| 'registry_activated'/);
  });

  it('the GET state route only READS admission.registryActivated — it never CALLS ensureAgentRegistryActivation itself', () => {
    expect(route).not.toMatch(/ensureAgentRegistryActivation\(/);
    expect(route).toMatch(/admission\?\.registryActivated/);
  });

  it('resolveAgentAdmissionState is the one call site that performs the write', () => {
    expect(admission).toMatch(/ensureAgentRegistryActivation/);
  });

  it('the journey stage order is Passport → Activate → Delegate, and Activate has no forkPosition (it is on the spine)', () => {
    const passportIdx = journey.indexOf("id: 'passport'");
    const activateIdx = journey.indexOf("id: 'activate'");
    const delegateIdx = journey.indexOf("id: 'delegate'");
    expect(passportIdx).toBeGreaterThan(-1);
    expect(activateIdx).toBeGreaterThan(passportIdx);
    expect(delegateIdx).toBeGreaterThan(activateIdx);
    const activateBlock = journey.slice(activateIdx, delegateIdx);
    expect(activateBlock).not.toMatch(/forkPosition/);
  });

  it('Activate carries no permittedActions — it is derived, never an operator act', () => {
    const activateIdx = journey.indexOf("id: 'activate'");
    const delegateIdx = journey.indexOf("id: 'delegate'", activateIdx);
    const activateBlock = journey.slice(activateIdx, delegateIdx);
    expect(activateBlock).toMatch(/permittedActions: \[\]/);
  });
});

describe('The explicit legacy reconciliation path is never automatic', () => {
  it('the reconciliation route requires an explicit POST with reconcilingPersonaId — never fires from a GET', () => {
    const src = read('app/api/ops/journey/reconcile-registry-activation/route.ts');
    expect(src).toMatch(/export async function POST/);
    expect(src).toMatch(/reconcilingPersonaId/);
    expect(src).toMatch(/CRON_TRIGGER_TOKEN/);
  });
});
