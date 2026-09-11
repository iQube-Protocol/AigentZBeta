/**
 * services/horizen/registrationReconciliation.ts — the scheduled reconciler
 * that gives checkAgentRegistrationStatus() independent liveness beyond the
 * browser poll's 160s cap (Horizen Pilot Closure item 1, 2026-08-09). Every
 * real dependency mocked; exercises reconcilePendingAgentRegistrations()
 * directly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindReceiptsByActionType = vi.fn();
const mockFindAgentRegistrationReceipts = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  findReceiptsByActionType: (...args: any[]) => mockFindReceiptsByActionType(...args),
  findAgentRegistrationReceipts: (...args: any[]) => mockFindAgentRegistrationReceipts(...args),
}));

const mockCheckStatus = vi.fn();
const mockResolveOwnerWalletAddress = vi.fn();
vi.mock('@/services/horizen/registrationClient', () => ({
  checkAgentRegistrationStatus: (...args: any[]) => mockCheckStatus(...args),
  resolveAgentOwnerWalletAddress: (...args: any[]) => mockResolveOwnerWalletAddress(...args),
}));

vi.mock('@/services/horizen/registrationConfirmationDeps', () => ({
  buildRegistrationStatusDeps: () => ({ tag: 'shared-deps' }),
}));

import { reconcilePendingAgentRegistrations } from '@/services/horizen/registrationReconciliation';

beforeEach(() => {
  mockFindReceiptsByActionType.mockReset();
  mockFindAgentRegistrationReceipts.mockReset();
  mockCheckStatus.mockReset();
  mockResolveOwnerWalletAddress.mockReset();
  mockResolveOwnerWalletAddress.mockResolvedValue('0xOwner');
  mockFindAgentRegistrationReceipts.mockResolvedValue([]);
});

function submittedReceipt(overrides: Partial<{ personaId: string; agentsInvoked: string[]; actionInput: Record<string, unknown> }> = {}) {
  return {
    id: 'receipt-submitted-1',
    personaId: 'persona-operator-1',
    agentsInvoked: ['aigent-moneypenny'],
    actionInput: { txHash: '0xTX1', network: 'base-sepolia', horizenAgentId: null },
    createdAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('reconcilePendingAgentRegistrations', () => {
  it('is a no-op when nothing is pending', async () => {
    mockFindReceiptsByActionType.mockResolvedValue([]);
    const result = await reconcilePendingAgentRegistrations();
    expect(result.ok).toBe(true);
    expect(result.pendingFound).toBe(0);
    expect(mockCheckStatus).not.toHaveBeenCalled();
  });

  it('skips a submission already confirmed by an earlier check — never re-checks it', async () => {
    mockFindReceiptsByActionType.mockResolvedValue([submittedReceipt()]);
    mockFindAgentRegistrationReceipts.mockResolvedValue([{ receiptId: 'r1', txHash: '0xTX1', network: 'base-sepolia', tokenId: '7', registryAddress: null, ownerAddress: null, createdAt: '2026-08-01T00:05:00.000Z' }]);
    const result = await reconcilePendingAgentRegistrations();
    expect(result.confirmed).toBe(1);
    expect(mockCheckStatus).not.toHaveBeenCalled();
  });

  it('calls checkAgentRegistrationStatus (never broadcast) for a genuinely pending submission, agent-generically', async () => {
    mockFindReceiptsByActionType.mockResolvedValue([submittedReceipt({ agentsInvoked: ['aigent-nakamoto'] })]);
    mockCheckStatus.mockResolvedValue({ ok: true, value: { confirmed: true, confirmationSource: 'on-chain-receipt', tokenId: '3' } });
    const result = await reconcilePendingAgentRegistrations();
    expect(mockCheckStatus).toHaveBeenCalledTimes(1);
    const [input, deps] = mockCheckStatus.mock.calls[0];
    expect(input.agentSlug).toBe('nakamoto'); // resolved from runtimeAgentId, never hardcoded
    expect(input.txHash).toBe('0xTX1');
    expect(deps).toEqual({ tag: 'shared-deps' }); // the SAME deps the interactive route uses — no duplicate confirmation logic
    expect(result.confirmed).toBe(1);
    expect(result.items[0].outcome).toBe('confirmed');
  });

  it('reports still-pending, not a false negative, when Horizen has not confirmed yet', async () => {
    mockFindReceiptsByActionType.mockResolvedValue([submittedReceipt()]);
    mockCheckStatus.mockResolvedValue({ ok: true, value: { confirmed: false } });
    const result = await reconcilePendingAgentRegistrations();
    expect(result.stillPending).toBe(1);
    expect(result.confirmed).toBe(0);
  });

  it('isolates one agent\'s failure — a thrown check does not stop other pending items in the same run', async () => {
    mockFindReceiptsByActionType.mockResolvedValue([
      submittedReceipt({ agentsInvoked: ['aigent-moneypenny'], actionInput: { txHash: '0xTX1', network: 'base-sepolia' } }),
      submittedReceipt({ agentsInvoked: ['aigent-nakamoto'], actionInput: { txHash: '0xTX2', network: 'base-sepolia' } }),
    ]);
    mockCheckStatus.mockImplementation(async (input: any) => {
      if (input.agentSlug === 'moneypenny') throw new Error('Horizen MCP unreachable');
      return { ok: true, value: { confirmed: true, confirmationSource: 'horizen-status', tokenId: '9' } };
    });
    const result = await reconcilePendingAgentRegistrations();
    expect(result.unresolvable).toBe(1);
    expect(result.confirmed).toBe(1);
    expect(result.items).toHaveLength(2);
  });

  it('skips, rather than throws, a submitted receipt missing agentsInvoked or txHash', async () => {
    mockFindReceiptsByActionType.mockResolvedValue([submittedReceipt({ agentsInvoked: [], actionInput: {} })]);
    const result = await reconcilePendingAgentRegistrations();
    expect(result.skipped).toBe(1);
    expect(mockCheckStatus).not.toHaveBeenCalled();
  });
});
