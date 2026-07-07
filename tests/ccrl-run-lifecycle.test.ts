/**
 * CCRL run-lifecycle — Phase C2.3 canary (CFS-019, instruments ↔ institution).
 *
 * Pins the constitutional guarantees of the seam that lets EXP runs advance a
 * research object's lifecycle through the ONE receipted path:
 *  1. run-event → transition mapping (nextRunState): run-started targets
 *     `running`; results-published takes the single legal step within the
 *     evaluate→publish band and NEVER drives `replicated`.
 *  2. illegal-state refusal: an event that maps to no legal step yields a null
 *     target (⇒ recordExperimentRunLifecycle records NOTHING) — honest refusal
 *     over silent forcing. Reinforced structurally: the refusal guards precede
 *     any receipt/transition write in the source.
 *  3. auto-create-then-transition: the registry floor is `running`, from which
 *     results-published legally steps to `evaluated` — the fresh-object path.
 *  4. T2-safety of evidence strings: the descriptors the runners build carry
 *     only provider/arm labels + counts, never a T0 identifier.
 *  5. STRUCTURAL: the seam routes through the ONE receipt constructor — exactly
 *     one createActivityReceipt call site remains in services/research/lifecycle,
 *     and neither the run-lifecycle route nor the runners import the receipt
 *     service directly.
 *
 * Runs under vitest in CI; verified in the sandbox via an esbuild-bundle + node
 * drill (vitest + @supabase/supabase-js unavailable there — the drill aliases
 * both to shims and only exercises the pure exports + source structure).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { nextRunState, RUN_LIFECYCLE_FLOOR } from '@/services/research/lifecycle';
import { EXPERIMENT_LIFECYCLE, isLegalExperimentTransition } from '@/types/research';

const ALL_STATES = EXPERIMENT_LIFECYCLE;

describe('C2.3 — run-event → transition mapping (canary-pinned)', () => {
  it('run-started always targets `running` (legality gated separately)', () => {
    for (const from of ALL_STATES) {
      expect(nextRunState('run-started', from).to).toBe('running');
    }
    // Legality is what actually refuses: designed → running is illegal (must
    // pass through protocol-ratified first); protocol-ratified onward is legal.
    expect(isLegalExperimentTransition('designed', 'running')).toBe(false);
    expect(isLegalExperimentTransition('protocol-ratified', 'running')).toBe(true);
    expect(isLegalExperimentTransition('running', 'running')).toBe(true); // re-run — the flywheel
    expect(isLegalExperimentTransition('published', 'running')).toBe(true); // re-run from any post-protocol state
  });

  it('results-published takes the single legal step within the evaluate→publish band', () => {
    expect(nextRunState('results-published', 'running')).toEqual({ to: 'evaluated' });
    expect(nextRunState('results-published', 'evaluated')).toEqual({ to: 'published' });
  });

  it('results-published NEVER drives `replicated` (that is a computed multi-provider signal)', () => {
    // published → replicated IS a technically-legal one-step, but a single run
    // must not assert replication — the mapping caps at published.
    expect(isLegalExperimentTransition('published', 'replicated')).toBe(true);
    const atPublished = nextRunState('results-published', 'published');
    expect(atPublished.to).toBeNull();
    expect(atPublished.reason).toBe('already-published');
    expect(nextRunState('results-published', 'replicated').to).toBeNull();
  });
});

describe('C2.3 — illegal / out-of-order events refuse honestly (record nothing)', () => {
  it('results-published before a run was recorded maps to no target', () => {
    const atDesigned = nextRunState('results-published', 'designed');
    expect(atDesigned.to).toBeNull();
    expect(atDesigned.reason).toBe('run-not-started');
    const atRatified = nextRunState('results-published', 'protocol-ratified');
    expect(atRatified.to).toBeNull();
    expect(atRatified.reason).toBe('run-not-started');
  });

  it('the source refuses BEFORE any write — the null-target and illegal-transition guards precede recordExperimentTransition', () => {
    const src = readFileSync(join(process.cwd(), 'services/research/lifecycle.ts'), 'utf8');
    const fnStart = src.indexOf('export async function recordExperimentRunLifecycle');
    const body = src.slice(fnStart);
    const nullGuard = body.indexOf("if (!to)");
    const illegalGuard = body.indexOf('isLegalExperimentTransition(current, to)');
    const transitionCall = body.indexOf('recordExperimentTransition({');
    expect(fnStart).toBeGreaterThan(-1);
    expect(nullGuard).toBeGreaterThan(-1);
    expect(illegalGuard).toBeGreaterThan(-1);
    expect(transitionCall).toBeGreaterThan(-1);
    // both refusal guards come before the transition (receipt) write
    expect(nullGuard).toBeLessThan(transitionCall);
    expect(illegalGuard).toBeLessThan(transitionCall);
  });
});

describe('C2.3 — auto-create-then-transition (registry floor)', () => {
  it('the registry floor is `running` — deriveOverview\'s zero-run floor for a shipping experiment', () => {
    expect(RUN_LIFECYCLE_FLOOR).toBe('running');
  });

  it('from the floor, results-published legally steps to `evaluated` (the fresh-object path)', () => {
    const next = nextRunState('results-published', RUN_LIFECYCLE_FLOOR);
    expect(next.to).toBe('evaluated');
    expect(isLegalExperimentTransition(RUN_LIFECYCLE_FLOOR, next.to!)).toBe(true);
  });

  it('from the floor, run-started re-enters `running` legally', () => {
    const next = nextRunState('run-started', RUN_LIFECYCLE_FLOOR);
    expect(next.to).toBe('running');
    expect(isLegalExperimentTransition(RUN_LIFECYCLE_FLOOR, next.to!)).toBe(true);
  });
});

describe('C2.3 — T2-safety of run evidence strings', () => {
  // The exact evidence templates the runners + backfill build (labels + counts).
  const SAMPLE_EVIDENCE = [
    'EXP-004 run published: rung=s2-substitutable provider=chaingpt',
    'EXP-005 run published: rung=s3-open-weight providers=venice+openai',
    'EXP-001 run published: provider=venice',
    'EXP-003 run published: provider=openai',
    'EXP-002 run published via backfill',
  ];
  const T0_TOKENS = /persona[_-]?id|auth[_-]?profile[_-]?id|root[_-]?did|fio[_-]?handle|kybe/i;
  // A raw UUID (personaId/caseId shape) must never leak into a T2 descriptor.
  const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

  it('no evidence descriptor names a T0 identifier or carries a UUID', () => {
    for (const e of SAMPLE_EVIDENCE) {
      expect(T0_TOKENS.test(e)).toBe(false);
      expect(UUID.test(e)).toBe(false);
    }
  });

  it('the runner sources build evidence from labels/counts only — no personaId in the run-lifecycle calls', () => {
    for (const f of [
      'components/composer/Exp001EvaluationRunner.tsx',
      'components/composer/Exp003RediscoveryRunner.tsx',
      'components/composer/Exp004SovereigntyRunner.tsx',
      'components/composer/Exp005ProviderChoiceRunner.tsx',
      'components/composer/ExperimentResultsTab.tsx',
    ]) {
      const src = readFileSync(join(process.cwd(), f), 'utf8');
      const callIdx = src.indexOf('recordRunLifecycle(');
      expect(callIdx).toBeGreaterThan(-1);
      // the evidence arg (this call's neighbourhood) never references personaId
      const region = src.slice(callIdx, callIdx + 400);
      expect(T0_TOKENS.test(region)).toBe(false);
    }
  });
});

describe('C2.3 — ONE receipt path (structural)', () => {
  it('exactly one createActivityReceipt CALL site remains in services/research/lifecycle', () => {
    const src = readFileSync(join(process.cwd(), 'services/research/lifecycle.ts'), 'utf8');
    const calls = src.match(/createActivityReceipt\(/g) ?? [];
    expect(calls).toHaveLength(1);
    // and the run-lifecycle seam composes the existing constructors, not a fork
    expect(src).toContain('recordExperimentRunLifecycle');
    expect(src).toContain('recordExperimentTransition({');
    expect(src).toContain('recordResearchObjectCreated({');
  });

  it('the run-lifecycle route never imports the receipt service — it goes through services/research/lifecycle', () => {
    const route = readFileSync(join(process.cwd(), 'app/api/research/run-lifecycle/route.ts'), 'utf8');
    expect(route).not.toContain('createActivityReceipt');
    expect(route).not.toContain('services/receipts');
    expect(route).toMatch(/recordExperimentRunLifecycle[\s\S]*?from '@\/services\/research\/lifecycle'/);
    // admin-gated identically to /api/research/lifecycle
    expect(route).toContain('persona.cartridgeFlags?.isAdmin');
  });

  it('no runner imports the receipt service or calls createActivityReceipt directly (personaFetch only)', () => {
    for (const f of [
      'components/composer/experimentStepFetch.ts',
      'components/composer/Exp001EvaluationRunner.tsx',
      'components/composer/Exp003RediscoveryRunner.tsx',
      'components/composer/Exp004SovereigntyRunner.tsx',
      'components/composer/Exp005ProviderChoiceRunner.tsx',
      'components/composer/ExperimentResultsTab.tsx',
    ]) {
      const src = readFileSync(join(process.cwd(), f), 'utf8');
      expect(src).not.toContain('createActivityReceipt');
      expect(src).not.toContain('services/receipts');
      // no raw global fetch( — personaFetch only (its lowercase never matches "Fetch(")
      expect(src).not.toMatch(/[^A-Za-z]fetch\(/);
    }
  });
});
