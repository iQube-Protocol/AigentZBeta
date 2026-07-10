/**
 * Artifact Runtime (AR) — runtime skeleton canary (CFS-025 Phase 1).
 *
 * Pins the PURE, DB-free behaviour of the two runtime organs:
 *   - classify.ts  — the ordered consequence-tier heuristic (4 outcomes)
 *   - runArtifact.ts — the tier ROUTING decision table:
 *       disposable   → all canonical fields null (fast path)
 *       operational  → versioned (artifactId + version tag), but no object/receipt/registry
 *       constitutional → composes a ConstitutionalObject; propose-mode writes no
 *                        receipt; publish-mode (gated) composes createActivityReceipt
 *   - the T0-inexpressibility guard on the produced object (only commitments).
 *
 * The unified receipt writer (createActivityReceipt) and the Supabase client are
 * stubbed — this canary never touches a DB. It mirrors the stub style of
 * tests/spine-admin-cartridges.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub the DB-bearing organs. createActivityReceipt is the ONLY I/O the
// constitutional publish path composes; it returns a fake receipt so the
// publish-mode row-write is observable without a database.
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: vi.fn(() => null),
}));
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: vi.fn(async () => ({ id: 'rcpt_stub_1' })),
}));

import { classifyArtifact } from '@/services/artifact/classify';
import { runArtifact, evidenceOf } from '@/services/artifact/runArtifact';
import type { ArtifactContext, ArtifactCompositionInput } from '@/types/artifactRuntime';
import { findForbiddenObjectKey } from '@/types/constitutionalObject';
import type { CompositionResult } from '@/types/composition';

const ctx = (mode?: 'propose' | 'publish'): ArtifactContext => ({
  invokedBy: 'ccrl',
  intentRef: 'intent-abc',
  actorCommitment: 'ownercommit16chars',
  ...(mode ? { mode } : {}),
});

const scratch: ArtifactCompositionInput = { compositionRef: null, result: null };
const composed: ArtifactCompositionInput = { compositionRef: 'comp-ref-1', result: null };

/** A minimal CompositionResult carrying a content hash + composedFrom trail. */
const resultWithProvenance: ArtifactCompositionInput = {
  compositionRef: 'comp-ref-2',
  result: {
    provenance: {
      contentHash: 'deadbeefcafebabe',
      composedFrom: [{ id: 'inv.experience.072', kind: 'invariant' }],
    },
  } as unknown as CompositionResult,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AR classify — the ordered consequence heuristic (4 outcomes)', () => {
  it('rule 2: no persistence intent → disposable', async () => {
    expect(await classifyArtifact('standard', scratch, ctx())).toBe('disposable');
  });

  it('rule 4: real content, no canonical mandate → operational', async () => {
    expect(await classifyArtifact('software', composed, ctx())).toBe('operational');
  });

  it('rule 1: explicit publish intent → constitutional (even for a research draft)', async () => {
    expect(await classifyArtifact('research', composed, ctx('publish'))).toBe('constitutional');
  });

  it('rule 3: inherently-canonical profile (policy) with content → constitutional', async () => {
    expect(await classifyArtifact('policy', composed, ctx())).toBe('constitutional');
  });

  it('rule ordering: publish intent beats the scratch check', async () => {
    // scratch input, but explicit publish intent → constitutional, not disposable
    expect(await classifyArtifact('standard', scratch, ctx('publish'))).toBe('constitutional');
  });
});

describe('AR runArtifact — DISPOSABLE tier (fast path, nothing persistent)', () => {
  it('returns all canonical fields null and only walks compose', async () => {
    const r = await runArtifact('disposable', 'standard', composed, ctx());
    expect(r.ok).toBe(true);
    expect(r.consequenceClass).toBe('disposable');
    expect(r.object).toBeNull();
    expect(r.artifactId).toBeNull();
    expect(r.version).toBeNull();
    expect(r.receiptId).toBeNull();
    expect(r.registryEntry).toBeNull();
    const stages = evidenceOf(r);
    expect(stages.map((s) => s.stage)).toEqual(['compose']);
  });
});

describe('AR runArtifact — OPERATIONAL tier (versioned, not canonical)', () => {
  it('returns a versioned artifactId + version, but null object/receipt/registry', async () => {
    const r = await runArtifact('operational', 'software', composed, ctx());
    expect(r.ok).toBe(true);
    expect(r.consequenceClass).toBe('operational');
    expect(r.artifactId).toBeTruthy();
    expect(r.version).toBe('v1');
    expect(r.object).toBeNull();
    expect(r.receiptId).toBeNull();
    expect(r.registryEntry).toBeNull();
    expect(evidenceOf(r).map((s) => s.stage)).toEqual(['compose', 'review', 'version', 'publish']);
  });
});

describe('AR runArtifact — CONSTITUTIONAL tier, PROPOSE mode (drafts, writes nothing)', () => {
  it('composes a ConstitutionalObject but writes no receipt/registry', async () => {
    const r = await runArtifact('constitutional', 'research', resultWithProvenance, ctx('propose'));
    expect(r.ok).toBe(true);
    expect(r.consequenceClass).toBe('constitutional');
    expect(r.object).not.toBeNull();
    expect(r.artifactId).toBeTruthy();
    // propose-mode: nothing published/anchored
    expect(r.receiptId).toBeNull();
    expect(r.registryEntry).toBeNull();
    // the object is DRAFTED (immutable id minted at publication, status draft)
    expect(r.object?.version.status).toBe('draft');
    expect(typeof r.version === 'object' && r.version?.version).toBe(1);
    // walks the full 10-stage lifecycle ending at registry
    expect(evidenceOf(r).map((s) => s.stage)).toEqual([
      'intent',
      'planning',
      'composition',
      'review',
      'verification',
      'publication',
      'distribution',
      'receipts',
      'standing',
      'registry',
    ]);
  });

  it('the produced object is T0-inexpressible (only commitments)', async () => {
    const r = await runArtifact('constitutional', 'policy', composed, ctx('propose'));
    expect(r.object).not.toBeNull();
    expect(findForbiddenObjectKey(r.object)).toBeNull();
    // ownership is the T2 actorCommitment, never a personaId
    expect(r.object?.ownership.ownerCommitment).toBe('ownercommit16chars');
  });

  it('carries the composition composedFrom trail forward without re-running composition', async () => {
    const r = await runArtifact('constitutional', 'research', resultWithProvenance, ctx('propose'));
    expect(r.object?.provenance.composedFrom).toEqual([{ id: 'inv.experience.072', kind: 'invariant' }]);
  });
});

describe('AR runArtifact — CONSTITUTIONAL tier, PUBLISH mode (gated: composes a receipt)', () => {
  it('composes createActivityReceipt and populates the full publication contract', async () => {
    const r = await runArtifact('constitutional', 'research', composed, ctx('publish'));
    expect(r.ok).toBe(true);
    expect(r.consequenceClass).toBe('constitutional');
    expect(r.object).not.toBeNull();
    expect(r.receiptId).toBe('rcpt_stub_1'); // from the stubbed unified writer
    expect(r.object?.version.status).toBe('published');
    // registry entry is an ObjectRef pointing at the immutable artifact id
    expect(r.registryEntry).toEqual({ id: r.artifactId, kind: r.object?.identity.kind });
    // the receipt id is recorded on the object's provenance
    expect(r.object?.provenance.receiptIds).toContain('rcpt_stub_1');
  });
});
