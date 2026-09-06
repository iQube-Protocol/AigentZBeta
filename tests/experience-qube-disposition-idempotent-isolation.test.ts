/**
 * experienceQubeDispositionService — idempotency + agent isolation (Factor
 * Operate blocker closeout, 2026-09-06).
 *
 * This is the ONE write path that produces the aigentme stage's two
 * completionEvidence receipts (`aigentme_activated`,
 * `experienceqube_focus_disposition_recorded`) — RegisterAgentPanel/
 * AgreementRatifyPanel's own tests already prove the OBSERVER-refresh half
 * of the fix; this file proves the WRITE path's own two hard requirements
 * the operator's review named explicitly:
 *
 *   - retries are idempotent (calling it twice for the same persona+agent
 *     never duplicates the `aigentme_activated` receipt);
 *   - one agent's Operate receipts cannot complete another agent's (the
 *     write and the read are both scoped by `runtimeAgentId`, never bare
 *     `personaId`).
 *
 * An in-memory fake stands in for `activityReceiptService` — this is a
 * service-level unit test, not a route or component test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

interface FakeReceipt {
  id: string;
  personaId: string;
  activeCartridge: string;
  actionType: string;
  summary: string;
  agentsInvoked: string[];
  actionInput?: Record<string, unknown>;
}

let receipts: FakeReceipt[] = [];
let nextId = 1;

const createActivityReceipt = vi.fn(async (input: Omit<FakeReceipt, 'id'>) => {
  const receipt: FakeReceipt = { id: `receipt-${nextId++}`, ...input };
  receipts.push(receipt);
  return receipt;
});

const listActivityReceiptsForPersona = vi.fn(
  async (
    personaId: string,
    opts: { actionTypes: string[]; agentsInvoked: string[]; limit: number },
  ) => {
    return receipts
      .filter(
        (r) =>
          r.personaId === personaId &&
          opts.actionTypes.includes(r.actionType) &&
          r.agentsInvoked.some((a) => opts.agentsInvoked.includes(a)),
      )
      .slice(0, opts.limit);
  },
);

vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: unknown[]) =>
    (createActivityReceipt as unknown as (...a: unknown[]) => unknown)(...args),
  listActivityReceiptsForPersona: (...args: unknown[]) =>
    (listActivityReceiptsForPersona as unknown as (...a: unknown[]) => unknown)(...args),
}));

import {
  recordExperienceQubeDisposition,
  readExperienceQubeDisposition,
} from '@/services/journey/experienceQubeDispositionService';

beforeEach(() => {
  receipts = [];
  nextId = 1;
  createActivityReceipt.mockClear();
  listActivityReceiptsForPersona.mockClear();
});

const PERSONA = 'persona-operator-1';
const FACTOR = 'aigent-factor';
const MONEYPENNY = 'aigent-moneypenny';

describe('recordExperienceQubeDisposition — idempotent activation, one per (persona, agent)', () => {
  it('writes aigentme_activated exactly once across repeated calls for the SAME persona+agent', async () => {
    for (let i = 0; i < 3; i += 1) {
      const result = await recordExperienceQubeDisposition({
        personaId: PERSONA,
        runtimeAgentId: FACTOR,
        agentDisplayName: 'Aigent Factor',
        dispositionSummary: `attempt ${i}`,
        actionInput: { disposition: 'central', domainFocus: 'financial-services' },
      });
      expect(result.ok).toBe(true);
    }

    const activationReceipts = receipts.filter(
      (r) => r.actionType === 'aigentme_activated' && r.agentsInvoked.includes(FACTOR),
    );
    expect(activationReceipts).toHaveLength(1);

    // The disposition receipt itself IS written every call (the caller
    // decides whether "change my answer" re-invokes this) — three attempts,
    // three disposition receipts, per the service's own documented contract.
    const dispositionReceipts = receipts.filter(
      (r) => r.actionType === 'experienceqube_focus_disposition_recorded' && r.agentsInvoked.includes(FACTOR),
    );
    expect(dispositionReceipts).toHaveLength(3);
  });

  it('a real retry (network flake, double-click) never leaves TWO activation receipts for the same agent', async () => {
    const first = await recordExperienceQubeDisposition({
      personaId: PERSONA,
      runtimeAgentId: FACTOR,
      agentDisplayName: 'Aigent Factor',
      dispositionSummary: 'first attempt',
      actionInput: { disposition: 'central' },
    });
    const retry = await recordExperienceQubeDisposition({
      personaId: PERSONA,
      runtimeAgentId: FACTOR,
      agentDisplayName: 'Aigent Factor',
      dispositionSummary: 'retried attempt',
      actionInput: { disposition: 'central' },
    });

    expect(first.ok).toBe(true);
    expect(retry.ok).toBe(true);
    expect(receipts.filter((r) => r.actionType === 'aigentme_activated')).toHaveLength(1);
  });
});

describe('recordExperienceQubeDisposition / readExperienceQubeDisposition — one agent cannot complete another\'s Operate stage', () => {
  it('Factor\'s disposition is invisible to a MoneyPenny-scoped read, and vice versa', async () => {
    await recordExperienceQubeDisposition({
      personaId: PERSONA,
      runtimeAgentId: FACTOR,
      agentDisplayName: 'Aigent Factor',
      dispositionSummary: 'Factor disposition',
      actionInput: { disposition: 'central' },
    });

    const factorRead = await readExperienceQubeDisposition(PERSONA, FACTOR);
    expect(factorRead.aigentMeActive).toBe(true);
    expect(factorRead.dispositionReceipt).not.toBeNull();

    // The SAME persona, but scoped to a DIFFERENT agent that never recorded
    // anything — must read as completely unactivated, never borrowing
    // Factor's receipts because they share a persona.
    const moneypennyRead = await readExperienceQubeDisposition(PERSONA, MONEYPENNY);
    expect(moneypennyRead.aigentMeActive).toBe(false);
    expect(moneypennyRead.dispositionReceipt).toBeNull();
  });

  it('recording BOTH agents under the same persona keeps two independent, non-interfering activation records', async () => {
    await recordExperienceQubeDisposition({
      personaId: PERSONA,
      runtimeAgentId: FACTOR,
      agentDisplayName: 'Aigent Factor',
      dispositionSummary: 'Factor',
      actionInput: { disposition: 'central' },
    });
    await recordExperienceQubeDisposition({
      personaId: PERSONA,
      runtimeAgentId: MONEYPENNY,
      agentDisplayName: 'MoneyPenny',
      dispositionSummary: 'MoneyPenny',
      actionInput: { disposition: 'secondary' },
    });

    const factorRead = await readExperienceQubeDisposition(PERSONA, FACTOR);
    const moneypennyRead = await readExperienceQubeDisposition(PERSONA, MONEYPENNY);
    expect(factorRead.aigentMeActive).toBe(true);
    expect(moneypennyRead.aigentMeActive).toBe(true);
    expect((factorRead.dispositionReceipt?.actionInput as { disposition?: string } | undefined)?.disposition).toBe(
      'central',
    );
    expect(
      (moneypennyRead.dispositionReceipt?.actionInput as { disposition?: string } | undefined)?.disposition,
    ).toBe('secondary');

    // Exactly one activation receipt PER AGENT — never a shared/merged one.
    expect(receipts.filter((r) => r.actionType === 'aigentme_activated')).toHaveLength(2);
  });

  it('a different PERSONA never inherits this persona\'s Factor activation, even for the same agent', async () => {
    await recordExperienceQubeDisposition({
      personaId: PERSONA,
      runtimeAgentId: FACTOR,
      agentDisplayName: 'Aigent Factor',
      dispositionSummary: 'Factor',
      actionInput: { disposition: 'central' },
    });

    const otherPersonaRead = await readExperienceQubeDisposition('persona-operator-2', FACTOR);
    expect(otherPersonaRead.aigentMeActive).toBe(false);
    expect(otherPersonaRead.dispositionReceipt).toBeNull();
  });
});
