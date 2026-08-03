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
  type PrepareHorizenTransparencyAuthorizationInput,
} from '@/services/horizen/authorizationClient';

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

  it('sends the numeric chain id, never the network name as `chain`', () => {
    expect(source).toMatch(/chain:\s*facts\.chainId/);
    expect(source, "'chain' was being sent the network key").not.toMatch(/chain:\s*input\.registry\.network/);
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
    expect(source).toMatch(/wallet:\s*input\.controllerWallet\.toLowerCase\(\)/);
  });

  it('refuses an unparseable agent id rather than sending a label', () => {
    expect(source).toMatch(/if \(!parsedAgentId\.ok\)/);
    expect(source).toContain('is not a usable agent id');
  });
});
