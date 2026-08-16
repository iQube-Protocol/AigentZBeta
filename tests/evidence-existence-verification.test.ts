/**
 * Capability-evidence existence verification (2026-08-18, operator-directed).
 *
 * A freshly regenerated TS2322 pack claimed an EXISTING/use_directly
 * capability — "Optional Value Handling — services/utils/optionalValueHandler.ts"
 * — that does not exist anywhere in the repo, and that fabricated path
 * entered `areasToTouch` alongside the real fix target. Nothing in the
 * pipeline ever verified an EXISTING claim against the actual file tree
 * before treating it as grounding fact.
 *
 * Fix: `verifyExistingEvidencePaths` (capabilityEvidence.ts) drops any
 * `evidence.existing` entry whose path does not verify on disk, BEFORE it
 * can shape the drafter's prompt or seed `areasToTouch`; `implementationPack.ts`
 * additionally excludes any SUCH rejected path from the final `areasToTouch`
 * as defense in depth, in case the drafter (or a stale persisted evidence
 * row) had already echoed it in. Deliberately narrow: only EXISTING claims
 * are verified — `missing` (genuinely new work) suggested locations are
 * legitimately not-yet-built and are untouched.
 */

import { describe, it, expect } from 'vitest';
import { verifyExistingEvidencePaths, type CapabilityEvidence } from '@/services/constitutional/capabilityEvidence';
import { generateImplementationPack } from '@/services/constitutional/implementationPack';

const FAKE_PATH = 'services/utils/optionalValueHandler.ts';
const REAL_PATH = 'services/constitutional/implementationPack.ts';

describe('verifyExistingEvidencePaths — pure existence check', () => {
  it('drops an EXISTING claim whose path does not exist on disk', () => {
    const evidence: CapabilityEvidence = {
      existing: [{ name: 'Optional Value Handling', path: FAKE_PATH, disposition: 'use_directly' }],
    };
    const result = verifyExistingEvidencePaths(evidence);
    expect(result.evidence?.existing).toEqual([]);
    expect(result.unverifiedExistingPaths).toEqual([FAKE_PATH]);
  });

  it('keeps an EXISTING claim whose path genuinely exists', () => {
    const evidence: CapabilityEvidence = {
      existing: [{ name: 'Implementation Pack service', path: REAL_PATH, disposition: 'use_directly' }],
    };
    const result = verifyExistingEvidencePaths(evidence);
    expect(result.evidence?.existing).toHaveLength(1);
    expect(result.evidence?.existing?.[0].path).toBe(REAL_PATH);
    expect(result.unverifiedExistingPaths).toEqual([]);
  });

  it('passes through an EXISTING claim with no specific path unverified (nothing to check)', () => {
    const evidence: CapabilityEvidence = {
      existing: [{ name: 'A conceptual registry capability', disposition: 'use_directly' }],
    };
    const result = verifyExistingEvidencePaths(evidence);
    expect(result.evidence?.existing).toHaveLength(1);
    expect(result.unverifiedExistingPaths).toEqual([]);
  });

  it('never touches `missing` — genuinely new work is legitimately not-yet-built', () => {
    const evidence: CapabilityEvidence = {
      missing: [{ name: 'the real fix', path: REAL_PATH }],
    };
    const result = verifyExistingEvidencePaths(evidence);
    expect(result.evidence?.missing).toEqual(evidence.missing);
    expect(result.unverifiedExistingPaths).toEqual([]);
  });

  it('handles undefined evidence and evidence with no existing entries', () => {
    expect(verifyExistingEvidencePaths(undefined)).toEqual({ evidence: undefined, unverifiedExistingPaths: [] });
    expect(verifyExistingEvidencePaths({ missing: [] }).unverifiedExistingPaths).toEqual([]);
  });
});

describe('generateImplementationPack — end-to-end, reproducing the exact live defect', () => {
  it('a fabricated EXISTING/use_directly capability never survives into areasToTouch, and is recorded as rejected', async () => {
    const pack = await generateImplementationPack({
      goal: 'Fix pre-existing TS2322 at implementationPack.ts:416',
      capabilityEvidence: {
        existing: [{ name: 'Optional Value Handling', path: FAKE_PATH, disposition: 'use_directly' }],
        missing: [{ name: 'the real fix', path: REAL_PATH, complexity: 'small' }],
      },
    });
    // The coherence invariant: a rejected EXISTING claim can never end up in
    // the pack's own shipped areasToTouch.
    expect(pack.areasToTouch).not.toContain(FAKE_PATH);
    expect(pack.areasToTouch).toEqual([REAL_PATH]);
    // Never silent: the rejection is on the record.
    expect(pack.unverifiedExistingPaths).toContain(FAKE_PATH);
    // The evidence itself no longer carries the fabricated claim forward —
    // it must not appear as fact anywhere the pack reports evidence.
    expect(pack.capabilityEvidence?.existing ?? []).toEqual([]);
  });

  it('a genuinely existing EXISTING/use_directly claim is NOT rejected and stays out of areasToTouch as normal (composition, not a touch target)', async () => {
    const pack = await generateImplementationPack({
      goal: 'Fix pre-existing TS2322 at implementationPack.ts:416',
      capabilityEvidence: {
        existing: [{ name: 'Implementation Pack service', path: REAL_PATH, disposition: 'use_directly' }],
      },
    });
    expect(pack.unverifiedExistingPaths).toEqual([]);
    expect(pack.capabilityEvidence?.existing).toHaveLength(1);
  });

  it('the routine/Sonnet/20-turn route is unaffected by evidence-integrity rejection (no unrelated escalation)', async () => {
    const pack = await generateImplementationPack({
      goal: 'Fix pre-existing TS2322 at implementationPack.ts:416',
      capabilityEvidence: {
        existing: [{ name: 'Optional Value Handling', path: FAKE_PATH, disposition: 'use_directly' }],
        missing: [{ name: 'the real fix', path: REAL_PATH, complexity: 'small' }],
      },
    });
    expect(pack.executionRoute.profile).toBe('routine');
    expect(pack.executionRoute.model).toBe('claude-sonnet-4-6');
    expect(pack.executionRoute.budget.maxTurns).toBe(20);
  });
});
