/**
 * GET /api/research/crystal/[experimentId]/instrument-falsification — the
 * dataflow fix (EXP-P1 retrospective, 2026-08-30).
 *
 * `buildFrozenCrystalManifest` was fixed (services/research/
 * crystalFrozenManifest.ts) to recover the exact frozen domain membership
 * regardless of a member's CURRENT status — but this route still fed the
 * retrospective's four hardened instruments an INDEPENDENT, freshly-queried
 * `runCrystalReadinessReport({experimentId, crystalDomain})` call, which
 * re-applies its own `status: ['validated', 'canonical']` filter and so
 * silently substitutes today's (smaller) corpus for the historically
 * recovered one. These tests pin the fix: the route must thread the
 * manifest's `recoveredInvariants` into `runCrystalReadinessReport` via its
 * new `invariants` override, so `listInvariants` (the independent,
 * status-filtered query) is never called at all when a frozen artifact's
 * membership was already recovered.
 *
 * `verifiedAgainstFreeze` staying fail-closed (false, here) is deliberately
 * untouched by this fix — `composeCrystalRetrospectiveFalsification` already
 * gates `reproducedReviewerObjections` on it independently of what population
 * was assessed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockGetArtifact = vi.fn();
vi.mock('@/services/research/artifacts', () => ({
  getArtifact: (...args: any[]) => mockGetArtifact(...args),
}));

const mockBuildFrozenCrystalManifest = vi.fn();
vi.mock('@/services/research/crystalFrozenManifest', () => ({
  buildFrozenCrystalManifest: (...args: any[]) => mockBuildFrozenCrystalManifest(...args),
}));

// listInvariants/listEdgesForInvariants are the REAL crystalReadiness.ts
// dependencies — left largely real, but listInvariants is instrumented so a
// test can assert it was NEVER called (the independent-query regression this
// fix closes). listEdgesForInvariants is stubbed to [] since no test here
// exercises the graph checks.
const mockListInvariants = vi.fn();
const mockListEdgesForInvariants = vi.fn(async () => []);
vi.mock('@/services/invariants/store', () => ({
  listInvariants: (...args: any[]) => mockListInvariants(...args),
  listEdgesForInvariants: (...args: any[]) => mockListEdgesForInvariants(...args),
}));

import { GET } from '@/app/api/research/crystal/[experimentId]/instrument-falsification/route';

function makeGetRequest(query: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/research/crystal/EXP-P1/instrument-falsification');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return { nextUrl: url } as unknown as NextRequest;
}

const params = (experimentId: string) => Promise.resolve({ experimentId });

function invariant(id: string, statement: string, status: string) {
  return {
    id,
    statement,
    namespace: 'finance',
    ontologyClassId: null,
    semanticType: 'constraint',
    status,
    confidence: 0.9,
    confidenceBasis: 'validated',
    standing: 0.5,
    reach: 1,
    timesValidated: 3,
    timesContradicted: 0,
    timesReferenced: 1,
    timesUsed: 1,
    version: 1,
    supersedesId: null,
    ratifiedSource: null,
    provenance: { evidenceProvenance: 'external-established' },
    reasoningProvenance: {},
    creatorAliasCommitment: null,
    dvnReceiptId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

// 15 members total — 4 currently `superseded` (merged as duplicates since
// freeze), 11 `validated`. Mirrors the live EXP-P1 shape the operator
// reported: buildFrozenCrystalManifest recovers all 15 by domain membership,
// independent of current status.
const RECOVERED_15 = [
  ...Array.from({ length: 11 }, (_, i) => invariant(`v${i}`, `Distinct statement ${i}.`, 'validated')),
  invariant('sup-1', 'Superseded duplicate one.', 'superseded'),
  invariant('sup-2', 'Superseded duplicate two.', 'superseded'),
  invariant('sup-3', 'Superseded duplicate three.', 'superseded'),
  invariant('sup-4', 'Superseded duplicate four.', 'superseded'),
];

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', cartridgeFlags: { isAdmin: true } });
  mockGetArtifact.mockReset();
  mockGetArtifact.mockResolvedValue({
    id: 'EXP-P1/crystal-vP1',
    lifecycle: 'frozen',
    contentHash: 'frozen-hash-abc',
    commitmentHash: 'frozen-hash-abc',
    frozenAt: '2026-01-03T00:00:00.000Z',
    signedBy: ['operator-ref'],
    receiptId: null,
  });
  mockBuildFrozenCrystalManifest.mockReset();
  mockListInvariants.mockReset();
  mockListInvariants.mockResolvedValue([]); // would prove the bug if ever called
  mockListEdgesForInvariants.mockReset();
  mockListEdgesForInvariants.mockResolvedValue([]);
});

describe('GET instrument-falsification — retrospective assesses the RECOVERED frozen population, never an independent re-query', () => {
  it('retrospective.invariantCount is 15 (not 11) when the manifest recovers 15 members, 4 of them superseded', async () => {
    mockBuildFrozenCrystalManifest.mockResolvedValue({
      frozenContentHash: 'frozen-hash-abc',
      verifiedAgainstFreeze: false, // fail-closed, per the operator's own live report
      verificationDetail: '15 member(s) recovered; 4 now carry a non-freeze-eligible status',
      recoveredInvariants: RECOVERED_15,
      members: null,
    });

    const res = await GET(makeGetRequest({ domain: 'financial-risk-value-systems' }), { params: params('EXP-P1') });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    // THE FIX, pinned directly: 15, not 11.
    expect(body.retrospective.invariantCount).toBe(15);
    // The independent, status-filtered live query must NEVER have been made —
    // the exact substitution this fix closes.
    expect(mockListInvariants).not.toHaveBeenCalled();
  });

  it('the superseded members are actually INCLUDED in the assessed population, not merely counted', async () => {
    mockBuildFrozenCrystalManifest.mockResolvedValue({
      frozenContentHash: 'frozen-hash-abc',
      verifiedAgainstFreeze: false,
      verificationDetail: '15 member(s) recovered',
      recoveredInvariants: RECOVERED_15,
      members: null,
    });

    const res = await GET(makeGetRequest({ domain: 'financial-risk-value-systems' }), { params: params('EXP-P1') });
    const body = await res.json();

    // duplication now evaluates 15/15 (distinctStatementEstimate over the
    // full 15, none of them near-duplicates of each other in this fixture —
    // proving the population fed in is genuinely 15 members, not a count
    // reported without the rows themselves).
    expect(body.retrospective.distinctStatementEstimate).toBe(15);
  });

  it('verifiedAgainstFreeze remains fail-closed (false) even though the population is now 15 — this fix never touches that gate', async () => {
    mockBuildFrozenCrystalManifest.mockResolvedValue({
      frozenContentHash: 'frozen-hash-abc',
      verifiedAgainstFreeze: false,
      verificationDetail: '15 member(s) recovered; status drift on 4',
      recoveredInvariants: RECOVERED_15,
      members: null,
    });

    const res = await GET(makeGetRequest({ domain: 'financial-risk-value-systems' }), { params: params('EXP-P1') });
    const body = await res.json();

    expect(body.frozenArtifact.verifiedAgainstFreeze).toBe(false);
    expect(body.retrospective.verifiedAgainstFreeze).toBe(false);
    // THIS mocked call's own retrospective still fails to reproduce — its
    // manifest supplies no legacyContentVerification, so its substrate is
    // inadmissible regardless of the stored profile's own state.
    expect(body.retrospective.reproducedReviewerObjections).toBe(false);
    expect(body.retrospective.substrateAdmissibility.admissible).toBe(false);
    expect(body.retrospective.blockingGaps.join(' ')).toContain('retrospective substrate is inadmissible');
    // remediationProfile.bound reflects the STORED registry profile (bound
    // 2026-08-30 via a real, separately-observed canonical retrospective) —
    // independent of and unaffected by what THIS call's own mocked manifest
    // computes. Binding is a stored fact of the registry, never recomputed
    // live from each request's retrospective.
    expect(body.remediationProfile.bound).toBe(true);
  });

  it('falls back to a live query only when there is NO frozen artifact at all', async () => {
    mockGetArtifact.mockResolvedValue(null);
    mockListInvariants.mockResolvedValue(RECOVERED_15.slice(0, 3));

    const res = await GET(makeGetRequest({ domain: 'financial-risk-value-systems' }), { params: params('EXP-P1') });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockBuildFrozenCrystalManifest).not.toHaveBeenCalled();
    expect(mockListInvariants).toHaveBeenCalled();
    expect(body.retrospective.invariantCount).toBe(3);
    expect(body.frozenArtifact.present).toBe(false);
  });
});
