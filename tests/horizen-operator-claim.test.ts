/**
 * Operator-claim orchestration (services/horizen/operatorClaim.ts) — the I/O
 * seam this session added so the pure `bindAgentIdentity` ceremony
 * (services/horizen/agentBinding.ts) is actually reachable from a route, not
 * only from unit tests.
 *
 * These canaries assert the ORCHESTRATION, not the cryptography or the pure
 * ceremony itself (both already covered by tests/horizen-agent-binding.test.ts
 * and services/identity/walletAliasService.ts's own tests) — I/O calls are
 * mocked so this file stays fast and never touches a network or a database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/identity/walletAliasService', () => ({
  verifyEvmOwnership: vi.fn(),
}));
vi.mock('@/services/delegation/delegationGrantStore', () => ({
  persistAgentIdentityBinding: vi.fn(),
}));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: vi.fn(),
}));
vi.mock('@/services/dvn/activityReceiptDvnPipeline', () => ({
  enqueueActivityReceiptAnchor: vi.fn(),
}));

import { buildOperatorClaimMessage, performOperatorAgentClaim } from '@/services/horizen/operatorClaim';
import { verifyEvmOwnership } from '@/services/identity/walletAliasService';
import { persistAgentIdentityBinding } from '@/services/delegation/delegationGrantStore';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { enqueueActivityReceiptAnchor } from '@/services/dvn/activityReceiptDvnPipeline';
import { currentIdentityRegistry } from '@/services/horizen/agentBinding';

const mockedVerify = verifyEvmOwnership as unknown as ReturnType<typeof vi.fn>;
const mockedPersist = persistAgentIdentityBinding as unknown as ReturnType<typeof vi.fn>;
const mockedReceipt = createActivityReceipt as unknown as ReturnType<typeof vi.fn>;
const mockedEnqueue = enqueueActivityReceiptAnchor as unknown as ReturnType<typeof vi.fn>;

const BASE_REQUEST = {
  runtime: 'metaMe',
  environment: 'development',
  origin: 'https://dev-beta.aigentz.me',
  network: 'base-sepolia' as const,
  tokenId: '7866',
  ownerWallet: '0x1111111111111111111111111111111111111111',
  personaId: 'persona-abc',
  passportId: 'passport-xyz',
  nonce: 'nonce-1',
  issuedAt: '2026-07-30T00:00:00.000Z',
  expiresAt: '2026-07-30T00:10:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildOperatorClaimMessage', () => {
  it('builds a message + claimExpectation for a valid decimal tokenId', () => {
    const result = buildOperatorClaimMessage(BASE_REQUEST);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.message).toContain('metaMe Agent Claim v1');
    expect(result.message).toContain('Token Id: 7866');
    expect(result.claimExpectation.identityRegistry).toBe(currentIdentityRegistry('base-sepolia'));
    // Principal/passport refs are T2 commitments, never the raw ids.
    expect(result.message).not.toContain('persona-abc');
    expect(result.message).not.toContain('passport-xyz');
  });

  it('refuses a synthetic catalogue id rather than inventing a token', () => {
    const result = buildOperatorClaimMessage({ ...BASE_REQUEST, tokenId: 'virtuals:26' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('not-numeric');
  });
});

describe('performOperatorAgentClaim', () => {
  function claimExpectationFor(req = BASE_REQUEST) {
    const built = buildOperatorClaimMessage(req);
    if (!built.ok) throw new Error('fixture setup failed');
    return built;
  }

  it('refuses when the presented signature does not recover to the claimed owner', async () => {
    mockedVerify.mockReturnValue(false);
    const { message, claimExpectation } = claimExpectationFor();

    const result = await performOperatorAgentClaim({
      agentRootDid: 'did:iqube:aigent-moneypenny-root',
      claimExpectation,
      message,
      signature: '0xbad',
      delegationGrantId: 'grant-1',
      claimedRelationship: true,
      acceptedResponsibility: true,
      scopeDefined: true,
      delegationActive: true,
      now: '2026-07-30T00:05:00.000Z',
      personaId: 'persona-abc',
      passportId: 'passport-xyz',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('signature-recovery-failed');
    expect(mockedPersist).not.toHaveBeenCalled();
    expect(mockedReceipt).not.toHaveBeenCalled();
  });

  it('on a valid signature: binds, persists, writes the receipt, and enqueues the DVN anchor', async () => {
    mockedVerify.mockReturnValue(true);
    mockedReceipt.mockResolvedValue({ id: 'receipt-1', actionType: 'partner_agent_evidence_recorded' });
    const { message, claimExpectation } = claimExpectationFor();

    const result = await performOperatorAgentClaim({
      agentRootDid: 'did:iqube:aigent-moneypenny-root',
      claimExpectation,
      message,
      signature: '0xgood',
      delegationGrantId: 'grant-1',
      claimedRelationship: true,
      acceptedResponsibility: true,
      scopeDefined: true,
      delegationActive: true,
      runtimeAdmissionEligible: false,
      now: '2026-07-30T00:05:00.000Z',
      personaId: 'persona-abc',
      passportId: 'passport-xyz',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.binding.status).toBe('active');
    expect(result.binding.facets.ownershipVerified).toBe(true);
    expect(result.binding.facets.operatorRelationshipClaimed).toBe(true);
    expect(result.binding.facets.delegationActive).toBe(true);
    expect(result.binding.facets.runtimeAdmissionEligible).toBe(false);
    expect(result.receiptId).toBe('receipt-1');

    expect(mockedPersist).toHaveBeenCalledTimes(1);
    const persistedArg = mockedPersist.mock.calls[0][0];
    // T0 discipline: the persisted record carries the raw ids (server-internal
    // store), but the RECEIPT below must never see them directly.
    expect(persistedArg.constitutionalAct.personaId).toBe('persona-abc');

    expect(mockedReceipt).toHaveBeenCalledTimes(1);
    const receiptArg = mockedReceipt.mock.calls[0][0];
    expect(receiptArg.actionType).toBe('partner_agent_evidence_recorded');
    expect(receiptArg.personaId).toBe('persona-abc');
    expect(receiptArg.summary).not.toContain('passport-xyz');

    expect(mockedEnqueue).toHaveBeenCalledTimes(1);
    expect(mockedEnqueue.mock.calls[0][1]).toBe('persona-abc');
  });

  it('refuses when the presented claimExpectation does not match the message that was signed (forgery attempt)', async () => {
    mockedVerify.mockReturnValue(true);
    const { message, claimExpectation } = claimExpectationFor();
    const forgedExpectation = { ...claimExpectation, tokenId: '9999' };

    const result = await performOperatorAgentClaim({
      agentRootDid: 'did:iqube:aigent-moneypenny-root',
      claimExpectation: forgedExpectation,
      message, // the ORIGINAL message (signed over tokenId 7866)
      signature: '0xgood',
      delegationGrantId: 'grant-1',
      claimedRelationship: true,
      acceptedResponsibility: true,
      scopeDefined: true,
      delegationActive: true,
      now: '2026-07-30T00:05:00.000Z',
      personaId: 'persona-abc',
      passportId: 'passport-xyz',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // The presented message still says "Token Id: 7866" — verifyAgentClaimMessage
    // catches the forged expectation's field-by-field mismatch before the
    // whole-message reconstruction check ever runs.
    expect(result.reason).toBe('token-mismatch');
    expect(mockedPersist).not.toHaveBeenCalled();
  });

  it('refuses when the constitutional act omits a required proof (e.g. scope not defined is still recorded, but claimedRelationship=false is a real refusal upstream)', async () => {
    // evaluateOperatorClaim only refuses on MISSING proofs, not on false booleans
    // within a present ConstitutionalAct — this test documents that the boolean
    // fields are recorded verbatim rather than gating the bind itself (the
    // pure model's own contract; see agentBinding.ts §9).
    mockedVerify.mockReturnValue(true);
    mockedReceipt.mockResolvedValue({ id: 'receipt-2', actionType: 'partner_agent_evidence_recorded' });
    const { message, claimExpectation } = claimExpectationFor();

    const result = await performOperatorAgentClaim({
      agentRootDid: 'did:iqube:aigent-moneypenny-root',
      claimExpectation,
      message,
      signature: '0xgood',
      delegationGrantId: 'grant-1',
      claimedRelationship: false,
      acceptedResponsibility: true,
      scopeDefined: true,
      delegationActive: true,
      now: '2026-07-30T00:05:00.000Z',
      personaId: 'persona-abc',
      passportId: 'passport-xyz',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.binding.constitutionalAct.claimedRelationship).toBe(false);
  });
});
