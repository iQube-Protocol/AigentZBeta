/**
 * services/marketa/admissionAssessmentStore.ts — GJR-MKT-001 Phase 4.
 * Supersede-never-delete persistence, exercised against a Map-based fake
 * Supabase admin (mirrors tests/independent-review-publish.test.ts's fake
 * admin convention) — no real network.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMarketaAdmissionAssessment,
  getCurrentMarketaAdmissionAssessment,
  getMarketaAdmissionAssessment,
} from '@/services/marketa/admissionAssessmentStore';
import type { MarketaAdmissionAssessment } from '@/services/marketa/admissionAssessmentEngine';

const rows = new Map<string, any>();

function makeFakeAdmin() {
  return {
    from: (table: string) => {
      if (table !== 'marketa_agent_admission_assessments') throw new Error(`unexpected table: ${table}`);
      return {
        insert: (row: any) => ({
          select: () => ({
            single: async () => {
              rows.set(row.assessment_id, { ...row });
              return { data: { ...row }, error: null };
            },
          }),
        }),
        update: (patch: any) => ({
          eq: (_col: string, value: string) => {
            const existing = rows.get(value);
            if (existing) rows.set(value, { ...existing, ...patch });
            return Promise.resolve({ error: null });
          },
        }),
        select: () => ({
          eq: (_col: string, value: string) => ({
            is: (_col2: string, _val: null) => ({
              maybeSingle: async () => {
                const match = [...rows.values()].find((r) => r.subject_aigent_iqube_id === value && r.superseded_by == null);
                return { data: match ?? null, error: null };
              },
            }),
            maybeSingle: async () => ({ data: rows.get(value) ?? null, error: null }),
          }),
        }),
      };
    },
  } as any;
}

const BASE_ASSESSMENT: MarketaAdmissionAssessment = {
  version: '1.0',
  mode: 'FINAL',
  decision: 'RECOMMENDED',
  satisfiedRules: ['MKT-ADM-001'],
  missingRules: [],
  failedRules: [],
  contradictionRefs: [],
  evidenceRefs: [],
  rationale: 'all satisfied',
  policyVersion: 'mkt-adm-policy-1.0.0',
};

beforeEach(() => {
  rows.clear();
});

describe('createMarketaAdmissionAssessment', () => {
  it('inserts a new current assessment with no supersede chain on first assessment', async () => {
    const admin = makeFakeAdmin();
    const record = await createMarketaAdmissionAssessment(
      { assessmentId: 'a1', subjectAigentQubeId: 'aigentqube-moneypenny', assessment: { ...BASE_ASSESSMENT, evidenceSnapshotHash: 'hash1' } as any, actorPersonaId: 'persona-1', receiptRef: 'r1' },
      admin,
    );
    expect(record.assessmentId).toBe('a1');
    expect(record.supersedesAssessmentId).toBeNull();
    expect(record.supersededBy).toBeNull();
  });

  it('marks the prior current assessment as superseded, without touching its own decision fields', async () => {
    const admin = makeFakeAdmin();
    await createMarketaAdmissionAssessment(
      { assessmentId: 'a1', subjectAigentQubeId: 'aigentqube-moneypenny', assessment: { ...BASE_ASSESSMENT, decision: 'NOT_RECOMMENDED', evidenceSnapshotHash: 'hash1' } as any, actorPersonaId: 'persona-1', receiptRef: 'r1' },
      admin,
    );
    await createMarketaAdmissionAssessment(
      { assessmentId: 'a2', subjectAigentQubeId: 'aigentqube-moneypenny', assessment: { ...BASE_ASSESSMENT, evidenceSnapshotHash: 'hash2' } as any, actorPersonaId: 'persona-1', receiptRef: 'r2', supersedesAssessmentId: 'a1' },
      admin,
    );

    const prior = await getMarketaAdmissionAssessment('a1', admin);
    expect(prior?.supersededBy).toBe('a2');
    expect(prior?.decision).toBe('NOT_RECOMMENDED'); // untouched

    const current = await getCurrentMarketaAdmissionAssessment('aigentqube-moneypenny', admin);
    expect(current?.assessmentId).toBe('a2');
  });

  it('getCurrentMarketaAdmissionAssessment returns null when no assessment exists yet', async () => {
    const admin = makeFakeAdmin();
    const current = await getCurrentMarketaAdmissionAssessment('never-assessed', admin);
    expect(current).toBeNull();
  });
});
