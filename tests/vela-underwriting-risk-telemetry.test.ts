/**
 * services/vela/velaUnderwritingRiskTelemetry.ts — Use Case Zero build-order
 * item 6 (2026-09-13), the direct sequel to
 * `tests/vela-underwriting-projection.test.ts` (item 5).
 *
 * Proves: (a) the function's own parameter type is structurally incapable of
 * receiving raw party financial inputs (mirrors
 * `tests/underwriting-provider-simulated.test.ts`'s own gate-1
 * `@ts-expect-error` proof); (b) every `golden_cycle_records` JSONB column
 * this item maps is exactly as specified, with the columns this item has no
 * honest data for left as literal empty objects, never fabricated; (c) the
 * write is idempotent by construction (same `record_key` on a retried
 * emission for the same `onChainRequestId`); (d) the function never throws —
 * DB-unavailable and write-error both fail closed to `null`.
 *
 * Reuses `tests/_lib/fakeSupabase.ts` (Extend, Don't Duplicate) rather than
 * hand-rolling a second in-memory Postgrest fake — that helper already models
 * `.upsert(payload, { onConflict })` + `.select().single()` exactly as this
 * module calls them.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createFakeSupabase, type FakeTables } from './_lib/fakeSupabase';

let currentAdmin: { from: (table: string) => unknown } | null = null;
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => currentAdmin,
}));

import {
  recordVelaUnderwritingRiskTelemetry,
  type VelaUnderwritingRiskTelemetryInput,
} from '@/services/vela/velaUnderwritingRiskTelemetry';
import type { UnderwritingQuote } from '@/services/financialServices/providers/underwriting/underwritingProviderTypes';

const ACCEPTABLE_QUOTE: UnderwritingQuote = {
  riskBand: 'LOW',
  estimatedExposure: 500,
  riskOfRepair: 'LOW',
  coverageEligible: true,
  coverageLimit: 5_000,
  premium: 50,
  conditions: [],
  confidence: 0.75,
  providerMode: 'SIMULATED',
};

function baseInput(overrides: Partial<VelaUnderwritingRiskTelemetryInput> = {}): VelaUnderwritingRiskTelemetryInput {
  return {
    requestRef: 'req-1',
    onChainRequestId: 'onchain-req-1',
    applicationId: '42',
    partyNamespaceRefs: ['ref-a', 'ref-b'],
    requestingPartyNamespaceRef: 'ref-a',
    scopeBinding: {
      applicationId: '42',
      requestRef: 'req-1',
      operationType: 'JOINT_CONSEQUENCE_PROJECTION',
      outputClass: 'JOINT_VERDICT',
    },
    scopeGrants: [{ action: 'COMPUTE_WITH', party: 'ref-a' }],
    disposition: 'ACCEPTABLE',
    quote: ACCEPTABLE_QUOTE,
    receiptId: 'receipt-1',
    policyVersion: 'vela-use-case-zero-underwriting-simulated-v1',
    settlementOccurred: false,
    timeToCompletionMs: 42,
    ...overrides,
  };
}

let tables: FakeTables;

beforeEach(() => {
  const fake = createFakeSupabase();
  currentAdmin = fake.admin;
  tables = fake.tables;
});

// ── Gate — structural type boundary ─────────────────────────────────────

describe('gate — structurally incapable of receiving raw party financial inputs', () => {
  it('the TypeScript signature rejects an object shaped like raw projection inputs', () => {
    // @ts-expect-error — VelaUnderwritingRiskTelemetryInput has no field
    // shaped like a party's raw financial inputs; this object (mirroring
    // VelaProjectionInputs) must fail to typecheck. The directive itself is
    // the gate proof (a full `tsc --noEmit` pass shows zero errors in this
    // file, meaning the expected error fired).
    const badInput: VelaUnderwritingRiskTelemetryInput = {
      currentExposure: 0,
      proposedSpend: 800,
      privateSpendLimit: 1000,
      privateRiskLimit: 1000,
    };
    expect(badInput).toBeDefined();
  });
});

// ── Field mapping ─────────────────────────────────────────────────────────

describe('golden_cycle_records field mapping', () => {
  it('maps every column exactly as specified, with never-fabricated columns as literal empty objects', async () => {
    const result = await recordVelaUnderwritingRiskTelemetry(baseInput());
    expect(result).not.toBeNull();

    const row = tables.golden_cycle_records[0];
    expect(row.record_key).toBe('vela-underwriting:onchain-req-1');
    expect(row.source_surface).toBe('vela-use-case-zero-underwriting');
    expect(row.protocol_ref).toBe(
      'docs/vela/accelerator/constitutional-financial-services/05_ACCELERATOR_USE_CASE_ZERO_SPEC_v0.1.md#12',
    );
    expect(row.evidence_status).toBe('operational_hypothesis_generating');
    expect(row.principal_ref).toBeNull();
    expect(row.action_ref).toBe('onchain-req-1');

    expect(row.value_cycle).toEqual({
      requestRef: 'req-1',
      applicationId: '42',
      partyNamespaceRefs: ['ref-a', 'ref-b'],
      requestingPartyNamespaceRef: 'ref-a',
    });
    expect(row.time_to_value).toEqual({ timeToCompletionMs: 42 });
    expect(row.risk_prediction).toEqual({
      disposition: 'ACCEPTABLE',
      riskBand: 'LOW',
      estimatedExposure: 500,
      riskOfRepair: 'LOW',
      confidence: 0.75,
    });
    expect(row.premium_terms).toEqual({ premium: 50, coverageLimit: 5_000, conditions: [] });
    expect(row.coverage_decision).toEqual({ coverageEligible: true, providerMode: 'SIMULATED' });
    expect(row.action_authorization).toEqual({
      scopeBinding: baseInput().scopeBinding,
      scopeGrants: baseInput().scopeGrants,
    });
    expect(row.execution_evidence).toEqual({ settlementOccurred: false });
    expect(row.provenance).toEqual({
      receiptId: 'receipt-1',
      policyVersion: 'vela-use-case-zero-underwriting-simulated-v1',
    });

    // Never-fabricated columns — this item has no honest data for these yet.
    expect(row.risk_cycle).toEqual({});
    expect(row.information_provenance).toEqual({});
    expect(row.observed_outcome).toEqual({});
    expect(row.repair_or_claim).toEqual({});
    expect(row.burden_bearer).toEqual({});
    expect(row.calibration_error).toEqual({});
    expect(row.constitutional_conditions).toEqual({});
  });

  it('settlementOccurred reflects the caller-supplied flag verbatim (true case)', async () => {
    await recordVelaUnderwritingRiskTelemetry(baseInput({ settlementOccurred: true }));
    expect(tables.golden_cycle_records[0].execution_evidence).toEqual({ settlementOccurred: true });
  });

  it('requestingPartyNamespaceRef defaults to null when omitted', async () => {
    const input = baseInput();
    delete (input as any).requestingPartyNamespaceRef;
    await recordVelaUnderwritingRiskTelemetry(input);
    expect((tables.golden_cycle_records[0].value_cycle as any).requestingPartyNamespaceRef).toBeNull();
  });
});

// ── Idempotency ────────────────────────────────────────────────────────────

describe('idempotency — retried emission for the same onChainRequestId', () => {
  it('produces the SAME record_key on both calls and results in exactly one row', async () => {
    const first = await recordVelaUnderwritingRiskTelemetry(baseInput());
    const second = await recordVelaUnderwritingRiskTelemetry(baseInput({ timeToCompletionMs: 999 }));

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first!.id).toBe(second!.id);
    expect(tables.golden_cycle_records).toHaveLength(1);
    expect(tables.golden_cycle_records[0].record_key).toBe('vela-underwriting:onchain-req-1');
    // The second call's own data won — proving it was a real update, not a
    // silently-dropped duplicate insert.
    expect(tables.golden_cycle_records[0].time_to_value).toEqual({ timeToCompletionMs: 999 });
  });

  it('a DIFFERENT onChainRequestId produces a different record_key and a second row', async () => {
    await recordVelaUnderwritingRiskTelemetry(baseInput({ onChainRequestId: 'onchain-req-1' }));
    await recordVelaUnderwritingRiskTelemetry(baseInput({ onChainRequestId: 'onchain-req-2' }));
    expect(tables.golden_cycle_records).toHaveLength(2);
  });
});

// ── Fail-closed discipline ───────────────────────────────────────────────

describe('fail-closed — never throws', () => {
  it('resolves null when getSupabaseServer() returns null (DB unconfigured)', async () => {
    currentAdmin = null;
    const result = await recordVelaUnderwritingRiskTelemetry(baseInput());
    expect(result).toBeNull();
  });

  it('resolves null when the upsert itself errors, rather than throwing', async () => {
    currentAdmin = {
      from: () => ({
        upsert: () => ({
          select: () => ({
            single: async () => ({ data: null, error: { message: 'simulated write failure' } }),
          }),
        }),
      }),
    };
    const result = await recordVelaUnderwritingRiskTelemetry(baseInput());
    expect(result).toBeNull();
  });

  it('resolves null when the Supabase call rejects (throws) outright', async () => {
    currentAdmin = {
      from: () => ({
        upsert: () => ({
          select: () => ({
            single: async () => {
              throw new Error('simulated network failure');
            },
          }),
        }),
      }),
    };
    await expect(recordVelaUnderwritingRiskTelemetry(baseInput())).resolves.toBeNull();
  });
});
