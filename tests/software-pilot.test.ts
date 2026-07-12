/**
 * `software` pilot canary (CFS-025 Phase 2, increment 4; D1-safe under CFS-016).
 *
 * Pins the PURE helpers of services/artifact/pilots/softwarePilot.ts —
 * pack→body rendering, pack→composition-input mapping (determinism + the
 * invariant composed-from trail), the T1 pack projection — and the pilot flow
 * itself with the DB/LLM-bearing organs stubbed:
 *   - generateImplementationPack → a fixed pack (no provider spend)
 *   - saveArtifactRecord's Supabase client → null (soft-fail path)
 *   - createActivityReceipt → observed to be NEVER called (operational tier +
 *     D1: no receipt, no execution, no deploy)
 *
 * Mirrors the stub style of tests/artifact-runtime-service.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock factories are hoisted — the fixture must be hoisted with them.
const FIXED_PACK = vi.hoisted(() => ({
  id: 'pack-fixed-0001',
  intentId: null as string | null,
  goal: 'ship the widget capability',
  invariantBindings: [
    { id: 'db-inv-1', seedId: 'inv.constitutional.011', statement: 'Receipts are unified.' },
    { id: 'db-inv-2', seedId: null, statement: 'Execution stays human at D1.' },
  ],
  resolvedTerms: [],
  areasToTouch: ['services/widget/'],
  implementationMechanism: 'code' as const,
  validationPlan: ['esbuild parse gates', 'canary test'],
  receiptPlan: ['implementation_pack_generated on generation'],
  canonVersion: 'canon-v1',
  generatedAt: '2026-07-12T00:00:00.000Z',
  composedBy: 'template' as const,
  preflight: null,
}));

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: vi.fn(() => null),
}));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: vi.fn(async () => ({ id: 'rcpt_stub_never' })),
}));
// The pack generator is the pilot's content organ — stub it so the canary
// spends no provider credits and stays deterministic.
vi.mock('@/services/constitutional/implementationPack', () => ({
  generateImplementationPack: vi.fn(async (input: { goal: string; intentId?: string }) => ({
    ...FIXED_PACK,
    goal: input.goal,
    intentId: input.intentId ?? null,
  })),
}));

import {
  renderPackMarkdown,
  packToCompositionInput,
  projectPackSummary,
  produceSoftwareArtifact,
  DEPLOYMENT_PROPOSAL_POINTER,
  D1_NOTE,
} from '@/services/artifact/pilots/softwarePilot';
import type { ImplementationPack } from '@/services/constitutional/implementationPack';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { findForbiddenObjectKey } from '@/types/constitutionalObject';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('renderPackMarkdown — the pack IS the artifact body (pure)', () => {
  it('renders goal, mechanism, invariants, plans, and the fenced pack JSON', () => {
    const body = renderPackMarkdown(FIXED_PACK);
    expect(body).toContain('# Implementation Pack — ship the widget capability');
    expect(body).toContain('mechanism **code**');
    expect(body).toContain('inv.constitutional.011: Receipts are unified.');
    expect(body).toContain('db-inv-2: Execution stays human at D1.'); // seedId null → DB id
    expect(body).toContain('- services/widget/');
    expect(body).toContain('- esbuild parse gates');
    expect(body).toContain('```json');
    expect(body).toContain('"id": "pack-fixed-0001"');
  });

  it('is deterministic and honest about empty plan fields', () => {
    const empty: ImplementationPack = {
      ...FIXED_PACK,
      invariantBindings: [],
      areasToTouch: [],
      validationPlan: [],
      receiptPlan: [],
    };
    const a = renderPackMarkdown(empty);
    expect(a).toBe(renderPackMarkdown(empty)); // no clock, no randomness
    expect(a).toContain('_none bound_');
    expect(a).toContain('_unknown — never invented_');
    expect(a).toContain('_none drafted_');
  });
});

describe('packToCompositionInput — deterministic commitment + invariant trail (pure)', () => {
  it('derives the content commitment from the body (idempotent re-runs)', () => {
    const body = renderPackMarkdown(FIXED_PACK);
    const a = packToCompositionInput(FIXED_PACK, body);
    const b = packToCompositionInput(FIXED_PACK, body);
    expect(a).toEqual(b);
    const hash = a.result?.provenance?.contentHash as string;
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
    expect(a.compositionRef).toBe(`software:pack:${hash}`);
  });

  it('a different body yields a different commitment', () => {
    const a = packToCompositionInput(FIXED_PACK, 'body-one');
    const b = packToCompositionInput(FIXED_PACK, 'body-two');
    expect(a.result?.provenance?.contentHash).not.toBe(b.result?.provenance?.contentHash);
  });

  it('carries the governing invariants as the composed-from trail (object refs, seedId preferred)', () => {
    const input = packToCompositionInput(FIXED_PACK, 'x');
    expect(input.result?.provenance?.composedFrom).toEqual([
      { id: 'inv.constitutional.011', kind: 'invariant' },
      { id: 'db-inv-2', kind: 'invariant' },
    ]);
  });
});

describe('projectPackSummary — T1-safe projection (pure)', () => {
  it('projects the plan fields and never a forbidden key', () => {
    const p = projectPackSummary(FIXED_PACK);
    expect(p.packId).toBe('pack-fixed-0001');
    expect(p.implementationMechanism).toBe('code');
    expect(p.invariantSeedIds).toEqual(['inv.constitutional.011', 'db-inv-2']);
    expect(p.preflightDisposition).toBeNull();
    expect(findForbiddenObjectKey(p)).toBeNull();
  });
});

describe('produceSoftwareArtifact — operational production, D1-safe', () => {
  const args = {
    actorCommitment: 'commit16chars000',
    intentRef: 'intent:aigentz-software:abc123',
    goal: 'ship the widget capability',
  };

  it('produces a versioned OPERATIONAL artifact: no object, no receipt, no registry', async () => {
    const r = await produceSoftwareArtifact(args);
    expect(r.artifact.ok).toBe(true);
    expect(r.artifact.consequenceClass).toBe('operational');
    expect(r.artifact.artifactId).toMatch(/^artifact:/);
    expect(r.artifact.version).toBe('v1');
    expect(r.artifact.object).toBeNull();
    expect(r.artifact.receiptId).toBeNull();
    expect(r.artifact.registryEntry).toBeNull();
    // Soft-fail store (no Supabase in the canary) → recordId null, flow intact.
    expect(r.recordId).toBeNull();
    expect(r.d1).toBe(D1_NOTE);
  });

  it('writes NO receipt (operational tier — the record is the durable output)', async () => {
    await produceSoftwareArtifact(args);
    expect(createActivityReceipt).not.toHaveBeenCalled();
  });

  it('proposeDeployment returns the documented pointer, never an inline proposal', async () => {
    const without = await produceSoftwareArtifact(args);
    expect(without.deploymentProposal).toBeNull();
    const withProposal = await produceSoftwareArtifact({ ...args, proposeDeployment: true });
    expect(withProposal.deploymentProposal).toBe(DEPLOYMENT_PROPOSAL_POINTER);
    expect(withProposal.deploymentProposal).toBe('use /api/constitutional/deployment-proposal');
    // Still no receipt, no execution — D1 holds on the proposal path too.
    expect(createActivityReceipt).not.toHaveBeenCalled();
  });

  it('the whole result is T0-inexpressible (findForbiddenObjectKey guard)', async () => {
    const r = await produceSoftwareArtifact(args);
    expect(findForbiddenObjectKey(r)).toBeNull();
  });

  it('same goal ⇒ same artifactId (content-commitment idempotency)', async () => {
    const a = await produceSoftwareArtifact(args);
    const b = await produceSoftwareArtifact(args);
    expect(a.artifact.artifactId).toBe(b.artifact.artifactId);
  });
});
