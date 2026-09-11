/**
 * Legacy Freeze Verification (services/research/crystalLegacyContentVerification.ts)
 * — 2026-08-30, EXP-P1 legacy-provenance audit implementation.
 *
 * Pins the operator's exact acceptance list:
 *   1. pristine frozen artifact → byte-exact
 *   2. EXP-P1 legacy pattern (complete membership, only post-freeze `status`
 *      drift, no seed rewrite, no post-freeze provenance reclassification)
 *      → scientific-content-verified while verifiedAgainstFreeze === false
 *   3. post-freeze statement mutation → unverified
 *   4. post-freeze namespace/semantic/provenance mutation → unverified
 *   5. incomplete membership → unverified
 *   6. unknown/unparseable mutation evidence → unverified
 *   7. verifiedAgainstFreeze semantics remain unchanged
 */
import { describe, it, expect } from 'vitest';
import {
  deriveLegacyFreezeVerification,
  type LegacyFreezeVerificationEvidence,
} from '@/services/research/crystalLegacyContentVerification';
import { SCIENTIFICALLY_MATERIAL_FIELD_NAMES } from '@/services/research/crystalContentProjection';
import type { InvariantRecord } from '@/types/invariants';

const FROZEN_AT = '2026-08-05T21:39:57.033Z';
const BEFORE_FREEZE = '2026-07-28T08:59:53.552Z';
const AFTER_FREEZE = '2026-08-06T00:00:00.000Z';

function invariant(overrides: Partial<InvariantRecord> = {}): InvariantRecord {
  return {
    id: 'inv-001',
    seedId: null,
    statement: 'A distinct statement.',
    namespace: 'finance' as InvariantRecord['namespace'],
    ontologyClassId: null,
    semanticType: 'constraint',
    status: 'validated',
    confidence: 0.9,
    confidenceBasis: 'principal_verified',
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
    ...overrides,
  };
}

describe('deriveLegacyFreezeVerification — the three-rung ladder', () => {
  it('1. pristine frozen artifact (verifiedAgainstFreeze true) → byte-exact', () => {
    const evidence = deriveLegacyFreezeVerification({
      verifiedAgainstFreeze: true,
      frozenAt: FROZEN_AT,
      invariants: [invariant()],
      membershipReadFailed: false,
    });
    expect(evidence.state).toBe('byte-exact');
    expect(evidence.byteExact).toBe(true);
    expect(evidence.immaterialDriftFields).toEqual([]);
    expect(evidence.blockingGaps).toEqual([]);
  });

  it('2. EXP-P1 legacy pattern — complete membership, only post-freeze status drift, no seed rewrite, no post-freeze reclassification → scientific-content-verified, verifiedAgainstFreeze stays false', () => {
    const survivors = Array.from({ length: 11 }, (_, i) =>
      invariant({
        id: `survivor-${i}`,
        status: 'validated',
        provenance: {
          evidenceProvenance: 'external-established',
          provenanceReclassifications: [
            { from: null, to: 'external-established', evidenceRefs: ['ref-1'], rationale: 'r', at: BEFORE_FREEZE, actor: 'op' },
          ],
        },
      }),
    );
    const superseded = Array.from({ length: 4 }, (_, i) =>
      invariant({
        id: `superseded-${i}`,
        status: 'superseded',
        provenance: { evidenceProvenance: 'external-established' },
      }),
    );
    const evidence = deriveLegacyFreezeVerification({
      verifiedAgainstFreeze: false,
      frozenAt: FROZEN_AT,
      invariants: [...survivors, ...superseded],
      membershipReadFailed: false,
    });
    expect(evidence.state).toBe('scientific-content-verified');
    expect(evidence.byteExact).toBe(false);
    expect(evidence.memberCount).toBe(15);
    expect(evidence.immaterialDriftFields).toEqual(['status']);
    expect(evidence.blockingGaps).toEqual([]);
    expect(evidence.materialFieldsChecked).toEqual([...SCIENTIFICALLY_MATERIAL_FIELD_NAMES]);
    expect(evidence.materialFieldsChecked).not.toContain('status');
    expect(evidence.reason).toContain('scientifically material');
    expect(evidence.unresolvedRisk.length).toBeGreaterThan(0);
  });

  it('3. post-freeze statement mutation risk (seed-ingest stamp present) → unverified', () => {
    // No other path in this codebase touches `statement` at all — the seed-
    // ingest script's `seeded_from` stamp is the ONLY observable evidence of
    // a statement mutation, so that is what must be asserted here.
    const members = [
      invariant({ id: 'mutated', status: 'validated', provenance: { evidenceProvenance: 'external-established', seeded_from: 'appendix-a', seed_version: 3 } }),
      ...Array.from({ length: 10 }, (_, i) => invariant({ id: `clean-${i}` })),
    ];
    const evidence = deriveLegacyFreezeVerification({
      verifiedAgainstFreeze: false,
      frozenAt: FROZEN_AT,
      invariants: members,
      membershipReadFailed: false,
    });
    expect(evidence.state).toBe('unverified');
    expect(evidence.blockingGaps.join(' ')).toContain('mutated');
    expect(evidence.blockingGaps.join(' ')).toContain('seeded_from');
  });

  it('3b. a seed_id matching a REAL canonical-invariants.seed.json entry → unverified (exercises the real cross-reference, not a mock)', () => {
    const members = [
      invariant({ id: 'seed-linked', seedId: 'inv.finance.001' }),
      ...Array.from({ length: 10 }, (_, i) => invariant({ id: `clean-${i}` })),
    ];
    const evidence = deriveLegacyFreezeVerification({
      verifiedAgainstFreeze: false,
      frozenAt: FROZEN_AT,
      invariants: members,
      membershipReadFailed: false,
    });
    expect(evidence.state).toBe('unverified');
    expect(evidence.blockingGaps.join(' ')).toContain('seed-linked');
    expect(evidence.blockingGaps.join(' ')).toContain('inv.finance.001');
  });

  it('4. post-freeze provenance reclassification → unverified (namespace/semantic/provenance mutation family)', () => {
    const members = [
      invariant({
        id: 'reclassified-after-freeze',
        provenance: {
          evidenceProvenance: 'external-established',
          provenanceReclassifications: [
            { from: 'platform-derived', to: 'external-established', evidenceRefs: ['x'], rationale: 'r', at: AFTER_FREEZE, actor: 'op' },
          ],
        },
      }),
      ...Array.from({ length: 10 }, (_, i) => invariant({ id: `clean-${i}` })),
    ];
    const evidence = deriveLegacyFreezeVerification({
      verifiedAgainstFreeze: false,
      frozenAt: FROZEN_AT,
      invariants: members,
      membershipReadFailed: false,
    });
    expect(evidence.state).toBe('unverified');
    expect(evidence.blockingGaps.join(' ')).toContain('reclassified-after-freeze');
    expect(evidence.blockingGaps.join(' ')).toContain('after freeze');
  });

  it('5. incomplete membership (read failed) → unverified', () => {
    const evidence = deriveLegacyFreezeVerification({
      verifiedAgainstFreeze: false,
      frozenAt: FROZEN_AT,
      invariants: [],
      membershipReadFailed: true,
    });
    expect(evidence.state).toBe('unverified');
    expect(evidence.blockingGaps.join(' ')).toContain('complete historical population could not be recovered');
  });

  it('5b. incomplete membership (zero members recovered, read did not fail) → unverified', () => {
    const evidence = deriveLegacyFreezeVerification({
      verifiedAgainstFreeze: false,
      frozenAt: FROZEN_AT,
      invariants: [],
      membershipReadFailed: false,
    });
    expect(evidence.state).toBe('unverified');
    expect(evidence.blockingGaps.join(' ')).toContain('zero members');
  });

  it('6. unknown/unparseable mutation evidence (non-parseable reclassification timestamp) → unverified, never assumed safe', () => {
    const members = [
      invariant({
        id: 'unparseable',
        provenance: {
          evidenceProvenance: 'external-established',
          provenanceReclassifications: [{ from: null, to: 'external-established', evidenceRefs: ['x'], rationale: 'r', at: 'not-a-date', actor: 'op' }],
        },
      }),
      ...Array.from({ length: 10 }, (_, i) => invariant({ id: `clean-${i}` })),
    ];
    const evidence = deriveLegacyFreezeVerification({
      verifiedAgainstFreeze: false,
      frozenAt: FROZEN_AT,
      invariants: members,
      membershipReadFailed: false,
    });
    expect(evidence.state).toBe('unverified');
    expect(evidence.blockingGaps.join(' ')).toContain('unparseable');
    expect(evidence.blockingGaps.join(' ')).toContain('unevaluable, not assumed safe');
  });

  it('6b. an unparseable frozenAt itself → unverified', () => {
    const evidence = deriveLegacyFreezeVerification({
      verifiedAgainstFreeze: false,
      frozenAt: 'not-a-timestamp',
      invariants: [invariant()],
      membershipReadFailed: false,
    });
    expect(evidence.state).toBe('unverified');
    expect(evidence.blockingGaps.join(' ')).toContain('not a parseable timestamp');
  });

  it('an unexplained hash mismatch (no status drift, no material-field mutation found) → unverified, never assumed status-only', () => {
    const members = Array.from({ length: 11 }, (_, i) => invariant({ id: `all-validated-${i}`, status: 'validated' }));
    const evidence = deriveLegacyFreezeVerification({
      verifiedAgainstFreeze: false,
      frozenAt: FROZEN_AT,
      invariants: members,
      membershipReadFailed: false,
    });
    expect(evidence.state).toBe('unverified');
    expect(evidence.blockingGaps.join(' ')).toContain('unexplained');
  });

  it('7. byteExact always mirrors the caller-supplied verifiedAgainstFreeze — this module never recomputes or redefines it', () => {
    const trueCase = deriveLegacyFreezeVerification({
      verifiedAgainstFreeze: true,
      frozenAt: FROZEN_AT,
      invariants: [invariant({ status: 'superseded' })], // even with drift present, true wins outright
      membershipReadFailed: false,
    });
    expect(trueCase.byteExact).toBe(true);
    expect(trueCase.state).toBe('byte-exact');

    const falseCase = deriveLegacyFreezeVerification({
      verifiedAgainstFreeze: false,
      frozenAt: FROZEN_AT,
      invariants: [invariant()],
      membershipReadFailed: false,
    });
    expect(falseCase.byteExact).toBe(false);
    expect(falseCase.state).not.toBe('byte-exact');
  });

  it('materialFieldsChecked is derived from SCIENTIFICALLY_MATERIAL_FIELD_NAMES, never a second hand-typed list, and excludes status', () => {
    const evidence = deriveLegacyFreezeVerification({
      verifiedAgainstFreeze: true,
      frozenAt: FROZEN_AT,
      invariants: [invariant()],
      membershipReadFailed: false,
    });
    expect(evidence.materialFieldsChecked).toBe(SCIENTIFICALLY_MATERIAL_FIELD_NAMES as unknown as string[]);
  });
});
