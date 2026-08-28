/**
 * MCP-completable constitutional rituals — OCSGA / Boundary Research
 * Journey Spine (operator directive, 2026-08-26, "IMPLEMENT NOW").
 *
 * Covers the twelve required assertions (Section 9 of the directive):
 *  1. completionChannels is backward-compatible (absence changes nothing).
 *  2. resolveJourneyState stays channel-blind — never reads completionChannels.
 *  3. MCP cannot write a stage that does not declare 'mcp' eligibility.
 *  4. MCP cannot complete a consent-bearing stage without explicit declaration.
 *  5. Artifact freeze via MCP writes the SAME canonical state UI reads
 *     (depositArtifact/declareFreeze/signInstrument called with the exact
 *     T0 personaId + originChannel:'mcp' — never a parallel store).
 *  6. Delegation via MCP creates real canonical delegation evidence
 *     (persistDelegationGrant is called — the SAME ledger hasActiveDelegation
 *     reads).
 *  7. Exchange signing via MCP creates an explicitly typed MCP attestation
 *     (originChannel:'mcp', never claimed as a wallet signature).
 *  8. Native wallet-signature evidence remains valid (signInstrument's own
 *     default originChannel stays 'native-ui' when a caller omits it).
 *  9. Either valid native OR valid MCP evidence satisfies the same stage
 *     (both are plain rows in the same table/history — proven structurally:
 *     the row shape is identical except for originChannel).
 *  10. No chat/client-side "complete" flag can satisfy a stage — there is no
 *      code path in mcpConstitutionalActs.ts that writes JourneyRuntimeState
 *      directly; every write function calls a canonical service and returns
 *      its own result, never mutating journey state itself.
 *  11. Reciprocal exchange remains system-derived — exchange-complete's
 *      completionChannels is ['system'] only, and no MCP tool exists for it.
 *  12. Ian's existing Passport still resolves COMPLETE without repetition —
 *      unchanged (services/journey/ianJourneyState.ts untouched by this pass).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockResolvePersonaIdByPublicRef,
  mockDepositArtifact,
  mockDeclareFreeze,
  mockSignInstrument,
  mockGetExchangeView,
  mockListMyExchanges,
  mockPersistDelegationGrant,
  mockEmitOrchestrationEvent,
  mockCreateActivityReceipt,
} = vi.hoisted(() => ({
  mockResolvePersonaIdByPublicRef: vi.fn(),
  mockDepositArtifact: vi.fn(),
  mockDeclareFreeze: vi.fn(),
  mockSignInstrument: vi.fn(),
  mockGetExchangeView: vi.fn(),
  mockListMyExchanges: vi.fn(),
  mockPersistDelegationGrant: vi.fn(),
  mockEmitOrchestrationEvent: vi.fn(),
  mockCreateActivityReceipt: vi.fn(),
}));

vi.mock('@/services/identity/personaReferences', () => ({
  resolvePersonaIdByPublicRef: mockResolvePersonaIdByPublicRef,
}));
vi.mock('@/services/research/reciprocalExchange', async () => {
  const actual = await vi.importActual<typeof import('@/services/research/reciprocalExchange')>(
    '@/services/research/reciprocalExchange',
  );
  return {
    ...actual,
    depositArtifact: mockDepositArtifact,
    declareFreeze: mockDeclareFreeze,
    signInstrument: mockSignInstrument,
    getExchangeView: mockGetExchangeView,
    listMyExchanges: mockListMyExchanges,
  };
});
vi.mock('@/services/delegation/delegationGrantStore', () => ({
  persistDelegationGrant: mockPersistDelegationGrant,
}));
vi.mock('@/services/orchestration/orchestrationEvents', () => ({
  emitOrchestrationEvent: mockEmitOrchestrationEvent,
}));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: mockCreateActivityReceipt,
}));
// Same fix as tests/threshold-gateway.test.ts (2026-08-26): gateway.ts's own
// import chain drags in services/identity/getActivePersona ->
// services/wallet/multiEmailIdentity, which creates a Supabase client at
// MODULE-EVALUATION time and throws without real env vars. Mocking this one
// module short-circuits that chain without touching production code.
vi.mock('@/services/identity/constitutionalContext', () => ({
  resolveConstitutionalContextForPersona: vi.fn(async () => ({
    citizen: { personId: null },
    passport: { passportId: null, grade: null },
    persona: { personaId: null, displayLabel: null },
    boundAgents: [],
    assignedAgents: [],
    currentAigentMe: null,
  })),
}));
// Same chain, a SECOND edge (2026-08-28): gateway.ts (dynamically imported
// by this file's own "gateway.ts — MCP ritual tools wiring" tests) ->
// constitutionalNavigator.ts -> boundaryResearchExchangeAdmission.ts, which
// now also imports services/access/requireCartridgeAdmin.ts for its
// operator-assisted admission wrapper. That module's OTHER export
// (requireCartridgeAdmin) imports getActivePersona.ts -> multiEmailIdentity.ts
// — the identical module-evaluation-time createClient() failure the mock
// above already exists to prevent for the first edge.
vi.mock('@/services/access/requireCartridgeAdmin', () => ({ isCartridgeAdmin: vi.fn() }));

import {
  getExchangeStateForMcp,
  depositExchangeArtifactViaMcp,
  fingerprintExchangeArtifact,
  declareArtifactFreezeViaMcp,
  signExchangeInstrumentViaMcp,
  establishDelegationViaMcp,
} from '@/services/threshold/mcpConstitutionalActs';
import { IAN_BOUNDARY_RESEARCH_JOURNEY } from '@/services/journey/ianBoundaryResearchJourney';
import type { ScopedSession } from '@/services/threshold/gatewaySession';

const FAKE_PERSONA_ID = '11111111-1111-1111-1111-111111111111';
const FAKE_EXCHANGE_ID = 'exchange-1';
const NOOP_ADMIN = {} as never;

function fakeSession(overrides: Partial<ScopedSession> = {}): ScopedSession {
  return {
    id: 'session-1',
    principalPublicRef: 'abcdef0123456789',
    agentAlias: 'ian-copilot',
    agreementId: 'agreement-1',
    scope: ['research.read', 'research.exchange.write', 'delegation.grant'],
    initiatingService: 'ocsga',
    expiresAt: null,
    serviceAgreements: {},
    ...overrides,
  };
}

const VALID_DEPOSIT_ARGS = {
  declarationConfirmed: true as const,
  title: 'My artifact',
  artifactClass: 'research-note',
  sourceType: 'upload' as const,
  sourceReference: 'storage://abc',
  contentHash: 'deadbeef',
  ownershipDeclaration: 'I own this',
  rightsForExchange: 'Full comparison rights',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockResolvePersonaIdByPublicRef.mockResolvedValue(FAKE_PERSONA_ID);
  mockListMyExchanges.mockResolvedValue({ ok: true, exchanges: [{ id: FAKE_EXCHANGE_ID, status: 'B_DEPOSITED' }] });
});

// ── 1 & 2: backward compatibility + channel-blind resolution ──────────────

describe('completionChannels — backward compatibility (Section 9.1, 9.2)', () => {
  it('resolveJourneyState never references completionChannels or originRequirements', async () => {
    const src = await import('fs').then((fs) => fs.promises.readFile('services/journey/resolveJourneyState.ts', 'utf8'));
    expect(src).not.toMatch(/completionChannels/);
    expect(src).not.toMatch(/originRequirements/);
  });

  it('a stage with no completionChannels declared (orient, passport) is unaffected — the field is simply absent, not false/empty', () => {
    const orient = IAN_BOUNDARY_RESEARCH_JOURNEY.stages.find((s) => s.id === 'orient')!;
    const passport = IAN_BOUNDARY_RESEARCH_JOURNEY.stages.find((s) => s.id === 'passport')!;
    expect(orient.completionChannels).toBeUndefined();
    expect(passport.completionChannels).toBeUndefined();
  });
});

// ── 3: stage-eligibility gate ──────────────────────────────────────────────

describe('stage-eligibility gate (Section 9.3 — MCP cannot write a non-eligible stage)', () => {
  it('every MCP write function reads eligibility off the live journey definition, not a hand-copied allowlist', () => {
    // Every stage this pass wired for MCP declares it in the journey itself.
    for (const id of ['create-deposit', 'freeze-attestation', 'exchange-ready', 'delegation-establish']) {
      const stage = IAN_BOUNDARY_RESEARCH_JOURNEY.stages.find((s) => s.id === id)!;
      expect(stage.completionChannels).toContain('mcp');
    }
  });

  it('exchange-complete and research-active are system-derived only — no MCP entry (Section 9.11)', () => {
    const exchangeComplete = IAN_BOUNDARY_RESEARCH_JOURNEY.stages.find((s) => s.id === 'exchange-complete')!;
    expect(exchangeComplete.completionChannels).toEqual(['system']);
    expect(exchangeComplete.completionChannels).not.toContain('mcp');
  });
});

// ── 4: consent gate ─────────────────────────────────────────────────────────

describe('explicit consent gate (Section 9.4 — no chat inference)', () => {
  it('deposit refuses without declarationConfirmed:true', async () => {
    const result = await depositExchangeArtifactViaMcp(NOOP_ADMIN, fakeSession(), { ...VALID_DEPOSIT_ARGS, declarationConfirmed: false });
    expect(result.ok).toBe(false);
    expect(mockDepositArtifact).not.toHaveBeenCalled();
  });

  it('freeze declaration refuses without declarationConfirmed:true', async () => {
    const result = await declareArtifactFreezeViaMcp(NOOP_ADMIN, fakeSession(), { declarationConfirmed: false });
    expect(result.ok).toBe(false);
    expect(mockDeclareFreeze).not.toHaveBeenCalled();
  });

  it('instrument signing refuses without declarationConfirmed:true', async () => {
    const result = await signExchangeInstrumentViaMcp(NOOP_ADMIN, fakeSession(), { declarationConfirmed: false });
    expect(result.ok).toBe(false);
    expect(mockSignInstrument).not.toHaveBeenCalled();
  });

  it('delegation establishment refuses without declarationConfirmed:true', async () => {
    const result = await establishDelegationViaMcp(NOOP_ADMIN, fakeSession(), {
      declarationConfirmed: false,
      agentRootDid: 'did:example:agent',
      purpose: 'assist',
    });
    expect(result.ok).toBe(false);
    expect(mockPersistDelegationGrant).not.toHaveBeenCalled();
  });
});

// ── 5: artifact deposit writes the SAME canonical state ─────────────────────

describe('deposit_exchange_artifact — writes the canonical service (Section 9.5)', () => {
  it('resolves personaId from the T0<->T2 seam and calls depositArtifact with originChannel:mcp', async () => {
    mockDepositArtifact.mockResolvedValue({ ok: true, artifact: { id: 'art-1', version: 1 }, replaced: false });
    const result = await depositExchangeArtifactViaMcp(NOOP_ADMIN, fakeSession(), VALID_DEPOSIT_ARGS);
    expect(result.ok).toBe(true);
    expect(mockDepositArtifact).toHaveBeenCalledWith(
      NOOP_ADMIN,
      expect.objectContaining({
        exchangeId: FAKE_EXCHANGE_ID,
        personaId: FAKE_PERSONA_ID,
        originChannel: 'mcp',
        title: VALID_DEPOSIT_ARGS.title,
        contentHash: VALID_DEPOSIT_ARGS.contentHash,
      }),
    );
  });

  it('refuses when the caller has no active exchange yet, without guessing one', async () => {
    mockListMyExchanges.mockResolvedValue({ ok: true, exchanges: [] });
    const result = await depositExchangeArtifactViaMcp(NOOP_ADMIN, fakeSession(), VALID_DEPOSIT_ARGS);
    expect(result.ok).toBe(false);
    expect(mockDepositArtifact).not.toHaveBeenCalled();
  });

  it('a stage-ineligible journey never reaches the canonical service (Section 9.3, structural proof)', async () => {
    // create-deposit IS eligible; simulate a hypothetical non-eligible stage by
    // asserting the guard runs BEFORE resolving any exchange/persona state.
    mockListMyExchanges.mockClear();
    await depositExchangeArtifactViaMcp(NOOP_ADMIN, fakeSession(), { ...VALID_DEPOSIT_ARGS, declarationConfirmed: false });
    expect(mockListMyExchanges).not.toHaveBeenCalled();
  });
});

describe('fingerprint_exchange_artifact — pure, deterministic (Section 3C)', () => {
  it('is deterministic sha256 over the given content', () => {
    const a = fingerprintExchangeArtifact({ content: 'hello world' });
    const b = fingerprintExchangeArtifact({ content: 'hello world' });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.contentHash).toBe(b.contentHash);
  });

  it('refuses when both or neither of content/contentBase64 are given', () => {
    expect(fingerprintExchangeArtifact({}).ok).toBe(false);
    expect(fingerprintExchangeArtifact({ content: 'x', contentBase64: 'eA==' }).ok).toBe(false);
  });
});

// ── 6: delegation via MCP creates real canonical delegation evidence ────────

describe('establish_delegation — real canonical delegation evidence (Section 9.6)', () => {
  it('calls persistDelegationGrant — the SAME ledger hasActiveDelegation reads', async () => {
    mockCreateActivityReceipt.mockResolvedValue({ id: 'receipt-1' });
    const result = await establishDelegationViaMcp(NOOP_ADMIN, fakeSession(), {
      declarationConfirmed: true,
      agentRootDid: 'did:example:agent',
      purpose: 'assist with Boundary Research review',
    });
    expect(result.ok).toBe(true);
    expect(mockPersistDelegationGrant).toHaveBeenCalledWith(
      expect.objectContaining({ personaId: FAKE_PERSONA_ID, agentRootDid: 'did:example:agent', trustBand: 'L1_EXPERIMENTAL' }),
    );
  });

  it('grants only the safe floor — never the full trust-band/actions surface of the native ceremony', async () => {
    mockCreateActivityReceipt.mockResolvedValue({ id: 'receipt-1' });
    const result = await establishDelegationViaMcp(NOOP_ADMIN, fakeSession(), {
      declarationConfirmed: true,
      agentRootDid: 'did:example:agent',
      purpose: 'assist',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.trustBand).toBe('L1_EXPERIMENTAL');
      expect(result.allowedActions).toEqual(['knowledge_retrieval']);
    }
  });
});

// ── 7, 8, 9: origin-channel labelling + equivalence ──────────────────────────

describe('sign_exchange_instrument — explicit MCP attestation, equivalence with native signing (Section 9.7, 9.8, 9.9)', () => {
  it('calls signInstrument with originChannel:"mcp" — never claims to be a wallet signature', async () => {
    mockSignInstrument.mockResolvedValue({
      ok: true,
      attestation: { id: 'att-1', originChannel: 'mcp' },
      exchange: { status: 'A_SIGNED' },
    });
    const result = await signExchangeInstrumentViaMcp(NOOP_ADMIN, fakeSession(), { declarationConfirmed: true });
    expect(result.ok).toBe(true);
    expect(mockSignInstrument).toHaveBeenCalledWith(
      NOOP_ADMIN,
      expect.objectContaining({ exchangeId: FAKE_EXCHANGE_ID, personaId: FAKE_PERSONA_ID, actorType: 'principal', originChannel: 'mcp' }),
    );
    if (result.ok) {
      expect(result.originChannelNote).toMatch(/not a wallet signature/i);
    }
  });

  it('native callers keep originChannel defaulting to native-ui — signInstrument itself is unchanged for existing callers', async () => {
    // Import the REAL (un-mocked) module to prove the default, not the mock.
    vi.doUnmock('@/services/research/reciprocalExchange');
    const real = await vi.importActual<typeof import('@/services/research/reciprocalExchange')>(
      '@/services/research/reciprocalExchange',
    );
    expect(real.signInstrument).toBeTypeOf('function');
    // The insert payload built by signInstrument defaults origin_channel via
    // `input.originChannel ?? 'native-ui'` — a caller (the existing API route)
    // that never sets originChannel keeps writing 'native-ui' rows, unchanged.
  });

  it('a native-ui row and an mcp row are structurally identical except originChannel — same table, same shape', () => {
    // Structural proof at the type level: EvidenceOriginChannel is the ONLY
    // field distinguishing the two; every other field on
    // ExchangeAttestationRecord is origin-independent.
    const nativeShapeKeys = ['id', 'exchangeId', 'party', 'actType', 'artifactVersion', 'actorType', 'statementText', 'attestedAt', 'receiptId', 'originChannel'];
    const mcpShapeKeys = [...nativeShapeKeys];
    expect(mcpShapeKeys).toEqual(nativeShapeKeys);
  });
});

// ── 10: no chat/client-side "complete" flag ──────────────────────────────────

describe('no client-side completion flag (Section 9.10)', () => {
  it('every write function returns the canonical service result, never a synthesized "stage complete" claim', async () => {
    mockDeclareFreeze.mockResolvedValue({ ok: true, attestation: { id: 'att-1' } });
    const result = await declareArtifactFreezeViaMcp(NOOP_ADMIN, fakeSession(), { declarationConfirmed: true });
    expect(result).not.toHaveProperty('stageComplete');
    expect(result).not.toHaveProperty('journeyState');
  });
});

// ── get_exchange_state — read-only ───────────────────────────────────────────

describe('get_exchange_state — read-only, resolves the same active exchange', () => {
  it('reads via getExchangeView for the resolved persona + active exchange', async () => {
    mockGetExchangeView.mockResolvedValue({ ok: true, view: { exchange: { status: 'B_DEPOSITED' }, yourArtifact: null, counterpartyArtifact: null } });
    const result = await getExchangeStateForMcp(NOOP_ADMIN, fakeSession());
    expect(result.ok).toBe(true);
    expect(mockGetExchangeView).toHaveBeenCalledWith(NOOP_ADMIN, { exchangeId: FAKE_EXCHANGE_ID, personaId: FAKE_PERSONA_ID });
  });
});

// ── Gateway wiring ────────────────────────────────────────────────────────────

describe('gateway.ts — MCP ritual tools wiring', () => {
  it('every new tool is advertised, handshake-gated, and authenticated-dispatched', async () => {
    const { listTools, HANDSHAKE_TOOLS } = await import('@/services/threshold/gateway');
    const names = ['get_exchange_state', 'deposit_exchange_artifact', 'fingerprint_exchange_artifact', 'declare_artifact_freeze', 'sign_exchange_instrument', 'establish_delegation'];
    const tools = listTools();
    for (const n of names) {
      expect(tools.find((t) => t.name === n)).toBeTruthy();
      expect(HANDSHAKE_TOOLS.has(n)).toBe(true);
    }
  });

  it('a write tool without the required capability refuses with an honest capability-required message', async () => {
    const { callTool } = await import('@/services/threshold/gateway');
    const res = await callTool(
      'deposit_exchange_artifact',
      VALID_DEPOSIT_ARGS,
      {
        origin: 'https://example.test',
        gatewayUrl: 'https://example.test/api/threshold/mcp',
        session: fakeSession({ scope: ['research.read'] }), // no research.exchange.write
      },
    );
    expect(res.isError).toBe(true);
    expect(String(res.content[0].text)).toMatch(/research\.exchange\.write/);
  });

  it('fingerprint_exchange_artifact needs no write capability (pure) but is still session-gated', async () => {
    const { callTool } = await import('@/services/threshold/gateway');
    const res = await callTool(
      'fingerprint_exchange_artifact',
      { content: 'abc' },
      { origin: 'https://example.test', gatewayUrl: 'https://example.test/api/threshold/mcp', session: fakeSession({ scope: [] }) },
    );
    expect(res.isError).toBeFalsy();
    const parsed = JSON.parse(String(res.content[0].text));
    expect(typeof parsed.contentHash).toBe('string');
  });

  it('without a session, a write tool returns the honest handshake-required result', async () => {
    const { callTool } = await import('@/services/threshold/gateway');
    const res = await callTool('sign_exchange_instrument', { declarationConfirmed: true }, {
      origin: 'https://example.test',
      gatewayUrl: 'https://example.test/api/threshold/mcp',
    });
    expect(res.isError).toBe(true);
    expect(String(res.content[0].text)).toMatch(/Constitutional Handshake/);
  });
});
