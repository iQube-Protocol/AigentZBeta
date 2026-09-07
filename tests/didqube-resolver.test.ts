/**
 * services/identity/didQubeResolver.ts — Phase 2 canonical resolver behavioral
 * tests (operator-approved 2026-09-07, third review). Every real dependency
 * mocked; exercises resolveDiDQube() directly against the resolution-state
 * vocabulary (resolved | unresolved | ambiguous | conflicted |
 * unsupported_subject_class) and the scenarios the operator named: missing,
 * duplicate, ambiguous, cross-class, conflicted, superseded, and malformed
 * bindings.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetSupabaseServer = vi.fn();
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => mockGetSupabaseServer(),
}));

const mockResolveRootPrincipalForAuthUser = vi.fn();
const mockResolvePassportPrincipal = vi.fn();
vi.mock('@/services/identity/passportPrincipal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/identity/passportPrincipal')>();
  return {
    ...actual,
    resolveRootPrincipalForAuthUser: (...args: any[]) => mockResolveRootPrincipalForAuthUser(...args),
    resolvePassportPrincipal: (...args: any[]) => mockResolvePassportPrincipal(...args),
  };
});

beforeEach(() => {
  mockGetSupabaseServer.mockReset();
  mockResolveRootPrincipalForAuthUser.mockReset();
  mockResolvePassportPrincipal.mockReset();
});

import { resolveDiDQube } from '@/services/identity/didQubeResolver';

const KYBE_ID = 'kybe-1111-1111-1111-111111111111';
const AGENT_ROOT_ID = 'agent-2222-2222-2222-222222222222';
const DIDQUBE_HUMAN = 'didqube-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const DIDQUBE_AGENT = 'didqube-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

/**
 * A minimal chainable fake matching exactly the `.from(table).select().eq()...`
 * shapes didQubeResolver.ts calls, keyed by table so each test can script
 * per-table responses without a full query engine.
 */
function fakeSupabase(responders: Record<string, (calls: { method: string; args: any[] }[]) => any>) {
  return {
    from: (table: string) => {
      const calls: { method: string; args: any[] }[] = [];
      const builder: any = {
        select: (...args: any[]) => {
          calls.push({ method: 'select', args });
          return builder;
        },
        eq: (...args: any[]) => {
          calls.push({ method: 'eq', args });
          return builder;
        },
        order: (...args: any[]) => {
          calls.push({ method: 'order', args });
          return builder;
        },
        limit: (...args: any[]) => {
          calls.push({ method: 'limit', args });
          return resolveResult();
        },
        maybeSingle: (...args: any[]) => {
          calls.push({ method: 'maybeSingle', args });
          return resolveResult();
        },
      };
      function resolveResult() {
        const responder = responders[table];
        if (!responder) return Promise.resolve({ data: null, error: null });
        return Promise.resolve(responder(calls));
      }
      return builder;
    },
  };
}

/**
 * A subtype-table (`human_didqubes`/`agent_didqubes`) responder that serves BOTH
 * shapes didQubeResolver.ts queries against these tables: the initial
 * `.eq(anchorColumn, anchorId).limit(2)` binding lookup (array), and the
 * per-hop `.eq('didqube_id', X).maybeSingle()` anchor-continuity check
 * (single row keyed by didqube_id) `verifyBoundToAnchor` runs on every
 * successor reached via supersession.
 */
function subtypeResponder(opts: {
  anchorColumn: 'kybe_identity_id' | 'agent_root_identity_id';
  bindingAnchorId: string;
  bindingDidqubeId: string;
  /** didqube_id -> the anchor id it is ACTUALLY bound to (for the per-hop check). */
  anchorByDidqube: Record<string, string>;
}) {
  return (calls: { method: string; args: any[] }[]) => {
    const eqCall = calls.find((c) => c.method === 'eq');
    if (!eqCall) return { data: null, error: null };
    const [col, val] = eqCall.args;
    if (col === opts.anchorColumn && val === opts.bindingAnchorId) {
      return { data: [{ didqube_id: opts.bindingDidqubeId }], error: null };
    }
    if (col === 'didqube_id') {
      const anchorId = opts.anchorByDidqube[val];
      if (anchorId === undefined) return { data: null, error: null };
      return { data: { [opts.anchorColumn]: anchorId }, error: null };
    }
    return { data: null, error: null };
  };
}

describe('resolveDiDQube — entry gating', () => {
  it('returns unsupported_subject_class immediately for a robot hint, no DB call', async () => {
    const result = await resolveDiDQube({ kind: 'subject_class_hint', subjectClass: 'robot' });
    expect(result).toEqual({ state: 'unsupported_subject_class', subjectClass: 'robot' });
    expect(mockGetSupabaseServer).not.toHaveBeenCalled();
  });

  it('returns unsupported_subject_class for an organization hint', async () => {
    const result = await resolveDiDQube({ kind: 'subject_class_hint', subjectClass: 'organization' });
    expect(result).toEqual({ state: 'unsupported_subject_class', subjectClass: 'organization' });
  });

  it('reports unresolved/unavailable when no Supabase server client exists', async () => {
    mockGetSupabaseServer.mockReturnValue(null);
    const result = await resolveDiDQube({ kind: 'kybe_identity_id', kybeIdentityId: KYBE_ID });
    expect(result).toEqual({ state: 'unresolved', reason: 'unavailable' });
  });

  it('erc8004 without a verifiedBindingRef is unresolved/unqualified_reference', async () => {
    mockGetSupabaseServer.mockReturnValue({});
    const result = await resolveDiDQube({ kind: 'erc8004', networkId: '1', identifier: '0xabc' });
    expect(result).toEqual({ state: 'unresolved', reason: 'unqualified_reference' });
  });

  it('erc8004 WITH a verifiedBindingRef is still unresolved/unqualified_reference — no binding store exists yet', async () => {
    mockGetSupabaseServer.mockReturnValue({});
    const result = await resolveDiDQube({
      kind: 'erc8004',
      networkId: '1',
      identifier: '0xabc',
      verifiedBindingRef: 'some-verified-ref',
    });
    expect(result).toEqual({ state: 'unresolved', reason: 'unqualified_reference' });
  });
});

describe('resolveDiDQube — missing anchor (the "absent" scenario)', () => {
  it('a kybe_identity_id with no human_didqubes row is unresolved/anchor_absent', async () => {
    mockGetSupabaseServer.mockReturnValue(
      fakeSupabase({
        human_didqubes: () => ({ data: [], error: null }),
      }),
    );
    const result = await resolveDiDQube({ kind: 'kybe_identity_id', kybeIdentityId: KYBE_ID });
    expect(result).toEqual({ state: 'unresolved', reason: 'anchor_absent' });
  });

  it('an agent_root_identity_id with no agent_didqubes row is unresolved/anchor_absent', async () => {
    mockGetSupabaseServer.mockReturnValue(
      fakeSupabase({
        agent_didqubes: () => ({ data: [], error: null }),
      }),
    );
    const result = await resolveDiDQube({ kind: 'agent_root_identity_id', agentRootIdentityId: AGENT_ROOT_ID });
    expect(result).toEqual({ state: 'unresolved', reason: 'anchor_absent' });
  });

  it('an agent_card_url matching zero agent_root_identity rows is unresolved/anchor_absent', async () => {
    mockGetSupabaseServer.mockReturnValue(
      fakeSupabase({
        agent_root_identity: () => ({ data: [], error: null }),
      }),
    );
    const result = await resolveDiDQube({ kind: 'agent_card_url', agentCardUrl: 'https://cards.example/nope' });
    expect(result).toEqual({ state: 'unresolved', reason: 'anchor_absent' });
  });
});

describe('resolveDiDQube — duplicate / ambiguous bindings', () => {
  it('two human_didqubes rows for the same kybe_identity_id is ambiguous (defensive — the DB UNIQUE constraint should prevent this)', async () => {
    mockGetSupabaseServer.mockReturnValue(
      fakeSupabase({
        human_didqubes: () => ({ data: [{ didqube_id: 'd1' }, { didqube_id: 'd2' }], error: null }),
      }),
    );
    const result = await resolveDiDQube({ kind: 'kybe_identity_id', kybeIdentityId: KYBE_ID });
    expect(result).toEqual({ state: 'ambiguous', candidateCount: 2 });
  });

  it('an agent_card_url matching two agent_root_identity rows (a duplicate discovery match) is ambiguous', async () => {
    mockGetSupabaseServer.mockReturnValue(
      fakeSupabase({
        agent_root_identity: () => ({ data: [{ id: 'a1' }, { id: 'a2' }], error: null }),
      }),
    );
    const result = await resolveDiDQube({ kind: 'agent_card_url', agentCardUrl: 'https://cards.example/dupe' });
    expect(result).toEqual({ state: 'ambiguous', candidateCount: 2 });
  });
});

describe('resolveDiDQube — cross-class binding (conflicted)', () => {
  it('a human_didqubes row pointing at a didqubes row with subject_class=agent is conflicted', async () => {
    mockGetSupabaseServer.mockReturnValue(
      fakeSupabase({
        human_didqubes: () => ({ data: [{ didqube_id: DIDQUBE_HUMAN }], error: null }),
        didqubes: () => ({ data: { subject_class: 'agent', lifecycle_state: 'active', superseded_by: null }, error: null }),
      }),
    );
    const result = await resolveDiDQube({ kind: 'kybe_identity_id', kybeIdentityId: KYBE_ID });
    expect(result.state).toBe('conflicted');
    expect((result as any).detail).toContain("not the expected 'natural_person'");
  });

  it('an agent_didqubes row pointing at a didqubes row with subject_class=natural_person is conflicted', async () => {
    mockGetSupabaseServer.mockReturnValue(
      fakeSupabase({
        agent_didqubes: () => ({ data: [{ didqube_id: DIDQUBE_AGENT }], error: null }),
        didqubes: () => ({ data: { subject_class: 'natural_person', lifecycle_state: 'active', superseded_by: null }, error: null }),
      }),
    );
    const result = await resolveDiDQube({ kind: 'agent_root_identity_id', agentRootIdentityId: AGENT_ROOT_ID });
    expect(result.state).toBe('conflicted');
    expect((result as any).detail).toContain("not the expected 'agent'");
  });
});

describe('resolveDiDQube — dual-subtype binding (conflicted)', () => {
  it('a didqube_id bound in BOTH human_didqubes and agent_didqubes is conflicted', async () => {
    mockGetSupabaseServer.mockReturnValue(
      fakeSupabase({
        human_didqubes: () => ({ data: [{ didqube_id: DIDQUBE_HUMAN }], error: null }),
        didqubes: () => ({ data: { subject_class: 'natural_person', lifecycle_state: 'active', superseded_by: null }, error: null }),
        agent_didqubes: () => ({ data: { didqube_id: DIDQUBE_HUMAN }, error: null }),
      }),
    );
    const result = await resolveDiDQube({ kind: 'kybe_identity_id', kybeIdentityId: KYBE_ID });
    expect(result.state).toBe('conflicted');
    expect((result as any).detail).toContain('bound in BOTH human_didqubes and agent_didqubes');
  });
});

describe('resolveDiDQube — supersession (stable-container model: anchor-verified continuity only)', () => {
  it('follows a single supersession hop ONLY because the successor is verified bound to the SAME anchor, and resolves', async () => {
    const didqubesData: Record<string, any> = {
      [DIDQUBE_HUMAN]: { subject_class: 'natural_person', lifecycle_state: 'superseded', superseded_by: 'didqube-successor' },
      'didqube-successor': { subject_class: 'natural_person', lifecycle_state: 'active', superseded_by: null },
    };
    mockGetSupabaseServer.mockReturnValue(
      fakeSupabase({
        human_didqubes: subtypeResponder({
          anchorColumn: 'kybe_identity_id',
          bindingAnchorId: KYBE_ID,
          bindingDidqubeId: DIDQUBE_HUMAN,
          anchorByDidqube: { [DIDQUBE_HUMAN]: KYBE_ID, 'didqube-successor': KYBE_ID },
        }),
        didqubes: (calls) => {
          const eqCall = calls.find((c) => c.method === 'eq');
          const id = eqCall?.args[1];
          return { data: didqubesData[id] ?? null, error: null };
        },
        agent_didqubes: () => ({ data: null, error: null }),
        kybe_identity: () => ({ data: { kybe_did: 'did:kybe:ppb:abc123' }, error: null }),
        root_identity: () => ({ data: [], error: null }),
        polity_passport_records: () => ({ data: [], error: null }),
      }),
    );
    const result = await resolveDiDQube({ kind: 'kybe_identity_id', kybeIdentityId: KYBE_ID });
    expect(result.state).toBe('resolved');
    expect((result as any).primitive.didqubeId).toBe('didqube-successor');
  });

  it('a successor with NO anchor binding at all is conflicted — never silently resolved (stable-container model)', async () => {
    const didqubesData: Record<string, any> = {
      [DIDQUBE_HUMAN]: { subject_class: 'natural_person', lifecycle_state: 'superseded', superseded_by: 'didqube-orphan-successor' },
      'didqube-orphan-successor': { subject_class: 'natural_person', lifecycle_state: 'active', superseded_by: null },
    };
    mockGetSupabaseServer.mockReturnValue(
      fakeSupabase({
        human_didqubes: subtypeResponder({
          anchorColumn: 'kybe_identity_id',
          bindingAnchorId: KYBE_ID,
          bindingDidqubeId: DIDQUBE_HUMAN,
          // 'didqube-orphan-successor' deliberately absent — no binding at all.
          anchorByDidqube: { [DIDQUBE_HUMAN]: KYBE_ID },
        }),
        didqubes: (calls) => {
          const eqCall = calls.find((c) => c.method === 'eq');
          const id = eqCall?.args[1];
          return { data: didqubesData[id] ?? null, error: null };
        },
      }),
    );
    const result = await resolveDiDQube({ kind: 'kybe_identity_id', kybeIdentityId: KYBE_ID });
    expect(result.state).toBe('conflicted');
    expect((result as any).detail).toContain('has no human_didqubes binding');
    expect((result as any).detail).toContain('cannot verify constitutional-anchor continuity');
  });

  it('a successor bound to a DIFFERENT anchor is conflicted, even though subject_class matches (subject-class continuity alone is insufficient)', async () => {
    const OTHER_KYBE_ID = 'kybe-9999-9999-9999-999999999999';
    const didqubesData: Record<string, any> = {
      [DIDQUBE_HUMAN]: { subject_class: 'natural_person', lifecycle_state: 'superseded', superseded_by: 'didqube-other-subject' },
      // Same subject_class as the predecessor — proves matching subject_class alone is not enough.
      'didqube-other-subject': { subject_class: 'natural_person', lifecycle_state: 'active', superseded_by: null },
    };
    mockGetSupabaseServer.mockReturnValue(
      fakeSupabase({
        human_didqubes: subtypeResponder({
          anchorColumn: 'kybe_identity_id',
          bindingAnchorId: KYBE_ID,
          bindingDidqubeId: DIDQUBE_HUMAN,
          // The successor is bound to a DIFFERENT kybe — a different constitutional subject.
          anchorByDidqube: { [DIDQUBE_HUMAN]: KYBE_ID, 'didqube-other-subject': OTHER_KYBE_ID },
        }),
        didqubes: (calls) => {
          const eqCall = calls.find((c) => c.method === 'eq');
          const id = eqCall?.args[1];
          return { data: didqubesData[id] ?? null, error: null };
        },
      }),
    );
    const result = await resolveDiDQube({ kind: 'kybe_identity_id', kybeIdentityId: KYBE_ID });
    expect(result.state).toBe('conflicted');
    expect((result as any).detail).toContain('bound to a DIFFERENT kybe_identity_id');
    // No returned primitive ever combines a successor DiDQube with an unproven predecessor anchor.
    expect((result as any).primitive).toBeUndefined();
  });

  it('a supersession cycle is conflicted, not an infinite loop (anchor checks pass throughout, isolating the cycle guard)', async () => {
    const didqubesData: Record<string, any> = {
      a: { subject_class: 'natural_person', lifecycle_state: 'superseded', superseded_by: 'b' },
      b: { subject_class: 'natural_person', lifecycle_state: 'superseded', superseded_by: 'a' },
    };
    mockGetSupabaseServer.mockReturnValue(
      fakeSupabase({
        human_didqubes: subtypeResponder({
          anchorColumn: 'kybe_identity_id',
          bindingAnchorId: KYBE_ID,
          bindingDidqubeId: 'a',
          anchorByDidqube: { a: KYBE_ID, b: KYBE_ID },
        }),
        didqubes: (calls) => {
          const eqCall = calls.find((c) => c.method === 'eq');
          const id = eqCall?.args[1];
          return { data: didqubesData[id] ?? null, error: null };
        },
      }),
    );
    const result = await resolveDiDQube({ kind: 'kybe_identity_id', kybeIdentityId: KYBE_ID });
    expect(result).toEqual({ state: 'conflicted', detail: 'supersession cycle detected at didqube_id a' });
  });

  it('a chain exceeding the maximum hop count is conflicted, not an infinite loop (anchor checks pass throughout, isolating the depth guard)', async () => {
    const CHAIN_LENGTH = 15; // > MAX_SUPERSESSION_HOPS (10), never cycling
    const ids = Array.from({ length: CHAIN_LENGTH }, (_, i) => `didqube-depth-${i}`);
    const didqubesData: Record<string, any> = {};
    ids.forEach((id, i) => {
      didqubesData[id] = {
        subject_class: 'natural_person',
        lifecycle_state: 'superseded',
        superseded_by: ids[i + 1] ?? 'didqube-depth-unreachable',
      };
    });
    const anchorByDidqube: Record<string, string> = Object.fromEntries(ids.map((id) => [id, KYBE_ID]));
    mockGetSupabaseServer.mockReturnValue(
      fakeSupabase({
        human_didqubes: subtypeResponder({
          anchorColumn: 'kybe_identity_id',
          bindingAnchorId: KYBE_ID,
          bindingDidqubeId: ids[0],
          anchorByDidqube,
        }),
        didqubes: (calls) => {
          const eqCall = calls.find((c) => c.method === 'eq');
          const id = eqCall?.args[1];
          return { data: didqubesData[id] ?? null, error: null };
        },
      }),
    );
    const result = await resolveDiDQube({ kind: 'kybe_identity_id', kybeIdentityId: KYBE_ID });
    expect(result.state).toBe('conflicted');
    expect((result as any).detail).toContain('exceeds');
    expect((result as any).detail).toContain('hops');
  });

  it('a didqube marked superseded with no successor recorded is conflicted (malformed)', async () => {
    mockGetSupabaseServer.mockReturnValue(
      fakeSupabase({
        human_didqubes: () => ({ data: [{ didqube_id: DIDQUBE_HUMAN }], error: null }),
        didqubes: () => ({ data: { subject_class: 'natural_person', lifecycle_state: 'superseded', superseded_by: null }, error: null }),
      }),
    );
    const result = await resolveDiDQube({ kind: 'kybe_identity_id', kybeIdentityId: KYBE_ID });
    expect(result.state).toBe('conflicted');
    expect((result as any).detail).toContain('no superseded_by successor');
  });
});

describe('resolveDiDQube — malformed bindings', () => {
  it('a human_didqubes row referencing a nonexistent didqubes row is conflicted', async () => {
    mockGetSupabaseServer.mockReturnValue(
      fakeSupabase({
        human_didqubes: () => ({ data: [{ didqube_id: DIDQUBE_HUMAN }], error: null }),
        didqubes: () => ({ data: null, error: null }),
      }),
    );
    const result = await resolveDiDQube({ kind: 'kybe_identity_id', kybeIdentityId: KYBE_ID });
    expect(result.state).toBe('conflicted');
    expect((result as any).detail).toContain('has no didqubes row');
  });

  it('a constitutional anchor with no public DID material (kybe_did null) is conflicted', async () => {
    mockGetSupabaseServer.mockReturnValue(
      fakeSupabase({
        human_didqubes: () => ({ data: [{ didqube_id: DIDQUBE_HUMAN }], error: null }),
        didqubes: () => ({ data: { subject_class: 'natural_person', lifecycle_state: 'active', superseded_by: null }, error: null }),
        agent_didqubes: () => ({ data: null, error: null }),
        kybe_identity: () => ({ data: { kybe_did: null }, error: null }),
      }),
    );
    const result = await resolveDiDQube({ kind: 'kybe_identity_id', kybeIdentityId: KYBE_ID });
    expect(result.state).toBe('conflicted');
    expect((result as any).detail).toContain('missing its public DID material');
  });

  it('an agent anchor with no did_uri is conflicted', async () => {
    mockGetSupabaseServer.mockReturnValue(
      fakeSupabase({
        agent_didqubes: () => ({ data: [{ didqube_id: DIDQUBE_AGENT }], error: null }),
        didqubes: () => ({ data: { subject_class: 'agent', lifecycle_state: 'active', superseded_by: null }, error: null }),
        human_didqubes: () => ({ data: null, error: null }),
        agent_root_identity: () => ({ data: { did_uri: null, bound_passport_id: null }, error: null }),
      }),
    );
    const result = await resolveDiDQube({ kind: 'agent_root_identity_id', agentRootIdentityId: AGENT_ROOT_ID });
    expect(result.state).toBe('conflicted');
    expect((result as any).detail).toContain('missing its public DID material');
  });
});

describe('resolveDiDQube — resolved happy paths, distinct fields, trust classes', () => {
  it('resolves a human DiDQube directly by kybe_identity_id, keeping anchor/current/passport/commitment distinct', async () => {
    mockGetSupabaseServer.mockReturnValue(
      fakeSupabase({
        human_didqubes: () => ({ data: [{ didqube_id: DIDQUBE_HUMAN }], error: null }),
        didqubes: () => ({ data: { subject_class: 'natural_person', lifecycle_state: 'active', superseded_by: null }, error: null }),
        agent_didqubes: () => ({ data: null, error: null }),
        kybe_identity: () => ({ data: { kybe_did: 'did:kybe:ppb:abc123' }, error: null }),
        root_identity: () => ({ data: [{ id: 'root-1', did_uri: 'did:iq:root:1', created_at: '2026-01-01' }], error: null }),
        polity_passport_records: () => ({
          data: [
            {
              passport_id: 'ppp-1',
              passport_class: 'citizen',
              citizen_status: 'active',
              participant_status: null,
              passport_grade: 'standard',
              revoked: false,
              expires_at: null,
            },
          ],
          error: null,
        }),
      }),
    );
    const result = await resolveDiDQube({ kind: 'kybe_identity_id', kybeIdentityId: KYBE_ID });
    expect(result.state).toBe('resolved');
    const primitive = (result as any).primitive;
    expect(primitive.subjectClass).toBe('natural_person');
    expect(primitive.constitutionalAnchor).toEqual({ kind: 'kybe_identity', id: KYBE_ID });
    expect(primitive.currentIdentityPrimitive).toEqual({ kind: 'root_identity', id: 'root-1', didUri: 'did:iq:root:1' });
    expect(primitive.passportCredential).toEqual({ passportId: 'ppp-1', passportClass: 'citizen', usable: true });
    expect(primitive.publicCommitment.commitmentVersion).toBe('v1');
    expect(typeof primitive.publicCommitment.value).toBe('string');
    expect(primitive.publicCommitment.value).not.toContain('did:kybe'); // one-way — never the raw DID
    expect(primitive.trustClass).toBe('server_derived');
  });

  it('resolves an agent DiDQube directly by agent_root_identity_id with no bound Passport', async () => {
    mockGetSupabaseServer.mockReturnValue(
      fakeSupabase({
        agent_didqubes: () => ({ data: [{ didqube_id: DIDQUBE_AGENT }], error: null }),
        didqubes: () => ({ data: { subject_class: 'agent', lifecycle_state: 'active', superseded_by: null }, error: null }),
        human_didqubes: () => ({ data: null, error: null }),
        agent_root_identity: () => ({ data: { did_uri: 'did:iq:agent:xyz', bound_passport_id: null }, error: null }),
      }),
    );
    const result = await resolveDiDQube({ kind: 'agent_root_identity_id', agentRootIdentityId: AGENT_ROOT_ID });
    expect(result.state).toBe('resolved');
    const primitive = (result as any).primitive;
    expect(primitive.subjectClass).toBe('agent');
    expect(primitive.constitutionalAnchor).toEqual({ kind: 'agent_root_identity', id: AGENT_ROOT_ID });
    expect(primitive.currentIdentityPrimitive).toEqual({
      kind: 'agent_root_identity',
      id: AGENT_ROOT_ID,
      didUri: 'did:iq:agent:xyz',
      coincidesWithAnchor: true,
    });
    expect(primitive.passportCredential).toBeNull();
    expect(primitive.trustClass).toBe('server_derived');
  });

  it('an agent_card_url resolution is tagged trustClass "discovery" — never authoritative alone', async () => {
    mockGetSupabaseServer.mockReturnValue(
      fakeSupabase({
        agent_root_identity: (calls) => {
          const hasEq = calls.some((c) => c.method === 'eq' && c.args[0] === 'agent_card_url');
          if (hasEq) return { data: [{ id: AGENT_ROOT_ID }], error: null };
          return { data: { did_uri: 'did:iq:agent:xyz', bound_passport_id: null }, error: null };
        },
        agent_didqubes: () => ({ data: [{ didqube_id: DIDQUBE_AGENT }], error: null }),
        didqubes: () => ({ data: { subject_class: 'agent', lifecycle_state: 'active', superseded_by: null }, error: null }),
        human_didqubes: () => ({ data: null, error: null }),
      }),
    );
    const result = await resolveDiDQube({ kind: 'agent_card_url', agentCardUrl: 'https://cards.example/one' });
    expect(result.state).toBe('resolved');
    expect((result as any).primitive.trustClass).toBe('discovery');
  });
});

describe('resolveDiDQube — auth_user_id and proven_wallet composition (never re-deriving the walk)', () => {
  it('auth_user_id composes resolveRootPrincipalForAuthUser and never touches personas', async () => {
    mockResolveRootPrincipalForAuthUser.mockResolvedValue({ ok: true, rootIdentityId: 'root-1', kybeId: KYBE_ID });
    mockGetSupabaseServer.mockReturnValue(
      fakeSupabase({
        human_didqubes: () => ({ data: [{ didqube_id: DIDQUBE_HUMAN }], error: null }),
        didqubes: () => ({ data: { subject_class: 'natural_person', lifecycle_state: 'active', superseded_by: null }, error: null }),
        agent_didqubes: () => ({ data: null, error: null }),
        kybe_identity: () => ({ data: { kybe_did: 'did:kybe:ppb:abc123' }, error: null }),
        root_identity: () => ({ data: { id: 'root-1', did_uri: 'did:iq:root:1' }, error: null }),
        polity_passport_records: () => ({ data: [], error: null }),
        personas: () => {
          throw new Error('didQubeResolver must never query personas');
        },
      }),
    );
    const result = await resolveDiDQube({ kind: 'auth_user_id', authUserId: 'auth-1' });
    expect(mockResolveRootPrincipalForAuthUser).toHaveBeenCalledWith('auth-1');
    expect(result.state).toBe('resolved');
    expect((result as any).primitive.currentIdentityPrimitive).toEqual({ kind: 'root_identity', id: 'root-1', didUri: 'did:iq:root:1' });
  });

  it('auth_user_id maps a lineage_incomplete failure straight through', async () => {
    mockGetSupabaseServer.mockReturnValue({});
    mockResolveRootPrincipalForAuthUser.mockResolvedValue({ ok: false, reason: 'lineage_incomplete' });
    const result = await resolveDiDQube({ kind: 'auth_user_id', authUserId: 'auth-2' });
    expect(result).toEqual({ state: 'unresolved', reason: 'lineage_incomplete' });
  });

  it('proven_wallet composes resolvePassportPrincipal, tagged trustClass "proven_control"', async () => {
    mockResolvePassportPrincipal.mockResolvedValue({
      ok: true,
      principal: {
        kybeId: KYBE_ID,
        rootIdentityId: 'root-1',
        authUserId: 'auth-1',
        passport: { passportClass: 'citizen', citizenStatus: 'active', participantStatus: null, passportGrade: 'standard', revoked: false, expiresAt: null },
      },
    });
    mockGetSupabaseServer.mockReturnValue(
      fakeSupabase({
        human_didqubes: () => ({ data: [{ didqube_id: DIDQUBE_HUMAN }], error: null }),
        didqubes: () => ({ data: { subject_class: 'natural_person', lifecycle_state: 'active', superseded_by: null }, error: null }),
        agent_didqubes: () => ({ data: null, error: null }),
        kybe_identity: () => ({ data: { kybe_did: 'did:kybe:ppb:abc123' }, error: null }),
        root_identity: () => ({ data: { id: 'root-1', did_uri: 'did:iq:root:1' }, error: null }),
        polity_passport_records: () => ({ data: [{ passport_id: 'ppp-1', passport_class: 'citizen', citizen_status: 'active', participant_status: null, passport_grade: 'standard', revoked: false, expires_at: null }], error: null }),
      }),
    );
    const result = await resolveDiDQube({ kind: 'proven_wallet', provenWalletAddress: '0xabc' });
    expect(mockResolvePassportPrincipal).toHaveBeenCalledWith('0xabc', 'evm');
    expect(result.state).toBe('resolved');
    expect((result as any).primitive.trustClass).toBe('proven_control');
  });

  it('proven_wallet with an unusable Passport is unresolved/passport_gate_unmet, not silently resolved', async () => {
    mockGetSupabaseServer.mockReturnValue({});
    mockResolvePassportPrincipal.mockResolvedValue({ ok: false, reason: 'passport_inactive' });
    const result = await resolveDiDQube({ kind: 'proven_wallet', provenWalletAddress: '0xdead' });
    expect(result).toEqual({ state: 'unresolved', reason: 'passport_gate_unmet' });
  });

  it('proven_wallet with no known lineage is unresolved/anchor_absent', async () => {
    mockGetSupabaseServer.mockReturnValue({});
    mockResolvePassportPrincipal.mockResolvedValue({ ok: false, reason: 'wallet_unknown' });
    const result = await resolveDiDQube({ kind: 'proven_wallet', provenWalletAddress: '0xnew' });
    expect(result).toEqual({ state: 'unresolved', reason: 'anchor_absent' });
  });
});
