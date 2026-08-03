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
import fs from 'fs';
import path from 'path';

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

describe('an optional partner enrichment never immobilises personhood (2026-08-03)', () => {
  /*
   * ── THE OPERATOR'S RULING ───────────────────────────────────────────────
   *
   *   > "Verify should be the last Horizen dependent stage and then
   *   >  everything else is our own systems."
   *
   * ── THE DEFECT ──────────────────────────────────────────────────────────
   *
   * Claim REFUSED `VERIFY_NOT_COMPLETE` unless BOTH Pulse monitoring and P&L
   * disclosure were authorized. That gate was stricter than the constitution
   * it enforces:
   *
   *   - Marketa's ratified engine sets REFUSAL_RULE_IDS = {003,004,005,006}.
   *     Pulse (MKT-ADM-007) and P&L (MKT-ADM-008) are NOT in it: absent, they
   *     evaluate `missing` (an evidence gap → NOT_RECOMMENDED), never `failed`
   *     and never REFUSED.
   *   - The Verify surface's own copy says authorizing Pulse "does not create
   *     or enlarge her constitutional authority."
   *
   * So a panel invented a prerequisite the constitution does not have. When
   * `partner_authorization_requests` turned out to be missing from the
   * deployed schema, that self-imposed gate escalated a deploy step into a
   * total block on Claim, Passport and delegation.
   */
  const CLAIM_ROUTE = path.join(__dirname, '..', 'app/api/journey/moneypenny-horizen/claim/prove-control/route.ts');
  const ENGINE = path.join(__dirname, '..', 'services/marketa/admissionAssessmentEngine.ts');
  const rawClaimSource = fs.readFileSync(CLAIM_ROUTE, 'utf8');
  /*
   * COMMENTS STRIPPED BEFORE ASSERTING. Three canaries in this session were
   * tripped by their own subject's DOC COMMENT — a comment that explains why
   * a defect was removed necessarily names the defect. Asserting over raw
   * source therefore measures the prose, not the code. Strip once, here.
   */
  const claimSource = rawClaimSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('Claim no longer refuses VERIFY_NOT_COMPLETE — the gate is gone, not renamed', () => {
    // THE ASSERTION THAT FAILS ON THE DEFECT.
    expect(claimSource).not.toContain('VERIFY_NOT_COMPLETE');
    expect(claimSource, 'no surviving hard gate on transparency').not.toMatch(
      /if \(!binding\.transparency\?\.pulse_enabled[\s\S]{0,200}?status: 409/,
    );
  });

  it('the constitutional prerequisites are all still enforced', () => {
    // Loosening the wrong gate must not loosen the right ones.
    for (const code of ['NO_PERSISTED_AIGENTQUBE', 'MISSING_TOKEN_ID', 'NO_CONTROLLER_WALLET']) {
      expect(claimSource, `${code} must still refuse`).toContain(code);
    }
    // Control Before Recommendation: the assessment call is still downstream
    // of a signature that recovered to the registered controller.
    const signAt = claimSource.indexOf('signPartnerAuthorization');
    const assessAt = claimSource.indexOf('runMarketaAdmissionAssessment');
    expect(signAt).toBeGreaterThan(-1);
    expect(assessAt).toBeGreaterThan(signAt);
  });

  it('Pulse/P&L absence is reported as a non-blocking exception, never silently passed', () => {
    expect(claimSource).toContain('nonBlockingExceptions');
    expect(claimSource).toContain('pulse-monitoring-not-authorized');
    expect(claimSource).toContain('pnl-disclosure-not-authorized');
  });

  it('the route is not stricter than the rule engine it calls', () => {
    /*
     * The structural statement of the defect: a surface may not invent a
     * refusal the ratified engine does not have. If MKT-ADM-007/008 are ever
     * ADDED to REFUSAL_RULE_IDS by a governed act, this canary goes red and
     * the gate must be reinstated deliberately — which is the correct
     * direction for that decision to travel.
     */
    const engine = fs.readFileSync(ENGINE, 'utf8');
    const refusalSet = engine.match(/const REFUSAL_RULE_IDS = new Set\(\[([^\]]*)\]\)/);
    expect(refusalSet, 'REFUSAL_RULE_IDS not found — the engine moved').not.toBeNull();
    expect(refusalSet![1]).not.toContain('MKT-ADM-007');
    expect(refusalSet![1]).not.toContain('MKT-ADM-008');
  });
});
