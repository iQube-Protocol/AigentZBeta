/**
 * services/horizen/registerCeremony.ts — the wallet-mediated Register
 * vertical slice (Wallet Signing Topology, operator ruling 2026-08-01).
 * Exercises the full ceremony against injected fixtures — never a live
 * network call, never a real key.
 */

import { describe, it, expect, vi } from 'vitest';
import { ethers } from 'ethers';
import {
  prepareRegistrationMandate,
  approvePrincipalRegistrationMandate,
  approveAgentRegistryInvocation,
  type RegisterCeremonyDeps,
} from '@/services/horizen/registerCeremony';
import type { SigningRequest, CreateSigningRequestInput } from '@/types/signingRequest';

const PRINCIPAL_WALLET = ethers.Wallet.createRandom();
const AGENT_WALLET = ethers.Wallet.createRandom();
const IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e';

// ─── In-memory fake SigningRequest store — mirrors the real store's public shape.
function fakeRequestStore() {
  const rows = new Map<string, SigningRequest>();
  let counter = 0;

  const create = vi.fn(async (input: CreateSigningRequestInput) => {
    const id = `sr_fake_${counter++}`;
    const now = new Date();
    const record: SigningRequest = {
      id,
      actionKind: input.actionKind,
      signerRole: input.signerRole,
      principalPersonaId: input.principalPersonaId,
      subjectAgentRef: input.subjectAgentRef,
      subjectAigentQubeId: input.subjectAigentQubeId,
      authorityCredential: input.authorityCredential,
      walletRef: input.walletRef,
      network: input.network,
      payload: input.payload,
      payloadHash: 'fakehash',
      consequence: input.consequence,
      nonce: input.nonce ?? `auto-${id}`,
      expiresAt: new Date(now.getTime() + input.expiresInSeconds * 1000).toISOString(),
      receiptDestination: input.receiptDestination,
      status: 'pending',
      createdAt: now.toISOString(),
      resolvedAt: null,
      signature: null,
      signerAddress: null,
      refusalCode: null,
      refusalDetail: null,
    };
    rows.set(id, record);
    return { ok: true as const, record };
  });

  const get = vi.fn(async (id: string) => rows.get(id) ?? null);

  const update = vi.fn(async (id: string, patch: Partial<SigningRequest> & { status: SigningRequest['status'] }) => {
    const existing = rows.get(id);
    if (!existing) throw new Error(`no row for id "${id}"`);
    const updated = { ...existing, ...patch, resolvedAt: patch.status !== 'pending' ? new Date().toISOString() : existing.resolvedAt };
    rows.set(id, updated);
    return updated;
  });

  return { create, get, update, rows };
}

function fakeMcpClient(overrides: Partial<{ unsignedTx: any; txHash: string }> = {}) {
  const unsignedTx = overrides.unsignedTx ?? { to: IDENTITY_REGISTRY, data: '0xabc123', chainId: 84532 };
  const txHash = overrides.txHash ?? '0x' + '11'.repeat(32);
  return {
    listTools: vi.fn(async () => ({
      tools: [
        { name: 'build_registration_tx', inputSchema: { properties: { walletAddress: {}, name: {}, description: {}, services: {}, network: {} } } },
        { name: 'submit_registry_tx', inputSchema: { properties: { signedTransaction: {}, network: {} } } },
        { name: 'get_onboarding_status', inputSchema: { properties: { transactionHash: {}, network: {} } } },
      ],
    })),
    callTool: vi.fn(async ({ name }: { name: string }) => {
      if (name === 'build_registration_tx') return { content: [{ type: 'text', text: JSON.stringify(unsignedTx) }] };
      if (name === 'submit_registry_tx') return { content: [{ type: 'text', text: JSON.stringify({ transactionHash: txHash }) }] };
      throw new Error(`unexpected tool call: ${name}`);
    }),
  };
}

function fakeFetchAgentCard() {
  const full = {
    name: 'Aigent Nakamoto',
    description: 'Oversees Bitcoin issuance integrity and governance.',
    url: 'https://dev-beta.aigentz.me/api/agents/nakamoto/agent-card.json',
    metadata: { runtime_agent_id: 'aigent-nakamoto', horizen: {} },
    skills: [{ id: 'issuance-governance', name: 'Issuance Governance', description: 'Approval-or-veto over issuance-sensitive acts.' }],
  };
  const raw = JSON.stringify(full);
  return vi.fn(async () => ({ card: full, url: full.url, raw }));
}

function baseDeps(store: ReturnType<typeof fakeRequestStore>, overrides: Partial<RegisterCeremonyDeps> = {}): RegisterCeremonyDeps {
  return {
    agentCardBase: 'https://dev-beta.aigentz.me',
    createSigningRequest: store.create as any,
    getSigningRequest: store.get as any,
    updateSigningRequest: store.update as any,
    mcpClient: fakeMcpClient() as any,
    fetchAgentCard: fakeFetchAgentCard(),
    resolveOwnerWalletAddress: () => AGENT_WALLET.address,
    resolveAgentPrivateKey: async () => AGENT_WALLET.privateKey,
    resolvePrincipalWalletAddress: async () => PRINCIPAL_WALLET.address,
    verifySignature: (payload: string, signature: string) => {
      try {
        return ethers.verifyMessage(payload, signature);
      } catch {
        return null;
      }
    },
    recordReceipt: vi.fn(async () => 'receipt-fake-1'),
    rpcProvider: (() => {
      const p = new ethers.JsonRpcProvider(undefined, undefined, { staticNetwork: ethers.Network.from(84532) });
      vi.spyOn(p, 'getFeeData').mockResolvedValue({ gasPrice: 1n, maxFeePerGas: null, maxPriorityFeePerGas: null } as any);
      vi.spyOn(p, 'getTransactionCount').mockResolvedValue(0);
      vi.spyOn(p, 'estimateGas').mockResolvedValue(21000n);
      vi.spyOn(p, 'call').mockResolvedValue('0x');
      return p;
    })(),
    ...overrides,
  };
}

describe('prepareRegistrationMandate', () => {
  it('creates a pending, principal-role, authorize_registration request bound to the correct agent', async () => {
    const store = fakeRequestStore();
    const result = await prepareRegistrationMandate(
      { agentSlug: 'nakamoto', principalPersonaId: 'persona-operator-1' },
      baseDeps(store),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      actionKind: 'authorize_registration',
      signerRole: 'principal',
      walletRef: 'principal',
      subjectAgentRef: 'aigent-nakamoto',
      status: 'pending',
    });
    expect(result.value.payload).toContain('Aigent Nakamoto');
    expect(result.value.payload).toContain(result.value.nonce);
  });

  it('refuses NO_PRINCIPAL_WALLET rather than fabricating a mandate when the operator has no wallet on file', async () => {
    const store = fakeRequestStore();
    const result = await prepareRegistrationMandate(
      { agentSlug: 'nakamoto', principalPersonaId: 'persona-operator-1' },
      baseDeps(store, { resolvePrincipalWalletAddress: async () => null }),
    );
    expect(result).toMatchObject({ ok: false, refusalCode: 'NO_PRINCIPAL_WALLET' });
    expect(store.create).not.toHaveBeenCalled();
  });

  it('refuses UNKNOWN_AGENT for an unregistrable slug', async () => {
    const store = fakeRequestStore();
    const result = await prepareRegistrationMandate(
      { agentSlug: 'not-a-real-agent', principalPersonaId: 'persona-operator-1' },
      baseDeps(store),
    );
    expect(result).toMatchObject({ ok: false, refusalCode: 'UNKNOWN_AGENT' });
  });
});

describe('approvePrincipalRegistrationMandate', () => {
  async function prepared(store: ReturnType<typeof fakeRequestStore>, deps: RegisterCeremonyDeps) {
    const r = await prepareRegistrationMandate({ agentSlug: 'nakamoto', principalPersonaId: 'persona-operator-1' }, deps);
    if (!r.ok) throw new Error('setup failed');
    return r.value;
  }

  it('verifies the recovered signer against the operator\'s ON-FILE wallet — never a client-declared address', async () => {
    const store = fakeRequestStore();
    const deps = baseDeps(store);
    const mandate = await prepared(store, deps);
    const signature = await PRINCIPAL_WALLET.signMessage(mandate.payload);

    const result = await approvePrincipalRegistrationMandate(
      { requestId: mandate.id, principalPersonaId: 'persona-operator-1', signature },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mandateRequest.status).toBe('approved');
    expect(result.value.agentInvocationRequest).toMatchObject({
      actionKind: 'sign_registry_transaction',
      signerRole: 'agent',
      walletRef: 'aigent-nakamoto',
      status: 'pending',
    });
  });

  it('refuses SIGNER_MISMATCH when the signature does not recover to the operator\'s on-file wallet — e.g. signed by an unrelated key', async () => {
    const store = fakeRequestStore();
    const deps = baseDeps(store);
    const mandate = await prepared(store, deps);
    const impostor = ethers.Wallet.createRandom();
    const signature = await impostor.signMessage(mandate.payload);

    const result = await approvePrincipalRegistrationMandate(
      { requestId: mandate.id, principalPersonaId: 'persona-operator-1', signature },
      deps,
    );
    expect(result).toMatchObject({ ok: false, refusalCode: 'SIGNER_MISMATCH' });
    expect((await store.get(mandate.id))?.status).toBe('pending');
  });

  it('refuses SIGNER_MISMATCH when the calling persona does not own the request', async () => {
    const store = fakeRequestStore();
    const deps = baseDeps(store);
    const mandate = await prepared(store, deps);
    const signature = await PRINCIPAL_WALLET.signMessage(mandate.payload);

    const result = await approvePrincipalRegistrationMandate(
      { requestId: mandate.id, principalPersonaId: 'persona-someone-else', signature },
      deps,
    );
    expect(result).toMatchObject({ ok: false, refusalCode: 'SIGNER_MISMATCH' });
  });

  it('refuses NOT_PENDING on an already-approved request — no double-approval', async () => {
    const store = fakeRequestStore();
    const deps = baseDeps(store);
    const mandate = await prepared(store, deps);
    const signature = await PRINCIPAL_WALLET.signMessage(mandate.payload);
    const first = await approvePrincipalRegistrationMandate({ requestId: mandate.id, principalPersonaId: 'persona-operator-1', signature }, deps);
    expect(first.ok).toBe(true);

    const second = await approvePrincipalRegistrationMandate({ requestId: mandate.id, principalPersonaId: 'persona-operator-1', signature }, deps);
    expect(second).toMatchObject({ ok: false, refusalCode: 'NOT_PENDING' });
  });

  it('refuses EXPIRED and transitions the request to expired rather than accepting a stale signature', async () => {
    const store = fakeRequestStore();
    const deps = baseDeps(store);
    const mandate = await prepared(store, deps);
    // Force expiry by rewriting the stored row's expiresAt into the past.
    const row = store.rows.get(mandate.id)!;
    store.rows.set(mandate.id, { ...row, expiresAt: new Date(Date.now() - 1000).toISOString() });
    const signature = await PRINCIPAL_WALLET.signMessage(mandate.payload);

    const result = await approvePrincipalRegistrationMandate({ requestId: mandate.id, principalPersonaId: 'persona-operator-1', signature }, deps);
    expect(result).toMatchObject({ ok: false, refusalCode: 'EXPIRED' });
    expect((await store.get(mandate.id))?.status).toBe('expired');
  });

  it('records the principal_registration_mandate_signed receipt exactly once on approval', async () => {
    const store = fakeRequestStore();
    const recordReceipt = vi.fn(async () => 'receipt-1');
    const deps = baseDeps(store, { recordReceipt });
    const mandate = await prepared(store, deps);
    const signature = await PRINCIPAL_WALLET.signMessage(mandate.payload);
    await approvePrincipalRegistrationMandate({ requestId: mandate.id, principalPersonaId: 'persona-operator-1', signature }, deps);
    expect(recordReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'principal_registration_mandate_signed' }),
    );
  });
});

describe('approveAgentRegistryInvocation', () => {
  async function approvedAgentRequest(store: ReturnType<typeof fakeRequestStore>, deps: RegisterCeremonyDeps) {
    const mandate = await prepareRegistrationMandate({ agentSlug: 'nakamoto', principalPersonaId: 'persona-operator-1' }, deps);
    if (!mandate.ok) throw new Error('setup failed');
    const signature = await PRINCIPAL_WALLET.signMessage(mandate.value.payload);
    const approved = await approvePrincipalRegistrationMandate({ requestId: mandate.value.id, principalPersonaId: 'persona-operator-1', signature }, deps);
    if (!approved.ok) throw new Error(`setup failed: ${approved.refusalCode} - ${approved.detail}`);
    return approved.value.agentInvocationRequest;
  }

  it('signs and broadcasts ONLY as the direct consequence of this explicit approval call — never earlier', async () => {
    const store = fakeRequestStore();
    const deps = baseDeps(store);
    const agentRequest = await approvedAgentRequest(store, deps);
    // Confirm nothing was broadcast yet — the mcpClient's submit_registry_tx must not have been called during prepare/approve.
    expect((deps.mcpClient as any).callTool).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'submit_registry_tx' }), expect.anything());

    const result = await approveAgentRegistryInvocation({ requestId: agentRequest.id }, deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.txHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(result.value.ownerWalletAddress).toBe(AGENT_WALLET.address);
    expect((await store.get(agentRequest.id))?.status).toBe('executed');
  });

  it('the agent private key never appears anywhere in the result', async () => {
    const store = fakeRequestStore();
    const deps = baseDeps(store);
    const agentRequest = await approvedAgentRequest(store, deps);
    const result = await approveAgentRegistryInvocation({ requestId: agentRequest.id }, deps);
    expect(JSON.stringify(result)).not.toContain(AGENT_WALLET.privateKey.slice(2));
  });

  it('records agent_registry_transaction_signed AND horizen_registration_submitted receipts', async () => {
    const store = fakeRequestStore();
    const recordReceipt = vi.fn(async () => 'receipt-1');
    const deps = baseDeps(store, { recordReceipt });
    const agentRequest = await approvedAgentRequest(store, deps);
    await approveAgentRegistryInvocation({ requestId: agentRequest.id }, deps);
    const types = recordReceipt.mock.calls.map((c) => c[0].actionType);
    expect(types).toContain('agent_registry_transaction_signed');
    expect(types).toContain('horizen_registration_submitted');
  });

  it('refuses WRONG_ACTION_KIND for a request that is not a pending agent registry-transaction approval', async () => {
    const store = fakeRequestStore();
    const deps = baseDeps(store);
    const mandate = await prepareRegistrationMandate({ agentSlug: 'nakamoto', principalPersonaId: 'persona-operator-1' }, deps);
    if (!mandate.ok) throw new Error('setup failed');
    const result = await approveAgentRegistryInvocation({ requestId: mandate.value.id }, deps);
    expect(result).toMatchObject({ ok: false, refusalCode: 'WRONG_ACTION_KIND' });
  });

  it('refuses NOT_PENDING on a request already executed — no double-broadcast', async () => {
    const store = fakeRequestStore();
    const deps = baseDeps(store);
    const agentRequest = await approvedAgentRequest(store, deps);
    const first = await approveAgentRegistryInvocation({ requestId: agentRequest.id }, deps);
    expect(first.ok).toBe(true);
    const second = await approveAgentRegistryInvocation({ requestId: agentRequest.id }, deps);
    expect(second).toMatchObject({ ok: false, refusalCode: 'NOT_PENDING' });
  });

  it('refuses BROADCAST_FAILED honestly when the agent has no custodied wallet on record, never signing with a fallback', async () => {
    const store = fakeRequestStore();
    const deps = baseDeps(store);
    const agentRequest = await approvedAgentRequest(store, deps);
    const result = await approveAgentRegistryInvocation(
      { requestId: agentRequest.id },
      { ...deps, resolveAgentPrivateKey: async () => undefined },
    );
    expect(result).toMatchObject({ ok: false, refusalCode: 'BROADCAST_FAILED' });
    expect((await store.get(agentRequest.id))?.status).toBe('pending');
  });
});
