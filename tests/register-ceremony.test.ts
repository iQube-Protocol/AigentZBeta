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
import {
  registerCeremonyProgress,
  expiredAttemptsNote,
  horizenContact,
} from '@/services/horizen/registerCeremonyProgress';
import { readSource, stripComments } from './_lib/sourceAuthority';

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

// ── The ceremony ladder ─────────────────────────────────────────────────────

describe('the Register stage says where it actually is', () => {
  /*
   * Operator, 2026-08-02:
   *
   *   > "The journey period is not progressing … Nothing has progressed. It's
   *   >  not clear what is happening at all … It's kind of completely in the
   *   >  dark as to what's going on."
   *
   * The panel fell back to `idle` between clicks — visually identical whether
   * the operator had never started, had five mandates expire, or had signed
   * one. Every attempt left the surface looking exactly as it had before, so
   * "nothing is happening" was the only honest reading available.
   */
  const base = {
    walletReady: true,
    liveMandate: false,
    liveInvocation: false,
    broadcastPending: false,
    tokenId: null as string | null,
    expiredAttempts: 0,
  };

  it('walks the ladder in order as each fact becomes true', () => {
    const ids = [
      { ...base, walletReady: false },
      base,
      { ...base, liveMandate: true },
      { ...base, liveInvocation: true },
      { ...base, broadcastPending: true },
      { ...base, tokenId: '42' },
    ].map((i) => registerCeremonyProgress(i).stageId);
    expect(ids).toEqual([
      'WALLET_NOT_READY',
      'NOT_STARTED',
      'MANDATE_AWAITING_SIGNATURE',
      'INVOCATION_AWAITING_APPROVAL',
      'BROADCAST_AWAITING_CONFIRMATION',
      'REGISTERED',
    ]);
  });

  it('every stage names WHO acts next — the question behind "why is nothing happening"', () => {
    for (const input of [base, { ...base, liveMandate: true }, { ...base, broadcastPending: true }]) {
      const p = registerCeremonyProgress(input);
      expect(['you', 'the network', 'nobody']).toContain(p.nextActor);
      expect(p.nextAct.length).toBeGreaterThan(20);
    }
    // The one stage nobody can hurry says so, instead of implying inaction.
    expect(registerCeremonyProgress({ ...base, broadcastPending: true }).nextActor).toBe('the network');
    expect(registerCeremonyProgress({ ...base, tokenId: '7' }).nextActor).toBe('nobody');
  });

  it('expired attempts are accounted for, not silently dropped', () => {
    // Five expired mandates are WHY the operator concluded nothing was
    // happening. Hiding them leaves the state unexplainable.
    const p = registerCeremonyProgress({ ...base, expiredAttempts: 5 });
    expect(p.expiredAttempts).toBe(5);
    const note = expiredAttemptsNote(5)!;
    expect(note).toMatch(/never revived/);
    expect(note).toMatch(/nothing was signed or broadcast/);
    // Not framed as five failures.
    expect(note).not.toMatch(/\berror|\bfail/i);
    expect(expiredAttemptsNote(0)).toBeNull();
  });

  it('an unstarted ceremony says nothing is in flight, rather than nothing at all', () => {
    const p = registerCeremonyProgress(base);
    expect(p.meaning).toMatch(/no act is part-completed/i);
    expect(p.nextAct).toMatch(/30 minutes/);
  });

  it('exactly one rung is current, with everything before it done', () => {
    const p = registerCeremonyProgress({ ...base, liveInvocation: true });
    expect(p.ladder.filter((s) => s.state === 'current')).toHaveLength(1);
    const at = p.ladder.findIndex((s) => s.state === 'current');
    expect(p.ladder.slice(0, at).every((s) => s.state === 'done')).toBe(true);
    expect(p.ladder.slice(at + 1).every((s) => s.state === 'pending')).toBe(true);
  });
});

describe('the Register panel renders the ladder', () => {
  const panel = stripComments(readSource('components/journey/RegisterAgentPanel.tsx'));

  it('reads real state rather than inferring from its own flow', () => {
    expect(panel).toMatch(/registerCeremonyProgress\(/);
    expect(panel).toMatch(/\/api\/wallet\/signing-requests/);
    expect(panel).toMatch(/register\/status/);
    expect(panel).toMatch(/progress\.ladder\.map/);
  });

  it('an unreadable ladder is absent, never rendered as "nothing has happened"', () => {
    expect(panel).toMatch(/setProgress\(null\)/);
  });

  it('reads through personaFetch — a spine endpoint, one resolved persona', () => {
    const at = panel.indexOf('/api/wallet/signing-requests');
    expect(panel.slice(at - 200, at)).toMatch(/personaFetch\(/);
  });
});

describe('the Verify stage speaks about the agent that was actually registered', () => {
  /*
   * Operator, 2026-08-02: "It still says awaiting agent MoneyPenny
   * registration … it should be saying awaiting Nakamoto because that is the
   * one that we actually just registered."
   *
   * The props interface existed and was IGNORED (`_props`) while the card
   * fetch and every sentence hardcoded MoneyPenny. The tab already tracked the
   * selection and the authorize route already accepted an agentSlug — only
   * this surface was never handed it, so Verify narrated a different agent
   * than Register had just acted on and read as broken when it was merely
   * talking about someone else.
   */
  const toggle = stripComments(readSource('components/journey/PulseTransparencyToggle.tsx'));
  const tab = stripComments(readSource('app/triad/components/codex/tabs/PilotJourneyTab.tsx'));

  it('takes the agent as a required prop — never a default that restores the bug', () => {
    expect(toggle).toMatch(/agentSlug: string;/);
    expect(toggle).toMatch(/agentDisplayName: string;/);
    expect(toggle).not.toMatch(/agentSlug\?: string/);
    // Props consumed, not ignored.
    expect(toggle).not.toMatch(/\(_props: PulseTransparencyToggleProps\)/);
  });

  it('fetches the selected agent card and names the selected agent in its copy', () => {
    expect(toggle).toMatch(/\/api\/agents\/\$\{agentSlug\}\/agent-card\.json/);
    expect(toggle).toMatch(/\{agentDisplayName\} does not have a Horizen tokenId/);
    // No sentence still asserts MoneyPenny.
    expect(toggle).not.toMatch(/MoneyPenny(&apos;s)? (does not|constitutional|Pulse)/);
  });

  it('sends the agent to the authorize route so its default stops mattering', () => {
    expect(toggle).toMatch(/scope: DISCLOSURE_SCOPE, agentSlug/);
  });

  it('the tab hands the selection to the Verify surface', () => {
    expect(tab).toMatch(/descriptor\.component === 'PulseTransparencyToggle'/);
    expect(tab).toMatch(/agentSlug: selectedAgentSlug, agentDisplayName: selectedAgent\.displayName/);
  });

  it('refetching is scoped to the agent — switching agents re-reads the card', () => {
    expect(toggle).toMatch(/\}, \[agentSlug\]\);/);
  });
});


describe('the headline states the SITUATION, never an achievement not yet made', () => {
  /*
   * Operator screenshot, 2026-08-02: the panel read
   *
   *   "Mandate signed by you  ·  waiting on you"
   *
   * directly above "A mandate is prepared and waiting for your signature."
   * The first version headlined the CURRENT RUNG'S LABEL — but a rung label
   * names the thing that happens AT that rung, and the current rung is the one
   * that has NOT happened. The header therefore claimed the opposite of the
   * state it was reporting, which is worse than saying nothing.
   */
  const base = {
    walletReady: true,
    liveMandate: false,
    liveInvocation: false,
    broadcastPending: false,
    tokenId: null as string | null,
    expiredAttempts: 0,
  };

  it('an unsigned mandate is headlined as awaiting a signature, not as signed', () => {
    const p = registerCeremonyProgress({ ...base, liveMandate: true });
    expect(p.headline).toBe('Awaiting your signature');
    expect(p.label).toBe('Mandate signed by you');
    // The headline must never assert the rung's achievement.
    expect(p.headline).not.toBe(p.label);
    expect(p.headline).not.toMatch(/signed by you/i);
  });

  it('no waiting stage headlines itself as complete', () => {
    for (const input of [
      { ...base },
      { ...base, liveMandate: true },
      { ...base, liveInvocation: true },
      { ...base, broadcastPending: true },
      { ...base, walletReady: false },
    ]) {
      const p = registerCeremonyProgress(input);
      expect(p.headline, p.stageId).not.toMatch(/\b(approved|broadcast to|issued|registered in)\b/i);
    }
    // Only the terminal stage may.
    expect(registerCeremonyProgress({ ...base, tokenId: '9' }).headline).toMatch(/Registered in Horizen/);
  });
});

describe('what contact with Horizen has actually occurred', () => {
  /*
   * Operator: "Nothing indicates at the moment that we're talking to the
   * Horizen system at all." That was TRUE — nothing is sent until the operator
   * signs the mandate and approves the key invocation. The surface says so;
   * inventing a "connecting…" state would be theatre.
   */
  it('says plainly that nothing has been sent, and why', () => {
    const c = horizenContact({ network: 'base-sepolia', broadcastPending: false, tokenId: null });
    expect(c.contacted).toBe(false);
    expect(c.statement).toMatch(/No transaction has been sent/i);
    expect(c.statement).toMatch(/base-sepolia/);
    expect(c.statement).toMatch(/after you sign the mandate and approve/i);
  });

  it('never names a network it did not read', () => {
    const c = horizenContact({ network: null, broadcastPending: false, tokenId: null });
    expect(c.statement).toMatch(/the configured network/);
    expect(c.statement).not.toMatch(/base-sepolia|mainnet/);
  });

  it('a broadcast is contact; a confirmation is contact with a tokenId', () => {
    expect(horizenContact({ network: 'base-sepolia', broadcastPending: true, tokenId: null }).contacted).toBe(true);
    const done = horizenContact({ network: 'base-sepolia', broadcastPending: false, tokenId: '42' });
    expect(done.contacted).toBe(true);
    expect(done.statement).toMatch(/tokenId 42/);
  });
});

describe('the ladder reads horizontally, with completed rungs in green', () => {
  const panel = stripComments(readSource('components/journey/RegisterAgentPanel.tsx'));

  it('renders the headline, not the rung label, as the header', () => {
    expect(panel).toMatch(/\{progress\.headline\}/);
  });

  it('lays the rungs out in a row and colours the done ones emerald', () => {
    expect(panel).toMatch(/flex items-start gap-1 overflow-x-auto/);
    expect(panel).toMatch(/border-emerald-500\/50 bg-emerald-500\/20 text-emerald-300/);
    // The connector between a completed rung and the next is green too.
    expect(panel).toMatch(/st\.state === 'done' \? 'bg-emerald-500\/40'/);
  });

  it('surfaces the Horizen contact statement', () => {
    expect(panel).toMatch(/horizenContact\(\{/);
    expect(panel).toMatch(/contact\.statement/);
    // Read from the status route, never assumed.
    expect(panel).toMatch(/network: horizenFacts\.network/);
  });
});

describe('the ladder reads live sources and keeps itself current', () => {
  /*
   * The 00:18 screenshots: the wallet said "nothing waiting · 5 expired"
   * while the Journey said "awaiting your signature". Both were truthful AT
   * THE MOMENT EACH LAST READ — the ladder read once and froze, the mandate
   * expired underneath it, the wallet opened later and saw the truth. And the
   * ladder's registered-rung source was a bare GET against a POST route that
   * requires {agentSlug, txHash, ownerWalletAddress, network} — a 400 on
   * every render, so REGISTERED could never light and the network was never
   * known.
   */
  const panel = stripComments(readSource('components/journey/RegisterAgentPanel.tsx'));

  it('reads "is this agent registered" from the agent card, not the status POST', () => {
    // metadata.horizen projects the SAME registry_assets binding the status
    // route writes on confirmation — one source of truth, public GET.
    expect(panel).toMatch(/fetch\(`\/api\/agents\/\$\{agentSlug\}\/agent-card\.json`/);
    // The bare misuse of the status route must not return. The status route
    // itself is still used — correctly, as a POST with the full body — by
    // pollStatus.
    expect(panel).not.toMatch(/personaFetch\('\/api\/journey\/moneypenny-horizen\/register\/status',\s*\{\s*cache/);
  });

  it('re-reads on an interval and on window focus', () => {
    // A surface reporting a state with a 30-minute fuse cannot read once.
    expect(panel).toMatch(/setInterval\(\(\) => void readProgress\(\), 30_000\)/);
    expect(panel).toMatch(/addEventListener\('focus', onFocus\)/);
  });

  it('shows the mandate countdown and re-reads the moment it lapses', () => {
    // Five mandates died invisibly; a deadline the operator can see is one
    // they can beat, and an expiry flips the ladder instead of freezing it.
    expect(panel).toMatch(/function MandateCountdown/);
    expect(panel).toMatch(/This mandate expires in/);
    expect(panel).toMatch(/onExpired=\{\(\) => void readProgress\(\)\}/);
    expect(panel).toMatch(/liveMandateRow\?\.expiresAt/);
  });

  it('the broadcast rung lights from this panel\'s own poll state', () => {
    // The tx facts live in the completion event, not in any store row — the
    // panel's polling step is the only witness of an in-flight broadcast.
    expect(panel).toMatch(/broadcastPending: flowStepRef\.current === 'polling'/);
  });
});

describe('a mandate is never spent on a failure that is not the operator\'s', () => {
  /*
   * ── The defect this closes (operator, 2026-08-02) ────────────────────────
   *
   *   > "Approve invocation of custodied key has NEVER shown and it has never
   *   >  gotten to this stage … after signing it just gives [a refusal] and
   *   >  then when the wallet is closed it goes back to Principal wallet ready
   *   >  to sign being the only green stage."
   *
   * `approvePrincipalRegistrationMandate` marked the mandate `approved` FIRST
   * and called `prepareAgentRegistration` — which fetches the Agent Card,
   * resolves the agent's custodied wallet, and calls Horizen's MCP
   * `build_registration_tx` — AFTER. Any failure there left the operator's
   * signed mandate CONSUMED and no invocation request created. Every attempt
   * destroyed a mandate and produced nothing; the ladder fell back to "no
   * mandate waiting", and the only remedy on offer was to prepare a fresh one
   * and lose it the same way.
   *
   * The signature is verified before any of this and is not in doubt. What
   * follows can fail for reasons that have nothing to do with the operator's
   * authority — an unreachable MCP server, an unconfigured agent key, a card
   * mismatch. A mandate must not be spent on someone else's outage.
   */
  const src = stripComments(readSource('services/horizen/registerCeremony.ts'));
  const fn = src.slice(
    src.indexOf('export async function approvePrincipalRegistrationMandate'),
    src.indexOf('export async function approveAgentRegistryInvocation'),
  );

  it('builds the transaction BEFORE the mandate is marked approved', () => {
    const prepareAt = fn.indexOf('prepareAgentRegistration(');
    const consumeAt = fn.indexOf("status: 'approved'");
    expect(prepareAt, 'prepareAgentRegistration is called').toBeGreaterThan(-1);
    expect(consumeAt, 'the mandate is marked approved').toBeGreaterThan(-1);
    expect(prepareAt, 'the mandate is consumed before the step that can fail').toBeLessThan(consumeAt);
  });

  it('resolves the agent before consuming too', () => {
    const resolveAt = fn.indexOf('resolveRegistrableAgentByRuntimeId(');
    const consumeAt = fn.indexOf("status: 'approved'");
    expect(resolveAt).toBeGreaterThan(-1);
    expect(resolveAt).toBeLessThan(consumeAt);
  });

  it('every pre-consumption refusal says the mandate survives and is retryable', () => {
    // Without this the operator cannot tell a spent mandate from a live one,
    // and re-prepares needlessly — which is what burned six of them.
    const upToConsume = fn.slice(0, fn.indexOf("status: 'approved'"));
    const refusals = [...upToConsume.matchAll(/refusalCode: '(UNKNOWN_AGENT|PREPARE_FAILED)'/g)];
    expect(refusals.length, 'both post-signature refusals are present').toBe(2);
    expect(upToConsume.match(/UNCHANGED and still signable/g)?.length).toBe(2);
  });

  it('PREPARE_FAILED names where the failure actually is', () => {
    // It is the first contact with Horizen. Saying so stops it reading as a
    // problem with the operator's signature.
    expect(fn).toMatch(/first contacts Horizen/);
    expect(fn).toMatch(/unrelated to your signature/);
  });
});
