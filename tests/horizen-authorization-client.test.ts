/**
 * services/horizen/authorizationClient.ts — GJR-VFY-001 Phase 1 orchestration.
 *
 * Exercises the full injected-fixture pipeline the operator's Phase 1 ruling
 * specifies as the acceptance criterion:
 *
 *   injected MCP schema discovered -> authorization request prepared ->
 *   subject/network/signer cross-checked -> signature produced without
 *   exposing key material -> submission fixture accepted -> authoritative
 *   reread confirmed -> receipt written
 *
 * plus the required refusal canaries this phase actually implements: missing
 * token id, registry owner mismatch, expired/replayed request (nonce reuse),
 * invalid signature (signer mismatch), partner mutation not confirmed, and
 * tool-not-found (never fabricate a partner mutation). "Changed Agent Card
 * hash" is deliberately NOT exercised here — that check requires a live
 * Agent Card reread, which is Phase 2 scope (Verify surface composition),
 * not Phase 1 (shared signing substrate).
 *
 * The persistence store and receipt writer are mocked with a simple
 * in-memory Map — no Supabase, no network — mirroring the injection
 * conventions already established by services/horizen/client.ts's
 * `fetchImpl` and tests/independent-review-publish.test.ts's fake admin.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';

// ── In-memory fake for partnerAuthorizationStore ────────────────────────────
const rows = new Map<string, any>();
const usedNonces = new Set<string>();

vi.mock('@/services/horizen/partnerAuthorizationStore', () => ({
  createPartnerAuthorizationRequest: vi.fn(async (input: any) => {
    // Trigger fixture for the LOCAL_PERSISTENCE_FAILED pass-through canary
    // below — mirrors a real schema-drift INSERT failure without touching
    // Supabase.
    if (input.authorizationId === 'auth-local-persistence-fails') {
      return {
        ok: false,
        refusalCode: 'LOCAL_PERSISTENCE_FAILED',
        detail: `Authorization was not submitted to Horizen because MetaMe could not create its local authorization record: Could not find the 'agent_id' column of 'partner_authorization_requests' in the schema cache`,
      };
    }
    if (input.authorizationId === 'auth-already-in-flight') {
      return {
        ok: false,
        refusalCode: 'AUTHORIZATION_ALREADY_IN_FLIGHT',
        detail: `authorization "${input.authorizationId}" already exists in state SUBMITTED`,
        existingState: 'SUBMITTED',
      };
    }
    const nonceKey = `${input.partner}:${input.nonce}`;
    if (usedNonces.has(nonceKey)) {
      return { ok: false, refusalCode: 'NONCE_MISSING_OR_REPLAYED', detail: `nonce "${input.nonce}" already used` };
    }
    usedNonces.add(nonceKey);
    // Mirrors the real store's collision handling (partnerAuthorizationStore.ts)
    // closely enough for tests that assert on wasReset/previousIssuedAt/
    // previousNonce — a row already existing under this deterministic id is
    // a RESET (retry for the same agent), never a fresh insert.
    const existing = rows.get(input.authorizationId);
    const wasReset = existing !== undefined;
    const record = { ...input, state: 'PREPARED', signerAddress: null, signatureRef: null, submissionRef: null, partnerStatus: null, receiptRef: null, refusalCode: null, refusalDetail: null, payloadHash: null, createdAt: 'now', updatedAt: 'now' };
    rows.set(input.authorizationId, record);
    return { ok: true, record, wasReset, previousIssuedAt: existing?.issuedAt ?? null, previousNonce: existing?.nonce ?? null };
  }),
  getPartnerAuthorizationRequest: vi.fn(async (id: string) => rows.get(id) ?? null),
  // The ceremony now probes the store BEFORE calling Horizen (operator,
  // 2026-08-03: a local prerequisite is checked locally). The mock store is
  // by definition available.
  checkAuthorizationStoreAvailable: vi.fn(async () => ({ available: true })),
  updatePartnerAuthorizationRequest: vi.fn(async (id: string, patch: any) => {
    const existing = rows.get(id);
    if (!existing) throw new Error(`no row for ${id}`);
    const updated = { ...existing, ...patch };
    rows.set(id, updated);
    return updated;
  }),
}));

// Keyed store backing BOTH mocks below, so a receipt written by
// createActivityReceipt can be read back by getActivityReceiptActionInput —
// exercising the real write-then-read round trip
// getPulseAuthorizationEvidence/reconcilePulseConstitutionalState depend on,
// never just asserting the write happened. Numbered sequentially so the
// FIRST receipt in any test keeps the pre-existing 'receipt-1' id every
// existing assertion already expects.
const receiptStore = new Map<string, any>();
let receiptCounter = 0;
const createActivityReceipt = vi.fn(async (input: any) => {
  receiptCounter += 1;
  const record = { id: `receipt-${receiptCounter}`, ...input };
  receiptStore.set(record.id, record);
  return record;
});
const getActivityReceiptActionInput = vi.fn(async (id: string) => receiptStore.get(id)?.actionInput ?? null);
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => createActivityReceipt(...args),
  getActivityReceiptActionInput: (...args: any[]) => getActivityReceiptActionInput(...args),
}));

import {
  prepareHorizenTransparencyAuthorization,
  signHorizenTransparencyAuthorization,
  runHorizenTransparencyAuthorization,
  verifyHorizenTransparencyActivation,
  verifySignatureIntegrity,
  parseLabelledMessageFields,
  buildFieldParityTable,
  pulseBuildCandidates,
  pulseStatusCandidates,
  detectPulseArgumentDrift,
  RECONCILABLE_STATES,
  getPulseAuthorizationEvidence,
  reconcilePulseConstitutionalState,
  type PrepareHorizenTransparencyAuthorizationInput,
} from '@/services/horizen/authorizationClient';
import {
  matchSchemaFields,
  missingRequiredFields,
  classifyPulseEnrollmentState,
  classifyPulseEnrollmentStateAuthoritative,
  extractStructuredPulseOnboardingFields,
} from '@/services/horizen/mcpSchemaMatch';
import { HORIZEN_NETWORK_FACTS } from '@/services/horizen/identity';

const WALLET = ethers.Wallet.createRandom();
const FIXED_NOW = () => new Date('2026-07-31T12:00:00.000Z');

/**
 * `enable_pulse_monitoring`'s schema, copied from the LIVE server (2026-08-04
 * diagnostic, al / Horizen brief) — required: agentId, name, endpoint,
 * walletAddress, signature, issuedAt; chain optional. There is no `message`
 * property on the real tool at all.
 */
const REAL_ENABLE_PULSE_SCHEMA = {
  properties: {
    agentId: {}, name: {}, endpoint: {}, healthPath: {}, walletAddress: {}, signature: {}, issuedAt: {}, chain: {},
  },
  required: ['agentId', 'name', 'endpoint', 'walletAddress', 'signature', 'issuedAt'],
};

function fakeMcpClient(
  overrides: Partial<{
    tools: any[];
    buildMessage: string;
    submissionRef: string;
    statusText: string;
    /**
     * Per-call get_onboarding_status text, indexed by call order — call #1 is
     * ALWAYS the pre-submit read `crossCheckRegistryOwner` makes for its own
     * owner cross-check (2026-08-07: also now consulted by the pre-submit
     * Pulse status gate), call #2+ are the post-submit reread(s). The LAST
     * entry repeats for any call beyond the array's length. Falls back to the
     * single `statusText` (or its own default) for every call when omitted —
     * every test that predates this option is unaffected.
     */
    statusTextSequence: string[];
    enableResult: any;
  }> = {},
) {
  const tools = overrides.tools ?? [
    { name: 'build_pulse_auth_message', inputSchema: { properties: { tokenId: {}, network: {}, wallet: {} } } },
    { name: 'enable_pulse_monitoring', inputSchema: REAL_ENABLE_PULSE_SCHEMA },
    { name: 'get_onboarding_status', inputSchema: { properties: { tokenId: {}, submissionRef: {} } } },
  ];
  // Must embed a parseable issuedAt — extractIssuedAt reads it from the
  // message text itself, never generates one (al / Horizen brief, 2026-08-04).
  const buildMessage =
    overrides.buildMessage ??
    'Sign this message... then call enable_pulse_monitoring with the signature and issuedAt="2026-07-31T12:00:00.000Z".\n' +
      'ASR Pulse enable\nAgent: 1234\nIssued At: 2026-07-31T12:00:00.000Z';
  const submissionRef = overrides.submissionRef ?? '0xsubmission123';
  const statusText = overrides.statusText ?? '{"status":"active"}';
  let statusCallCount = 0;
  return {
    listTools: vi.fn(async () => ({ tools })),
    callTool: vi.fn(async ({ name }: { name: string }) => {
      if (name === 'build_pulse_auth_message') return { content: [{ type: 'text', text: JSON.stringify({ message: buildMessage }) }] };
      if (name === 'enable_pulse_monitoring') {
        if (overrides.enableResult) return overrides.enableResult;
        return { content: [{ type: 'text', text: JSON.stringify({ submissionRef }) }] };
      }
      if (name === 'get_onboarding_status') {
        statusCallCount += 1;
        const text = overrides.statusTextSequence
          ? overrides.statusTextSequence[Math.min(statusCallCount, overrides.statusTextSequence.length) - 1]
          : statusText;
        return { content: [{ type: 'text', text }] };
      }
      throw new Error(`unexpected tool call: ${name}`);
    }),
  };
}

function fakeFetchRegistryAgent(owner: string) {
  return vi.fn(async () => ({ ok: true as const, ready: true, value: { owner } }));
}

function baseInput(overrides: Partial<PrepareHorizenTransparencyAuthorizationInput> = {}): PrepareHorizenTransparencyAuthorizationInput {
  return {
    authorizationId: `auth-${Math.random().toString(36).slice(2)}`,
    actorPersonaId: 'persona-operator-1',
    aigentQubeId: 'aigentqube-moneypenny',
    agentCardHash: 'sha256-card-hash',
    controllerWallet: WALLET.address,
    keyRef: 'aigent-moneypenny',
    registry: { network: 'base-sepolia', tokenId: '1234' },
    scope: ['pulse-monitoring', 'pnl-disclosure'],
    agentDisplayName: 'Aigent Test',
    pulseEndpoint: 'https://example.test/health',
    ...overrides,
  };
}

beforeEach(() => {
  rows.clear();
  usedNonces.clear();
  createActivityReceipt.mockClear();
  getActivityReceiptActionInput.mockClear();
  receiptStore.clear();
  receiptCounter = 0;
});

describe('runHorizenTransparencyAuthorization — full pipeline (Phase 1 acceptance criterion)', () => {
  it('discovers tools, prepares, signs without exposing key material, submits, confirms, and writes the receipt', async () => {
    // Pre-submit read: neutral (agent not yet enrolled — this test exercises
    // the FULL sign+submit ceremony, per its own name). Post-submit reread:
    // the original default, which confirms.
    const mcpClient = fakeMcpClient({ statusTextSequence: ['{"status":"unrelated"}', '{"status":"active"}'] });
    const result = await runHorizenTransparencyAuthorization(baseInput(), {
      mcpClient,
      fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.receiptRef).toBe('receipt-1');

    expect(mcpClient.listTools).toHaveBeenCalled();
    // horizen_pulse_authorized (primary) + pulse_enrollment_verified (the
    // fine-grained constitutional transition, 2026-08-08) — no
    // pulse_commitment_verified here since this fixture's status text
    // carries no structured pulseCommitmentRecorded field.
    expect(createActivityReceipt).toHaveBeenCalledTimes(2);
    const receiptCall = createActivityReceipt.mock.calls[0][0];
    expect(receiptCall.actionType).toBe('horizen_pulse_authorized');
    expect(receiptCall.personaId).toBe('persona-operator-1');
    expect(createActivityReceipt.mock.calls[1][0].actionType).toBe('pulse_enrollment_verified');

    const finalRow = rows.get(result.value.authorizationId);
    expect(finalRow.state).toBe('CONFIRMED');
    // The signature commitment is stored, never the raw signature or the key.
    expect(finalRow.signatureRef).toHaveLength(64); // sha256 hex
    expect(JSON.stringify(finalRow)).not.toContain(WALLET.privateKey.slice(2));
  });
});

describe('the diagnostic executes the path it claims to diagnose (2026-08-03)', () => {
  /*
   * `scripts/horizen-pulse-diagnostic.ts` exists so we stop inferring what
   * Horizen wants. It then hand-rolled its own argument literal — sending
   * `wallet` where the schema requires `walletAddress` — and reported
   * `walletAddress Required` as though the client had that defect. It does
   * not: `matchSchemaFields` matches on containment, so `walletAddress`
   * selects the `wallet` candidate.
   *
   * A diagnostic that does not run the real path returns confident WRONG
   * answers, which is worse than returning none. These canaries pin that the
   * argument set has exactly one definition and that the containment match
   * genuinely covers Horizen's declared field name.
   */
  const diagnostic = fs.readFileSync(path.join(__dirname, '..', 'scripts/horizen-pulse-diagnostic.ts'), 'utf8');

  it('the diagnostic imports the shared candidate builder rather than defining its own', () => {
    expect(diagnostic).toContain('pulseBuildCandidates');
    expect(diagnostic).toContain('matchSchemaFields');
    expect(diagnostic, 'a second hand-rolled argument literal is the defect returning').not.toMatch(
      /const args = \{[^}]*action:/,
    );
  });

  it("supplies Horizen's declared `walletAddress`, which is what the failed run was really about", () => {
    // The real schema, copied from the live server 2026-08-03: required are
    // action, agentId, walletAddress; chain is optional; there is no `network`.
    const schema = {
      properties: { action: {}, agentId: {}, walletAddress: {}, chain: {} },
      required: ['action', 'agentId', 'walletAddress'],
    };
    const args = matchSchemaFields(schema, pulseBuildCandidates(HORIZEN_NETWORK_FACTS['base-sepolia'], '8798', '0xABCD'));

    expect(missingRequiredFields(schema, args)).toEqual([]);
    expect(args.walletAddress).toBe('0xabcd');
    expect(args.agentId).toBe('8798');
    expect(args.chain).toBe('base-sepolia');
    // `network` is not a declared property — offering it must not smuggle it in.
    expect(args).not.toHaveProperty('network');
  });
});

describe('the composed ceremony pays its remote costs ONCE (2026-08-03)', () => {
  /*
   * WHY THIS EXISTS: the operator's Verify button returned an EMPTY response
   * body — `Failed to execute 'json' on 'Response': Unexpected end of JSON
   * input` — which is a handler killed before it could write, i.e. a timeout.
   *
   * The pipeline's own shape was part of the cost. `prepare`, `submit` and
   * `verify` each independently discover tools, so a full run made THREE
   * `listTools` round trips (and, uninjected, three separate transport
   * connections) for a tool set that cannot change inside one ceremony.
   *
   * THIS CANARY FAILS AGAINST THE HISTORICAL DEFECT (OS-9): run against the
   * pre-fix client it observes 3 calls, not 1.
   *
   * WHAT IT DOES NOT COVER, stated rather than implied: the connection count.
   * That path only runs when NO client is injected, and every test here
   * injects one. The connection saving is asserted by reading
   * `shareOneConnection`'s single `defaultMcpClient()` call site, not by this.
   */
  it('discovers the partner tool set exactly once across prepare, submit and verify', async () => {
    const mcpClient = fakeMcpClient();
    const result = await runHorizenTransparencyAuthorization(baseInput(), {
      mcpClient,
      fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });

    expect(result.ok).toBe(true);
    expect(mcpClient.listTools).toHaveBeenCalledTimes(1);
  });

  it('still lets each stage discover tools on its own — sharing must not break independent use', async () => {
    // The stages are driven one at a time elsewhere (and by Phase 1's own
    // tests). Sharing was added by WRAPPING the client in the composed path,
    // precisely so a stage called alone keeps working unchanged.
    const mcpClient = fakeMcpClient();
    const prepared = await prepareHorizenTransparencyAuthorization(baseInput(), { mcpClient, now: FIXED_NOW });
    expect(prepared.ok).toBe(true);
    expect(mcpClient.listTools).toHaveBeenCalledTimes(1);
  });
});

describe('required refusal canaries', () => {
  it('missing token ID', async () => {
    const result = await prepareHorizenTransparencyAuthorization(
      baseInput({ registry: { network: 'base-sepolia', tokenId: '' } }),
      { mcpClient: fakeMcpClient() },
    );
    expect(result).toMatchObject({ ok: false, refusalCode: 'MISSING_TOKEN_ID' });
  });

  it('tool not found — never fabricates a partner mutation', async () => {
    const result = await prepareHorizenTransparencyAuthorization(baseInput(), {
      mcpClient: fakeMcpClient({ tools: [{ name: 'totally_unrelated', inputSchema: { properties: {} } }] }),
    });
    expect(result).toMatchObject({ ok: false, refusalCode: 'HORIZEN_AUTHORIZATION_TOOL_NOT_FOUND' });
  });

  it('expired/replayed signing request — a reused nonce is refused', async () => {
    const deps = { mcpClient: fakeMcpClient(), now: FIXED_NOW, randomNonce: () => 'fixed-nonce-for-replay-test' };
    const input1 = baseInput({ authorizationId: 'auth-replay-1' });
    const first = await prepareHorizenTransparencyAuthorization(input1, deps);
    expect(first.ok).toBe(true);

    const input2 = baseInput({ authorizationId: 'auth-replay-2' });
    const second = await prepareHorizenTransparencyAuthorization(input2, deps);
    expect(second).toMatchObject({ ok: false, refusalCode: 'NONCE_MISSING_OR_REPLAYED' });
  });

  it('local persistence failure (e.g. schema drift) passes its OWN refusalCode through verbatim — never mislabeled as a nonce replay, never a thrown error (al, 2026-08-04)', async () => {
    const result = await prepareHorizenTransparencyAuthorization(
      baseInput({ authorizationId: 'auth-local-persistence-fails' }),
      { mcpClient: fakeMcpClient(), now: FIXED_NOW },
    );
    expect(result).toMatchObject({
      ok: false,
      refusalCode: 'LOCAL_PERSISTENCE_FAILED',
      detail: expect.stringContaining('Authorization was not submitted to Horizen'),
    });
    // The defect this closes: the caller used to hardcode
    // NONCE_MISSING_OR_REPLAYED for ANY createPartnerAuthorizationRequest
    // failure, regardless of what the store actually reported.
    expect(result).not.toMatchObject({ refusalCode: 'NONCE_MISSING_OR_REPLAYED' });
  });

  it('AUTHORIZATION_ALREADY_IN_FLIGHT also passes through verbatim — the fix generalises to every store refusal code, not just one', async () => {
    const result = await prepareHorizenTransparencyAuthorization(
      baseInput({ authorizationId: 'auth-already-in-flight' }),
      { mcpClient: fakeMcpClient(), now: FIXED_NOW },
    );
    expect(result).toMatchObject({ ok: false, refusalCode: 'AUTHORIZATION_ALREADY_IN_FLIGHT' });
  });

  it('invalid signature — signer does not match the registered controller', async () => {
    const other = ethers.Wallet.createRandom();
    // Pre-submit read: neutral — this test isolates a key-custody mismatch,
    // never reaches submission, and must not be short-circuited by the
    // pre-submit Pulse status gate reading the default fixture as enrolled.
    const mcpClient = fakeMcpClient({ statusText: '{"status":"unrelated"}' });
    const result = await runHorizenTransparencyAuthorization(baseInput({ controllerWallet: other.address }), {
      mcpClient,
      // The ownership check now runs BEFORE signing (2026-08-04) — set the
      // registry owner to match the declared controllerWallet so THIS test
      // still isolates the thing it actually tests: a key-custody mismatch
      // (resolveSigningKey resolves a DIFFERENT wallet than the one declared
      // as the controller), independent of registry truth.
      fetchRegistryAgent: fakeFetchRegistryAgent(other.address),
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    expect(result).toMatchObject({ ok: false, refusalCode: 'SIGNING_FAILED' });
  });

  it('registry owner mismatch', async () => {
    const stranger = ethers.Wallet.createRandom();
    const result = await runHorizenTransparencyAuthorization(baseInput(), {
      mcpClient: fakeMcpClient(),
      fetchRegistryAgent: fakeFetchRegistryAgent(stranger.address),
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    expect(result).toMatchObject({ ok: false, refusalCode: 'REGISTRY_OWNER_MISMATCH' });
  });

  it('a wallet that is not the registry\'s on-chain owner is refused BEFORE SIGNING even happens (moved 2026-08-04, al: "signing is itself a governed cryptographic act") — never a live "Invalid signature" 401 for a wrong-wallet configuration', async () => {
    const stranger = ethers.Wallet.createRandom();
    const mcpClient = fakeMcpClient();
    const callToolSpy = vi.fn(mcpClient.callTool);
    mcpClient.callTool = callToolSpy;
    const resolveSigningKeySpy = vi.fn(async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }));
    const result = await runHorizenTransparencyAuthorization(baseInput(), {
      mcpClient,
      fetchRegistryAgent: fakeFetchRegistryAgent(stranger.address),
      resolveSigningKey: resolveSigningKeySpy,
      now: FIXED_NOW,
    });
    expect(result).toMatchObject({ ok: false, refusalCode: 'REGISTRY_OWNER_MISMATCH' });
    // The agent key is never even resolved — no reason to ask it to sign a
    // message already known to name the wrong wallet.
    expect(resolveSigningKeySpy).not.toHaveBeenCalled();
    // build_pulse_auth_message is fine (it only builds text, never mutates
    // anything on Horizen's side) — enable_pulse_monitoring, the actual
    // state-changing call, must never fire for a wrong-owner wallet either.
    const calledTools = callToolSpy.mock.calls.map((c) => c[0]?.name);
    expect(calledTools).not.toContain('enable_pulse_monitoring');
  });

  it('the signature-integrity gate catches a walletAddress that drifted between signing and submission — never a mystery Horizen 401 for a local data-continuity bug', async () => {
    const prepared = await prepareHorizenTransparencyAuthorization(
      baseInput({ authorizationId: 'auth-integrity-drift' }),
      { mcpClient: fakeMcpClient(), fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address), now: FIXED_NOW },
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const signed = await signHorizenTransparencyAuthorization(prepared.value, {
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;

    // Simulate drift: something mutated the persisted record's walletAddress
    // AFTER the message was signed against the original one (e.g. a bug, or
    // a future refactor that reconstructs facts instead of threading them
    // verbatim) — the row is the in-memory fake store `rows` this file's own
    // partnerAuthorizationStore mock uses.
    const row = rows.get('auth-integrity-drift');
    row.walletAddress = ethers.Wallet.createRandom().address;

    const integrity = await verifySignatureIntegrity('auth-integrity-drift', prepared.value.message, signed.value, WALLET.address);
    expect(integrity).toMatchObject({ ok: false, refusalCode: 'SIGNATURE_INTEGRITY_FAILED' });
  });

  it('the signature-integrity gate catches an expectedOwner that disagrees, even when the recovered signer and persisted walletAddress already agree with each other — the decisive three-way test, not a composition of two checks', async () => {
    const prepared = await prepareHorizenTransparencyAuthorization(
      baseInput({ authorizationId: 'auth-integrity-owner-mismatch' }),
      { mcpClient: fakeMcpClient(), fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address), now: FIXED_NOW },
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const signed = await signHorizenTransparencyAuthorization(prepared.value, {
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;

    // recoveredSigner === persisted walletAddress === WALLET.address, but the
    // registry's ACTUAL resolved owner (what crossCheckRegistryOwner would
    // have returned moments earlier) is a stranger — must still refuse.
    const stranger = ethers.Wallet.createRandom();
    const integrity = await verifySignatureIntegrity('auth-integrity-owner-mismatch', prepared.value.message, signed.value, stranger.address);
    expect(integrity).toMatchObject({ ok: false, refusalCode: 'SIGNATURE_INTEGRITY_FAILED' });
  });

  it('the signature-integrity gate passes when nothing has drifted — a genuine regression guard, not a permanently-failing check', async () => {
    const prepared = await prepareHorizenTransparencyAuthorization(
      baseInput({ authorizationId: 'auth-integrity-clean' }),
      { mcpClient: fakeMcpClient(), fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address), now: FIXED_NOW },
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const signed = await signHorizenTransparencyAuthorization(prepared.value, {
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;

    const integrity = await verifySignatureIntegrity('auth-integrity-clean', prepared.value.message, signed.value, WALLET.address);
    expect(integrity).toEqual({ ok: true });
  });

  /*
   * A valid signature is still not completion without an authoritative reread
   * — unchanged. What CHANGED (Al's brief, 2026-08-06) is the VERDICT recorded
   * when the reread has not converged: `PARTNER_STATE_UNRESOLVED`, and the row
   * stays SUBMITTED. It used to write REFUSED + HORIZEN_REREAD_NOT_CONFIRMED,
   * recording a timing condition as a constitutional denial — the same defect
   * class as reading a transport timeout as a refusal.
   */
  it('partner mutation not confirmed — reports PARTNER_STATE_UNRESOLVED and leaves the row SUBMITTED, never REFUSED', async () => {
    const authorizationId = 'auth-unresolved-reread';
    const result = await runHorizenTransparencyAuthorization(baseInput({ authorizationId }), {
      mcpClient: fakeMcpClient({ statusText: '{"status":"awaiting"}' }),
      fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    expect(result).toMatchObject({ ok: false, refusalCode: 'PARTNER_STATE_UNRESOLVED' });
    // Never a completion receipt without confirmation — unchanged guarantee.
    expect(createActivityReceipt).not.toHaveBeenCalled();
    // And never a denial: refresh must be able to settle this later.
    expect(rows.get(authorizationId).state).toBe('SUBMITTED');
  });

  /*
   * PARTNER_NOT_ENROLLED — a CONCLUSIVE negative from the authoritative
   * reread is distinct from an inconclusive one (operator's follow-up brief,
   * 2026-08-06). Horizen's `get_onboarding_status` answered, in words, that
   * Pulse is not enrolled and named the exact next step — this must never be
   * filed under "hasn't converged yet."
   */
  it('reread reporting "Not enrolled... Next step: Enroll" (no conflicting owner in the text) resolves to PARTNER_NOT_ENROLLED, retryable, persisted as REFUSED with that exact code', async () => {
    const authorizationId = 'auth-explicit-not-enrolled';
    // No "owner 0x…" line here, deliberately — this test isolates the
    // enrollment classifier from the owner-source-conflict gate below, which
    // is exercised separately against the exact live transcript (that
    // transcript's owner line is what THAT gate exists to catch).
    const statusText =
      'Onboarding status for agent 8798 on Base:\n' +
      '✓ Registered on-chain.\n' +
      '✓ Indexed in the registry marketplace as "Agent #0x225e".\n' +
      '✗ Not enrolled in Pulse monitoring.\n\n' +
      'Next step: Enroll: build_pulse_auth_message (action: enable) → sign with the owner wallet → enable_pulse_monitoring.';
    const result = await runHorizenTransparencyAuthorization(baseInput({ authorizationId }), {
      mcpClient: fakeMcpClient({ statusText }),
      fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusalCode).toBe('PARTNER_NOT_ENROLLED');
    expect(result.retryable).toBe(true);
    // Explicitly NOT a claim that the signature was invalid — the operator's
    // exact requirement — while still naming (and denying) that class of
    // failure, so the operator sees it was actively ruled out.
    expect(result.detail).not.toMatch(/\binvalid signature\b/i);
    expect(result.detail).toContain('not a signature, ownership, or cryptographic failure');
    // No state migration: persisted as the EXISTING `REFUSED` state, distinguished by refusalCode alone.
    expect(rows.get(authorizationId).state).toBe('REFUSED');
    expect(rows.get(authorizationId).refusalCode).toBe('PARTNER_NOT_ENROLLED');
    // The verbatim partner text survives for audit (acceptance item 8).
    expect(rows.get(authorizationId).partnerStatus).toContain('Not enrolled');
    expect(createActivityReceipt).not.toHaveBeenCalled();
  });

  it('"Next step: Enroll" alone (no local check failure, isError unset) still resolves to PARTNER_NOT_ENROLLED — never HORIZEN_SUBMISSION_REJECTED or a signature code', async () => {
    const authorizationId = 'auth-next-step-enroll-only';
    const result = await runHorizenTransparencyAuthorization(baseInput({ authorizationId }), {
      mcpClient: fakeMcpClient({ statusText: 'Onboarding incomplete. Next step: Enroll in Pulse monitoring.' }),
      fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    expect(result).toMatchObject({ ok: false, refusalCode: 'PARTNER_NOT_ENROLLED' });
  });

  it('a fresh authorization after PARTNER_NOT_ENROLLED creates a genuinely new attempt via the existing REFUSED-reset path — no new state, no migration needed', async () => {
    const authorizationId = 'auth-retry-after-not-enrolled';
    const first = await runHorizenTransparencyAuthorization(baseInput({ authorizationId }), {
      mcpClient: fakeMcpClient({ statusText: 'Not enrolled in Pulse monitoring. Next step: Enroll.' }),
      fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    expect(first).toMatchObject({ ok: false, refusalCode: 'PARTNER_NOT_ENROLLED' });
    expect(rows.get(authorizationId).state).toBe('REFUSED');

    // A genuinely fresh prepare call — different issuedAt — must proceed via
    // the SAME reset path already proven for every other REFUSED reason,
    // never blocked by AUTHORIZATION_ALREADY_IN_FLIGHT.
    const laterNow = () => new Date('2026-07-31T12:05:00.000Z');
    const second = await prepareHorizenTransparencyAuthorization(
      baseInput({
        authorizationId,
        registry: { network: 'base-sepolia', tokenId: '1234' },
      }),
      {
        mcpClient: fakeMcpClient({ buildMessage: 'ASR Pulse enable\nAgent: 1234\nIssued At: 2026-07-31T12:05:00.000Z' }),
        now: laterNow,
      },
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.diagnostics?.rowAction).toBe('reset');
    expect(second.value.envelope.issuedAt).toBe('2026-07-31T12:05:00.000Z');
  });

  /*
   * REPLACES "no recognisable submission reference is refused, never guessed"
   * (Al's brief, 2026-08-06). That test encoded the defect: it asserted that a
   * successful, non-`isError` response carrying no transaction-like reference
   * must be recorded as HORIZEN_SUBMISSION_FAILED. Horizen then answered a
   * real enablement with 1109 characters of prose and the client discarded it,
   * persisting REFUSED for what may have been a completed authorization.
   *
   * A reference is metadata. The reread decides.
   */
  it('a response with no submission reference is NOT a failure — it proceeds to the authoritative reread, which decides', async () => {
    const authorizationId = 'auth-no-reference';
    const mcpClient = fakeMcpClient();
    const base = fakeMcpClient();
    mcpClient.callTool = vi.fn(async ({ name, arguments: args }: { name: string; arguments: Record<string, unknown> }) => {
      if (name === 'build_pulse_auth_message') {
        return { content: [{ type: 'text', text: JSON.stringify({ message: 'authorize this issuedAt="2026-07-31T12:00:00.000Z"' }) }] };
      }
      // A successful response naming no reference at all.
      if (name === 'enable_pulse_monitoring') return { content: [{ type: 'text', text: JSON.stringify({ unrelatedField: 'x' }) }] };
      return base.callTool({ name, arguments: args });
    });
    const result = await runHorizenTransparencyAuthorization(baseInput({ authorizationId }), {
      mcpClient,
      fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    // The default status fixture reports `{"status":"active"}` — so the reread
    // CONFIRMS, and a missing reference never blocked completion.
    expect(result.ok).toBe(true);
    expect(rows.get(authorizationId).state).toBe('CONFIRMED');
    expect(rows.get(authorizationId).submissionRef ?? null).toBeNull();
    expect(createActivityReceipt).toHaveBeenCalled();
  });
});

describe('the Pulse call conforms to the documented contract, not to inference (2026-08-03)', () => {
  /*
   * Horizen's partner Q&A specifies the byte-exact Pulse message and the
   * arguments producing it: DECIMAL agentId, the pulse network selector, the
   * numeric chain id, lowercased registry and wallet. Every one of those
   * facts already lived in HORIZEN_NETWORK_FACTS / parseAgentId — the call
   * simply wasn't reading them, and was sending the string 'base-sepolia'
   * where chain id 84532 belongs.
   */
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'horizen', 'authorizationClient.ts'),
    'utf8',
  );

  /*
   * CORRECTED 2026-08-03 from Horizen's own schema rejection:
   *   chain:  expected 'base-mainnet' | 'base-sepolia', received number
   *   action: expected 'enable' | 'disable', received undefined, Required
   *
   * `Chain: 84532` is what Horizen writes INTO the plaintext message body; the
   * tool ARGUMENT selecting the network is the string selector. The previous
   * assertion pinned the wrong one — a canary defending a defect, replaced
   * rather than deleted (CANARY-REPRODUCES-DEFECT).
   */
  it('sends the network SELECTOR as `chain`, never the numeric chain id', () => {
    expect(source).toMatch(/chain:\s*facts\.pulseSelector/);
    expect(source, 'chain: facts.chainId is exactly what Horizen rejected as a number').not.toMatch(
      /\n\s*chain:\s*facts\.chainId/,
    );
  });

  it('supplies the required `action` argument', () => {
    expect(source).toMatch(/action:\s*'enable'/);
  });

  it('refuses locally when the tool declares a required argument we do not supply', () => {
    // The schema was in hand before the call — a missing required field should
    // fail here, naming it, not at the partner with a generic validation dump.
    expect(source).toContain('missingRequiredFields(buildTool.tool.inputSchema, buildArgs)');
    expect(source).toContain('declares required argument(s) this client supplies no value for');
  });

  it('sends the pulse network selector from the facts table', () => {
    expect(source).toMatch(/network:\s*facts\.pulseSelector/);
  });

  it('normalises the agent id to DECIMAL through parseAgentId', () => {
    expect(source).toContain('parseAgentId(input.registry.tokenId)');
    expect(source).toMatch(/parsedAgentId\.value\.toString\(10\)/);
    expect(source).toMatch(/agentId:\s*decimalAgentId/);
  });

  it('lowercases the registry and wallet, as the byte-exact message requires', () => {
    expect(source).toMatch(/registry:\s*facts\.identityRegistry\.toLowerCase\(\)/);
    // The candidates moved into `pulseBuildCandidates` so the diagnostic could
    // share them; the wallet arrives as a parameter rather than off `input`.
    expect(source).toMatch(/wallet:\s*controllerWallet\.toLowerCase\(\)/);
  });

  it('refuses an unparseable agent id rather than sending a label', () => {
    expect(source).toMatch(/if \(!parsedAgentId\.ok\)/);
    expect(source).toContain('is not a usable agent id');
  });
});

describe('enable_pulse_monitoring conforms to the LIVE required schema (al / Horizen brief, 2026-08-04)', () => {
  /*
   * The live error was conclusive, not a parsing defect: Horizen's real
   * enable_pulse_monitoring requires agentId, name, endpoint, walletAddress,
   * signature AND issuedAt. Offering only message/signature candidates left
   * five fields undefined — exactly what the Zod rejection named. This
   * canary calls the tool through a schema shaped exactly like the live one
   * and inspects what was actually sent.
   */
  it('sends all six required fields, none undefined', async () => {
    // Pre-submit read neutral so submission is actually reached (this test
    // inspects the submit call itself); post-submit default confirms.
    const mcpClient = fakeMcpClient({ statusTextSequence: ['{"status":"unrelated"}', '{"status":"active"}'] });
    const result = await runHorizenTransparencyAuthorization(baseInput({ agentDisplayName: 'Aigent Nakamoto', pulseEndpoint: 'https://nakamoto.example/health' }), {
      mcpClient,
      fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(true);

    const submitCall = mcpClient.callTool.mock.calls.find((c: any[]) => c[0].name === 'enable_pulse_monitoring');
    expect(submitCall, 'enable_pulse_monitoring was never called').toBeTruthy();
    const sentArgs = submitCall![0].arguments;

    for (const field of REAL_ENABLE_PULSE_SCHEMA.required) {
      expect(sentArgs[field], `"${field}" must not be undefined`).not.toBeUndefined();
    }
    expect(sentArgs.name).toBe('Aigent Nakamoto');
    expect(sentArgs.endpoint).toBe('https://nakamoto.example/health');
    expect(missingRequiredFields(REAL_ENABLE_PULSE_SCHEMA, sentArgs)).toEqual([]);
  });

  /*
   * "Do not regenerate issuedAt, substitute another wallet, or alter the
   * agent ID between the build and enable calls." — the values submitted
   * must be IDENTICAL to the ones that produced the signed message, not
   * independently re-derived at submit time.
   */
  it('submits the EXACT agentId/walletAddress/issuedAt that produced the signed message — never regenerated', async () => {
    // Pre-submit read neutral so submission is actually reached; post-submit
    // default confirms.
    const mcpClient = fakeMcpClient({ statusTextSequence: ['{"status":"unrelated"}', '{"status":"active"}'] });
    const result = await runHorizenTransparencyAuthorization(baseInput({ registry: { network: 'base-sepolia', tokenId: '8798' } }), {
      mcpClient,
      fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(true);

    const submitCall = mcpClient.callTool.mock.calls.find((c: any[]) => c[0].name === 'enable_pulse_monitoring');
    const sentArgs = submitCall![0].arguments;

    // The exact issuedAt embedded in the build response's own message text —
    // never `now()`, never freshly generated.
    expect(sentArgs.issuedAt).toBe('2026-07-31T12:00:00.000Z');
    expect(sentArgs.agentId).toBe('8798'); // decimal, matching the tokenId
    expect(sentArgs.walletAddress.toLowerCase()).toBe(WALLET.address.toLowerCase());
  });

  /*
   * isError IS TERMINAL (al / Horizen brief, 2026-08-04): "The tool returned
   * isError: true; the client should stop there and report a tool validation
   * failure, not run the success-reference extractor." Before this fix, a
   * rejected call fell through to "did not return a recognisable submission
   * reference" — true, but misleading: the tool never reached success at
   * all, it was rejected outright.
   */
  it('treats isError:true as terminal — never attempts submission-reference extraction on it', async () => {
    const zodStyleError =
      'Invalid arguments for tool enable_pulse_monitoring: [{"code":"invalid_type","expected":"string","received":"undefined","path":["agentId"],"message":"Required"}]';
    const mcpClient = fakeMcpClient({
      // Pre-submit read neutral so submission is actually attempted (and
      // rejected, which is what this test exercises).
      statusText: '{"status":"unrelated"}',
      enableResult: { isError: true, content: [{ type: 'text', text: zodStyleError }] },
    });
    const result = await runHorizenTransparencyAuthorization(baseInput(), {
      mcpClient,
      fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    expect(result).toMatchObject({ ok: false, refusalCode: 'HORIZEN_SUBMISSION_REJECTED' });
    if (result.ok) return;
    // The tool's own rejection reason is reported verbatim — not the generic
    // "did not return a recognisable submission reference" complaint.
    expect(result.detail).toContain('Invalid arguments for tool enable_pulse_monitoring');
    expect(result.detail).not.toContain('did not return a recognisable submission reference');

    // A bounded, safe diagnostic transcript rides along (al, 2026-08-04) —
    // this rejection was only reachable after verifySignatureIntegrity
    // already confirmed local recovery/wallet/owner agreement, so the
    // transcript is what an escalation to Horizen would need.
    const transcriptMatch = result.detail.match(/Local signature transcript.*?: (\{.*\})$/);
    expect(transcriptMatch).toBeTruthy();
    const transcript = JSON.parse(transcriptMatch![1]);
    expect(transcript).toMatchObject({
      recoveredSigner: WALLET.address,
      // The persisted walletAddress is now the EXACT string sent to
      // build_pulse_auth_message — lowercased, matching what the signed
      // message actually embeds (2026-08-05 wallet-casing fix) — never the
      // checksummed value `AgentKeyService` returns.
      expectedOwner: WALLET.address.toLowerCase(),
      agentId: '1234', // baseInput()'s default registry.tokenId
      issuedAt: '2026-07-31T12:00:00.000Z',
    });
    expect(typeof transcript.messageByteLength).toBe('number');
    expect(typeof transcript.messageHash).toBe('string');
    expect(typeof transcript.signatureLength).toBe('number');
    // Never the private key, never the full message text, never the raw signature.
    expect(JSON.stringify(transcript)).not.toContain(WALLET.privateKey);

    // The unrelated (non-signature) rejection still gets a full escalation
    // packet — attachment isn't conditioned on the "looks like a signature
    // rejection" wording check, only the framing text is.
    expect(result.escalationPacket).toBeTruthy();
  });

  it('build_pulse_auth_message response with no extractable issuedAt refuses locally rather than generating one', async () => {
    const mcpClient = fakeMcpClient({ buildMessage: 'authorize pulse monitoring, no timestamp mentioned at all' });
    const result = await prepareHorizenTransparencyAuthorization(baseInput(), { mcpClient, now: FIXED_NOW });
    expect(result).toMatchObject({ ok: false, refusalCode: 'ISSUED_AT_UNAVAILABLE' });
  });
});

describe('parseLabelledMessageFields (al, 2026-08-04)', () => {
  it('extracts "Label: value" lines, preserving exact case/spacing of the value, ignoring prose lines with no colon-labelled structure', () => {
    const message =
      'ASR Pulse enable\n' +
      'This message authorizes Pulse monitoring for your agent.\n' +
      'Agent: 8798\n' +
      'Network: base-sepolia\n' +
      'Chain: 84532\n' +
      'Registry: 0x8004A818BFB912233c491871b3d84c89A494BD9e\n' +
      'Wallet: 0x24bbb9c7aacb33556d1429a3e1b33f05faf7d4b9\n' +
      'Issued At: 2026-08-04T11:04:25.071Z\n' +
      'By signing, you agree to Horizen\'s terms.';
    const fields = parseLabelledMessageFields(message);
    expect(fields.get('Agent')).toBe('8798');
    expect(fields.get('Network')).toBe('base-sepolia');
    expect(fields.get('Chain')).toBe('84532');
    expect(fields.get('Registry')).toBe('0x8004A818BFB912233c491871b3d84c89A494BD9e');
    expect(fields.get('Wallet')).toBe('0x24bbb9c7aacb33556d1429a3e1b33f05faf7d4b9');
    expect(fields.get('Issued At')).toBe('2026-08-04T11:04:25.071Z');
    // Prose lines produce no entry — never guessed into a field.
    expect(fields.size).toBe(6);
  });

  it('returns an empty map for a message with no labelled lines at all', () => {
    expect(parseLabelledMessageFields('just some free text\nwith no colons naming fields').size).toBe(0);
  });
});

describe('buildFieldParityTable — exact, unnormalized comparison (al, 2026-08-04: "Do not normalize values before comparison")', () => {
  const message =
    'ASR Pulse enable\nAgent: 8798\nNetwork: base-sepolia\nChain: 84532\n' +
    'Registry: 0x8004a818bfb912233c491871b3d84c89a494bd9e\nWallet: 0x24bbb9c7aacb33556d1429a3e1b33f05faf7d4b9\n' +
    'Issued At: 2026-08-04T11:04:25.071Z';

  it('reports equal:true when the submitted value matches the signed value byte-for-byte', () => {
    const table = buildFieldParityTable(message, { agentId: '8798', issuedAt: '2026-08-04T11:04:25.071Z' });
    expect(table.find((r) => r.field === 'agentId')).toEqual({ field: 'agentId', signedValue: '8798', submittedValue: '8798', equal: true });
    expect(table.find((r) => r.field === 'issuedAt')).toMatchObject({ equal: true });
  });

  it('reports equal:false and shows BOTH exact values, unnormalized, when they genuinely differ — e.g. the message names the network selector but submission sends the numeric chain id', () => {
    const table = buildFieldParityTable(message, { network: '84532' }); // wrong on purpose: message says "base-sepolia"
    const row = table.find((r) => r.field === 'network');
    expect(row).toEqual({ field: 'network', signedValue: 'base-sepolia', submittedValue: '84532', equal: false });
  });

  it('is case-SENSITIVE on values — a casing-only difference (e.g. checksum vs lowercased wallet) is reported as unequal, never silently normalized away', () => {
    const table = buildFieldParityTable(message, { walletAddress: '0x24BBB9C7aAcB33556D1429a3e1B33f05fAf7D4B9' });
    const row = table.find((r) => r.field === 'walletAddress');
    expect(row?.equal).toBe(false);
    expect(row?.signedValue).toBe('0x24bbb9c7aacb33556d1429a3e1b33f05faf7d4b9');
    expect(row?.submittedValue).toBe('0x24BBB9C7aAcB33556D1429a3e1B33f05fAf7D4B9');
  });

  it('reports signedValue:null (not a crash, not a guess) for a field never mentioned in the message at all', () => {
    const row = buildFieldParityTable(message, { name: 'Aigent Nakamoto' }).find((r) => r.field === 'name');
    expect(row).toEqual({ field: 'name', signedValue: null, submittedValue: 'Aigent Nakamoto', equal: false });
  });
});

describe('HorizenEscalationPacket — attached on submission rejection (al, 2026-08-04)', () => {
  // Wallet line is LOWERCASED (2026-08-05 fix) — matching the EXACT string
  // pulseBuildCandidates sends to build_pulse_auth_message, and the exact
  // string now persisted as record.walletAddress
  // (`messageWalletAddress` in prepareHorizenTransparencyAuthorization).
  // Before the fix, this fixture used the checksummed WALLET.address, which
  // masked the real defect: record.walletAddress was persisted from
  // `input.controllerWallet` AS GIVEN (checksummed), so a REAL ceremony's
  // returned message — always lowercased, since that's what we send build —
  // would disagree with the checksummed submission by case alone. That is
  // the live "401 — Invalid signature" Horizen diagnosed on 2026-08-05.
  const asrMessage =
    'ASR Pulse enable\nAgent: 8798\nNetwork: base-sepolia\nChain: 84532\n' +
    'Registry: 0x8004a818bfb912233c491871b3d84c89a494bd9e\nWallet: ' +
    WALLET.address.toLowerCase() +
    '\nIssued At: 2026-07-31T12:00:00.000Z';

  it('an "Invalid signature" rejection gets the corrected framing AND a full escalation packet with the exact message and signature (never bounded, unlike the general-log transcript)', async () => {
    const mcpClient = fakeMcpClient({
      buildMessage: asrMessage,
      // Pre-submit read neutral so submission is actually attempted (and
      // rejected, which is what this test exercises).
      statusText: '{"status":"unrelated"}',
      enableResult: {
        isError: true,
        content: [{ type: 'text', text: 'Registry API returned 401 for /agents/8798/enable-pulse — Invalid signature' }],
      },
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await runHorizenTransparencyAuthorization(baseInput({ registry: { network: 'base-sepolia', tokenId: '8798' } }), {
      mcpClient,
      fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    expect(result).toMatchObject({ ok: false, refusalCode: 'HORIZEN_SUBMISSION_REJECTED' });

    // The packet is otherwise unreachable (never in `detail`, never
    // forwarded by the route) — this [HORIZEN ESCALATION] log, mirroring
    // services/dvn/activityReceiptDvnPipeline.ts's own [DVN ESCALATION]
    // pattern, is the ONLY place it currently lands.
    const escalationLog = consoleErrorSpy.mock.calls.find((c) => typeof c[0] === 'string' && c[0].startsWith('[HORIZEN ESCALATION]'));
    expect(escalationLog).toBeTruthy();
    const loggedJson = JSON.parse(escalationLog![0].slice(escalationLog![0].indexOf('{')));
    expect(loggedJson.exactMessage).toBe(asrMessage);
    consoleErrorSpy.mockRestore();
    if (result.ok) return;

    // The corrected framing (al, 2026-08-04) — only for a rejection that
    // actually names "Invalid signature", never blanket-applied.
    expect(result.detail).toContain('Horizen rejected a locally verified owner signature.');
    expect(result.detail).toContain('Local authorization integrity passed.');
    expect(result.detail).toContain('Partner contract clarification required.');

    const packet = result.escalationPacket;
    expect(packet).toBeTruthy();
    if (!packet) return;
    // The FULL exact text and signature — deliberately NOT bounded here,
    // unlike buildSignatureDiagnosticTranscript's hash-only general-log form.
    expect(packet.exactMessage).toBe(asrMessage);
    expect(packet.signature.length).toBeGreaterThan(100);
    expect(packet.tokenId).toBe('8798');
    expect(packet.network).toBe('base-sepolia');
    expect(packet.registryContract.toLowerCase()).toBe(HORIZEN_NETWORK_FACTS['base-sepolia'].identityRegistry.toLowerCase());
    expect(packet.expectedOwner.toLowerCase()).toBe(WALLET.address.toLowerCase());
    expect(packet.recoveredSigner.toLowerCase()).toBe(WALLET.address.toLowerCase());
    expect(packet.issuedAt).toBe('2026-07-31T12:00:00.000Z');
    expect(packet.buildTool.name).toBe('build_pulse_auth_message');
    expect(packet.submitTool.name).toBe('enable_pulse_monitoring');
    // 2026-08-05: the escalation packet must carry BOTH tools' declared MCP
    // schemas, not just build's — otherwise a reader can see what MetaMe
    // submitted but not what Horizen's own schema said it expected.
    expect(packet.buildTool.inputSchema).toBeTruthy();
    expect(packet.submitTool.inputSchema).toEqual(REAL_ENABLE_PULSE_SCHEMA);
    // The field parity table proves agreement for the fields that DO use
    // the same representation on both sides in this fixture.
    expect(packet.fieldParity.find((r) => r.field === 'agentId')).toMatchObject({ equal: true });
    expect(packet.fieldParity.find((r) => r.field === 'walletAddress')).toMatchObject({ equal: true });
    // 'network' has NO submitted counterpart at all with the REAL live
    // schema (REAL_ENABLE_PULSE_SCHEMA declares no `network` property, only
    // `chain` — matchSchemaFields drops any candidate the tool doesn't
    // declare) — reported honestly as submittedValue:null, not hidden.
    expect(packet.fieldParity.find((r) => r.field === 'network')).toEqual({
      field: 'network',
      signedValue: 'base-sepolia',
      submittedValue: null,
      equal: false,
    });
    // 'chain' IS forwarded, and is a KNOWN, DOCUMENTED representation
    // difference in this codebase, not a bug: the message writes the
    // numeric chain id ('84532') while the enable_pulse_monitoring
    // ARGUMENT sends the network selector ('base-sepolia') — see
    // pulseBuildCandidates's own header comment. The parity table reports
    // this unnormalized, exactly as it should — the row exists precisely so
    // a reader can judge whether a given mismatch is expected or the actual
    // defect, rather than this code pre-deciding.
    expect(packet.fieldParity.find((r) => r.field === 'chain')).toEqual({
      field: 'chain',
      signedValue: '84532',
      submittedValue: 'base-sepolia',
      equal: false,
    });
  });

  it('the escalation packet\'s field parity table surfaces a genuine mismatch when the message and submission disagree — the exact defect class under investigation', async () => {
    // The wallet-CASING drift this test originally simulated is now
    // prevented BY CONSTRUCTION (2026-08-05 fix): submission always uses
    // `messageWalletAddress`, the exact string sent to build, never a
    // re-derived or independently-cased value — so that specific mismatch
    // can no longer occur via this code path at all. What this test now
    // proves instead: if Horizen's OWN returned message ever names a
    // DIFFERENT wallet entirely (not merely different casing of the same
    // one — a partner-side anomaly this client cannot prevent),
    // buildFieldParityTable still surfaces it honestly rather than masking
    // it.
    const anotherWallet = ethers.Wallet.createRandom();
    const mismatchedMessage = asrMessage.replace(WALLET.address.toLowerCase(), anotherWallet.address.toLowerCase());
    const mcpClient = fakeMcpClient({
      buildMessage: mismatchedMessage,
      // Pre-submit read neutral so submission is actually attempted (and
      // rejected, which is what this test exercises).
      statusText: '{"status":"unrelated"}',
      enableResult: {
        isError: true,
        content: [{ type: 'text', text: 'Registry API returned 401 for /agents/8798/enable-pulse — Invalid signature' }],
      },
    });
    const result = await runHorizenTransparencyAuthorization(baseInput({ registry: { network: 'base-sepolia', tokenId: '8798' } }), {
      mcpClient,
      fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    if (result.ok) throw new Error('expected a refusal');
    const row = result.escalationPacket?.fieldParity.find((r) => r.field === 'walletAddress');
    expect(row).toEqual({
      field: 'walletAddress',
      signedValue: anotherWallet.address.toLowerCase(),
      submittedValue: WALLET.address.toLowerCase(),
      equal: false,
    });
  });

  /*
   * A REGRESSION GATE, THE SAME REGISTER AS verifySignatureIntegrity
   * (2026-08-05): today `submitArgs.walletAddress` is LITERALLY
   * `record.walletAddress` (both flow from `messageWalletAddress` at
   * prepare time), so this passes trivially — its value is catching a
   * FUTURE change that reintroduces the exact casing bug Horizen diagnosed
   * (e.g. a refactor that re-derives the submitted wallet from
   * `AgentKeyService` again instead of reading the persisted record).
   */
  it('detectPulseArgumentDrift names the differing field and both exact values when build-time and submit-time disagree', () => {
    const drifted = detectPulseArgumentDrift(
      { agentId: '8798', walletAddress: WALLET.address.toLowerCase(), issuedAt: '2026-07-31T12:00:00.000Z', network: 'base-sepolia' },
      { agentId: '8798', walletAddress: WALLET.address, issuedAt: '2026-07-31T12:00:00.000Z', chain: 'base-sepolia' },
    );
    expect(drifted).toEqual([
      { field: 'walletAddress', builtValue: WALLET.address.toLowerCase(), submitValue: WALLET.address },
    ]);
  });

  it('detectPulseArgumentDrift reports no drift when every field agrees byte-for-byte', () => {
    const drift = detectPulseArgumentDrift(
      { agentId: '8798', walletAddress: WALLET.address.toLowerCase(), issuedAt: '2026-07-31T12:00:00.000Z', network: 'base-sepolia' },
      { agentId: '8798', walletAddress: WALLET.address.toLowerCase(), issuedAt: '2026-07-31T12:00:00.000Z', chain: 'base-sepolia' },
    );
    expect(drift).toEqual([]);
  });
});

/*
 * CANONICAL MESSAGE SELECTION — the structured `message` field IS the
 * signable payload (Al's brief, 2026-08-06).
 *
 * These tests replace the 2026-08-05 "PULSE_MESSAGE_DRIFT instrumentation"
 * block, whose contract was: refuse whenever the structured message differs
 * from the whole-blob fallback. That refusal did its job — it produced the
 * decisive evidence — and the evidence disproved the assumption underneath
 * it. Horizen's live build response carries an 826-byte instructional
 * envelope AND a 198-byte structured `message`; `enable_pulse_monitoring`
 * accepts no message argument, so the server reconstructs the canonical
 * message and verifies against THAT. Signing the envelope recovers
 * perfectly to the right owner locally and still 401s at the partner.
 *
 * So a difference between the two candidates is no longer a refusal — it is
 * the normal shape of the response, and the structured field wins. The
 * fail-closed behaviour survives only where it is still true: two structured
 * fields naming DIFFERENT strings, which no local rule can decide.
 */
describe('canonical message selection — structured `message` wins over the instructional envelope (2026-08-06)', () => {
  function mcpClientWithBuildText(buildText: string) {
    const base = fakeMcpClient();
    return {
      ...base,
      callTool: vi.fn(async ({ name, arguments: args }: { name: string; arguments: Record<string, unknown> }) => {
        if (name === 'build_pulse_auth_message') return { content: [{ type: 'text', text: buildText }] };
        return base.callTool({ name, arguments: args });
      }),
    };
  }

  /*
   * THE EXACT LIVE RESPONSE SHAPE observed on 2026-08-06 — instructional
   * preamble, human-readable body, `--- structured ---` marker, then JSON
   * carrying the canonical `message`. issuedAt is pinned to FIXED_NOW so the
   * staleness guard never fires and these tests isolate SELECTION alone.
   */
  const CANONICAL_MESSAGE =
    'ASR Pulse enable\n' +
    'Agent: 8798\n' +
    'Network: sepolia\n' +
    'Chain: 84532\n' +
    'Registry: 0x8004a818bfb912233c491871b3d84c89a494bd9e\n' +
    'Wallet: 0x24bbb9c7aacb33556d1429a3e1b33f05faf7d4b9\n' +
    'Issued At: 2026-07-31T12:00:00.000Z';

  function liveDualCandidateResponse(structured: Record<string, unknown> = {}): string {
    return (
      'Sign this message with wallet 0x24bbb9c7aacb33556d1429a3e1b33f05faf7d4b9 using personal_sign, then call ' +
      'enable_pulse_monitoring with the signature and issuedAt="2026-07-31T12:00:00.000Z". Do not modify the ' +
      'message in any way; the server reconstructs it byte-for-byte during verification.\n\n' +
      CANONICAL_MESSAGE +
      '\n\n--- structured ---\n' +
      JSON.stringify({
        chain: 'base-sepolia',
        network: 'sepolia',
        action: 'enable',
        message: CANONICAL_MESSAGE,
        issuedAt: '2026-07-31T12:00:00.000Z',
        validForMs: 300000,
        ...structured,
      })
    );
  }

  it('selects the structured 198-byte canonical message, NOT the instructional envelope around it', async () => {
    const blob = liveDualCandidateResponse();
    const result = await prepareHorizenTransparencyAuthorization(baseInput(), {
      mcpClient: mcpClientWithBuildText(blob),
      now: FIXED_NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The exact structured string — byte for byte, no trimming, no rebuild.
    expect(result.value.message).toBe(CANONICAL_MESSAGE);
    // And emphatically NOT the envelope: no preamble, no marker, no JSON.
    expect(result.value.message).not.toContain('Sign this message with wallet');
    expect(result.value.message).not.toContain('--- structured ---');
    expect(result.value.message.length).toBeLessThan(blob.length);
    expect(result.value.selection.source).toBe('structured-message');
    expect(result.value.selection.field).toBe('message');
  });

  it('records the rejected envelope as a noncanonical diagnostic candidate rather than refusing on it', async () => {
    const blob = liveDualCandidateResponse();
    const result = await prepareHorizenTransparencyAuthorization(baseInput(), {
      mcpClient: mcpClientWithBuildText(blob),
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { selection } = result.value;
    // Both sides recorded — which was signed, and which was not.
    expect(selection.messageByteLength).toBe(Buffer.byteLength(CANONICAL_MESSAGE, 'utf8'));
    expect(selection.outerCandidateByteLength).toBe(Buffer.byteLength(blob, 'utf8'));
    expect(selection.outerCandidateHash).not.toBe(selection.messageHash);
  });

  it('the persisted payload_hash and the envelope messageHash are the SELECTED message\'s hash — never the envelope\'s', async () => {
    const authorizationId = 'auth-canonical-hash';
    const blob = liveDualCandidateResponse();
    const result = await prepareHorizenTransparencyAuthorization(baseInput({ authorizationId }), {
      mcpClient: mcpClientWithBuildText(blob),
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const expectedHash = createHash('sha256').update(CANONICAL_MESSAGE, 'utf8').digest('hex');
    const envelopeHash = createHash('sha256').update(blob, 'utf8').digest('hex');
    expect(result.value.envelope.messageHash).toBe(expectedHash);
    expect(result.value.envelope.messageHash).not.toBe(envelopeHash);
    // Persisted as payload_hash — the value FRESH_AUTHORIZATION_NOT_CREATED
    // compares against on the next attempt, so it must be the signed one.
    expect(rows.get(authorizationId).payloadHash).toBe(expectedHash);
  });

  it('local recovery succeeds against the SELECTED structured message, and the same signature does NOT recover to the owner over the envelope', async () => {
    const blob = liveDualCandidateResponse();
    const prepared = await prepareHorizenTransparencyAuthorization(baseInput({ authorizationId: 'auth-canonical-recovery' }), {
      mcpClient: mcpClientWithBuildText(blob),
      fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      now: FIXED_NOW,
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const signed = await signHorizenTransparencyAuthorization(prepared.value, {
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;

    // Recovery over the SELECTED message === the owner. This is the property
    // Horizen's server-side reconstruction actually tests.
    expect(ethers.verifyMessage(CANONICAL_MESSAGE, signed.value.signature).toLowerCase()).toBe(WALLET.address.toLowerCase());
    // The same signature over the ENVELOPE recovers to some other address —
    // which is exactly why signing the envelope produced a 401 while every
    // local check passed.
    expect(ethers.verifyMessage(blob, signed.value.signature).toLowerCase()).not.toBe(WALLET.address.toLowerCase());
  });

  it('a structured-vs-envelope difference does NOT raise PULSE_MESSAGE_DRIFT — that refusal encoded the disproved assumption', async () => {
    const result = await prepareHorizenTransparencyAuthorization(baseInput(), {
      mcpClient: mcpClientWithBuildText(liveDualCandidateResponse()),
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) expect(result.refusalCode).not.toBe('PULSE_MESSAGE_DRIFT');
  });

  it('TWO structured fields naming DIFFERENT strings still fails closed with PULSE_MESSAGE_DRIFT — the one genuinely undecidable case', async () => {
    // `message` and `payload` are both in MESSAGE_FIELDS; making them
    // disagree is a contract ambiguity no local rule can resolve.
    const blob = liveDualCandidateResponse({ payload: 'ASR Pulse enable\nAgent: 9999\nIssued At: 2026-07-31T12:00:00.000Z' });
    const result = await prepareHorizenTransparencyAuthorization(baseInput(), {
      mcpClient: mcpClientWithBuildText(blob),
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusalCode).toBe('PULSE_MESSAGE_DRIFT');
    expect(result.detail).toContain('conflicting canonical message fields');
    // Never persisted — the refusal precedes any state transition.
    expect(rows.size).toBe(0);
  });

  /*
   * THE LIVE ARTIFACT, PINNED (Al's brief, 2026-08-06). Uses the real
   * issuedAt from the 2026-08-06 escalation (`2026-08-06T01:21:51.528Z`) and
   * asserts the selected message hashes to the exact value the brief records:
   *
   *   selected  : 198 bytes, sha256 784fe278f784da67cde3f2ca2558971190f9c7feaf7af97a88447e3c12d64964
   *   envelope  : 826 bytes, sha256 1c60a368…  (NOT signed)
   *
   * A future change that reverts to signing the envelope fails HERE, on a
   * hash the partner themselves can verify — not on an internal invariant
   * whose meaning has to be reconstructed from prose.
   *
   * The 198-byte length and its sha256 are the partner's OWN recorded values
   * and are pinned exactly. The envelope's 826 bytes / 1c60a368… are NOT
   * pinned: the live instructional preamble is not in this repo verbatim, and
   * hand-writing prose padded to exactly 826 bytes would be inventing
   * precision we do not have (CLAUDE.md's No-Guessing rule). What IS asserted
   * about the envelope is the property that matters — it is longer than the
   * canonical message, hashes differently, and is not what gets signed.
   */
  it('reproduces the live 2026-08-06 escalation artifact exactly — 198 bytes, sha256 784fe278…', async () => {
    const liveIssuedAt = '2026-08-06T01:21:51.528Z';
    const liveMessage =
      'ASR Pulse enable\n' +
      'Agent: 8798\n' +
      'Network: sepolia\n' +
      'Chain: 84532\n' +
      'Registry: 0x8004a818bfb912233c491871b3d84c89a494bd9e\n' +
      'Wallet: 0x24bbb9c7aacb33556d1429a3e1b33f05faf7d4b9\n' +
      `Issued At: ${liveIssuedAt}`;
    // Sanity-anchor the fixture itself against the brief's recorded facts
    // before asserting the selector reproduces them.
    expect(Buffer.byteLength(liveMessage, 'utf8')).toBe(198);
    expect(createHash('sha256').update(liveMessage, 'utf8').digest('hex')).toBe(
      '784fe278f784da67cde3f2ca2558971190f9c7feaf7af97a88447e3c12d64964',
    );

    const blob =
      `Sign this message with wallet 0x24bbb9c7aacb33556d1429a3e1b33f05faf7d4b9 using personal_sign, then call ` +
      `enable_pulse_monitoring with the signature and issuedAt="${liveIssuedAt}".\n\n` +
      liveMessage +
      '\n\n--- structured ---\n' +
      JSON.stringify({
        chain: 'base-sepolia',
        network: 'sepolia',
        action: 'enable',
        message: liveMessage,
        issuedAt: liveIssuedAt,
        validForMs: 300000,
      });

    const result = await prepareHorizenTransparencyAuthorization(
      baseInput({ authorizationId: 'auth-live-artifact', registry: { network: 'base-sepolia', tokenId: '8798' } }),
      // `now` pinned to the live issuedAt so the staleness guard sees age 0 —
      // this test is about SELECTION, not the validity window.
      { mcpClient: mcpClientWithBuildText(blob), now: () => new Date(liveIssuedAt) },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.message).toBe(liveMessage);
    expect(result.value.selection.messageByteLength).toBe(198);
    expect(result.value.selection.messageHash).toBe('784fe278f784da67cde3f2ca2558971190f9c7feaf7af97a88447e3c12d64964');
    // The envelope is recorded, is genuinely larger, and is NOT what was
    // signed — the property that matters, without pinning prose we don't have.
    expect(result.value.selection.outerCandidateByteLength).toBe(Buffer.byteLength(blob, 'utf8'));
    expect(result.value.selection.outerCandidateByteLength!).toBeGreaterThan(198);
    // The message hash MUST differ from the envelope hash — that difference
    // IS the bug this fix removes.
    expect(result.value.selection.messageHash).not.toBe(result.value.selection.outerCandidateHash);
    expect(result.value.envelope.issuedAt).toBe(liveIssuedAt);
  });

  it('legacy shapes with NO structured message keep the existing fallback exactly — bare JSON named field', async () => {
    // fakeMcpClient()'s default build response is `{"message": "..."}` with
    // no prose/marker at all. Every other test in this file signs this shape;
    // the selection change must never regress it.
    const result = await prepareHorizenTransparencyAuthorization(baseInput(), {
      mcpClient: fakeMcpClient(),
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.message).not.toContain('--- structured ---');
    // Bare JSON IS an embedded object, so this still resolves structurally.
    expect(result.value.selection.source).toBe('structured-message');
  });

  it('legacy shapes with NO structured message keep the existing fallback exactly — plain text, no JSON at all', async () => {
    // Horizen's earlier 265-char plain-text response (2026-08-03 diagnostic):
    // no JSON object anywhere, so the sole-text-block fallback still applies.
    const plain = 'ASR Pulse enable\nAgent: 1234\nIssued At: 2026-07-31T12:00:00.000Z';
    const result = await prepareHorizenTransparencyAuthorization(baseInput(), {
      mcpClient: mcpClientWithBuildText(plain),
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.message).toBe(plain);
    expect(result.value.selection.source).toBe('sole-text-block');
  });
});

/*
 * PULSE_AUTHORIZATION_EXPIRED — a signature may recover to the correct owner
 * indefinitely while still being invalid for Horizen's ceremony, because the
 * signed request carries a short validity window (operator escalation,
 * 2026-08-05: a live rejection's issuedAt matched an EARLIER attempt's, on
 * what was reported as a fresh retry). These tests exercise the staleness
 * check + bounded auto-retry inside prepareHorizenTransparencyAuthorization,
 * WITHOUT touching wallet casing, signature encoding, Passport resolution,
 * persona attribution, or agent identity (al's explicit scope for this pass).
 */
describe('PULSE_AUTHORIZATION_EXPIRED — staleness guard + bounded auto-retry (2026-08-05)', () => {
  function mcpClientWithBuildSequence(messages: string[]) {
    const base = fakeMcpClient();
    let callIndex = 0;
    return {
      ...base,
      callTool: vi.fn(async ({ name, arguments: args }: { name: string; arguments: Record<string, unknown> }) => {
        if (name === 'build_pulse_auth_message') {
          const text = messages[Math.min(callIndex, messages.length - 1)];
          callIndex += 1;
          return { content: [{ type: 'text', text: JSON.stringify({ message: text }) }] };
        }
        return base.callTool({ name, arguments: args });
      }),
    };
  }

  // FIXED_NOW is 2026-07-31T12:00:00.000Z — stale is well outside the 5-minute
  // default window relative to it; fresh is comfortably inside it.
  const staleMessage = 'ASR Pulse enable\nAgent: 1234\nIssued At: 2026-07-31T11:00:00.000Z';
  const freshMessage = 'ASR Pulse enable\nAgent: 1234\nIssued At: 2026-07-31T11:58:00.000Z';

  it('refuses PULSE_AUTHORIZATION_EXPIRED after both attempts come back stale — never signs, never submits, never persists', async () => {
    const mcpClient = mcpClientWithBuildSequence([staleMessage, staleMessage]);
    const result = await prepareHorizenTransparencyAuthorization(baseInput({ authorizationId: 'auth-expired-both' }), {
      mcpClient,
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusalCode).toBe('PULSE_AUTHORIZATION_EXPIRED');
    expect(result.detail).toContain('2 of 2 attempts');
    // build_pulse_auth_message was called exactly twice — one fresh attempt, one retry, never more.
    const buildCalls = mcpClient.callTool.mock.calls.filter((c: any[]) => c[0]?.name === 'build_pulse_auth_message');
    expect(buildCalls).toHaveLength(2);
    // Never persisted — a refused prepare must not leave a PREPARED row behind.
    expect(rows.has('auth-expired-both')).toBe(false);
  });

  it('self-heals on a transient stale response — the retry succeeds and the ceremony proceeds normally', async () => {
    const mcpClient = mcpClientWithBuildSequence([staleMessage, freshMessage]);
    const result = await prepareHorizenTransparencyAuthorization(baseInput({ authorizationId: 'auth-expired-self-heals' }), {
      mcpClient,
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The SECOND (fresh) message is what was actually prepared/signed — never the first, stale one.
    expect(result.value.message).toBe(freshMessage);
    const buildCalls = mcpClient.callTool.mock.calls.filter((c: any[]) => c[0]?.name === 'build_pulse_auth_message');
    expect(buildCalls).toHaveLength(2);
  });

  it('never flags the existing, already-working fixture (issuedAt pinned to the same instant as now()) as stale', async () => {
    // Every other test in this file relies on this: FIXED_NOW === the
    // fixture's embedded issuedAt, i.e. age 0 — must never be treated as expired.
    const result = await prepareHorizenTransparencyAuthorization(baseInput({ authorizationId: 'auth-not-stale' }), {
      mcpClient: fakeMcpClient(),
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(true);
  });
});

/*
 * HORIZEN_OWNER_SOURCE_CONFLICT — a defensive gate for a partner-side data
 * inconsistency, not a MetaMe defect (Al's escalation, 2026-08-06).
 *
 * A live investigation proved: Horizen's REST `/agents/:id` endpoint and
 * their `get_onboarding_status` MCP tool can report DIFFERENT owners for the
 * SAME token. For Nakamoto's token 8798, the REST value (matching MetaMe's
 * configured wallet) was corroborated three independent ways — the on-chain
 * mint event, a direct `ownerOf()` read, and cross-validation against three
 * unrelated tokenIds — while the onboarding-status value had never
 * transacted on-chain at all. This is Horizen's own two services disagreeing
 * with each other, not a signature or wallet-configuration defect on our
 * side, and no local action (re-signing, retrying) can fix it.
 *
 * These tests exercise the gate added to `crossCheckRegistryOwner` — checked
 * BEFORE any signing, using the exact live transcript as a fixture.
 */
describe('HORIZEN_OWNER_SOURCE_CONFLICT — Horizen\'s own two services disagree (2026-08-06)', () => {
  const LIVE_ONBOARDING_STATUS_TEXT =
    'Onboarding status for agent 8798 on Base:\n' +
    '✓ Registered on-chain — owner 0xa6aCB16f7baf5FFE984a67d96c62b686ED6c1709.\n' +
    '✓ Indexed in the registry marketplace as "Agent #0x225e".\n' +
    '✗ Not enrolled in Pulse monitoring.\n\n' +
    'Next step: Enroll: build_pulse_auth_message (action: enable) → sign with the owner wallet → enable_pulse_monitoring.';

  it('the exact live transcript — REST owner (the signing wallet) vs onboarding-status owner — refuses HORIZEN_OWNER_SOURCE_CONFLICT BEFORE signing, naming both addresses', async () => {
    const authorizationId = 'auth-owner-source-conflict';
    const resolveSigningKeySpy = vi.fn(async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }));
    const result = await runHorizenTransparencyAuthorization(baseInput({ authorizationId }), {
      mcpClient: fakeMcpClient({ statusText: LIVE_ONBOARDING_STATUS_TEXT }),
      // REST reports the SAME wallet MetaMe already signs with — this is the
      // side that was proven correct by the live investigation.
      fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      resolveSigningKey: resolveSigningKeySpy,
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusalCode).toBe('HORIZEN_OWNER_SOURCE_CONFLICT');
    // Caught BEFORE signing — never asked the agent key to sign anything.
    expect(resolveSigningKeySpy).not.toHaveBeenCalled();
    // Both addresses named, never just one.
    expect(result.detail).toContain(WALLET.address);
    expect(result.detail).toContain('0xa6aCB16f7baf5FFE984a67d96c62b686ED6c1709');
    // Never framed as our signature/wallet being wrong.
    expect(result.detail).not.toMatch(/\binvalid signature\b/i);
    expect(result.detail).toContain("partner-side data conflict between two Horizen backends");
    expect(rows.get(authorizationId).state).toBe('REFUSED');
    expect(rows.get(authorizationId).refusalCode).toBe('HORIZEN_OWNER_SOURCE_CONFLICT');
  });

  it('never fires when both sources agree — the ordinary matching-owner path is unaffected', async () => {
    const agreeingText = 'Onboarding status for agent 8798 on Base:\n✓ Registered on-chain — owner ' + WALLET.address + '.\n✗ Not enrolled in Pulse monitoring.';
    const result = await runHorizenTransparencyAuthorization(baseInput({ authorizationId: 'auth-owners-agree' }), {
      mcpClient: fakeMcpClient({ statusText: agreeingText }),
      fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Proceeds past the owner gate to the (unrelated) enrollment classification.
    expect(result.refusalCode).toBe('PARTNER_NOT_ENROLLED');
  });

  it('never fires when the onboarding-status tool cannot be reached or names no owner — best-effort, not a hard requirement', async () => {
    // fakeMcpClient()'s default get_onboarding_status returns `{"status":"active"}` — no owner field at all.
    const result = await runHorizenTransparencyAuthorization(baseInput({ authorizationId: 'auth-no-status-owner-signal' }), {
      mcpClient: fakeMcpClient(),
      fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(true);
  });

  it('a genuine REGISTRY_OWNER_MISMATCH (no cross-source conflict at all) is still reported as such, not swallowed by the new gate', async () => {
    const stranger = ethers.Wallet.createRandom();
    const result = await runHorizenTransparencyAuthorization(baseInput({ authorizationId: 'auth-plain-owner-mismatch' }), {
      mcpClient: fakeMcpClient(), // default status text names no owner at all
      fetchRegistryAgent: fakeFetchRegistryAgent(stranger.address),
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    expect(result).toMatchObject({ ok: false, refusalCode: 'REGISTRY_OWNER_MISMATCH' });
  });

  it('the gate also runs on the post-submit reread path (verifyHorizenTransparencyActivation / "Refresh partner status"), not only pre-submit', async () => {
    const authorizationId = 'auth-owner-conflict-on-reread';
    const prepared = await prepareHorizenTransparencyAuthorization(baseInput({ authorizationId }), {
      mcpClient: fakeMcpClient(),
      fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      now: FIXED_NOW,
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const signed = await signHorizenTransparencyAuthorization(prepared.value, {
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    rows.set(authorizationId, { ...rows.get(authorizationId), state: 'SUBMITTED', submissionRef: '0xsub' });

    const verified = await verifyHorizenTransparencyActivation(
      authorizationId,
      { actorPersonaId: 'persona-operator-1', registry: { network: 'base-sepolia', tokenId: '1234' }, controllerWallet: WALLET.address },
      { mcpClient: fakeMcpClient({ statusText: LIVE_ONBOARDING_STATUS_TEXT }), fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address) },
    );
    expect(verified).toMatchObject({ ok: false, refusalCode: 'HORIZEN_OWNER_SOURCE_CONFLICT' });
  });
});

/*
 * THE ROOT CAUSE, CLOSED (Horizen, confirmed directly 2026-08-06):
 *
 *   > "get_onboarding_status defaults to base-mainnet when you omit chain.
 *   >  Pass chain: 'base-sepolia' and it returns [the real wallet]... I hit
 *   >  the same trap on my first lookup, so it's an easy one."
 *
 * The `HORIZEN_OWNER_SOURCE_CONFLICT` transcript above (owner
 * 0xa6aCB16f7baf5FFE984a67d96c62b686ED6c1709, "Agent #0x225e") was never a
 * partner-side inconsistency between two Horizen services — it was
 * `fetchOnboardingStatusOwner`'s and `verifyHorizenTransparencyActivation`'s
 * own `get_onboarding_status` calls never offering a `chain` candidate (only
 * `network`), so a schema property literally named `chain` was left
 * unpopulated and Horizen defaulted the lookup to base-mainnet — where token
 * 8798 happens to belong to a different, unrelated agent. These canaries pin
 * that both call sites now explicitly supply `chain` (and `chainId`)
 * whenever the tool's declared schema names either, via the shared
 * `pulseStatusCandidates` (mirroring `pulseBuildCandidates`'s existing
 * completeness — inv.engineering.036/037, one candidate set, not three).
 */
describe('get_onboarding_status calls always supply chain explicitly (2026-08-06 fix)', () => {
  const STATUS_SCHEMA_WITH_CHAIN = {
    properties: { tokenId: {}, agentId: {}, network: {}, chain: {}, chainId: {}, submissionRef: {}, transactionHash: {} },
  };

  function toolsWithChainAwareStatus(statusText?: string) {
    return [
      { name: 'build_pulse_auth_message', inputSchema: { properties: { tokenId: {}, network: {}, wallet: {} } } },
      { name: 'enable_pulse_monitoring', inputSchema: REAL_ENABLE_PULSE_SCHEMA },
      { name: 'get_onboarding_status', inputSchema: STATUS_SCHEMA_WITH_CHAIN },
    ];
  }

  it('pulseStatusCandidates always carries chain + chainId, never network alone', () => {
    const candidates = pulseStatusCandidates(HORIZEN_NETWORK_FACTS['base-sepolia'], '8798');
    expect(candidates.network).toBe('base-sepolia');
    expect(candidates.chain).toBe('base-sepolia');
    expect(candidates.chainId).toBe(84532);
  });

  it('the pre-submit owner cross-check sends an explicit chain to a schema that declares one', async () => {
    const mcpClient = fakeMcpClient({ tools: toolsWithChainAwareStatus() });
    await runHorizenTransparencyAuthorization(baseInput({ authorizationId: 'auth-chain-explicit-precheck', registry: { network: 'base-sepolia', tokenId: '8798' } }), {
      mcpClient,
      fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    const statusCall = mcpClient.callTool.mock.calls.find(([args]: [any]) => args.name === 'get_onboarding_status');
    expect(statusCall, 'get_onboarding_status was never called').toBeDefined();
    expect(statusCall![0].arguments.chain).toBe('base-sepolia');
    expect(statusCall![0].arguments.chainId).toBe(84532);
  });

  it('the post-submit reread (verifyHorizenTransparencyActivation) sends an explicit chain too', async () => {
    const authorizationId = 'auth-chain-explicit-reread';
    const prepared = await prepareHorizenTransparencyAuthorization(baseInput({ authorizationId, registry: { network: 'base-sepolia', tokenId: '8798' } }), {
      mcpClient: fakeMcpClient({ tools: toolsWithChainAwareStatus() }),
      fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      now: FIXED_NOW,
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const signed = await signHorizenTransparencyAuthorization(prepared.value, {
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    rows.set(authorizationId, { ...rows.get(authorizationId), state: 'SUBMITTED', submissionRef: '0xsub' });

    const mcpClient = fakeMcpClient({ tools: toolsWithChainAwareStatus() });
    await verifyHorizenTransparencyActivation(
      authorizationId,
      { actorPersonaId: 'persona-operator-1', registry: { network: 'base-sepolia', tokenId: '8798' }, controllerWallet: WALLET.address },
      { mcpClient, fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address) },
    );
    const statusCalls = mcpClient.callTool.mock.calls.filter(([args]: [any]) => args.name === 'get_onboarding_status');
    expect(statusCalls.length, 'both the owner cross-check and the enrollment reread call get_onboarding_status').toBeGreaterThanOrEqual(1);
    for (const [args] of statusCalls) {
      expect(args.arguments.chain).toBe('base-sepolia');
      expect(args.arguments.chainId).toBe(84532);
    }
  });
});

/*
 * FRESH_AUTHORIZATION_NOT_CREATED — the hard local guard (Al's audit brief,
 * 2026-08-06, after three "Create fresh authorization" presses all
 * reproduced the exact same messageHash/issuedAt/signaturePrefix). A genuine
 * retry must call build_pulse_auth_message again and get back something
 * that DIFFERS — if it comes back byte-identical to what is already
 * persisted for this authorizationId, this is not a fresh ceremony and must
 * refuse LOCALLY before ever reaching sign/submit.
 */
describe('FRESH_AUTHORIZATION_NOT_CREATED — replay guard (2026-08-06)', () => {
  it('refuses when a second prepare call returns an issuedAt+message identical to the already-persisted attempt', async () => {
    const authorizationId = 'auth-replay-guard';
    const input = baseInput({ authorizationId });

    const first = await prepareHorizenTransparencyAuthorization(input, { mcpClient: fakeMcpClient(), now: FIXED_NOW });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const persistedAfterFirst = rows.get(authorizationId);
    expect(persistedAfterFirst.state).toBe('PREPARED');

    // SAME mcp client fixture — build_pulse_auth_message returns the exact
    // same message/issuedAt it returned last time, simulating a partner-side
    // cache or a call that never actually reached Horizen fresh.
    const second = await prepareHorizenTransparencyAuthorization(input, { mcpClient: fakeMcpClient(), now: FIXED_NOW });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.refusalCode).toBe('FRESH_AUTHORIZATION_NOT_CREATED');
    expect(second.diagnostics?.issuedAt).toBe(first.value.envelope.issuedAt);
    expect(second.diagnostics?.messageHash).toBe(first.value.envelope.messageHash);
    // The old row is untouched — never overwritten by the rejected replay.
    expect(rows.get(authorizationId)).toEqual(persistedAfterFirst);
  });

  /*
   * FRESH AFTER REJECTION, WITH THE CANONICAL SELECTOR IN PLAY (Al's brief,
   * 2026-08-06, acceptance item 9). A rejected authorization may be retained
   * for history but must never be returned as the active prepared
   * authorization — a genuine retry produces a new issuedAt, a new canonical
   * message, a new hash, and therefore a new signature.
   */
  it('a fresh attempt after a REFUSED authorization produces a new issuedAt, hash and signature — the rejected row is not resurrected', async () => {
    const authorizationId = 'auth-fresh-after-refusal';
    const canonical = (issuedAt: string) =>
      'ASR Pulse enable\nAgent: 8798\nNetwork: sepolia\nChain: 84532\n' +
      'Registry: 0x8004a818bfb912233c491871b3d84c89a494bd9e\n' +
      `Wallet: ${WALLET.address.toLowerCase()}\nIssued At: ${issuedAt}`;
    const responseFor = (issuedAt: string) => ({
      content: [
        {
          type: 'text',
          text:
            `Sign this message… issuedAt="${issuedAt}".\n\n` +
            canonical(issuedAt) +
            '\n\n--- structured ---\n' +
            JSON.stringify({ message: canonical(issuedAt), issuedAt, validForMs: 300000 }),
        },
      ],
    });
    const clientFor = (issuedAt: string) => {
      const base = fakeMcpClient();
      return {
        ...base,
        callTool: vi.fn(async ({ name, arguments: args }: { name: string; arguments: Record<string, unknown> }) => {
          if (name === 'build_pulse_auth_message') return responseFor(issuedAt);
          return base.callTool({ name, arguments: args });
        }),
      };
    };
    const signWith = async (prepared: any, now: () => Date) =>
      signHorizenTransparencyAuthorization(prepared, {
        resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
        now,
      });

    // Attempt 1 → prepare, sign, then land in REFUSED (as a partner rejection would).
    const firstIssuedAt = '2026-07-31T12:00:00.000Z';
    const firstNow = () => new Date(firstIssuedAt);
    const first = await prepareHorizenTransparencyAuthorization(
      baseInput({ authorizationId, registry: { network: 'base-sepolia', tokenId: '8798' } }),
      { mcpClient: clientFor(firstIssuedAt), now: firstNow },
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const firstSigned = await signWith(first.value, firstNow);
    expect(firstSigned.ok).toBe(true);
    if (!firstSigned.ok) return;
    rows.set(authorizationId, { ...rows.get(authorizationId), state: 'REFUSED', refusalCode: 'HORIZEN_SUBMISSION_REJECTED' });

    // Attempt 2 → a genuinely fresh build response, three minutes later.
    const secondIssuedAt = '2026-07-31T12:03:00.000Z';
    const secondNow = () => new Date(secondIssuedAt);
    const second = await prepareHorizenTransparencyAuthorization(
      baseInput({ authorizationId, registry: { network: 'base-sepolia', tokenId: '8798' } }),
      { mcpClient: clientFor(secondIssuedAt), now: secondNow },
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const secondSigned = await signWith(second.value, secondNow);
    expect(secondSigned.ok).toBe(true);
    if (!secondSigned.ok) return;

    // Every one of the four values Al requires to change, changed.
    expect(second.value.envelope.issuedAt).not.toBe(first.value.envelope.issuedAt);
    expect(second.value.envelope.messageHash).not.toBe(first.value.envelope.messageHash);
    expect(second.value.message).not.toBe(first.value.message);
    expect(secondSigned.value.signature).not.toBe(firstSigned.value.signature);
    expect(second.value.attemptId).not.toBe(first.value.attemptId);
    // The refused row was superseded, not returned as-is.
    expect(second.diagnostics?.rowAction).toBe('reset');
    expect(rows.get(authorizationId).state).toBe('SIGNED');
  });

  it('proceeds normally when the second attempt genuinely differs (new issuedAt) from the persisted attempt', async () => {
    const authorizationId = 'auth-replay-guard-genuine-retry';
    const input = baseInput({ authorizationId });

    const first = await prepareHorizenTransparencyAuthorization(input, { mcpClient: fakeMcpClient(), now: FIXED_NOW });
    expect(first.ok).toBe(true);

    // A genuinely fresh build response — different issuedAt, different message.
    const freshMessage = 'ASR Pulse enable\nAgent: 1234\nIssued At: 2026-07-31T12:03:00.000Z';
    const laterNow = () => new Date('2026-07-31T12:03:00.000Z');
    const second = await prepareHorizenTransparencyAuthorization(input, {
      mcpClient: fakeMcpClient({ buildMessage: freshMessage }),
      now: laterNow,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.envelope.issuedAt).not.toBe((first as any).value.envelope.issuedAt);
    expect(second.diagnostics?.rowAction).toBe('reset');
  });
});

/*
 * ── A LATER PROVEN PARTNER STATE SUPERSEDES AN EARLIER SETTLED REFUSAL
 * (operator directive, 2026-08-07) ──────────────────────────────────────
 *
 * Aigent Nakamoto's live `get_onboarding_status` reread came back positive —
 * "✓ Enrolled in Pulse monitoring... Next step: Onboarding complete." — while
 * the locally-persisted `partner_authorization_requests` row still held an
 * EARLIER reread's verdict: REFUSED / PARTNER_NOT_ENROLLED. The operator's
 * report was that the UI kept projecting the stale refusal instead of the
 * fresh confirmation.
 *
 * Canonical precedence rule (unchanged from OS-1, restated for this specific
 * transition): a confirmed external consequence outranks a stale local
 * refusal. The refusal remains true AS HISTORY (never deleted, never
 * overwritten to hide that it happened) but must not be what a subsequent
 * read of "current state" reports once a later authoritative reread
 * confirms enrollment.
 *
 * This block adds the exact regression fixture requested: the live positive
 * transcript, verbatim, asserted against `classifyPulseEnrollmentState`
 * directly, and the full reconciliation transition through
 * `verifyHorizenTransparencyActivation` (the same function
 * verify/status/route.ts calls for "Check status now" / "Refresh partner
 * status") — never a second, parallel classifier or reconciliation path.
 */
const LIVE_CONFIRMED_ONBOARDING_STATUS_TEXT =
  '✓ Registered on-chain\n' +
  '✓ Indexed in registry marketplace as "Aigent Nakamoto"\n' +
  '✓ Enrolled in Pulse monitoring — SLA receipts accumulate automatically.\n' +
  '✓ On-chain identity commitment recorded — SLA proofs will be accepted.\n\n' +
  'Next step: Onboarding complete.';

describe('Pulse reconciliation — a later CONFIRMED reread supersedes an earlier REFUSED/PARTNER_NOT_ENROLLED row (2026-08-07)', () => {
  it('classifyPulseEnrollmentState reads the exact live positive transcript as CONFIRMED', () => {
    expect(classifyPulseEnrollmentState(LIVE_CONFIRMED_ONBOARDING_STATUS_TEXT)).toBe('CONFIRMED');
  });

  it('a row already REFUSED/PARTNER_NOT_ENROLLED from an earlier reread is reconciled to CONFIRMED by a later authoritative reread that reports enrollment — the old refusal never survives as current state', async () => {
    const authorizationId = 'auth-reconcile-refused-to-confirmed';
    // Seed the row exactly as verifyHorizenTransparencyActivation's own
    // NOT_ENROLLED branch would have left it after an EARLIER reread — never
    // hand-rolled state a real code path wouldn't actually produce.
    rows.set(authorizationId, {
      authorizationId,
      purpose: 'horizen-pulse-transparency',
      subjectAigentQubeId: 'aigentqube-nakamoto',
      partner: 'horizen',
      network: 'base-sepolia',
      agentId: 'nakamoto-8798',
      walletAddress: WALLET.address,
      issuedAt: '2026-08-06T00:00:00.000Z',
      state: 'REFUSED',
      signerAddress: WALLET.address,
      signatureRef: 'sig-ref-earlier-attempt',
      submissionRef: '0xsubmission-earlier',
      partnerStatus: 'earlier NOT_ENROLLED reread (history — must not be re-asserted as current)',
      receiptRef: null,
      refusalCode: 'PARTNER_NOT_ENROLLED',
      refusalDetail:
        'Horizen\'s authoritative status reports this agent is NOT enrolled in Pulse monitoring — the prior ' +
        'submission did not establish enrollment. Partner state read: (earlier negative transcript)',
      createdAt: 'earlier',
      updatedAt: 'earlier',
    });

    const result = await verifyHorizenTransparencyActivation(
      authorizationId,
      {
        actorPersonaId: 'persona-operator-1',
        registry: { network: 'base-sepolia', tokenId: '8798' },
        controllerWallet: WALLET.address,
        // The exact set "Check status now" / "Refresh partner status" pass —
        // never a wider or narrower allowlist invented for this test.
        allowStates: RECONCILABLE_STATES,
      },
      {
        mcpClient: fakeMcpClient({ statusText: LIVE_CONFIRMED_ONBOARDING_STATUS_TEXT }),
        fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      },
    );

    expect(result.ok).toBe(true);

    const reconciled = rows.get(authorizationId);
    expect(reconciled.state).toBe('CONFIRMED');
    // The earlier refusal's own record is allowed to remain readable in the
    // row's refusalCode/refusalDetail fields (history) — but `state` itself,
    // the field every observer (verify/status/route.ts, PulseTransparencyToggle)
    // actually branches on, must no longer read REFUSED once this reread
    // confirms. This is the one assertion that catches "shadowed by history".
    expect(reconciled.state).not.toBe('REFUSED');
    // A receipt was written for the newly-confirmed enrollment — the same
    // `horizen_pulse_authorized` receipt path CONFIRMED already takes.
    expect(createActivityReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'horizen_pulse_authorized' }),
    );
  });
});

/*
 * ── "CLOSE PULSE NOW" — STRUCTURED-FIRST RECONCILIATION (operator directive,
 * 2026-08-08) ────────────────────────────────────────────────────────────────
 *
 * The topic-scoping fix above (same day) closed the one KNOWN way an
 * unrelated capability's prose could veto Pulse's own positive evidence. This
 * operator directive asks for the belt as well as that suspender: "Do not
 * use prose regex classification when structured status exists... A Boolean
 * partner field must never be overridden by prose interpretation."
 *
 * `verifyHorizenTransparencyActivation` only ever makes ONE live partner
 * call in this path — `get_onboarding_status` — so this fixture folds the
 * operator's two supplied response blocks (the enrollment confirmation and
 * the onboarding-status reread) into the single structured JSON that one
 * call is modeled as returning, carrying every field the acceptance test
 * requires a projection for: `pulseEnrolled`, `pulseCommitmentRecorded`,
 * `verifiablePnlRegistered`, and `endpointWarning`.
 */
const CLOSE_PULSE_NOW_FIXTURE_TEXT = JSON.stringify({
  registeredOnChain: true,
  indexedInRegistry: true,
  onboardingPath: 'pulse',
  pulseEnrolled: true,
  pulseCommitmentRecorded: true,
  verifiablePnlRegistered: false,
  endpointWarning: null,
  nextStep: 'Onboarding complete. Verified receipts appear as Pulse proves uptime windows.',
});

describe('"Close Pulse now" — structured pulseEnrolled/pulseCommitmentRecorded dominate prose (operator directive, 2026-08-08)', () => {
  it('classifyPulseEnrollmentStateAuthoritative reads the exact fixture as CONFIRMED from its structured fields alone', () => {
    const toolResult = { content: [{ type: 'text', text: CLOSE_PULSE_NOW_FIXTURE_TEXT }] };
    expect(classifyPulseEnrollmentStateAuthoritative(toolResult, CLOSE_PULSE_NOW_FIXTURE_TEXT.toLowerCase())).toBe('CONFIRMED');
  });

  it('extractStructuredPulseOnboardingFields pulls all four projected fields from the fixture, case-preserved', () => {
    const toolResult = { content: [{ type: 'text', text: CLOSE_PULSE_NOW_FIXTURE_TEXT }] };
    expect(extractStructuredPulseOnboardingFields(toolResult)).toEqual({
      pulseEnrolled: true,
      pulseCommitmentRecorded: true,
      verifiablePnlRegistered: false,
      endpointWarning: null,
    });
  });

  it('a structured pulseEnrolled:true would-be defeated by NOT_ENROLLED prose elsewhere in the SAME response is still CONFIRMED — the boolean outranks the regex, not merely coexists with it', () => {
    // Deliberately adversarial: this response ALSO contains "next step:
    // enroll" prose (as Verifiable PnL's own unrelated copy would read) —
    // proving the structured field is checked FIRST and short-circuits the
    // prose classifier entirely, rather than merely happening to agree with
    // it on this fixture.
    const adversarial = JSON.stringify({
      pulseEnrolled: true,
      pulseCommitmentRecorded: true,
      note: 'Next step: Enroll to unlock Verifiable PnL reporting.',
    });
    const toolResult = { content: [{ type: 'text', text: adversarial }] };
    expect(classifyPulseEnrollmentStateAuthoritative(toolResult, adversarial.toLowerCase())).toBe('CONFIRMED');
  });

  it('a structured pulseEnrolled:false is NOT_ENROLLED even when confirmation-shaped words appear elsewhere in the same response', () => {
    const adversarial = JSON.stringify({ pulseEnrolled: false, note: 'Pulse monitoring is enabled for other agents on this registry.' });
    const toolResult = { content: [{ type: 'text', text: adversarial }] };
    expect(classifyPulseEnrollmentStateAuthoritative(toolResult, adversarial.toLowerCase())).toBe('NOT_ENROLLED');
  });

  it('no structured field at all falls back to the scoped prose classifier, unchanged', () => {
    const prose = 'Not enrolled in Pulse monitoring. Next step: Enroll.';
    expect(classifyPulseEnrollmentStateAuthoritative({ content: [{ type: 'text', text: prose }] }, prose.toLowerCase())).toBe('NOT_ENROLLED');
  });

  /*
   * THE FULL ACCEPTANCE TEST, VERBATIM (operator directive, 2026-08-08):
   * seed local REFUSED/PARTNER_NOT_ENROLLED, return the exact live structured
   * response, and require the reconciliation to land on CONFIRMED with the
   * structured projection fields attached — through
   * `verifyHorizenTransparencyActivation`, the SAME function verify/status/
   * route.ts calls for "Check status again", never a second reconciliation
   * path.
   */
  it('seeded REFUSED/PARTNER_NOT_ENROLLED + the exact live structured response reconciles to CONFIRMED, carrying pulseCommitmentRecorded/verifiablePnlRegistered/endpointWarning for the UI to project directly — no "Create fresh authorization" affordance is warranted', async () => {
    const authorizationId = 'auth-close-pulse-now-8798';
    rows.set(authorizationId, {
      authorizationId,
      purpose: 'horizen-pulse-transparency',
      subjectAigentQubeId: 'aigentqube-nakamoto',
      partner: 'horizen',
      network: 'base-sepolia',
      agentId: 'nakamoto-8798',
      walletAddress: WALLET.address,
      issuedAt: '2026-08-07T00:00:00.000Z',
      state: 'REFUSED',
      signerAddress: WALLET.address,
      signatureRef: 'sig-ref-earlier-attempt',
      submissionRef: '0xsubmission-earlier',
      partnerStatus: 'earlier PARTNER_NOT_ENROLLED reread (history — must not be re-asserted as current)',
      receiptRef: null,
      refusalCode: 'PARTNER_NOT_ENROLLED',
      refusalDetail: 'Horizen\'s authoritative status reports this agent is NOT enrolled in Pulse monitoring (stale, superseded below).',
      createdAt: 'earlier',
      updatedAt: 'earlier',
    });

    const result = await verifyHorizenTransparencyActivation(
      authorizationId,
      {
        actorPersonaId: 'persona-operator-1',
        registry: { network: 'base-sepolia', tokenId: '8798' },
        controllerWallet: WALLET.address,
        allowStates: RECONCILABLE_STATES,
      },
      {
        mcpClient: fakeMcpClient({ statusText: CLOSE_PULSE_NOW_FIXTURE_TEXT }),
        fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      // The structured fields this test's UI-projection counterpart
      // (PulseTransparencyToggle) renders directly — never re-derived from
      // prose on the client either.
      expect(result.structuredStatus).toEqual({
        pulseEnrolled: true,
        pulseCommitmentRecorded: true,
        verifiablePnlRegistered: false,
        endpointWarning: null,
      });
    }

    const reconciled = rows.get(authorizationId);
    expect(reconciled.state).toBe('CONFIRMED');
    expect(reconciled.state).not.toBe('REFUSED');
    // The historical refusal is explicitly permitted to remain readable as
    // AUDIT HISTORY (operator: "Preserve the historical refusal in
    // audit/receipt history if desired") — but nothing that reads CURRENT
    // state may branch on it once `state` itself has moved to CONFIRMED.
    // verify/status/route.ts's CONFIRMED branch never reads refusalCode at
    // all, which is the structural guarantee this assertion documents.
    expect(reconciled.refusalCode).toBe('PARTNER_NOT_ENROLLED');
    expect(createActivityReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'horizen_pulse_authorized' }),
    );
  });
});

/*
 * ── RECEIPTED CONSTITUTIONAL STATE (operator directive, 2026-08-08) ─────────
 *
 * "Replace external-state-as-runtime-authority with receipted constitutional
 * state... verified external fact + valid constitutional policy + DVN
 * receipt = canonical constitutional state transition... Reconciliation does
 * not rewrite constitutional history. It produces new evidence."
 *
 * Exercises, against the SAME `verifyHorizenTransparencyActivation` transition
 * boundary already covered above (never a parallel writer):
 *   1. the evidence commitment written alongside CONFIRMED is complete and
 *      readable back via getPulseAuthorizationEvidence;
 *   2/3. pulse_enrollment_verified / pulse_commitment_verified are each
 *      independently gated on their own structured fact;
 *   4/5. reconcilePulseConstitutionalState on agreement vs. disagreement —
 *      disagreement writes a NEW discrepancy receipt and NEVER touches
 *      `state`, which is the acceptance invariant itself;
 *   6/7. reconciliation refuses cleanly against a not-yet-confirmed row or a
 *      confirmed row with no readable receipted evidence, rather than
 *      guessing at either.
 */
const CLOSE_PULSE_NOW_RECONCILIATION_FIXTURE = JSON.stringify({
  pulseEnrolled: true,
  pulseCommitmentRecorded: true,
  verifiablePnlRegistered: false,
  endpointWarning: null,
  nextStep: 'Onboarding complete.',
});

async function confirmPulseViaReread(
  authorizationId: string,
  statusText: string,
): Promise<{ evidence: any; receiptRef: string | null }> {
  rows.set(authorizationId, {
    authorizationId,
    purpose: 'horizen-pulse-transparency',
    subjectAigentQubeId: 'aigentqube-nakamoto',
    partner: 'horizen',
    network: 'base-sepolia',
    agentId: 'nakamoto-8798',
    walletAddress: WALLET.address,
    issuedAt: '2026-08-08T00:00:00.000Z',
    state: 'SUBMITTED',
    signerAddress: WALLET.address,
    signatureRef: 'sig-ref-1',
    submissionRef: '0xsubmission-1',
    partnerStatus: null,
    receiptRef: null,
    refusalCode: null,
    refusalDetail: null,
    createdAt: 'earlier',
    updatedAt: 'earlier',
  });
  const result = await verifyHorizenTransparencyActivation(
    authorizationId,
    {
      actorPersonaId: 'persona-operator-1',
      registry: { network: 'base-sepolia', tokenId: '8798' },
      controllerWallet: WALLET.address,
      runtimeAgentId: 'aigent-nakamoto',
    },
    { mcpClient: fakeMcpClient({ statusText }), fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address) },
  );
  expect(result.ok).toBe(true);
  const row = rows.get(authorizationId);
  expect(row.state).toBe('CONFIRMED');
  const evidence = await getPulseAuthorizationEvidence(row.receiptRef);
  return { evidence, receiptRef: row.receiptRef };
}

describe('Receipted constitutional state — evidence commitment + fine-grained transitions (operator directive, 2026-08-08)', () => {
  it('the evidence commitment written at CONFIRMED carries every field the directive requires, and reads back byte-identical via getPulseAuthorizationEvidence', async () => {
    const { evidence } = await confirmPulseViaReread('auth-evidence-shape', CLOSE_PULSE_NOW_RECONCILIATION_FIXTURE);
    expect(evidence).toMatchObject({
      aigentQubeId: 'aigentqube-nakamoto',
      network: 'base-sepolia',
      tokenId: '8798',
      controllerWallet: WALLET.address,
      authorizationId: 'auth-evidence-shape',
      pulseEnrolled: true,
      pulseCommitmentRecorded: true,
      verifiablePnlRegistered: false,
      endpointWarning: null,
      verifierPolicyVersion: 'gjr-vfy-001-structured-first-v1',
    });
    // A commitment over the COMPLETE source response — 64 lowercase hex
    // chars, sha256's exact shape — never the 500-char `partnerStatus` truncation.
    expect(evidence.sourceResponseCommitment).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof evidence.verifiedAt).toBe('string');
    expect(new Date(evidence.verifiedAt).toString()).not.toBe('Invalid Date');
  });

  it('pulse_enrollment_verified fires whenever the transition confirms; pulse_commitment_verified fires ONLY when pulseCommitmentRecorded is true', async () => {
    await confirmPulseViaReread(
      'auth-both-verified',
      JSON.stringify({ pulseEnrolled: true, pulseCommitmentRecorded: true, verifiablePnlRegistered: false, endpointWarning: null }),
    );
    const actionTypes = createActivityReceipt.mock.calls.map((c: any[]) => c[0].actionType);
    expect(actionTypes).toContain('pulse_enrollment_verified');
    expect(actionTypes).toContain('pulse_commitment_verified');
  });

  it('an enrollment confirmed WITHOUT a commitment fact issues only pulse_enrollment_verified, never pulse_commitment_verified', async () => {
    // pulseEnrolled true, pulseCommitmentRecorded explicitly false — the
    // schema permits these to diverge even though this pilot's live fixture
    // always shows both true together.
    await confirmPulseViaReread(
      'auth-enrolled-not-committed',
      JSON.stringify({ pulseEnrolled: true, pulseCommitmentRecorded: false }),
    );
    const actionTypes = createActivityReceipt.mock.calls.map((c: any[]) => c[0].actionType);
    expect(actionTypes).toContain('pulse_enrollment_verified');
    expect(actionTypes).not.toContain('pulse_commitment_verified');
  });

  it('reconciliation on AGREEMENT: records the check, writes no discrepancy receipt, and leaves state CONFIRMED', async () => {
    const { receiptRef } = await confirmPulseViaReread('auth-reconcile-agree', CLOSE_PULSE_NOW_RECONCILIATION_FIXTURE);
    createActivityReceipt.mockClear();

    const result = await reconcilePulseConstitutionalState(
      'auth-reconcile-agree',
      { actorPersonaId: 'persona-operator-1', registry: { network: 'base-sepolia', tokenId: '8798' }, runtimeAgentId: 'aigent-nakamoto' },
      { mcpClient: fakeMcpClient({ statusText: CLOSE_PULSE_NOW_RECONCILIATION_FIXTURE }) },
    );

    expect(result).toMatchObject({ ok: true, agreement: true, disagreements: [], discrepancyReceiptRef: null });
    expect(createActivityReceipt).not.toHaveBeenCalled();
    expect(rows.get('auth-reconcile-agree').state).toBe('CONFIRMED');
    expect(rows.get('auth-reconcile-agree').receiptRef).toBe(receiptRef);
  });

  it('reconciliation on DISAGREEMENT: names the disagreeing fields, writes horizen_reconciliation_discrepancy_recorded, and — the acceptance invariant itself — NEVER changes state away from CONFIRMED', async () => {
    await confirmPulseViaReread('auth-reconcile-disagree', CLOSE_PULSE_NOW_RECONCILIATION_FIXTURE);
    createActivityReceipt.mockClear();

    const laterDisagreeingRead = JSON.stringify({ pulseEnrolled: false, pulseCommitmentRecorded: true, verifiablePnlRegistered: false, endpointWarning: null });
    const result = await reconcilePulseConstitutionalState(
      'auth-reconcile-disagree',
      { actorPersonaId: 'persona-operator-1', registry: { network: 'base-sepolia', tokenId: '8798' }, runtimeAgentId: 'aigent-nakamoto' },
      { mcpClient: fakeMcpClient({ statusText: laterDisagreeingRead }) },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.agreement).toBe(false);
    expect(result.disagreements).toEqual(['pulseEnrolled']);
    expect(result.discrepancyReceiptRef).not.toBeNull();
    expect(createActivityReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'horizen_reconciliation_discrepancy_recorded',
        actionInput: expect.objectContaining({ disagreements: ['pulseEnrolled'] }),
      }),
    );
    // THE ASSERTION THAT MATTERS: a later disagreeing read produces a NEW
    // event, never a silent rewrite of the receipted transition.
    expect(rows.get('auth-reconcile-disagree').state).toBe('CONFIRMED');
  });

  it('refuses STATE_MISMATCH against a row that has not yet reached CONFIRMED — reconciliation is not a substitute for verifyHorizenTransparencyActivation', async () => {
    rows.set('auth-not-yet-confirmed', {
      authorizationId: 'auth-not-yet-confirmed',
      state: 'SUBMITTED',
      subjectAigentQubeId: 'aigentqube-nakamoto',
      receiptRef: null,
    });
    const result = await reconcilePulseConstitutionalState(
      'auth-not-yet-confirmed',
      { actorPersonaId: 'persona-operator-1', registry: { network: 'base-sepolia', tokenId: '8798' } },
      { mcpClient: fakeMcpClient() },
    );
    expect(result).toMatchObject({ ok: false, refusalCode: 'STATE_MISMATCH' });
    expect(createActivityReceipt).not.toHaveBeenCalled();
  });

  it('refuses NO_RECEIPTED_EVIDENCE for a CONFIRMED row with no readable receipt, rather than fabricating agreement', async () => {
    rows.set('auth-confirmed-no-receipt', {
      authorizationId: 'auth-confirmed-no-receipt',
      state: 'CONFIRMED',
      subjectAigentQubeId: 'aigentqube-nakamoto',
      receiptRef: null,
    });
    const result = await reconcilePulseConstitutionalState(
      'auth-confirmed-no-receipt',
      { actorPersonaId: 'persona-operator-1', registry: { network: 'base-sepolia', tokenId: '8798' } },
      { mcpClient: fakeMcpClient() },
    );
    expect(result).toMatchObject({ ok: false, refusalCode: 'NO_RECEIPTED_EVIDENCE' });
  });
});

/*
 * ── PRE-SUBMIT PULSE STATUS GATE — correlated trace c565e58b-4ce8-4ccf-9f0f-
 * ac611d1d526c (operator directive, 2026-08-07) ─────────────────────────────
 *
 * `crossCheckRegistryOwner` already calls `get_onboarding_status` before any
 * signing, purely to extract an owner address for the cross-source conflict
 * check. That response is DISCARDED afterward — `runHorizenTransparencyAuthorization`
 * never asks whether it also says Pulse is already enrolled, so an
 * already-enrolled agent is signed and resubmitted anyway, every time. This
 * exercises the required fix: reuse that SAME already-fetched response (no
 * new partner call) to short-circuit before signing when it already reports
 * enrollment.
 *
 * The exact live transcript from the operator's brief, verbatim.
 */
const PRESUBMIT_LIVE_ENROLLED_TEXT =
  '✓ Enrolled in Pulse monitoring\n' + '✓ On-chain identity commitment recorded\n' + 'Next step: Onboarding complete.';

describe('Pre-submit Pulse status gate — an already-enrolled agent is never resubmitted (2026-08-07)', () => {
  it('classifyPulseEnrollmentState reads the operator\'s exact transcript as CONFIRMED (sanity check for the fixture itself)', () => {
    expect(classifyPulseEnrollmentState(PRESUBMIT_LIVE_ENROLLED_TEXT)).toBe('CONFIRMED');
  });

  it('acceptance #1 + #3 — a fresh ceremony against an already-enrolled agent never calls enable_pulse_monitoring and never returns PARTNER_NOT_ENROLLED', async () => {
    const authorizationId = 'auth-presubmit-already-enrolled';
    const mcp = fakeMcpClient({ statusText: PRESUBMIT_LIVE_ENROLLED_TEXT });
    const result = await runHorizenTransparencyAuthorization(baseInput({ authorizationId }), {
      mcpClient: mcp,
      fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });

    expect(result.ok).toBe(true);
    expect(result.refusalCode).not.toBe('PARTNER_NOT_ENROLLED');
    // The decisive assertion: enable_pulse_monitoring was never invoked.
    expect(mcp.callTool).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'enable_pulse_monitoring' }));
    expect(rows.get(authorizationId).state).toBe('CONFIRMED');
    expect(createActivityReceipt).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'horizen_pulse_authorized' }));
  });

  it('acceptance #2 — an existing REFUSED/PARTNER_NOT_ENROLLED row reconciles to CONFIRMED via the pre-submit read alone, without resubmitting', async () => {
    const authorizationId = 'auth-presubmit-reconcile-refused';
    rows.set(authorizationId, {
      authorizationId,
      purpose: 'horizen-financial-transparency',
      subjectAigentQubeId: 'aigentqube-nakamoto',
      partner: 'horizen',
      network: 'base-sepolia',
      agentId: '8798',
      walletAddress: WALLET.address.toLowerCase(),
      issuedAt: '2026-08-06T00:00:00.000Z',
      nonce: 'earlier-nonce',
      expiresAt: '2026-08-06T00:15:00.000Z',
      state: 'REFUSED',
      signerAddress: WALLET.address,
      signatureRef: 'sig-ref-earlier',
      submissionRef: '0xsubmission-earlier',
      partnerStatus: 'earlier NOT_ENROLLED reread',
      receiptRef: null,
      refusalCode: 'PARTNER_NOT_ENROLLED',
      refusalDetail: 'earlier refusal (history)',
      createdAt: 'earlier',
      updatedAt: 'earlier',
    });

    const mcp = fakeMcpClient({ statusText: PRESUBMIT_LIVE_ENROLLED_TEXT });
    const result = await runHorizenTransparencyAuthorization(baseInput({ authorizationId }), {
      mcpClient: mcp,
      fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });

    expect(result.ok).toBe(true);
    expect(mcp.callTool).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'enable_pulse_monitoring' }));
    const reconciled = rows.get(authorizationId);
    expect(reconciled.state).toBe('CONFIRMED');
    expect(reconciled.state).not.toBe('REFUSED');
  });

  it('acceptance #4 (preserve) — a pre-submit read that explicitly says not enrolled proceeds to the ordinary sign+submit ceremony, unaffected by the new gate', async () => {
    const authorizationId = 'auth-presubmit-genuinely-not-enrolled';
    const mcp = fakeMcpClient({ statusText: 'Not enrolled in Pulse monitoring. Next step: Enroll.' });
    const result = await runHorizenTransparencyAuthorization(baseInput({ authorizationId }), {
      mcpClient: mcp,
      fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    // Same fixture text pre- and post-submit (the fake client returns one
    // canned response) — genuinely not enrolled resolves the ordinary way:
    // submit IS attempted, and the post-submit reread still refuses honestly.
    expect(mcp.callTool).toHaveBeenCalledWith(expect.objectContaining({ name: 'enable_pulse_monitoring' }));
    expect(result).toMatchObject({ ok: false, refusalCode: 'PARTNER_NOT_ENROLLED' });
  });

  it('acceptance #5 (preserve) — an owner-source conflict still refuses BEFORE the enrollment gate, never masked by a positive-looking status read', async () => {
    const authorizationId = 'auth-presubmit-owner-conflict';
    // The exact live owner-conflict transcript (also positive on enrollment
    // wording) used by the existing HORIZEN_OWNER_SOURCE_CONFLICT suite above —
    // proves the conflict check still runs first even when the SAME response
    // would otherwise look enrolled.
    const statusText =
      'Onboarding status for agent 8798 on Base:\n' +
      '✓ Registered on-chain — owner 0xa6aCB16f7baf5FFE984a67d96c62b686ED6c1709.\n' +
      '✓ Enrolled in Pulse monitoring.\n' +
      'Next step: Onboarding complete.';
    const result = await runHorizenTransparencyAuthorization(baseInput({ authorizationId }), {
      mcpClient: fakeMcpClient({ statusText }),
      fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    expect(result).toMatchObject({ ok: false, refusalCode: 'HORIZEN_OWNER_SOURCE_CONFLICT' });
  });
});

/*
 * ── THE FORWARDING GAP BEHIND acceptance #7 (correlated trace, 2026-08-07) ──
 *
 * `services/horizen/pulseEnrollmentTrace.ts`'s `startPulseEnrollmentTrace`
 * decides whether Horizen was ever actually contacted for submission by
 * checking `result.rawSubmitResult !== undefined`. When submission genuinely
 * SUCCEEDED but the immediate post-submit reread did not (yet) confirm —
 * PARTNER_NOT_ENROLLED, PARTNER_STATE_UNRESOLVED, or any other reread
 * refusal — `runHorizenTransparencyAuthorization`'s failure return dropped
 * `submitted.rawSubmitResult`/`submittedArguments` entirely, so the trace
 * read this as "never reached submission" and froze at LOCAL_CONTRACT_ERROR
 * — which also means `computeComplete` marked it `complete: true`,
 * permanently blocking the scheduled +5/+15/+30s continuation rereads that
 * would otherwise have discovered Horizen's later, genuine confirmation.
 */
describe('Submit-then-inconclusive-reread must still report rawSubmitResult (2026-08-07)', () => {
  it('a submission that succeeds, followed by a reread that reports NOT_ENROLLED, still carries rawSubmitResult + submittedArguments on the failure result', async () => {
    const authorizationId = 'auth-submit-then-not-yet-converged';
    let statusCallCount = 0;
    const client = {
      listTools: vi.fn(async () => ({
        tools: [
          { name: 'build_pulse_auth_message', inputSchema: { properties: { tokenId: {}, network: {}, wallet: {} } } },
          { name: 'enable_pulse_monitoring', inputSchema: REAL_ENABLE_PULSE_SCHEMA },
          { name: 'get_onboarding_status', inputSchema: { properties: { tokenId: {}, submissionRef: {} } } },
        ],
      })),
      callTool: vi.fn(async ({ name }: { name: string }) => {
        if (name === 'build_pulse_auth_message') {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ message: 'Sign...\nASR Pulse enable\nAgent: 8798\nIssued At: 2026-07-31T12:00:00.000Z' }),
              },
            ],
          };
        }
        if (name === 'enable_pulse_monitoring') {
          return { content: [{ type: 'text', text: JSON.stringify({ submissionRef: '0xsub-converge', status: 'success' }) }] };
        }
        if (name === 'get_onboarding_status') {
          statusCallCount += 1;
          // Pre-submit owner-extraction call: no owner named, harmless.
          // Post-submit reread: genuinely hasn't converged yet — an explicit
          // negative, which is a CONCLUSIVE (not pending) verdict per
          // classifyPulseEnrollmentState's own contract, and is preserved
          // unchanged by this fix.
          const text = statusCallCount === 1 ? '{"status":"unrelated"}' : 'Not enrolled in Pulse monitoring. Next step: Enroll.';
          return { content: [{ type: 'text', text }] };
        }
        throw new Error(`unexpected tool: ${name}`);
      }),
    };

    const result = await runHorizenTransparencyAuthorization(
      baseInput({ authorizationId, registry: { network: 'base-sepolia', tokenId: '8798' } }),
      {
        mcpClient: client,
        fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
        resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
        now: FIXED_NOW,
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // The genuine reread verdict is unchanged — this fix never touches it.
    expect(result.refusalCode).toBe('PARTNER_NOT_ENROLLED');
    // The decisive assertion: submission DID happen, and the result must say so.
    expect(result.rawSubmitResult).toBeDefined();
    expect(result.submittedArguments).toBeDefined();
    expect((result.submittedArguments as any)?.agentId).toBe('8798');
  });
});
