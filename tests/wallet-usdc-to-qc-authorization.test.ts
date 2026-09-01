/**
 * POST /api/wallet/qct/convert/usdc-to-qc — authorization repair
 * (2026-09-01, urgent). Before this fix, the route trusted a body-supplied
 * `personaId` with NO authentication at all: any caller could debit/credit
 * ANY persona's wallet just by naming it in the request body. The wallet
 * subject now resolves EXCLUSIVELY from `getActivePersona(request)` — the
 * same canonical identity-spine resolver every other spine-gated route
 * uses (no new resolver invented) — and a body `personaId` is never read.
 *
 * These tests pin exactly the three failure modes the repair closes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockDebitWalletAsset = vi.fn();
const mockCreditWalletAsset = vi.fn();
vi.mock('@/services/wallet/qctLedgerService', () => ({
  debitWalletAsset: (...args: unknown[]) => mockDebitWalletAsset(...args),
  creditWalletAsset: (...args: unknown[]) => mockCreditWalletAsset(...args),
}));

import { POST } from '@/app/api/wallet/qct/convert/usdc-to-qc/route';

const CALLER_PERSONA_ID = 'persona-caller-real-owner';
const VICTIM_PERSONA_ID = 'persona-someone-elses-wallet';

function requestWithBody(body: Record<string, unknown>): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

describe('POST /api/wallet/qct/convert/usdc-to-qc — authorization repair', () => {
  beforeEach(() => {
    mockGetActivePersona.mockReset();
    mockDebitWalletAsset.mockReset();
    mockCreditWalletAsset.mockReset();
  });

  it('anonymous invocation cannot convert — getActivePersona resolves null, refused 401, no wallet mutation attempted', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await POST(requestWithBody({ usdcAmount: 10 }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(mockDebitWalletAsset).not.toHaveBeenCalled();
    expect(mockCreditWalletAsset).not.toHaveBeenCalled();
  });

  it("supplying somebody else's personaId in the body cannot affect that person's wallet — the SERVER-resolved caller persona is debited/credited instead", async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: CALLER_PERSONA_ID, authProfileId: 'auth-1' });
    mockDebitWalletAsset.mockResolvedValue({ success: true, newBalance: 90, txId: 'tx-debit-1' });
    mockCreditWalletAsset.mockResolvedValue({ success: true, newBalance: 990, txId: 'tx-credit-1' });

    const res = await POST(requestWithBody({ personaId: VICTIM_PERSONA_ID, usdcAmount: 10 }));
    expect(res.status).toBe(200);

    // The victim's id is NEVER passed to either wallet mutation — only the
    // server-resolved caller persona is.
    expect(mockDebitWalletAsset).toHaveBeenCalledWith(
      CALLER_PERSONA_ID,
      'USDC',
      10,
      expect.any(String),
      expect.any(Object),
    );
    expect(mockCreditWalletAsset).toHaveBeenCalledWith(
      CALLER_PERSONA_ID,
      expect.any(String),
      expect.any(Number),
      expect.any(String),
      expect.any(Object),
    );
    for (const call of [...mockDebitWalletAsset.mock.calls, ...mockCreditWalletAsset.mock.calls]) {
      expect(call[0]).not.toBe(VICTIM_PERSONA_ID);
    }
  });

  it('body personaId cannot override the server-resolved persona even when it matches no real persona at all', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: CALLER_PERSONA_ID, authProfileId: 'auth-1' });
    mockDebitWalletAsset.mockResolvedValue({ success: true, newBalance: 90, txId: 'tx-debit-2' });
    mockCreditWalletAsset.mockResolvedValue({ success: true, newBalance: 990, txId: 'tx-credit-2' });

    await POST(requestWithBody({ personaId: 'not-even-a-real-persona-id', usdcAmount: 5 }));

    expect(mockDebitWalletAsset).toHaveBeenCalledWith(CALLER_PERSONA_ID, 'USDC', 5, expect.any(String), expect.any(Object));
  });

  it('a caller with no personaId on the resolved context (malformed spine result) is refused, never falls through to an unauthenticated write', async () => {
    mockGetActivePersona.mockResolvedValue({ authProfileId: 'auth-1' }); // no personaId
    const res = await POST(requestWithBody({ usdcAmount: 10 }));
    expect(res.status).toBe(401);
    expect(mockDebitWalletAsset).not.toHaveBeenCalled();
  });
});
