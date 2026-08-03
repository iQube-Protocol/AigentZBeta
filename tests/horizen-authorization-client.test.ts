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
  pulseBuildCandidates,
  type PrepareHorizenTransparencyAuthorizationInput,
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
