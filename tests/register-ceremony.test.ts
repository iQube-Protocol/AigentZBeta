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
import { extractUnsignedTx } from '@/services/horizen/registrationClient';
import { HORIZEN_NETWORK_FACTS } from '@/services/horizen/identity';
import {
  PRINCIPAL_MANDATE_TTL_SECONDS,
  AGENT_INVOCATION_TTL_SECONDS,
  humanLegIsNotTighterThanMachineLeg,
} from '@/services/signing/mandatePolicy';
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

describe('Horizen gets the arguments it actually requires', () => {
  /*
   * ── The defect this closes (operator, 2026-08-02, live MCP error) ────────
   *
   *   MCP error -32602: Invalid arguments for tool build_registration_tx:
   *     services[0].endpoint  Required (received undefined)
   *     services[1].endpoint  Required (received undefined)
   *     services[2].endpoint  Required (received undefined)
   *
   * This was THE blocker. Horizen requires an `endpoint` on every service; we
   * sent name + description only, so the very first contact with Horizen was
   * rejected on every attempt. Six signed mandates never reached the
   * invocation step for want of one field.
   *
   * The endpoint is taken from the Agent Card's own published `url` — the same
   * value already sent as agentURI. Our cards publish no per-skill endpoint
   * (an A2A skill carries id/name/description/tags and nothing addressable),
   * and every skill on a card is served by that one agent at that one address.
   * It is READ, never constructed: synthesising one by appending a skill id to
   * a URL that would not resolve is the guess this codebase forbids.
   */
  const client = stripComments(readSource('services/horizen/registrationClient.ts'));

  it('every service carries an endpoint', () => {
    const at = client.indexOf('function buildServicesFromCard');
    expect(at).toBeGreaterThan(-1);
    const fn = client.slice(at, client.indexOf('\n}', at));
    expect(fn).toMatch(/endpoint:/);
  });

  it('the endpoint is read from the card, never constructed', () => {
    const at = client.indexOf('function buildServicesFromCard');
    const fn = client.slice(at, client.indexOf('\n}', at));
    // The agent's own published url, or a per-skill one if ever published.
    expect(fn).toMatch(/typeof card\.url === 'string'/);
    expect(fn).toMatch(/typeof s\.endpoint === 'string' \? s\.endpoint : agentEndpoint/);
    // No URL assembly: no template literal, no concatenation onto a base.
    expect(fn).not.toMatch(/`\$\{/);
    expect(fn).not.toMatch(/\+\s*['"]\//);
  });

  it('a missing card.url is already refused before this point', () => {
    // So an empty endpoint can never be emitted silently.
    expect(client).toMatch(/card\.url \(the agentURI to register\) is missing/);
  });

  it('a rejected-argument failure names the arguments, not just the symptom', () => {
    // Horizen answers a bad call with the exact paths it refused. That fact
    // was buried mid-way through a 4000-character dump behind "could not
    // locate an unsigned transaction", which describes a symptom and names
    // nothing. The operator found it by reading the dump; nobody should have
    // to.
    expect(client).toMatch(/function describeRejectedArguments/);
    expect(client).toMatch(/describeRejectedArguments\(buildResult\) \?\?/);
    expect(client).toMatch(/Horizen rejected the arguments sent to build_registration_tx/);
    // The full arguments and raw result still follow — removing them would
    // trade one blindness for another.
    expect(client).toMatch(/Arguments sent: \$\{JSON\.stringify\(buildArgs\)\}/);
    expect(client).toMatch(/Raw result: \$\{JSON\.stringify\(buildResult\)/);
  });

  it('a non-validation failure is not described as one', () => {
    // Never invent a cause: an unrecognised shape falls back to the symptom.
    const at = client.indexOf('function describeRejectedArguments');
    const fn = client.slice(at, client.indexOf('\n}\n', at));
    expect(fn).toMatch(/return null/);
  });
});

describe('the dry-run agent is the one selected on arrival', () => {
  /*
   * Operator, 2026-08-02: "I forgot to change it to Nakamoto before running."
   *
   * "MoneyPenny is the demo agent; Aigent Nakamoto is the dry-run agent"
   * (ruling 2026-07-31). Nakamoto is what is being exercised; MoneyPenny led
   * only because it was written first, and a mandate was prepared against it
   * by accident.
   */
  const panel = stripComments(readSource('components/journey/RegisterAgentPanel.tsx'));
  const tab = stripComments(readSource('app/triad/components/codex/tabs/PilotJourneyTab.tsx'));

  it('Nakamoto is first in PILOT_AGENTS', () => {
    const at = panel.indexOf('export const PILOT_AGENTS');
    const list = panel.slice(at, panel.indexOf('];', at));
    expect(list.indexOf("slug: 'nakamoto'")).toBeGreaterThan(-1);
    expect(list.indexOf("slug: 'nakamoto'")).toBeLessThan(list.indexOf("slug: 'moneypenny'"));
  });

  it('and is the initial selection', () => {
    expect(tab).toMatch(/useState<string>\('nakamoto'\)/);
    expect(tab).not.toMatch(/useState<string>\('moneypenny'\)/);
  });

  it('the list order and the initial selection agree', () => {
    // PILOT_AGENTS[0] is also the fallback resolveSurfaceProps uses when a
    // slug does not resolve. If the two disagreed, the fallback would silently
    // reintroduce the default this change removes.
    const at = panel.indexOf('export const PILOT_AGENTS');
    const first = panel.slice(at, panel.indexOf('];', at)).match(/slug: '([a-z]+)'/)?.[1];
    expect(tab).toMatch(new RegExp(`useState<string>\\('${first}'\\)`));
  });
});

describe('a transaction Horizen built is a transaction we can find', () => {
  /*
   * ── The defect this closes (operator, 2026-08-02) ────────────────────────
   *
   * Horizen BUILT it — "Unsigned registration transaction built for 0x24BB…
   * on Base Sepolia" — and `extractUnsignedTx` reported it could not find one.
   * Two reasons, both ours:
   *
   *   1. `JSON.parse` was called on the WHOLE text block. Horizen replies with
   *      prose, a `--- structured ---` marker, then the object. The parse threw
   *      on every SUCCESSFUL response and the catch swallowed it as "not JSON
   *      — keep looking".
   *   2. Horizen nests the transaction under `tx`. The recognised shapes were
   *      root `to`/`data`, `transaction`, `unsignedTransaction` — three, none
   *      of them the one returned.
   *
   * A successful build was therefore indistinguishable from a failed one, and
   * the refusal said "could not locate an unsigned transaction" — true of the
   * function, false of the world.
   */
  const realHorizenReply = {
    content: [
      {
        type: 'text',
        text:
          'Unsigned registration transaction built for 0x24BBB9C7aAcB33556D1429a3e1B33f05fAf7D4B9 on Base Sepolia.\n\n' +
          'Next steps:\n1. Sign this transaction with the wallet\'s own key.\n\n' +
          '--- structured ---\n' +
          '{\n "chain": "base-sepolia",\n "network": "sepolia",\n "tx": {\n  "type": "eip1559",\n' +
          '  "to": "0x8004A818BFB912233c491871b3d84c89A494BD9e",\n  "chainId": 84532,\n  "data": "0xf2c298be00"\n }\n}',
      },
    ],
  };

  it('finds the transaction in Horizen\'s actual reply', () => {
    const tx = extractUnsignedTx(realHorizenReply as never);
    expect(tx, 'the transaction Horizen built must be found').toBeTruthy();
    expect(tx?.to).toBe('0x8004A818BFB912233c491871b3d84c89A494BD9e');
    expect(Number(tx?.chainId)).toBe(84532);
  });

  it('the recovered `to` is this repo\'s recorded IdentityRegistry for base-sepolia', () => {
    // If these disagreed the ceremony would refuse with
    // NETWORK_OR_CONTRACT_MISMATCH — correctly, but it is worth knowing that
    // they agree before the operator spends a signature finding out.
    const tx = extractUnsignedTx(realHorizenReply as never);
    expect(tx?.to?.toLowerCase()).toBe(
      HORIZEN_NETWORK_FACTS['base-sepolia'].identityRegistry.toLowerCase(),
    );
  });

  it('a brace in the prose does not swallow the object', () => {
    // Taking only the FIRST `{` is fragile: Horizen's prose is free text, and
    // one stray brace would consume the extraction and report "no transaction"
    // about a response containing one. Caught by a test before production.
    const tx = extractUnsignedTx({
      content: [{ type: 'text', text: 'note {aside} then {"tx":{"to":"0xA","data":"0xB"}}' }],
    } as never);
    expect(tx?.to).toBe('0xA');
  });

  it('every previously recognised shape still works — the target did not move', () => {
    const shapes = [
      { to: '0xA', data: '0xB' },
      { transaction: { to: '0xA', data: '0xB' } },
      { unsignedTransaction: { to: '0xA', data: '0xB' } },
    ];
    for (const shape of shapes) {
      const tx = extractUnsignedTx({ content: [{ type: 'text', text: JSON.stringify(shape) }] } as never);
      expect(tx?.to, JSON.stringify(shape)).toBe('0xA');
    }
  });

  it('genuinely absent stays absent', () => {
    expect(extractUnsignedTx({ content: [{ type: 'text', text: 'no json at all' }] } as never)).toBeNull();
    expect(extractUnsignedTx(null)).toBeNull();
  });
});

describe('a lapsed ceremony says so, and can be restarted', () => {
  /*
   * ── The run this closes (operator, 2026-08-02) ───────────────────────────
   *
   * The ladder reached three green rungs — wallet ready, mandate prepared,
   * MANDATE SIGNED — and the agent-key invocation lapsed unapproved behind it.
   *
   *   > "The issue is the page has the flow at mandate signed. Probably needs
   *   >  a start over button to clear and restart otherwise we'll remain stuck
   *   >  here."
   *
   * With both requests gone the stage is correctly NOT_STARTED. But telling
   * the operator "nothing is in flight, no act is part-completed" denies work
   * they actually did and sends them looking for a state that no longer
   * exists.
   */
  const base = {
    walletReady: true,
    liveMandate: false,
    liveInvocation: false,
    broadcastPending: false,
    tokenId: null as string | null,
    expiredAttempts: 0,
  };

  it('distinguishes "never begun" from "reached the agent key and lapsed"', () => {
    const fresh = registerCeremonyProgress(base);
    const lapsed = registerCeremonyProgress({ ...base, expiredInvocations: 1 });
    expect(fresh.stageId).toBe('NOT_STARTED');
    expect(lapsed.stageId).toBe('NOT_STARTED');
    expect(fresh.headline).toBe('Not started');
    expect(lapsed.headline).toMatch(/lapsed/i);
    expect(lapsed.headline).not.toBe(fresh.headline);
  });

  it('the lapsed message does not deny the work that was done', () => {
    const lapsed = registerCeremonyProgress({ ...base, expiredInvocations: 1 });
    expect(lapsed.meaning).toMatch(/mandate was signed/i);
    expect(lapsed.meaning).not.toMatch(/no act is part-completed/i);
    // And is unambiguous that nothing reached the chain.
    expect(lapsed.meaning).toMatch(/[Nn]othing was broadcast/);
    expect(lapsed.meaning).toMatch(/nothing reached Horizen/i);
  });

  it('both human legs get the same window — the machine leg is not tighter', () => {
    // 900s assumed the second approval is immediate. The first real run showed
    // it is the same human doing the same navigation a second time, and it
    // lapsed.
    expect(AGENT_INVOCATION_TTL_SECONDS).toBe(PRINCIPAL_MANDATE_TTL_SECONDS);
    expect(humanLegIsNotTighterThanMachineLeg()).toBe(true);
  });

  it('Start over clears the view without cancelling anything', () => {
    // Abandoning an authorisation on the operator's behalf is not a side
    // effect a "clear the screen" control may have. A live mandate stays live
    // and stays signable; refusing one is a separate, stated act in the wallet.
    const panel = stripComments(readSource('components/journey/RegisterAgentPanel.tsx'));
    expect(panel).toMatch(/>\s*Start over\s*</);
    const at = panel.indexOf('Start over');
    const block = panel.slice(Math.max(0, at - 900), at);
    expect(block).toMatch(/setFlow\(\{ step: 'idle' \}\)/);
    expect(block).toMatch(/void readProgress\(\)/);
    // It must not call refuse, nor any completion route.
    expect(block).not.toMatch(/refuse|\/approve|announceWalletSurfaceCompletion/i);
  });

  it('Start over is not offered once registration is complete', () => {
    const panel = stripComments(readSource('components/journey/RegisterAgentPanel.tsx'));
    expect(panel).toMatch(/progress\.stageId !== 'REGISTERED' &&/);
  });

  /*
   * STUCK AT RUNG 4 (operator, 2026-08-02, 13:10: "It's stuck again").
   *
   * The panel showed BOTH of these at once: a ladder reading "Awaiting your
   * approval of the agent key / Mandate signed by you ✓", and beneath it a
   * card reading "Awaiting your wallet signature ... request sr_fde7c6d5 ...
   * Sign in your wallet". The card was this page's stale memory of what it
   * last did; the ladder was the signing store's account of what IS. The
   * wrong one carried the only wallet button on the page, and the act the
   * ladder actually named had no control at all.
   */
  it('the stale signature card yields to the ladder once the mandate rung has passed', () => {
    const panel = stripComments(readSource('components/journey/RegisterAgentPanel.tsx'));
    // The card is gated on the ladder, not on local flow state alone.
    expect(panel).toMatch(/flow\.step === 'awaiting-signature' && !ladderMovedPastMandate &&/);
    // And "past" is compared by POSITION, so a rung inserted later is covered
    // without anyone remembering to come back here.
    expect(panel).toMatch(/REGISTER_CEREMONY_LADDER\.findIndex/);
    expect(panel).toMatch(/return nowAt > mandateAt;/);
  });

  it('every rung that names a wallet act offers that act', () => {
    const panel = stripComments(readSource('components/journey/RegisterAgentPanel.tsx'));
    // Both human legs happen in Pending actions, and they are DIFFERENT acts —
    // labelling the approval "Sign in your wallet" is what made the stale card
    // look like the right control.
    expect(panel).toMatch(/stageId === 'MANDATE_AWAITING_SIGNATURE'\s*\?\s*'Sign in your wallet'/);
    expect(panel).toMatch(/stageId === 'INVOCATION_AWAITING_APPROVAL'\s*\?\s*'Approve the agent key in your wallet'/);
    // The label is wired to a real hand-over, not just rendered as text.
    const at = panel.indexOf('{walletActLabel && (');
    expect(at, 'the ladder renders no wallet button').toBeGreaterThan(-1);
    const block = panel.slice(at, panel.indexOf('</button>', at));
    expect(block).toMatch(/handOverToWallet\('PENDING_ACTIONS'/);

    // Every stage that says "waiting on you" and is not the wallet gate must
    // have a label — otherwise the ladder can name an act it cannot offer.
    const acting = (['MANDATE_AWAITING_SIGNATURE', 'INVOCATION_AWAITING_APPROVAL'] as const).map((id) =>
      registerCeremonyProgress({
        ...base,
        liveMandate: id === 'MANDATE_AWAITING_SIGNATURE',
        liveInvocation: id === 'INVOCATION_AWAITING_APPROVAL',
      }),
    );
    for (const p of acting) {
      expect(p.nextActor).toBe('you');
      expect(p.nextAct).toMatch(/Pending actions/);
    }
  });

  /*
   * A BROADCAST THAT WAS NOT CONFIRMED IS STILL A BROADCAST (operator,
   * 2026-08-02, 13:43).
   *
   *   > "We advanced to approve and then it hung and gave this error: Horizen
   *   >  has not confirmed registration yet ... And then interface is back to
   *   >  start over ... is it back to 1 register again or will that create a
   *   >  duplicate registration?"
   *
   * The approval succeeded — `approveAgentRegistryInvocation` broadcast a real
   * transaction and receipted it twice. The confirmation poll then ran out and
   * the txHash, held only in the component's `flow` state, was lost on the next
   * render. What remained on screen was the first act of the ceremony.
   *
   * That is the dangerous case, not merely the confusing one: the guard against
   * a duplicate registration is `ALREADY_REGISTERED`, which fires on the Agent
   * Card carrying a tokenId — and the tokenId is written only by a confirmation
   * that has not happened. So an unconfirmed broadcast is exactly the state in
   * which "Register again" is NOT protected, and exactly the state the surface
   * was offering it in.
   */
  it('an unconfirmed broadcast is recovered from the receipts, not from page memory', () => {
    const panel = stripComments(readSource('components/journey/RegisterAgentPanel.tsx'));
    // Read back from the durable record of the broadcast.
    expect(panel).toMatch(/actionTypes=horizen_registration_submitted,horizen_agent_registered/);
    // A submitted receipt with no confirmation behind it IS the pending one.
    expect(panel).toMatch(/confirmedHashes/);
    expect(panel).toMatch(/r\.actionType === 'horizen_registration_submitted' &&/);
    // And it drives the ladder, so rung 5 survives a reload.
    expect(panel).toMatch(/broadcastPending: flowStepRef\.current === 'polling' \|\| \(!tokenId && unconfirmed !== undefined\)/);
  });

  it('the primary control never offers "Register" over an unconfirmed broadcast', () => {
    /*
     * The whole point. At BROADCAST_AWAITING_CONFIRMATION the offer is to ASK
     * HORIZEN, and the reason is stated — pressing Register there would build
     * and broadcast a second registration with no guard standing in the way.
     */
    const panel = stripComments(readSource('components/journey/RegisterAgentPanel.tsx'));
    const at = panel.indexOf("progress.stageId === 'BROADCAST_AWAITING_CONFIRMATION'");
    expect(at, 'the primary action does not branch on the broadcast rung').toBeGreaterThan(-1);
    // Bounded to THIS branch: it ends where the Register fallback begins.
    // A fixed-width window would overrun into that branch and read its
    // legitimate `prepare()` as a violation.
    const end = panel.indexOf('label: `Register ', at);
    expect(end, 'the Register fallback no longer follows this branch').toBeGreaterThan(at);
    const block = panel.slice(at, end);
    expect(block).toMatch(/Check status with Horizen/);
    expect(block).not.toMatch(/void prepare\(\)/);
    expect(block).toMatch(/would broadcast a second one/);
  });

  it('the primary control is derived from the rung, not from idle-ness', () => {
    const panel = stripComments(readSource('components/journey/RegisterAgentPanel.tsx'));
    // The old shape: "Register ..." rendered on flow.step === 'idle' + a ready
    // wallet, whatever rung the ceremony had reached.
    expect(panel).not.toMatch(/flow\.step === 'idle' && walletGate\?\.ready && \(/);
    expect(panel).toMatch(/flow\.step === 'idle' && primaryAction && \(/);
    // An unavailable act renders inactive rather than absent — the operator
    // asked for this explicitly ("if action is not available it can be
    // inactive"), and a missing control reads as a broken page.
    expect(panel).toMatch(/disabled=\{!primaryAction\.enabled\}/);
  });

  it('a status check needs only the txHash — the owner address is derived server-side', () => {
    /*
     * Requiring `ownerWalletAddress` from the caller is what made the check
     * unaskable after a reload. It is a property OF THE AGENT (its own
     * custodied wallet) and was always derivable where the agent resolves.
     */
    const route = stripComments(
      readSource('app/api/journey/moneypenny-horizen/register/status/route.ts'),
    );
    expect(route).toMatch(/if \(!body\.agentSlug \|\| !body\.txHash \|\| !body\.network\)/);
    expect(route).toMatch(/body\.ownerWalletAddress\?\.trim\(\) \|\| \(await resolveAgentOwnerWalletAddress\(agent\)\)/);
    // A failure to look it up must not be reported as the transaction failing.
    expect(route).toMatch(/not a statement that the transaction failed/);
  });

  it('the duplicate guard reads the Agent Card tokenId — so it cannot protect an unconfirmed broadcast', () => {
    /*
     * Stated as a test because it is the REASON the surface must not offer
     * Register at rung 5. If this guard ever becomes able to see an
     * unconfirmed broadcast, that is a deliberate change and this test should
     * be revisited with it — not silently outgrown.
     */
    const client = stripComments(readSource('services/horizen/registrationClient.ts'));
    expect(client).toMatch(/refusalCode: 'ALREADY_REGISTERED'/);
    const at = client.indexOf("refusalCode: 'ALREADY_REGISTERED'");
    const before = client.slice(Math.max(0, at - 300), at);
    expect(before).toMatch(/horizen\.tokenId != null/);
  });
});
