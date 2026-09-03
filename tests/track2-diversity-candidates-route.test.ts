/**
 * GET /api/research/track2/[experimentId]/diversity-candidates and its
 * sibling POST .../accept — Stage 9's structural-diversity remediation
 * (operator direction, 2026-08-05). GET never writes; it classifies
 * unpromoted candidates and keeps only ones whose natural shape differs from
 * the crystal's current dominant shape. POST is the only path that can set a
 * semantic type other than 'constraint' on promotion.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockListInvariants = vi.fn();
vi.mock('@/services/invariants/store', () => ({
  listInvariants: (...args: any[]) => mockListInvariants(...args),
}));

const mockListCandidates = vi.fn();
const mockPromoteCandidate = vi.fn();
vi.mock('@/services/invariants/discoveryEngine', () => ({
  listCandidates: (...args: any[]) => mockListCandidates(...args),
  // The route reads via the across-sub-domains variant (2026-09-03,
  // "EXP-P1 Crystal v2 sub-domain invisibility" repair) — same mock fn.
  listCandidatesAcrossSubDomains: (...args: any[]) => mockListCandidates(...args),
  promoteCandidate: (...args: any[]) => mockPromoteCandidate(...args),
}));

const mockValidateInvariant = vi.fn();
vi.mock('@/services/invariants', () => ({
  validateInvariant: (...args: any[]) => mockValidateInvariant(...args),
}));

const mockSuggestSemanticType = vi.fn();
vi.mock('@/services/invariants/semanticTypeSuggestion', () => ({
  suggestSemanticType: (...args: any[]) => mockSuggestSemanticType(...args),
}));

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => ({}),
}));

import { GET } from '@/app/api/research/track2/[experimentId]/diversity-candidates/route';
import { POST } from '@/app/api/research/track2/[experimentId]/diversity-candidates/[candidateId]/accept/route';

function makeGetRequest(): NextRequest {
  return { nextUrl: new URL('http://localhost/api/research/track2/EXP-P1/diversity-candidates') } as unknown as NextRequest;
}
function makePostRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

const params = Promise.resolve({ experimentId: 'EXP-P1' });
const acceptParams = Promise.resolve({ experimentId: 'EXP-P1', candidateId: 'cand-1' });

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-steward', cartridgeFlags: { isAdmin: true } });
  mockListInvariants.mockReset();
  mockListInvariants.mockResolvedValue([
    { id: 'inv-1', semanticType: 'constraint' },
    { id: 'inv-2', semanticType: 'constraint' },
  ]);
  mockListCandidates.mockReset();
  mockListCandidates.mockResolvedValue([
    { id: 'cand-1', status: 'candidate', statement: 'Every settlement must be receipted within 24 hours.', rationale: 'from FATF guidance' },
    { id: 'cand-2', status: 'promoted', statement: 'already promoted' },
  ]);
  mockSuggestSemanticType.mockReset();
  mockPromoteCandidate.mockReset();
  mockValidateInvariant.mockReset();
});

describe('GET diversity-candidates', () => {
  it('refuses an unauthenticated caller', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await GET(makeGetRequest(), { params });
    expect(res.status).toBe(401);
  });

  it('surfaces only candidates whose proposed shape differs from the crystal dominant shape', async () => {
    mockSuggestSemanticType.mockResolvedValue({ ok: true, suggestion: { semanticType: 'law', confidence: 85, reason: 'exceptionless timing rule' } });
    const res = await GET(makeGetRequest(), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.dominantShape).toBe('constraint');
    expect(body.candidates).toHaveLength(1);
    expect(body.candidates[0]).toMatchObject({ candidateId: 'cand-1', proposedSemanticType: 'law' });
    // status:'promoted' candidate never gets scanned
    expect(mockSuggestSemanticType).toHaveBeenCalledTimes(1);
  });

  it('drops a candidate whose proposed shape MATCHES the dominant shape — never "diversity" that repeats it', async () => {
    mockSuggestSemanticType.mockResolvedValue({ ok: true, suggestion: { semanticType: 'constraint', confidence: 90, reason: 'still a constraint' } });
    const res = await GET(makeGetRequest(), { params });
    const body = await res.json();
    expect(body.candidates).toHaveLength(0);
  });

  it('drops a candidate the classifier refused rather than guessing', async () => {
    mockSuggestSemanticType.mockResolvedValue({ ok: false, error: 'inference failed' });
    const res = await GET(makeGetRequest(), { params });
    const body = await res.json();
    expect(body.candidates).toHaveLength(0);
  });
});

describe('POST diversity-candidates/[candidateId]/accept', () => {
  it('refuses a semanticType outside the six canonical values', async () => {
    const res = await POST(makePostRequest({ semanticType: 'rule-of-thumb' }), { params: acceptParams });
    expect(res.status).toBe(400);
    expect(mockPromoteCandidate).not.toHaveBeenCalled();
  });

  it('promotes with the EXACT steward-confirmed semanticType, never re-deriving it', async () => {
    mockPromoteCandidate.mockResolvedValue({ ok: true, invariantId: 'inv-new', linkedParents: 0 });
    mockValidateInvariant.mockResolvedValue({ invariant: {}, verdict: { ok: true, checks: [] } });
    const res = await POST(makePostRequest({ semanticType: 'law' }), { params: acceptParams });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(mockPromoteCandidate).toHaveBeenCalledWith({}, 'cand-1', { personaId: 'persona-steward' }, [], 'law');
    expect(body.validated).toBe(true);
    expect(body.semanticType).toBe('law');
  });

  it('reports validated:false with the failing check, never a fabricated success', async () => {
    mockPromoteCandidate.mockResolvedValue({ ok: true, invariantId: 'inv-new', linkedParents: 0 });
    mockValidateInvariant.mockResolvedValue({
      invariant: {},
      verdict: { ok: false, checks: [{ name: 'consistency', passed: false, detail: 'contradicts canonical invariant x' }] },
    });
    const res = await POST(makePostRequest({ semanticType: 'law' }), { params: acceptParams });
    const body = await res.json();
    expect(body.validated).toBe(false);
    expect(body.validationDetail).toContain('contradicts');
  });

  it('surfaces a promotion refusal as 409 rather than a fabricated success', async () => {
    mockPromoteCandidate.mockResolvedValue({ ok: false, error: 'candidate is already promoted' });
    const res = await POST(makePostRequest({ semanticType: 'law' }), { params: acceptParams });
    expect(res.status).toBe(409);
    expect(mockValidateInvariant).not.toHaveBeenCalled();
  });
});
