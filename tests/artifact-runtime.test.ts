/**
 * Artifact Runtime (AR) — contract canaries (CFS-025).
 *
 * Pins the order-constant constitutional data (the three consequence classes,
 * the per-tier lifecycles, the profiles, the invoking runtimes, the invariants'
 * statements) and the PURE helpers (class/stage/profile indices, per-class legal
 * transitions, promotion, emptyArtifactJob). The runtime organs are a later,
 * ratification-gated phase and are not exercised here.
 */

import { describe, it, expect } from 'vitest';
import {
  CONSEQUENCE_CLASSES,
  CONSTITUTIONAL_CLASS,
  consequenceClassIndex,
  DISPOSABLE_LIFECYCLE,
  OPERATIONAL_LIFECYCLE,
  CONSTITUTIONAL_LIFECYCLE,
  LIFECYCLE_FOR_CLASS,
  lifecycleFor,
  IMMUTABILITY_STAGE,
  stageIndexOf,
  isLegalStageTransition,
  canPromote,
  ARTIFACT_PROFILES,
  profileIndexOf,
  INVOKING_RUNTIMES,
  emptyArtifactJob,
  ARTIFACT_RUNTIME_INVARIANTS,
} from '@/types/artifactRuntime';

describe('AR — consequence classes (constitutionality is a property of consequence)', () => {
  it('pins the three tiers in ascending order of consequence', () => {
    expect([...CONSEQUENCE_CLASSES]).toEqual(['disposable', 'operational', 'constitutional']);
    expect(CONSTITUTIONAL_CLASS).toBe('constitutional');
  });

  it('consequenceClassIndex ranks tiers; -1 for unknown', () => {
    expect(consequenceClassIndex('disposable')).toBe(0);
    expect(consequenceClassIndex('operational')).toBe(1);
    expect(consequenceClassIndex('constitutional')).toBe(2);
    expect(consequenceClassIndex('nope')).toBe(-1);
  });
});

describe('AR — per-tier lifecycles (one runtime, three ceremonies)', () => {
  it('disposable is compose→done; operational is compose→review→version→publish', () => {
    expect([...DISPOSABLE_LIFECYCLE]).toEqual(['compose']);
    expect([...OPERATIONAL_LIFECYCLE]).toEqual(['compose', 'review', 'version', 'publish']);
  });

  it('constitutional runs the full lifecycle ending at registry', () => {
    expect([...CONSTITUTIONAL_LIFECYCLE]).toEqual([
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
    expect(IMMUTABILITY_STAGE).toBe('publication');
  });

  it('LIFECYCLE_FOR_CLASS + lifecycleFor map each class to its lifecycle', () => {
    expect(lifecycleFor('disposable')).toBe(LIFECYCLE_FOR_CLASS.disposable);
    expect([...lifecycleFor('constitutional')]).toEqual([...CONSTITUTIONAL_LIFECYCLE]);
    expect(lifecycleFor('nope')).toEqual([]);
  });

  it('stageIndexOf locates a stage within its class lifecycle', () => {
    expect(stageIndexOf('constitutional', 'intent')).toBe(0);
    expect(stageIndexOf('constitutional', 'registry')).toBe(CONSTITUTIONAL_LIFECYCLE.length - 1);
    expect(stageIndexOf('operational', 'publish')).toBe(3);
    // a constitutional stage is NOT a member of the operational lifecycle
    expect(stageIndexOf('operational', 'registry')).toBe(-1);
  });
});

describe('AR — isLegalStageTransition is per-class (one step forward or re-enter)', () => {
  it('advances one step or re-enters within the class', () => {
    expect(isLegalStageTransition('constitutional', 'intent', 'planning')).toBe(true);
    expect(isLegalStageTransition('constitutional', 'review', 'review')).toBe(true);
    expect(isLegalStageTransition('operational', 'compose', 'review')).toBe(true);
  });

  it('rejects skip-ahead, backward, cross-class, and unknown', () => {
    expect(isLegalStageTransition('constitutional', 'intent', 'composition')).toBe(false); // skip
    expect(isLegalStageTransition('constitutional', 'planning', 'intent')).toBe(false); // backward
    expect(isLegalStageTransition('operational', 'compose', 'publication')).toBe(false); // cross-class stage
    expect(isLegalStageTransition('nope', 'compose', 'review')).toBe(false); // unknown class
  });
});

describe('AR — promotion is earned (up one tier, never down, never skip)', () => {
  it('promotes exactly one tier upward', () => {
    expect(canPromote('disposable', 'operational')).toBe(true);
    expect(canPromote('operational', 'constitutional')).toBe(true);
  });

  it('refuses demotion, tier-skipping, self, and unknown', () => {
    expect(canPromote('operational', 'disposable')).toBe(false); // demotion
    expect(canPromote('disposable', 'constitutional')).toBe(false); // skip
    expect(canPromote('constitutional', 'constitutional')).toBe(false); // self
    expect(canPromote('nope', 'operational')).toBe(false); // unknown
  });
});

describe('AR — profiles + invoking runtimes (order pinned)', () => {
  it('pins the profile set and locates by index', () => {
    expect(ARTIFACT_PROFILES).toContain('research');
    expect(ARTIFACT_PROFILES).toContain('software');
    expect(profileIndexOf('standard')).toBe(0);
    expect(profileIndexOf('nope')).toBe(-1);
  });

  it('pins the invoking runtimes; none owns the runtime', () => {
    expect([...INVOKING_RUNTIMES]).toEqual(['agentme', 'aigentz', 'studio', 'ccrl', 'operator']);
  });
});

describe('AR — emptyArtifactJob (honest nulls, unclassified start)', () => {
  it('is unclassified with fresh arrays and null state', () => {
    const j = emptyArtifactJob();
    expect(j.consequenceClass).toBeNull();
    expect(j.state).toBeNull(); // classification is the first act
    expect(j.profile).toBeNull();
    expect(j.evidence).toEqual([]);
    expect(j.receiptIds).toEqual([]);
    expect(j.ownerCommitment).toBeNull();
    expect(j.compositionInput).toEqual({ compositionRef: null, result: null });
  });

  it('a fresh job has no shared mutable arrays', () => {
    expect(emptyArtifactJob().evidence).not.toBe(emptyArtifactJob().evidence);
  });
});

describe('AR — the invariants (statements pinned; proposed under Law XI)', () => {
  it('pins the four invariant ids in order', () => {
    expect(ARTIFACT_RUNTIME_INVARIANTS.map((i) => i.id)).toEqual([
      'constitutionality-is-earned',
      'consequence-classification-first',
      'production-not-composition',
      'constitutional-object-identity',
    ]);
  });

  it('the governing principle is stated verbatim', () => {
    const earned = ARTIFACT_RUNTIME_INVARIANTS.find((i) => i.id === 'constitutionality-is-earned');
    expect(earned?.statement).toContain('property of consequence, not of creation');
    const classify = ARTIFACT_RUNTIME_INVARIANTS.find((i) => i.id === 'consequence-classification-first');
    expect(classify?.statement).toContain('classified by consequence');
    expect(classify?.statement).toContain('NO receipts');
  });
});
