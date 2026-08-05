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
  runHorizenTransparencyAuthorization,
  signHorizenTransparencyAuthorization,
  submitHorizenTransparencyAuthorization,
  pulseBuildCandidates,
  parsePulseAuthMessage,
  diffPulseCeremonyArgs,
  type PrepareHorizenTransparencyAuthorizationInput,
  type PulseCeremonyArgs,
} from '@/services/horizen/authorizationClient';
import { matchSchemaFields, missingRequiredFields } from '@/services/horizen/mcpSchemaMatch';
import { HORIZEN_NETWORK_FACTS } from '@/services/horizen/identity';

const WALLET = ethers.Wallet.createRandom();
const FIXED_NOW = () => new Date('2026-07-31T12:00:00.000Z');

function fakeMcpClient(overrides: Partial<{ tools: any[]; buildMessage: string; submissionRef: string; statusText: string }> = {}) {
  const tools = overrides.tools ?? [
    { name: 'build_pulse_auth_message', inputSchema: { properties: { tokenId: {}, network: {}, wallet: {} } } },
    { name: 'enable_pulse_monitoring', inputSchema: { properties: { message: {}, signature: {} } } },
    { name: 'get_onboarding_status', inputSchema: { properties: { tokenId: {}, submissionRef: {} } } },
  ];
  const buildMessage = overrides.buildMessage ?? 'authorize pulse monitoring for token 1234 on base-sepolia';
  const submissionRef = overrides.submissionRef ?? '0xsubmission123';
  const statusText = overrides.statusText ?? '{"status":"active"}';
  return {
    listTools: vi.fn(async () => ({ tools })),
    callTool: vi.fn(async ({ name }: { name: string }) => {
      if (name === 'build_pulse_auth_message') return { content: [{ type: 'text', text: JSON.stringify({ message: buildMessage }) }] };
      if (name === 'enable_pulse_monitoring') return { content: [{ type: 'text', text: JSON.stringify({ submissionRef }) }] };
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

  it('invalid signature — signer does not match the registered controller', async () => {
    const other = ethers.Wallet.createRandom();
    const mcpClient = fakeMcpClient();
    const result = await runHorizenTransparencyAuthorization(baseInput({ controllerWallet: other.address }), {
      mcpClient,
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
      if (name === 'build_pulse_auth_message') return { content: [{ type: 'text', text: JSON.stringify({ message: 'authorize this' }) }] };
      if (name === 'enable_pulse_monitoring') return { content: [{ type: 'text', text: JSON.stringify({ unrelatedField: 'x' }) }] };
      throw new Error(`unexpected tool call: ${name}`);
    });
    const result = await runHorizenTransparencyAuthorization(baseInput(), {
      mcpClient,
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

/*
 * Horizen partner confirmation (2026-08-04): the server never reads
 * `message`/`signedMessage`/`signedPayload` — it reconstructs the signed
 * plaintext server-side from `(action, agentId, walletAddress, issuedAt,
 * chain)` and verifies the signature against ITS OWN reconstruction. These
 * canaries pin that:
 *   1. this client parses the partner's own returned plaintext for the
 *      authoritative `issuedAt` rather than stamping its own clock;
 *   2. the same five values used to build the message are the ones sent to
 *      enable_pulse_monitoring, not re-derived or silently omitted;
 *   3. a malformed/incomplete set of those five values is refused LOCALLY,
 *      before any call to Horizen.
 */
const REALISTIC_PULSE_MESSAGE = (overrides: Partial<Record<'agent' | 'network' | 'chain' | 'registry' | 'wallet' | 'issuedAt', string>> = {}) =>
  [
    'ASR Pulse enable',
    `Agent: ${overrides.agent ?? '8798'}`,
    `Network: ${overrides.network ?? 'sepolia'}`,
    `Chain: ${overrides.chain ?? '84532'}`,
    `Registry: ${overrides.registry ?? '0x8004a818f0a0b5f3c8e6b2f0b5d9b0e0c0a0b0c0'}`,
    `Wallet: ${overrides.wallet ?? '0x24bbb9c7aacb33556d1429a3e1b33f05faf7d4b9'}`,
    `Issued At: ${overrides.issuedAt ?? '2026-08-04T16:17:12.655Z'}`,
  ].join('\n');

describe('parsePulseAuthMessage — reads the partner\'s own plaintext template', () => {
  it('extracts every documented field', () => {
    const parsed = parsePulseAuthMessage(REALISTIC_PULSE_MESSAGE());
    expect(parsed).toEqual({
      action: 'enable',
      agentId: '8798',
      network: 'sepolia',
      chainId: '84532',
      registry: '0x8004a818f0a0b5f3c8e6b2f0b5d9b0e0c0a0b0c0',
      walletAddress: '0x24bbb9c7aacb33556d1429a3e1b33f05faf7d4b9',
      issuedAt: '2026-08-04T16:17:12.655Z',
    });
  });

  it('never throws on unrecognised text, and returns nulls rather than guessing', () => {
    expect(() => parsePulseAuthMessage('not the template at all')).not.toThrow();
    expect(parsePulseAuthMessage('not the template at all')).toEqual({
      action: null,
      agentId: null,
      network: null,
      chainId: null,
      registry: null,
      walletAddress: null,
      issuedAt: null,
    });
  });
});

describe('diffPulseCeremonyArgs — byte-identity comparison', () => {
  const base: PulseCeremonyArgs = { action: 'enable', agentId: '8798', walletAddress: '0x24bb…d4b9', chain: 'base-sepolia', issuedAt: '2026-08-04T16:17:12.655Z' };

  it('reports no diffs for identical objects', () => {
    expect(diffPulseCeremonyArgs(base, { ...base })).toEqual([]);
  });

  it('names the exact field and both values on a mismatch (e.g. wallet casing)', () => {
    const drifted: PulseCeremonyArgs = { ...base, walletAddress: '0x24BB…D4B9' };
    const diffs = diffPulseCeremonyArgs(base, drifted);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toContain('walletAddress');
    expect(diffs[0]).toContain(base.walletAddress);
    expect(diffs[0]).toContain(drifted.walletAddress);
  });
});

describe('the ceremony preserves issuedAt from the partner\'s own message, never its own clock (2026-08-04)', () => {
  it('uses the parsed "Issued At:" value when the build message matches the documented template', async () => {
    const mcpClient = fakeMcpClient({ buildMessage: REALISTIC_PULSE_MESSAGE({ agent: '1234', wallet: WALLET.address.toLowerCase() }) });
    const prepared = await prepareHorizenTransparencyAuthorization(baseInput(), { mcpClient, now: FIXED_NOW });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    // FIXED_NOW is 2026-07-31T12:00:00.000Z — the message's own timestamp must win, not the clock.
    expect(prepared.value.pulseArgs.issuedAt).toBe('2026-08-04T16:17:12.655Z');
    expect(prepared.value.envelope.issuedAt).toBe('2026-08-04T16:17:12.655Z');
  });

  it('falls back to the local clock, loudly, when the message does not match the template', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const mcpClient = fakeMcpClient({ buildMessage: 'not the documented template' });
      const prepared = await prepareHorizenTransparencyAuthorization(baseInput(), { mcpClient, now: FIXED_NOW });
      expect(prepared.ok).toBe(true);
      if (!prepared.ok) return;
      expect(prepared.value.pulseArgs.issuedAt).toBe(FIXED_NOW().toISOString());
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[HORIZEN ESCALATION]'));
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe('submitHorizenTransparencyAuthorization sends the same five reconstruction fields the build call used (2026-08-04)', () => {
  it('includes action, agentId, walletAddress, chain and issuedAt when the partner schema declares them', async () => {
    const mcpClient = fakeMcpClient({
      tools: [
        { name: 'build_pulse_auth_message', inputSchema: { properties: { tokenId: {}, network: {}, wallet: {} } } },
        {
          name: 'enable_pulse_monitoring',
          inputSchema: { properties: { message: {}, signature: {}, action: {}, agentId: {}, walletAddress: {}, chain: {}, issuedAt: {} } },
        },
        { name: 'get_onboarding_status', inputSchema: { properties: { tokenId: {}, submissionRef: {} } } },
      ],
      buildMessage: REALISTIC_PULSE_MESSAGE({ agent: '1234', wallet: WALLET.address.toLowerCase() }),
    });

    const prepared = await prepareHorizenTransparencyAuthorization(baseInput(), { mcpClient, now: FIXED_NOW });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const signed = await signHorizenTransparencyAuthorization(prepared.value, {
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;

    await submitHorizenTransparencyAuthorization(
      prepared.value.authorizationId,
      { message: prepared.value.message, signature: signed.value, pulseArgs: prepared.value.pulseArgs },
      { mcpClient },
    );

    const submitCall = mcpClient.callTool.mock.calls.find((c: any) => c[0].name === 'enable_pulse_monitoring');
    expect(submitCall).toBeTruthy();
    const sentArgs = submitCall[0].arguments;
    expect(sentArgs.action).toBe(prepared.value.pulseArgs.action);
    expect(sentArgs.agentId).toBe(prepared.value.pulseArgs.agentId);
    expect(sentArgs.walletAddress).toBe(prepared.value.pulseArgs.walletAddress);
    expect(sentArgs.chain).toBe(prepared.value.pulseArgs.chain);
    expect(sentArgs.issuedAt).toBe(prepared.value.pulseArgs.issuedAt);
    // The exact same value that was used to build the message — not re-lowercased, not re-derived.
    expect(sentArgs.walletAddress).toBe(WALLET.address.toLowerCase());
  });

  async function prepareAndSign(authorizationId: string) {
    // agent: '1234' matches baseInput()'s registry.tokenId, so the message's
    // own Agent: line agrees with what this client requested — no spurious
    // build-time drift warning from an intentionally mismatched fixture.
    const mcpClient = fakeMcpClient({ buildMessage: REALISTIC_PULSE_MESSAGE({ agent: '1234', wallet: WALLET.address.toLowerCase() }) });
    const prepared = await prepareHorizenTransparencyAuthorization(baseInput({ authorizationId }), { mcpClient, now: FIXED_NOW });
    if (!prepared.ok) throw new Error(`prepare failed: ${prepared.detail}`);
    const signed = await signHorizenTransparencyAuthorization(prepared.value, {
      resolveSigningKey: async () => ({ privateKeyHex: WALLET.privateKey, storedAddress: WALLET.address }),
      now: FIXED_NOW,
    });
    if (!signed.ok) throw new Error(`sign failed: ${signed.detail}`);
    return { mcpClient, prepared: prepared.value, signed: signed.value };
  }

  it('refuses locally with PULSE_ARGUMENT_DRIFT — never calling Horizen — when walletAddress was re-cased after the build step', async () => {
    const { mcpClient, prepared, signed } = await prepareAndSign('auth-drift-casing');
    const checksummed = ethers.getAddress(prepared.pulseArgs.walletAddress); // EIP-55 checksummed, not lowercased
    const callsBefore = mcpClient.callTool.mock.calls.length;

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = await submitHorizenTransparencyAuthorization(
        prepared.authorizationId,
        { message: prepared.message, signature: signed, pulseArgs: { ...prepared.pulseArgs, walletAddress: checksummed } },
        { mcpClient },
      );
      expect(result).toMatchObject({ ok: false, refusalCode: 'PULSE_ARGUMENT_DRIFT' });
      if (!result.ok) expect(result.detail).toContain('not lowercased');
      // The whole point: refused before spending a network call on it.
      expect(mcpClient.callTool.mock.calls.length).toBe(callsBefore);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('refuses locally with PULSE_ARGUMENT_DRIFT when a required field is missing, once a row exists', async () => {
    const { mcpClient, prepared, signed } = await prepareAndSign('auth-drift-missing-field');
    const callsBefore = mcpClient.callTool.mock.calls.length;

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = await submitHorizenTransparencyAuthorization(
        prepared.authorizationId,
        { message: prepared.message, signature: signed, pulseArgs: { ...prepared.pulseArgs, chain: '' } },
        { mcpClient },
      );
      expect(result).toMatchObject({ ok: false, refusalCode: 'PULSE_ARGUMENT_DRIFT' });
      // The whole point: refused BEFORE any partner call.
      expect(mcpClient.callTool.mock.calls.length).toBe(callsBefore);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
