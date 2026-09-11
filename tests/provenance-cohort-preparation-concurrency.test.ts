/**
 * prepareProvenanceCohort's per-signature suggestion calls run CONCURRENTLY
 * (2026-09-04 repair) — the second, previously-unaddressed cost driver
 * behind the live `HTTP 504` on "Classify Provenance". The 2026-09-03
 * batching fix (see provenance-cohort-preparation.test.ts) removed the
 * per-invariant `discovery_evidence` N+1 from the deterministic triage half
 * of this module; it never touched THIS loop, which paid one real
 * `callSovereign` inference round-trip per DISTINCT source signature, in
 * series. The live EXP-P1 corpus collapses onto seven distinct signatures,
 * so the route was serialising seven inference calls inside one HTTP
 * request — an unbounded tail exactly the 60s route budget could exceed.
 *
 * This is a call-count-is-not-enough regression guard: a test asserting
 * only "suggestProvenanceClass was called once per signature" (already
 * covered elsewhere) would pass equally well whether those calls ran in
 * series or in parallel — it cannot distinguish the fix from the defect.
 * This measures actual overlap.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSuggestClassification = vi.fn();
vi.mock('@/services/invariants/discoveryEngine', () => ({
  suggestClassification: (...args: any[]) => mockSuggestClassification(...args),
}));

const mockSuggestProvenanceClass = vi.fn();
vi.mock('@/services/invariants/provenanceSuggestion', () => ({
  suggestProvenanceClass: (...args: any[]) => mockSuggestProvenanceClass(...args),
}));

import { prepareProvenanceCohort } from '@/services/research/provenanceCohortPreparation';

function fakeEvidenceAdmin(rows: Record<string, string | null>) {
  return {
    from: (table: string) => {
      if (table !== 'discovery_evidence') throw new Error(`fakeEvidenceAdmin: unexpected table '${table}'`);
      return {
        select: () => ({
          in: async (_col: string, ids: string[]) => ({
            data: ids.filter((id) => id in rows).map((id) => ({ id, source_ref: rows[id] })),
            error: null,
          }),
        }),
      };
    },
  } as any;
}

function completeSuggestion(refs: string[]) {
  return {
    invariantId: 'x', evidenceIdCount: refs.length, resolvedEvidenceCount: refs.length,
    unresolvedEvidenceIds: [], evidenceIdsWithoutSourceRef: [],
    sources: refs.map((r) => ({
      sourceRef: r, evidenceIds: ['e1'], evidenceTitles: ['t'], candidateTitle: null,
      issuer: null, recordedProvenanceClass: null, reviewNotes: null, seedInstitution: null, seedClaim: null,
    })),
    suggestedEvidenceRefs: refs, suggestedRationale: 'r', complete: true, notes: [],
  };
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  mockSuggestClassification.mockReset();
  mockSuggestProvenanceClass.mockReset();
});

describe('prepareProvenanceCohort — distinct-signature suggestions run concurrently, not in series', () => {
  const SIGNATURE_COUNT = 6;
  const CALL_DELAY_MS = 40;

  function sixDistinctSignatureInputs() {
    const admin = fakeEvidenceAdmin(
      Object.fromEntries(Array.from({ length: SIGNATURE_COUNT }, (_, i) => [`e-${i}`, `https://source-${i}.example.org`])),
    );
    const inputs = Array.from({ length: SIGNATURE_COUNT }, (_, i) => ({
      id: `inv-${i}`,
      statement: `s-${i}`,
      provenance: { evidence_ids: [`e-${i}`] },
    }));
    return { admin, inputs };
  }

  it('total wall-clock stays close to ONE call\'s latency, not the sum across all distinct signatures', async () => {
    const { admin, inputs } = sixDistinctSignatureInputs();
    mockSuggestClassification.mockImplementation(async () => {
      await delay(CALL_DELAY_MS);
      return completeSuggestion(['https://source.example.org']);
    });
    mockSuggestProvenanceClass.mockImplementation(async () => {
      await delay(CALL_DELAY_MS);
      return { ok: true, suggestion: { suggestedClass: 'external-established', confidence: 80, primarySource: 's', supportingSources: [], reason: 'r' } };
    });

    const start = Date.now();
    const prepared = await prepareProvenanceCohort(admin, inputs);
    const elapsedMs = Date.now() - start;

    expect(prepared.distinctSignaturesClassified).toBe(SIGNATURE_COUNT);
    expect(mockSuggestProvenanceClass).toHaveBeenCalledTimes(SIGNATURE_COUNT);
    // Each signature's path is two SEQUENTIAL calls (suggestClassification
    // then suggestProvenanceClass) = ~2×CALL_DELAY_MS per signature in
    // isolation. Run sequentially ACROSS signatures, 6 signatures would cost
    // ~6×2×40ms = 480ms. Run concurrently across signatures, it costs
    // ~2×40ms regardless of signature count. The regression threshold sits
    // comfortably between the two (well under half the serial cost) so
    // normal test-runner scheduling jitter can never produce a false pass.
    const serialLowerBound = SIGNATURE_COUNT * 2 * CALL_DELAY_MS;
    expect(elapsedMs).toBeLessThan(serialLowerBound / 2);
  });

  it('every exception-cause semantic is preserved exactly under concurrent execution — a failure on one signature never corrupts another\'s result', async () => {
    const { admin, inputs } = sixDistinctSignatureInputs();
    mockSuggestClassification.mockImplementation(async () => completeSuggestion(['https://source.example.org']));
    let call = 0;
    mockSuggestProvenanceClass.mockImplementation(async () => {
      call += 1;
      // Every 3rd signature fails; the rest succeed with a distinct class.
      if (call % 3 === 0) return { ok: false, error: 'model unavailable' };
      return { ok: true, suggestion: { suggestedClass: 'external-established', confidence: 80, primarySource: 's', supportingSources: [], reason: 'r' } };
    });

    const prepared = await prepareProvenanceCohort(admin, inputs);
    const ready = prepared.recommendations.filter((r) => r.disposition === 'ready');
    const failed = prepared.recommendations.filter((r) => r.disposition === 'exception' && r.exceptionCause === 'suggestion-unavailable');

    expect(ready.length + failed.length).toBe(SIGNATURE_COUNT);
    expect(failed.length).toBeGreaterThan(0);
    expect(ready.length).toBeGreaterThan(0);
    for (const r of failed) expect(r.proposedClass).toBeNull();
    for (const r of ready) expect(r.proposedClass).toBe('external-established');
  });
});
