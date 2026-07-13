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
// The DVN pipeline's heavy IC deps are stubbed so shouldAnchorActionType (a pure
// predicate over ANCHORABLE_ACTION_TYPES) is importable without @dfinity/agent.
vi.mock('@/services/ops/icAgent', () => ({ getActor: vi.fn() }));
vi.mock('@/services/ops/idl/cross_chain_service', () => ({ idlFactory: vi.fn() }));
// research/lifecycle's invariant store — the pilot never triggers a receipt via
// it, but stubbing avoids loading its own DB deps at import time.
vi.mock('@/services/invariants/store', () => ({ getInvariantsBySeedIds: vi.fn(async () => []) }));

import { classifyArtifact } from '@/services/artifact/classify';
import { runArtifact, evidenceOf } from '@/services/artifact/runArtifact';
import { produceIrlResearchArtifact } from '@/services/artifact/pilots/irlResearchPilot';
import { RECEIPT_EVENT_TO_ACTIVITY_ACTION } from '@/services/registry/receiptEmitter';
import { shouldAnchorActionType } from '@/services/dvn/activityReceiptDvnPipeline';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import type { ArtifactContext, ArtifactCompositionInput } from '@/types/artifactRuntime';
import { findForbiddenObjectKey } from '@/types/constitutionalObject';
import type { CompositionResult } from '@/types/composition';

const ctx = (mode?: 'propose' | 'publish'): ArtifactContext => ({
  invokedBy: 'irl',
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

  it('the publish receipt now uses the artifact_published action type (CFS-025 Phase 2)', async () => {
    vi.mocked(createActivityReceipt).mockClear();
    await runArtifact('constitutional', 'research', composed, ctx('publish'));
    expect(vi.mocked(createActivityReceipt)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createActivityReceipt).mock.calls[0][0]).toMatchObject({
      actionType: 'artifact_published',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// CFS-025 Phase 2 — the IRL `research` pilot (propose-vs-publish decision).
// ─────────────────────────────────────────────────────────────────────────
describe('IRL research pilot — propose vs publish decision', () => {
  const A_COMMIT = 'actorcommit16chr';

  it('propose (default): drafts, writes NO receipt (receiptId null)', async () => {
    vi.mocked(createActivityReceipt).mockClear();
    const r = await produceIrlResearchArtifact({
      actorCommitment: A_COMMIT,
      intentRef: 'intent:irl:EXP-001',
      mode: 'propose',
    });
    expect(r.ok).toBe(true);
    expect(r.consequenceClass).toBe('constitutional');
    expect(r.object).not.toBeNull();
    expect(r.object?.version.status).toBe('draft');
    expect(r.receiptId).toBeNull();
    // NO receipt written in propose-mode (the pilot owns the single publish write)
    expect(vi.mocked(createActivityReceipt)).not.toHaveBeenCalled();
    // ownership is the T2 actorCommitment, never a personaId
    expect(r.object?.ownership.ownerCommitment).toBe(A_COMMIT);
    expect(findForbiddenObjectKey(r.object)).toBeNull();
  });

  it('publish (gated): emits ONE artifact_published receipt with the REAL personaId', async () => {
    vi.mocked(createActivityReceipt).mockClear();
    const r = await produceIrlResearchArtifact({
      actorCommitment: A_COMMIT,
      intentRef: 'intent:irl:EXP-001',
      mode: 'publish',
      personaId: 'persona-real-uuid-1',
    });
    expect(r.ok).toBe(true);
    // exactly ONE receipt, of the anchorable artifact_published type, with the
    // route-resolved T0 personaId (the T2-seam fix) — NOT the actorCommitment.
    expect(vi.mocked(createActivityReceipt)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createActivityReceipt).mock.calls[0][0]).toMatchObject({
      actionType: 'artifact_published',
      personaId: 'persona-real-uuid-1',
    });
    expect(r.receiptId).toBe('rcpt_stub_1');
    expect(r.object?.version.status).toBe('published');
    expect(r.object?.provenance.receiptIds).toContain('rcpt_stub_1');
    expect(r.registryEntry).toEqual({ id: r.artifactId, kind: r.object?.identity.kind });
    // the returned result is still T1-projected — no personaId leaks onto the object
    expect(findForbiddenObjectKey(r.object)).toBeNull();
    expect(r.object?.ownership.ownerCommitment).toBe(A_COMMIT);
  });

  it('publish WITHOUT a resolved personaId falls back to propose (no receipt, gate closed)', async () => {
    vi.mocked(createActivityReceipt).mockClear();
    const r = await produceIrlResearchArtifact({
      actorCommitment: A_COMMIT,
      intentRef: 'intent:irl:EXP-001',
      mode: 'publish', // but no personaId threaded → cannot attribute a receipt
    });
    expect(vi.mocked(createActivityReceipt)).not.toHaveBeenCalled();
    expect(r.receiptId).toBeNull();
    expect(r.object?.version.status).toBe('draft');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// CFS-025 receipt reconciliation — the ReceiptEventType → ActivityActionType
// map. The load-bearing safety property: money-adjacent events map to a
// NON-anchorable action type (they must never land on-chain via the adapter).
// ─────────────────────────────────────────────────────────────────────────
describe('Receipt reconciliation map — money events are NON-anchorable', () => {
  it('reward.granted and participation.metered map to a non-anchorable type', () => {
    for (const ev of ['reward.granted', 'participation.metered'] as const) {
      const action = RECEIPT_EVENT_TO_ACTIVITY_ACTION[ev];
      expect(action).toBe('knowledge_curated');
      expect(shouldAnchorActionType(action)).toBe(false);
    }
  });

  it('the ONLY event mapped to the anchorable artifact_published is asset.published', () => {
    for (const [ev, action] of Object.entries(RECEIPT_EVENT_TO_ACTIVITY_ACTION)) {
      if (shouldAnchorActionType(action)) {
        expect(ev).toBe('asset.published');
        expect(action).toBe('artifact_published');
      }
    }
    // and asset.published is indeed anchorable
    expect(shouldAnchorActionType(RECEIPT_EVENT_TO_ACTIVITY_ACTION['asset.published'])).toBe(true);
  });

  it('every mapped action type is a real member of ActivityActionType surface used here', () => {
    // all non-anchorable pipeline events use one of the two documented fallbacks
    const values = new Set(Object.values(RECEIPT_EVENT_TO_ACTIVITY_ACTION));
    for (const v of values) {
      expect(['artifact_created', 'knowledge_curated', 'artifact_published']).toContain(v);
    }
  });
});
