/**
 * services/horizen/registrationClient.ts — the Register stage's real
 * mutation path (agent-selectable, 2026-07-31). Exercises the 3-step
 * pipeline (prepare -> broadcast -> check status) against injected MCP/RPC
 * fixtures — never a live network call. Mirrors
 * tests/horizen-authorization-client.test.ts's injection conventions.
 */

import { describe, it, expect, vi } from 'vitest';
import { ethers } from 'ethers';
import {
  prepareAgentRegistration,
  broadcastAgentRegistration,
  checkAgentRegistrationStatus,
  extractUnsignedTx,
  extractTxHash,
} from '@/services/horizen/registrationClient';

const OWNER_WALLET = ethers.Wallet.createRandom();
const IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e';

function fakeMcpClient(overrides: Partial<{ tools: any[]; unsignedTx: any; txHash: string; statusText: string }> = {}) {
  const tools = overrides.tools ?? [
    { name: 'build_registration_tx', inputSchema: { properties: { walletAddress: {}, name: {}, description: {}, services: {}, network: {} } } },
    { name: 'submit_registry_tx', inputSchema: { properties: { signedTransaction: {}, network: {} } } },
    { name: 'get_onboarding_status', inputSchema: { properties: { transactionHash: {}, network: {} } } },
  ];
  const unsignedTx = overrides.unsignedTx ?? { to: IDENTITY_REGISTRY, data: '0xabc123', chainId: 84532 };
  const txHash = overrides.txHash ?? '0x' + '11'.repeat(32);
  const statusText = overrides.statusText ?? '{"status":"active"}';
  return {
    listTools: vi.fn(async () => ({ tools })),
    callTool: vi.fn(async ({ name }: { name: string }) => {
      if (name === 'build_registration_tx') return { content: [{ type: 'text', text: JSON.stringify(unsignedTx) }] };
      if (name === 'submit_registry_tx') return { content: [{ type: 'text', text: JSON.stringify({ transactionHash: txHash }) }] };
      if (name === 'get_onboarding_status') return { content: [{ type: 'text', text: statusText }] };
      throw new Error(`unexpected tool call: ${name}`);
    }),
  };
}

function fakeFetchAgentCard(card: Record<string, unknown> = {}) {
  const full = {
    name: 'Aigent MoneyPenny',
    description: 'The Constitutional Financial Services Agent.',
    url: 'https://dev-beta.aigentz.me/api/agents/moneypenny/agent-card.json',
    metadata: { runtime_agent_id: 'aigent-moneypenny', horizen: {} },
    skills: [{ id: 'financial-advisory', name: 'Financial Advisory', description: 'Grounded financial guidance.' }],
    ...card,
  };
  const raw = JSON.stringify(full);
  return vi.fn(async () => ({ card: full, url: full.url, raw }));
}

const resolveOwnerWalletAddress = () => OWNER_WALLET.address;

describe('prepareAgentRegistration', () => {
  it('builds and cross-checks the unsigned tx against this repo\'s recorded IdentityRegistry, without signing anything', async () => {
    const mcpClient = fakeMcpClient();
    const result = await prepareAgentRegistration(
      { agentSlug: 'moneypenny', agentCardBase: 'https://dev-beta.aigentz.me' },
      { mcpClient, fetchAgentCard: fakeFetchAgentCard(), resolveOwnerWalletAddress },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.network).toBe('base-sepolia');
    expect(result.value.unsignedTx.to).toBe(IDENTITY_REGISTRY);
    expect(typeof result.value.agentCardHash).toBe('string');
    expect(result.value.agentCardHash).toHaveLength(64);

    // Confirmed-live schema (2026-07-31): walletAddress/name/description/services.
    const buildCall = mcpClient.callTool.mock.calls.find((c: any[]) => c[0].name === 'build_registration_tx');
    expect(buildCall[0].arguments).toMatchObject({
      walletAddress: OWNER_WALLET.address,
      name: 'Aigent MoneyPenny',
      description: 'The Constitutional Financial Services Agent.',
      services: [{ name: 'Financial Advisory', description: 'Grounded financial guidance.' }],
    });
  });

  it('refuses OWNER_KEY_NOT_CONFIGURED before ever calling build_registration_tx when no owner wallet is configured', async () => {
    const mcpClient = fakeMcpClient();
    const result = await prepareAgentRegistration(
      { agentSlug: 'moneypenny', agentCardBase: 'https://dev-beta.aigentz.me' },
      { mcpClient, fetchAgentCard: fakeFetchAgentCard(), resolveOwnerWalletAddress: () => null },
    );
    expect(result).toMatchObject({ ok: false, refusalCode: 'OWNER_KEY_NOT_CONFIGURED' });
    expect(mcpClient.callTool).not.toHaveBeenCalled();
  });

  it('refuses UNKNOWN_AGENT for a slug not in the registrable-agents config', async () => {
    const result = await prepareAgentRegistration({ agentSlug: 'not-a-real-agent', agentCardBase: 'https://dev-beta.aigentz.me' });
    expect(result).toMatchObject({ ok: false, refusalCode: 'UNKNOWN_AGENT' });
  });

  it('refuses ALREADY_REGISTERED rather than re-registering when the card already carries a tokenId', async () => {
    const result = await prepareAgentRegistration(
      { agentSlug: 'moneypenny', agentCardBase: 'https://dev-beta.aigentz.me' },
      { mcpClient: fakeMcpClient(), fetchAgentCard: fakeFetchAgentCard({ metadata: { runtime_agent_id: 'aigent-moneypenny', horizen: { tokenId: '999' } } }), resolveOwnerWalletAddress },
    );
    expect(result).toMatchObject({ ok: false, refusalCode: 'ALREADY_REGISTERED' });
  });

  it('refuses AGENT_CARD_INVALID on a name mismatch, never proceeding with a mismatched identity', async () => {
    const result = await prepareAgentRegistration(
      { agentSlug: 'moneypenny', agentCardBase: 'https://dev-beta.aigentz.me' },
      { mcpClient: fakeMcpClient(), fetchAgentCard: fakeFetchAgentCard({ name: 'Someone Else' }), resolveOwnerWalletAddress },
    );
    expect(result).toMatchObject({ ok: false, refusalCode: 'AGENT_CARD_INVALID' });
  });

  it('refuses UNSIGNED_TX_UNAVAILABLE with the raw arguments + response visible, never a bare "not found"', async () => {
    const mcpClient = fakeMcpClient();
    mcpClient.callTool = vi.fn(async ({ name }: { name: string }) => {
      if (name === 'build_registration_tx') return { content: [{ type: 'text', text: JSON.stringify({ someUnrelatedShape: true }) }] };
      throw new Error(`unexpected tool call: ${name}`);
    });
    const result = await prepareAgentRegistration(
      { agentSlug: 'moneypenny', agentCardBase: 'https://dev-beta.aigentz.me' },
      { mcpClient, fetchAgentCard: fakeFetchAgentCard(), resolveOwnerWalletAddress },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusalCode).toBe('UNSIGNED_TX_UNAVAILABLE');
    expect(result.detail).toContain('someUnrelatedShape');
    expect(result.detail).toContain('Arguments sent');
  });

  it('refuses REGISTRATION_TOOL_NOT_FOUND rather than guessing a call shape', async () => {
    const result = await prepareAgentRegistration(
      { agentSlug: 'moneypenny', agentCardBase: 'https://dev-beta.aigentz.me' },
      { mcpClient: fakeMcpClient({ tools: [{ name: 'totally_unrelated', inputSchema: { properties: {} } }] }), fetchAgentCard: fakeFetchAgentCard(), resolveOwnerWalletAddress },
    );
    expect(result).toMatchObject({ ok: false, refusalCode: 'REGISTRATION_TOOL_NOT_FOUND' });
  });

  it('refuses NETWORK_OR_CONTRACT_MISMATCH when the returned unsigned tx targets a different contract', async () => {
    const result = await prepareAgentRegistration(
      { agentSlug: 'moneypenny', agentCardBase: 'https://dev-beta.aigentz.me' },
      { mcpClient: fakeMcpClient({ unsignedTx: { to: '0xDeadbeefDeadbeefDeadbeefDeadbeefDeadbeef', data: '0xabc' } }), fetchAgentCard: fakeFetchAgentCard(), resolveOwnerWalletAddress },
    );
    expect(result).toMatchObject({ ok: false, refusalCode: 'NETWORK_OR_CONTRACT_MISMATCH' });
  });

  it('resolveOwnerWalletAddress is passed the full agent config, not a bare env-var name — the default resolves via the agent\'s own custodied wallet (agent_keys), never a per-agent env var (operator ruling 2026-08-01)', async () => {
    const resolveSpy = vi.fn((agent: any) => {
      expect(agent).toMatchObject({ slug: 'moneypenny', runtimeAgentId: 'aigent-moneypenny' });
      expect(agent).not.toHaveProperty('ownerPrivateKeyEnvVar');
      return OWNER_WALLET.address;
    });
    const result = await prepareAgentRegistration(
      { agentSlug: 'moneypenny', agentCardBase: 'https://dev-beta.aigentz.me' },
      { mcpClient: fakeMcpClient(), fetchAgentCard: fakeFetchAgentCard(), resolveOwnerWalletAddress: resolveSpy },
    );
    expect(result.ok).toBe(true);
    expect(resolveSpy).toHaveBeenCalledTimes(1);
  });

  it('awaits an async resolveOwnerWalletAddress (the real default is async — it queries agent_keys)', async () => {
    const result = await prepareAgentRegistration(
      { agentSlug: 'moneypenny', agentCardBase: 'https://dev-beta.aigentz.me' },
      { mcpClient: fakeMcpClient(), fetchAgentCard: fakeFetchAgentCard(), resolveOwnerWalletAddress: async () => OWNER_WALLET.address },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.unsignedTx.to).toBe(IDENTITY_REGISTRY);
  });

  it('refuses OWNER_KEY_NOT_CONFIGURED when the agent has no custodied wallet, with a message naming agent_keys rather than an env var', async () => {
    const result = await prepareAgentRegistration(
      { agentSlug: 'moneypenny', agentCardBase: 'https://dev-beta.aigentz.me' },
      { mcpClient: fakeMcpClient(), fetchAgentCard: fakeFetchAgentCard(), resolveOwnerWalletAddress: async () => null },
    );
    expect(result).toMatchObject({ ok: false, refusalCode: 'OWNER_KEY_NOT_CONFIGURED' });
    if (result.ok) return;
    expect(result.detail).toContain('agent_keys');
    expect(result.detail).not.toMatch(/_ENV_VAR|OWNER_WALLET_PRIVATE_KEY/);
  });
});

describe('broadcastAgentRegistration', () => {
  const unsignedTx = { to: IDENTITY_REGISTRY, data: '0xabc123' };

  it('refuses CONFIRM_REQUIRED without an explicit confirm — never signs implicitly', async () => {
    // @ts-expect-error — deliberately omitting confirm to exercise the refusal
    const result = await broadcastAgentRegistration({ agentSlug: 'moneypenny', unsignedTx, ownerPrivateKey: OWNER_WALLET.privateKey, rpcUrl: 'https://sepolia.base.org' });
    expect(result).toMatchObject({ ok: false, refusalCode: 'CONFIRM_REQUIRED' });
  });

  it('refuses OWNER_KEY_NOT_CONFIGURED when no private key is supplied', async () => {
    const result = await broadcastAgentRegistration({ agentSlug: 'moneypenny', unsignedTx, confirm: true, ownerPrivateKey: undefined, rpcUrl: 'https://sepolia.base.org' });
    expect(result).toMatchObject({ ok: false, refusalCode: 'OWNER_KEY_NOT_CONFIGURED' });
  });

  it('signs locally and submits — the raw private key never appears in the result', async () => {
    const mcpClient = fakeMcpClient();
    const fakeProvider = new ethers.JsonRpcProvider(undefined, undefined, { staticNetwork: ethers.Network.from(84532) });
    vi.spyOn(fakeProvider, 'getFeeData').mockResolvedValue({ gasPrice: 1n, maxFeePerGas: null, maxPriorityFeePerGas: null } as any);
    vi.spyOn(fakeProvider, 'getTransactionCount').mockResolvedValue(0);
    vi.spyOn(fakeProvider, 'estimateGas').mockResolvedValue(21000n);
    vi.spyOn(fakeProvider, 'call').mockResolvedValue('0x');

    const result = await broadcastAgentRegistration(
      { agentSlug: 'moneypenny', unsignedTx, confirm: true, ownerPrivateKey: OWNER_WALLET.privateKey, rpcUrl: 'https://sepolia.base.org' },
      { mcpClient, rpcProvider: fakeProvider },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.ownerWalletAddress).toBe(OWNER_WALLET.address);
    expect(result.value.txHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain(OWNER_WALLET.privateKey.slice(2));
  });
});

describe('checkAgentRegistrationStatus', () => {
  const baseInput = {
    agentSlug: 'moneypenny',
    txHash: '0x' + '11'.repeat(32),
    ownerWalletAddress: OWNER_WALLET.address,
    network: 'base-sepolia' as const,
    actorPersonaId: 'persona-operator-1',
  };

  it('reports not-yet-confirmed without rereading the registry or writing anything', async () => {
    const updateSpy = vi.fn();
    const receiptSpy = vi.fn();
    const result = await checkAgentRegistrationStatus(baseInput, {
      mcpClient: fakeMcpClient({ statusText: '{"status":"pending"}' }),
      updateRegistryAssetBinding: updateSpy,
      createRegistrationReceipt: receiptSpy,
    });
    expect(result).toMatchObject({ ok: true, value: { confirmed: false } });
    expect(updateSpy).not.toHaveBeenCalled();
    expect(receiptSpy).not.toHaveBeenCalled();
  });

  it('on confirmation, rereads the registry, persists the binding, and writes exactly one receipt', async () => {
    const updateSpy = vi.fn();
    const receiptSpy = vi.fn(async () => 'receipt-register-1');
    const result = await checkAgentRegistrationStatus(baseInput, {
      mcpClient: fakeMcpClient({ statusText: '{"status":"active"}' }),
      fetchRegistryAgent: async () => ({ ok: true, ready: true, value: { tokenId: '4567', registryAlias: '0x11d7' } }),
      updateRegistryAssetBinding: updateSpy,
      createRegistrationReceipt: receiptSpy,
    });
    expect(result).toMatchObject({ ok: true, value: { confirmed: true, tokenId: '4567', registryAlias: '0x11d7', receiptId: 'receipt-register-1' } });
    expect(updateSpy).toHaveBeenCalledWith('aigentqube-moneypenny', { tokenId: '4567', registryAlias: '0x11d7', agentIdentifier: null, humanReadableUrl: null });
    expect(receiptSpy).toHaveBeenCalledTimes(1);
  });

  it('resolves agentIdentifier from a DISTINCT field, never defaulting it from tokenId, and builds the confirmed-live Horizen URL', async () => {
    const updateSpy = vi.fn();
    const result = await checkAgentRegistrationStatus(baseInput, {
      mcpClient: fakeMcpClient({ statusText: '{"status":"active"}' }),
      fetchRegistryAgent: async () => ({ ok: true, ready: true, value: { tokenId: '4567', registryAlias: '0x11d7', agentIdentifier: '0xZkSignalAgent' } }),
      updateRegistryAssetBinding: updateSpy,
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        tokenId: '4567',
        agentIdentifier: '0xZkSignalAgent',
        humanReadableUrl: 'https://agent-registry.horizenlabs.io/agent/0xZkSignalAgent?network=base-sepolia',
      },
    });
    expect(updateSpy).toHaveBeenCalledWith('aigentqube-moneypenny', {
      tokenId: '4567',
      registryAlias: '0x11d7',
      agentIdentifier: '0xZkSignalAgent',
      humanReadableUrl: 'https://agent-registry.horizenlabs.io/agent/0xZkSignalAgent?network=base-sepolia',
    });
  });

  it('agentIdentifier and tokenId are never silently conflated — no agentIdentifier field means no URL, even though tokenId resolved', async () => {
    const result = await checkAgentRegistrationStatus(baseInput, {
      mcpClient: fakeMcpClient({ statusText: '{"status":"active"}' }),
      fetchRegistryAgent: async () => ({ ok: true, ready: true, value: { tokenId: '4567', registryAlias: '0x11d7' } }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tokenId).toBe('4567');
    expect(result.value.agentIdentifier).toBeNull();
    expect(result.value.humanReadableUrl).toBeNull();
  });

  it('MoneyPenny and Nakamoto resolve different Horizen agent-page URLs from their own bindings', async () => {
    const moneypenny = await checkAgentRegistrationStatus(
      { ...baseInput, agentSlug: 'moneypenny' },
      {
        mcpClient: fakeMcpClient({ statusText: '{"status":"active"}' }),
        fetchRegistryAgent: async () => ({ ok: true, ready: true, value: { tokenId: '1', registryAlias: '0x1', agentIdentifier: '0xMoneyPennyAgent' } }),
      },
    );
    const nakamoto = await checkAgentRegistrationStatus(
      { ...baseInput, agentSlug: 'nakamoto' },
      {
        mcpClient: fakeMcpClient({ statusText: '{"status":"active"}' }),
        fetchRegistryAgent: async () => ({ ok: true, ready: true, value: { tokenId: '2', registryAlias: '0x2', agentIdentifier: '0xNakamotoAgent' } }),
      },
    );
    expect(moneypenny.ok && nakamoto.ok).toBe(true);
    if (!moneypenny.ok || !nakamoto.ok) return;
    expect(moneypenny.value.humanReadableUrl).not.toBe(nakamoto.value.humanReadableUrl);
    expect(moneypenny.value.humanReadableUrl).toContain('0xMoneyPennyAgent');
    expect(nakamoto.value.humanReadableUrl).toContain('0xNakamotoAgent');
  });

  it('refuses REGISTRY_REREAD_FAILED rather than fabricating a tokenId when the reread itself fails', async () => {
    const result = await checkAgentRegistrationStatus(baseInput, {
      mcpClient: fakeMcpClient({ statusText: '{"status":"confirmed"}' }),
      fetchRegistryAgent: async () => ({ ok: false, ready: true, reason: 'timeout' }),
    });
    expect(result).toMatchObject({ ok: false, refusalCode: 'REGISTRY_REREAD_FAILED' });
  });
});

describe('extractUnsignedTx / extractTxHash — defensive extraction, never guessed', () => {
  it('extractUnsignedTx finds a top-level {to,data} object', () => {
    const tx = extractUnsignedTx({ content: [{ type: 'text', text: JSON.stringify({ to: '0xabc', data: '0x1' }) }] } as any);
    expect(tx).toEqual({ to: '0xabc', data: '0x1' });
  });

  it('extractUnsignedTx returns null when nothing matches, never fabricating a shape', () => {
    expect(extractUnsignedTx({ content: [{ type: 'text', text: JSON.stringify({ unrelated: true }) }] } as any)).toBeNull();
  });

  it('extractTxHash finds a 0x-prefixed hash embedded in free text', () => {
    const hash = extractTxHash({ content: [{ type: 'text', text: `submitted: ${'0x' + 'ab'.repeat(32)} ok` }] } as any);
    expect(hash).toBe('0x' + 'ab'.repeat(32));
  });
});
