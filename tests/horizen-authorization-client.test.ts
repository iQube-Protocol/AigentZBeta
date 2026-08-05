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
    const record = { ...input, state: 'PREPARED', signerAddress: null, signatureRef: null, submissionRef: null, partnerStatus: null, receiptRef: null, refusalCode: null, refusalDetail: null, payloadHash: null, createdAt: 'now', updatedAt: 'now' };
    rows.set(input.authorizationId, record);
    return { ok: true, record };
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

const createActivityReceipt = vi.fn(async (input: any) => ({ id: 'receipt-1', ...input }));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: (...args: any[]) => createActivityReceipt(...args),
}));

import {
  prepareHorizenTransparencyAuthorization,
  signHorizenTransparencyAuthorization,
  runHorizenTransparencyAuthorization,
  verifySignatureIntegrity,
  parseLabelledMessageFields,
  buildFieldParityTable,
  pulseBuildCandidates,
  detectPulseArgumentDrift,
  type PrepareHorizenTransparencyAuthorizationInput,
} from '@/services/horizen/authorizationClient';
import { matchSchemaFields, missingRequiredFields } from '@/services/horizen/mcpSchemaMatch';
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
  overrides: Partial<{ tools: any[]; buildMessage: string; submissionRef: string; statusText: string; enableResult: any }> = {},
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
  return {
    listTools: vi.fn(async () => ({ tools })),
    callTool: vi.fn(async ({ name }: { name: string }) => {
      if (name === 'build_pulse_auth_message') return { content: [{ type: 'text', text: JSON.stringify({ message: buildMessage }) }] };
      if (name === 'enable_pulse_monitoring') {
        if (overrides.enableResult) return overrides.enableResult;
        return { content: [{ type: 'text', text: JSON.stringify({ submissionRef }) }] };
      }
      if (name === 'get_onboarding_status') return { content: [{ type: 'text', text: statusText }] };
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
});

describe('runHorizenTransparencyAuthorization — full pipeline (Phase 1 acceptance criterion)', () => {
  it('discovers tools, prepares, signs without exposing key material, submits, confirms, and writes the receipt', async () => {
    const mcpClient = fakeMcpClient();
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
    expect(createActivityReceipt).toHaveBeenCalledTimes(1);
    const receiptCall = createActivityReceipt.mock.calls[0][0];
    expect(receiptCall.actionType).toBe('horizen_pulse_authorized');
    expect(receiptCall.personaId).toBe('persona-operator-1');

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
    const mcpClient = fakeMcpClient();
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

  it('partner mutation not confirmed — a valid signature is not completion without an authoritative reread', async () => {
    const result = await runHorizenTransparencyAuthorization(baseInput(), {
      mcpClient: fakeMcpClient({ statusText: '{"status":"pending"}' }),
      fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    expect(result).toMatchObject({ ok: false, refusalCode: 'HORIZEN_REREAD_NOT_CONFIRMED' });
    expect(createActivityReceipt).not.toHaveBeenCalled();
  });

  it('partner submission failure — no recognisable submission reference is refused, never guessed', async () => {
    const mcpClient = fakeMcpClient();
    mcpClient.callTool = vi.fn(async ({ name }: { name: string }) => {
      if (name === 'build_pulse_auth_message') return { content: [{ type: 'text', text: JSON.stringify({ message: 'authorize this issuedAt="2026-07-31T12:00:00.000Z"' }) }] };
      if (name === 'enable_pulse_monitoring') return { content: [{ type: 'text', text: JSON.stringify({ unrelatedField: 'x' }) }] };
      throw new Error(`unexpected tool call: ${name}`);
    });
    const result = await runHorizenTransparencyAuthorization(baseInput(), {
      mcpClient,
      // The new pre-submit owner cross-check (2026-08-04) now runs between
      // sign and submit — without this fixture it would fall through to the
      // REAL defaultFetchRegistryAgent and attempt a live network call.
      fetchRegistryAgent: fakeFetchRegistryAgent(WALLET.address),
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    expect(result).toMatchObject({ ok: false, refusalCode: 'HORIZEN_SUBMISSION_FAILED' });
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
    const mcpClient = fakeMcpClient();
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
    const mcpClient = fakeMcpClient();
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
 * PULSE_MESSAGE_DRIFT — instrumentation for the Horizen live-test escalation
 * (2026-08-05): "the recovered signer ≠ the walletAddress you submitted...
 * your 401 says your bytes ≠ our reconstruction." Leading hypothesis: build_
 * pulse_auth_message returns a human-readable blob PLUS a `--- structured
 * ---` JSON section, and the signable bytes are that section's `message`
 * field — not the rendered text around it. These tests exercise
 * `prepareHorizenTransparencyAuthorization`'s new comparison between what
 * `extractPartnerMessage` chose to sign and a marker-aware read of the same
 * response, WITHOUT changing which value gets signed on the non-drifted path
 * (al, 2026-08-05: "Do not change signing behavior until the instrumentation
 * identifies the exact divergence").
 */
describe('PULSE_MESSAGE_DRIFT — instrumentation, not a fix (Horizen live-test escalation, 2026-08-05)', () => {
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

  it('refuses with rich byte-level diagnostics when the structured JSON message differs from the whole-blob fallback', async () => {
    const structuredMessage =
      'ASR Pulse enable\nAgent: 1234\nNetwork: base-sepolia\nChain: 84532\nIssued At: 2026-07-31T12:00:00.000Z';
    const blob =
      'Sign this message with wallet 0xabc… then call enable_pulse_monitoring with the signature and issuedAt="2026-07-31T12:00:00.000Z".\n' +
      structuredMessage +
      '\n--- structured ---\n' +
      JSON.stringify({ message: structuredMessage });

    const result = await prepareHorizenTransparencyAuthorization(baseInput(), {
      mcpClient: mcpClientWithBuildText(blob),
      now: FIXED_NOW,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusalCode).toBe('PULSE_MESSAGE_DRIFT');
    // Named diagnostics on BOTH sides — length, sha256, first/last 32 chars,
    // JSON.stringify — never just "they differ."
    expect(result.detail).toContain('SIGNED candidate');
    expect(result.detail).toContain('STRUCTURED candidate');
    expect(result.detail).toContain('sha256');
    expect(result.detail).toContain('first32');
    expect(result.detail).toContain('last32');
    // The signed side is the full blob (the bug); the structured side is not.
    // (first32/last32 are printed as raw slices, not JSON.stringify-quoted —
    // only the whole-string `json` field is stringified.)
    expect(result.detail).toContain(blob.slice(0, 32));
    expect(result.detail).toContain(structuredMessage.slice(0, 32));

    // Never persisted as PREPARED — the local refusal happens before any
    // partner-facing state transition that would suggest progress was made.
    expect(rows.size).toBe(0);
  });

  it('does NOT refuse when the response is bare JSON with a named field — the existing, already-working shape agrees with itself and is never flagged as drift', async () => {
    // fakeMcpClient()'s default build response is exactly this shape:
    // `{"message": "..."}` with no prose/marker at all — extractPartnerMessage
    // resolves it via 'named-field' and extractStructuredMessageField finds
    // the identical field via the same embedded JSON object. Asserted
    // explicitly here (rather than only implicitly via the next test) because
    // this is precisely the shape every other test in this file signs today —
    // instrumentation must never regress it.
    const result = await prepareHorizenTransparencyAuthorization(baseInput(), {
      mcpClient: fakeMcpClient(),
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.message).not.toContain('--- structured ---');
  });

  it('proceeds unchanged when no structured alternative exists at all — instrumentation only ever adds a refusal, never narrows the existing accepted shape', async () => {
    // The existing, already-working bare-JSON shape every other test in this
    // file uses — no "--- structured ---" marker anywhere.
    const result = await prepareHorizenTransparencyAuthorization(baseInput(), {
      mcpClient: fakeMcpClient(),
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(true);
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
