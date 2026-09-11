/**
 * TS2322 acceptance pack — end-to-end shape check (2026-08-18, operator-
 * directed final pre-dispatch verification, Phase F bounded-execution
 * repair).
 *
 * The exact live-run scenario a real bounded dispatch will exercise: fixing
 * the pre-existing TS2322 at `implementationPack.ts:416`. Pins the operator's
 * complete expected final-pack shape in one place, end-to-end through
 * `generateImplementationPack` (not unit-testing individual pieces), so a
 * regression anywhere in the pipeline — coherence filtering, routing,
 * budget defaults — is caught against the REAL acceptance scenario, not just
 * a synthetic one.
 */

import { describe, it, expect } from 'vitest';
import { generateImplementationPack } from '@/services/constitutional/implementationPack';

const GOAL =
  'Fix pre-existing TS2322 at implementationPack.ts:416 (value.work_potential_qc optional vs non-optional field)';

describe('TS2322 acceptance pack — regenerated end-to-end shape', () => {
  it('types/access.ts surfaced only as reference/evidence: never enters areasToTouch, nothing excluded', async () => {
    const pack = await generateImplementationPack({
      goal: GOAL,
      capabilityEvidence: {
        missing: [{ name: 'the real fix', path: 'services/constitutional/implementationPack.ts', complexity: 'small' }],
        // A reference, not a proposed touch target — evidence/context assets
        // never seed areasToTouch (only `missing` locations do; see
        // capabilityEvidence.ts::areasFromEvidence).
        contextAssets: [{ title: 'PackPreflight.value type reference', path: 'types/access.ts', signal: 'reference' }],
      },
    });
    expect(pack.areasToTouch).toEqual(['services/constitutional/implementationPack.ts']);
    expect(pack.excludedProtectedAreas).toEqual([]);
    expect(pack.forbiddenFiles).toContain('types/access.ts');
    expect(pack.constitutionalDecision.rationale).not.toMatch(/video/i);
    expect(pack.executionRoute.profile).toBe('routine');
    expect(pack.executionRoute.model).toBe('claude-sonnet-4-6');
    expect(pack.executionRoute.budget.maxTurns).toBe(20);
  });

  it('types/access.ts proposed as a touch target (the reproduced live-run bug): excluded, recorded, routine profile preserved', async () => {
    const pack = await generateImplementationPack({
      goal: GOAL,
      capabilityEvidence: {
        // Reproduces the exact live-run defect: evidence proposes the
        // protected file as something to MODIFY, not just reference.
        missing: [
          { name: 'the real fix', path: 'services/constitutional/implementationPack.ts', complexity: 'small' },
          { name: 'access spine change', path: 'types/access.ts', complexity: 'small' },
        ],
      },
    });
    expect(pack.areasToTouch).toEqual(['services/constitutional/implementationPack.ts']);
    expect(pack.excludedProtectedAreas).toEqual(['types/access.ts']);
    // The exclusion alone must not escalate — no genuine protected-surface
    // modification is happening in the pack that actually ships.
    expect(pack.executionRoute.profile).toBe('routine');
    expect(pack.executionRoute.model).toBe('claude-sonnet-4-6');
    expect(pack.executionRoute.budget.maxTurns).toBe(20);
  });

  it('a fabricated EXISTING capability (the second reproduced live-run bug, 2026-08-18): excluded, recorded, areasToTouch narrows to the real fix only', async () => {
    const pack = await generateImplementationPack({
      goal: GOAL,
      capabilityEvidence: {
        // Reproduces the exact live-evidence defect: a nonexistent path
        // claimed as an EXISTING/use_directly capability ("Optional Value
        // Handling") that a repo inspection does not find anywhere.
        existing: [
          { name: 'Optional Value Handling', path: 'services/utils/optionalValueHandler.ts', disposition: 'use_directly' },
        ],
        missing: [{ name: 'the real fix', path: 'services/constitutional/implementationPack.ts', complexity: 'small' }],
      },
    });
    expect(pack.areasToTouch).toEqual(['services/constitutional/implementationPack.ts']);
    expect(pack.unverifiedExistingPaths).toEqual(['services/utils/optionalValueHandler.ts']);
    // The fabricated claim never survives as evidence fact either.
    expect(pack.capabilityEvidence?.existing ?? []).toEqual([]);
    // Route unaffected — an evidence-integrity rejection is not a
    // protected-surface or escalation signal.
    expect(pack.executionRoute.profile).toBe('routine');
    expect(pack.executionRoute.model).toBe('claude-sonnet-4-6');
    expect(pack.executionRoute.budget.maxTurns).toBe(20);
  });
});
