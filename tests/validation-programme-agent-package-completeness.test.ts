/**
 * Validation Programme JSON Agent Package — External Review Completeness
 * Pass (2026-08-09) canaries. Structural/source-authority style, matching
 * `tests/validation-programme-agent-package.test.ts` and
 * `tests/crystal-freeze-recommendation.test.ts`'s own convention for a full
 * route/React harness this sandbox does not run.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { stripComments } from './_lib/sourceAuthority';
import {
  deriveCallerObserverStatus,
  blindOtherObserverDecisions,
  resolveObserverRound,
  buildObserverReviewPackage,
  type ObserverDecision,
} from '@/services/research/crystalObserverReview';

const REPO = process.cwd();
const readSource = (rel: string) => readFileSync(join(REPO, rel), 'utf8');
const ROUTE = 'app/api/journey/validation-programme/agent-package/route.ts';

describe('point 1 — the frozen-state wire vocabulary never contradicts itself', () => {
  it('the agent package never emits a hardcoded crystalStatus literal', () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).not.toMatch(/crystalStatus:\s*'candidate'/);
  });

  it("crystalSubject is frozen-aware — 'Frozen' is set directly from the persisted artifact, never crystalMilestone() blind to it", () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).toMatch(/if \(isFrozen && artifact\) \{[\s\S]{0,200}milestone: 'Frozen'/);
  });

  it('lifecycle.crystal is derived from the SAME persisted artifact.lifecycle check as isFrozen, never a second computation', () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).toMatch(/const isFrozen = artifact\?\.lifecycle === 'frozen'/);
    expect(src).toMatch(/frozen: isFrozen,/);
  });
});

describe('point 3 — Observer Accepted is structurally independent of Protocol Ratified', () => {
  it('deriveProtocolRatified is called with the experimentId ALONE — no observer round data ever flows into it', () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).toMatch(/deriveProtocolRatified\(VALIDATION_PROGRAMME_EXPERIMENT_ID\)/);
    // Not deriveProtocolRatified(experimentId, <anything observer-shaped>) —
    // a second argument here would be the coupling this canary exists to
    // catch before it ships.
    expect(src).not.toMatch(/deriveProtocolRatified\([^)]*observer/i);
  });

  it("lifecycle.protocol's own note states the independence explicitly", () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).toMatch(/INDEPENDENT of observerReview/);
  });
});

describe('point 8 — observer independence: no leak of another observer\'s decision', () => {
  it('the agent package never embeds a raw decisions array in its response — only the aggregate resolution + caller-scoped status', () => {
    const src = stripComments(readSource(ROUTE));
    // `round.decisions` legitimately appears TWICE, feeding the pure
    // aggregate/caller-status derivations server-side — that is not a leak.
    // The leak this canary refuses is a `decisions:` KEY inside the
    // RETURNED `observerReview` object itself.
    const observerReviewBlock = src.match(/const observerReview = observerPackage[\s\S]*?: null;/)?.[0] ?? '';
    expect(observerReviewBlock.length).toBeGreaterThan(0);
    expect(observerReviewBlock).not.toMatch(/^\s*decisions:/m);
    expect(observerReviewBlock).toMatch(/callerObserverStatus/);
    expect(observerReviewBlock).toMatch(/resolution: observerRoundResolution/);
  });

  it('deriveCallerObserverStatus exposes only caller-scoped fields — never another observer\'s ref, even by elimination (tightened 2026-08-09, second review pass)', () => {
    const pkg = buildObserverReviewPackage({
      packageId: 'p1',
      experimentId: 'EXP-TEST',
      artifact: {
        id: 'EXP-TEST/crystal-vTest',
        kind: 'crystal-version',
        lifecycle: 'frozen',
        contentHash: 'a'.repeat(64),
        commitmentHash: 'a'.repeat(64),
        frozenAt: '2026-08-09T00:00:00.000Z',
        signedBy: ['operator-ref'],
      },
      roundPolicy: 'all-assigned',
      assignedObserverRefs: ['austin-ref', 'avi-ref'],
      createdAt: '2026-08-09T00:00:00.000Z',
    });
    const austinDecision: ObserverDecision = {
      packageHash: pkg.packageHash,
      observerRef: 'austin-ref',
      decision: 'accepted',
      rationale: 'looks sound',
      evidenceRefs: [],
      submittedByAgentRef: null,
      decidedAt: '2026-08-09T00:00:00.000Z',
    };
    const status = deriveCallerObserverStatus({ pkg, decisions: [austinDecision], callerRef: 'avi-ref' });
    expect(status).toEqual({
      callerAssigned: true,
      callerDecisionStatus: 'not-decided',
      roundComplete: false,
      otherAssignedCount: 1,
      otherDecisionsOutstanding: false,
    });
    // No `assignedObserverRefs`/`outstandingObserverRefs`-shaped field survives here —
    // only counts and booleans about OTHERS, never a ref that would let a
    // 2-observer round's "who's outstanding" become "who specifically" by
    // elimination.
    expect(Object.keys(status).sort()).toEqual([
      'callerAssigned',
      'callerDecisionStatus',
      'otherAssignedCount',
      'otherDecisionsOutstanding',
      'roundComplete',
    ]);
    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain('austin-ref');
    expect(serialized).not.toContain('avi-ref');
  });

  it("blindOtherObserverDecisions hides Austin's decision from Avi before Avi has decided", () => {
    const austinDecision: ObserverDecision = {
      packageHash: 'p1',
      observerRef: 'austin-ref',
      decision: 'accepted',
      rationale: 'looks sound',
      evidenceRefs: [],
      submittedByAgentRef: null,
      decidedAt: '2026-08-09T00:00:00.000Z',
    };
    const blinded = blindOtherObserverDecisions({ decisions: [austinDecision], callerRef: 'avi-ref', mayViewAll: false });
    expect(blinded).toEqual([]);

    // Once Avi decides too (mayViewAll would be computed true by the caller
    // — here we just prove the unblinded path shows both).
    const aviDecision: ObserverDecision = { ...austinDecision, observerRef: 'avi-ref', decision: 'changes_requested' };
    const unblinded = blindOtherObserverDecisions({ decisions: [austinDecision, aviDecision], callerRef: 'avi-ref', mayViewAll: true });
    expect(unblinded).toHaveLength(2);
  });

  it("the aggregate resolution is unaffected by blinding — it always folds the FULL decision set, never the caller's redacted view", () => {
    const pkg = buildObserverReviewPackage({
      packageId: 'p1',
      experimentId: 'EXP-TEST',
      artifact: {
        id: 'EXP-TEST/crystal-vTest',
        kind: 'crystal-version',
        lifecycle: 'frozen',
        contentHash: 'a'.repeat(64),
        commitmentHash: 'a'.repeat(64),
        frozenAt: '2026-08-09T00:00:00.000Z',
        signedBy: ['operator-ref'],
      },
      roundPolicy: 'all-assigned',
      assignedObserverRefs: ['austin-ref', 'avi-ref'],
      createdAt: '2026-08-09T00:00:00.000Z',
    });
    const decisions: ObserverDecision[] = [
      { packageHash: pkg.packageHash, observerRef: 'austin-ref', decision: 'accepted', rationale: 'ok', evidenceRefs: [], submittedByAgentRef: null, decidedAt: '2026-08-09T00:00:00.000Z' },
      { packageHash: pkg.packageHash, observerRef: 'avi-ref', decision: 'accepted', rationale: 'ok', evidenceRefs: [], submittedByAgentRef: null, decidedAt: '2026-08-09T00:00:01.000Z' },
    ];
    const resolution = resolveObserverRound({ pkg, decisions });
    expect(resolution.acceptance).toBe('accepted');
  });

  it('the underlying observer-review GET route applies the same blinding derivation, not a second one', () => {
    const src = stripComments(readSource('app/api/research/observer-review/[experimentId]/route.ts'));
    expect(src).toMatch(/blindOtherObserverDecisions/);
    expect(src).toMatch(/deriveCallerObserverStatus/);
    expect(src).toMatch(/mayViewAllDecisions = isSteward \|\| callerHasDecided \|\| roundClosed/);
  });
});

describe('point 6 — governing resources resolve to real files', () => {
  const GOVERNING_RESOURCE_PATHS = [
    'foundation/IRL-012_austin-feedback-integration.md',
    'foundation/IRL-016_experimental-freeze-and-protocol-governance.md',
    'foundation/CFS-033_constitutional-evaluation.md',
    'foundation/CFS-054_crystal-freeze-specification.md',
    'foundation/PRD-EPI-001_exp-p1-experimental-infrastructure-programme.md',
    'foundation/experiments/SERIES-RATIFICATION_p1-p2-p3.md',
    'foundation/experiments/exp-010-representation-gauntlet/README.md',
  ];

  it('every declared governing-resource path exists on disk under codexes/packs/irl/', () => {
    for (const rel of GOVERNING_RESOURCE_PATHS) {
      const full = join(REPO, 'codexes/packs/irl', rel);
      expect(existsSync(full), `missing: ${rel}`).toBe(true);
    }
  });

  it('the route declares the same seven ids the spec named, resolving through the existing pack-file mechanism', () => {
    const src = stripComments(readSource(ROUTE));
    for (const id of ['IRL-012', 'IRL-016', 'CFS-033', 'CFS-054', 'PRD-EPI-001', 'SERIES-RATIFICATION-P1-P2-P3', 'EXP-010']) {
      expect(src).toContain(`id: '${id}'`);
    }
    expect(src).toMatch(/corpusReadPackFile\('irl', r\.path\)/);
  });

  it('the four EXP-P1-local documentResources are unchanged — still filtered from col_experiments, not hand-listed', () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).toMatch(/resolveExpP1DocumentResources/);
    expect(src).toMatch(/\.filter\(isExpP1Path\)/);
    expect(src).toMatch(/col_experiments/);
  });
});

describe('point 2 — the experimentDesign block extracts the canonical protocol, never restates it', () => {
  it('extracts real sections from the actual README.md rather than hand-typing arm/task facts', () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).toMatch(/extractMarkdownSection\(raw, '## 4\. Arms'\)/);
    expect(src).toMatch(/extractMarkdownSection\(raw, '## 5\. Task Set'\)/);
    expect(src).toMatch(/extractMarkdownSection\(raw, '## 12\. Interpretation Table'\)/);
  });

  it('the referenced README.md actually contains those headings, so extraction is not silently returning the honest-absence fallback', () => {
    const readmePath = join(
      REPO,
      'codexes/packs/irl/foundation/experiments/exp-p1-representation-runtime-gauntlet/README.md',
    );
    const raw = readFileSync(readmePath, 'utf8');
    for (const heading of ['## 4. Arms', '## 5. Task Set', '## 6. Probes', '## 7. Runs and Statistics', '## 9. Token Accounting', '## 12. Interpretation Table']) {
      expect(raw).toContain(heading);
    }
  });
});

describe('every existing access/agreement/authority/prohibition boundary is preserved', () => {
  it('the route still gates on callerMayReadExperimentReview and never widens it', () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).toMatch(/callerMayReadExperimentReview/);
    expect(src).toMatch(/Not authorized to read this programme/);
  });

  it('prohibitions still forbid freeze/mutate/canonize/execute and the additional-vote rule', () => {
    const src = stripComments(readSource(ROUTE));
    const joined = src.match(/const PROHIBITIONS = \[[\s\S]*?\];/)?.[0] ?? '';
    expect(joined.toLowerCase()).toMatch(/freeze/);
    expect(joined.toLowerCase()).toMatch(/corpus mutation/);
    expect(joined.toLowerCase()).toMatch(/standing/);
    expect(joined.toLowerCase()).toMatch(/additional observer vote/);
  });

  it('reviewMandate explicitly disclaims approval-by-acceptance', () => {
    const src = stripComments(readSource(ROUTE));
    const mandateBlock = src.match(/const REVIEW_MANDATE = \{[\s\S]*?\n\};/)?.[0] ?? '';
    expect(mandateBlock.length).toBeGreaterThan(0);
    const disclaimerBlock = mandateBlock.match(/disclaimer:\s*\n((?:\s*'[^']*'\s*\+?\s*\n?)+)/)?.[1] ?? '';
    // Reassemble the disclaimer's `+`-joined string literals into one
    // runtime-shaped string, so a line-wrap cannot hide a missing phrase
    // from this check the way a raw substring match would.
    const joined = [...disclaimerBlock.matchAll(/'([^']*)'/g)].map((m) => m[1]).join('');
    expect(joined.length).toBeGreaterThan(0);
    expect(joined).toMatch(/does NOT approve results/);
    expect(joined).toMatch(/does NOT establish domain generality/i);
    expect(joined).toMatch(/does NOT authorize experiment execution/i);
    expect(joined).toMatch(/substitute for.*Protocol Ratification/i);
  });
});
