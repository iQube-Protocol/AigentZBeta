/**
 * Constitutional Production Runtime — contract canaries (CFS-025).
 *
 * Pins the order-constant constitutional data (the single production lifecycle,
 * the profile set, the invoking runtimes, the three invariants' statements) and
 * the PURE helpers (stageIndexOf, profileIndexOf, isLegalStageTransition,
 * emptyProductionJob). The runtime (services/production/*) is not exercised here
 * — it composes the impure primitives (composition, receipts, DVN, registry,
 * standing, the identity spine) and is a later phase.
 */

import { describe, it, expect } from 'vitest';
import {
  PRODUCTION_LIFECYCLE,
  IMMUTABILITY_STAGE,
  stageIndexOf,
  isLegalStageTransition,
  PRODUCTION_PROFILES,
  profileIndexOf,
  INVOKING_RUNTIMES,
  CONSTITUTIONAL_PRODUCTION_INVARIANTS,
  emptyProductionJob,
} from '@/types/constitutionalProduction';

describe('CFS-025 — the single production lifecycle (order pinned)', () => {
  it('sequences intent → … → registry', () => {
    expect([...PRODUCTION_LIFECYCLE]).toEqual([
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

  it('stageIndexOf returns position (0 = intent) or -1 for unknown', () => {
    expect(stageIndexOf('intent')).toBe(0);
    expect(stageIndexOf('publication')).toBe(5);
    expect(stageIndexOf('registry')).toBe(PRODUCTION_LIFECYCLE.length - 1);
    expect(stageIndexOf('nonexistent')).toBe(-1);
  });

  it('pins publication as the immutability boundary', () => {
    expect(IMMUTABILITY_STAGE).toBe('publication');
  });
});

describe('CFS-025 — legal stage transitions (one step forward or re-enter)', () => {
  it('allows a single step forward', () => {
    expect(isLegalStageTransition('intent', 'planning')).toBe(true);
    expect(isLegalStageTransition('publication', 'distribution')).toBe(true);
    expect(isLegalStageTransition('standing', 'registry')).toBe(true);
  });

  it('allows re-entering the current stage (the flywheel)', () => {
    expect(isLegalStageTransition('review', 'review')).toBe(true);
  });

  it('rejects skipping ahead, moving backward, and unknown stages', () => {
    expect(isLegalStageTransition('intent', 'composition')).toBe(false); // skip
    expect(isLegalStageTransition('review', 'planning')).toBe(false); // backward
    expect(isLegalStageTransition('registry', 'intent')).toBe(false); // backward
    expect(isLegalStageTransition('nonexistent', 'intent')).toBe(false); // unknown from
    expect(isLegalStageTransition('intent', 'nonexistent')).toBe(false); // unknown to
  });
});

describe('CFS-025 — production profiles (configure, don’t replace)', () => {
  it('pins the profile set', () => {
    expect([...PRODUCTION_PROFILES]).toEqual([
      'standard',
      'white-paper',
      'research',
      'software',
      'agreement',
      'presentation',
      'book',
      'investor-deck',
      'api',
      'documentation',
      'policy',
      'multimedia',
    ]);
  });

  it('profileIndexOf returns position or -1 for unknown', () => {
    expect(profileIndexOf('standard')).toBe(0);
    expect(profileIndexOf('research')).toBe(2);
    expect(profileIndexOf('multimedia')).toBe(PRODUCTION_PROFILES.length - 1);
    expect(profileIndexOf('nonexistent')).toBe(-1);
  });
});

describe('CFS-025 — the invoking runtimes (none owns CPR)', () => {
  it('pins the invoking runtimes', () => {
    expect([...INVOKING_RUNTIMES]).toEqual(['agentme', 'aigentz', 'studio', 'ccrl', 'operator']);
  });
});

describe('CFS-025 — emptyProductionJob (honest nulls, fresh arrays)', () => {
  it('returns a not-yet-invoked job with honest nulls', () => {
    const job = emptyProductionJob();
    expect(job.jobId).toBeNull();
    expect(job.intentRef).toBeNull();
    expect(job.profile).toBeNull();
    expect(job.invokedBy).toBeNull();
    expect(job.compositionInput.compositionRef).toBeNull();
    expect(job.compositionInput.result).toBeNull();
    expect(job.ownerCommitment).toBeNull();
    expect(job.evidence).toEqual([]);
    expect(job.receiptIds).toEqual([]);
  });

  it('starts at the honest lifecycle start (intent)', () => {
    expect(emptyProductionJob().state).toBe('intent');
  });

  it('a fresh empty job has no shared mutable arrays (new arrays each call)', () => {
    const a = emptyProductionJob();
    const b = emptyProductionJob();
    expect(a.evidence).not.toBe(b.evidence);
    expect(a.receiptIds).not.toBe(b.receiptIds);
  });
});

describe('CFS-025 — the three production invariants (statements pinned)', () => {
  it('pins the three invariant ids in order', () => {
    expect(CONSTITUTIONAL_PRODUCTION_INVARIANTS.map((i) => i.id)).toEqual([
      'production-not-composition',
      'production-single-lifecycle',
      'production-object-identity',
    ]);
  });

  it('not-composition invariant: composition and production are distinct', () => {
    const inv = CONSTITUTIONAL_PRODUCTION_INVARIANTS.find(
      (i) => i.id === 'production-not-composition',
    );
    expect(inv?.statement).toContain('Composition and production');
    expect(inv?.statement).toContain('CPR owns production');
  });

  it('single-lifecycle invariant: ONE lifecycle, a profile never reorders it', () => {
    const inv = CONSTITUTIONAL_PRODUCTION_INVARIANTS.find(
      (i) => i.id === 'production-single-lifecycle',
    );
    expect(inv?.statement).toContain('ONE lifecycle');
    expect(inv?.statement).toContain('never adds, removes, or reorders');
  });

  it('object-identity invariant: every output IS a ConstitutionalObject', () => {
    const inv = CONSTITUTIONAL_PRODUCTION_INVARIANTS.find(
      (i) => i.id === 'production-object-identity',
    );
    expect(inv?.statement).toContain('ConstitutionalObject');
    expect(inv?.statement).toContain('Constitutional Object Model');
  });
});
