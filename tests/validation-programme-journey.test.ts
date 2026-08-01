/**
 * Validation Programme journey canaries (operator spec, 2026-08-01) — the
 * external reviewer's guided path through EXP-P1, built entirely by REUSING
 * SPEC-IRL-WORKSPACE-001's existing substrate (the `reviewer` role, the
 * `autonomi-review-exp-p1` workspace, the 8-view matrix) plus a narrow
 * extension to admit that role where server enforcement had not yet caught
 * up with the render-level matrix.
 *
 * Methodology matches this repo's own convention for these surfaces:
 * behavioural where the logic is pure/fake-able (the reviewer-reach check,
 * the journey state resolution), structural/source-authority where a full
 * route or React render harness would be needed and isn't available in this
 * sandbox (matches tests/horizen-agent-page-surface-wiring.test.ts).
 */

import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { readSource, stripComments, importAuthority } from './_lib/sourceAuthority';
import { callerMayReadExperimentReview, getReviewReadableExperiments } from '@/services/passport/participationAccess';
import {
  VALIDATION_PROGRAMME_JOURNEY,
  VALIDATION_PROGRAMME_WORKSPACE_ID,
  VALIDATION_PROGRAMME_EXPERIMENT_ID,
} from '@/services/journey/validationProgrammeJourney';
import { JOURNEY_SURFACES } from '@/services/journey/journeySurfaceRegistry';
import { resolveJourneyState } from '@/services/journey/resolveJourneyState';
import { RESEARCH_WORKSPACES } from '@/services/research/researchWorkspace';
import { IRL_OS_CARTRIDGE } from '@/data/codex-configs';

// ─── A minimal fake Supabase query builder (matches tests/passport-first-connection.test.ts's pattern) ───

type FakeResult = { data: unknown; error: unknown };

class FakeQueryBuilder implements PromiseLike<FakeResult> {
  constructor(private readonly result: FakeResult) {}
  select() {
    return this;
  }
  eq() {
    return this;
  }
  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

function fakeAdminReturning(rows: Record<string, unknown>[]): SupabaseClient {
  return { from: () => new FakeQueryBuilder({ data: rows, error: null }) } as unknown as SupabaseClient;
}

describe('callerMayReadExperimentReview — the reviewer-reach gate this journey depends on', () => {
  it('admits an active reviewer grant scoped to the experiment', async () => {
    const admin = fakeAdminReturning([{ role: 'reviewer', allowed_experiments: ['EXP-P1', 'EXP-P2'] }]);
    expect(await callerMayReadExperimentReview(admin, 'persona-1', 'EXP-P1')).toBe(true);
  });

  it('denies a reviewer grant scoped to a DIFFERENT experiment — acceptance criterion 4', async () => {
    const admin = fakeAdminReturning([{ role: 'reviewer', allowed_experiments: ['EXP-P2'] }]);
    expect(await callerMayReadExperimentReview(admin, 'persona-1', 'EXP-P1')).toBe(false);
  });

  it('admits an unrestricted grant (null allowed_experiments = the whole series)', async () => {
    const admin = fakeAdminReturning([{ role: 'reviewer', allowed_experiments: null }]);
    expect(await callerMayReadExperimentReview(admin, 'persona-1', 'EXP-P1')).toBe(true);
  });

  it('denies an Institutional Observer (research-participant) — excluded from the Review view', async () => {
    const admin = fakeAdminReturning([{ role: 'research-participant', allowed_experiments: null }]);
    expect(await callerMayReadExperimentReview(admin, 'persona-1', 'EXP-P1')).toBe(false);
  });

  it('denies a Student Researcher — excluded from the Review view', async () => {
    const admin = fakeAdminReturning([{ role: 'student-researcher', allowed_experiments: null }]);
    expect(await callerMayReadExperimentReview(admin, 'persona-1', 'EXP-P1')).toBe(false);
  });

  it('denies with no grants at all', async () => {
    const admin = fakeAdminReturning([]);
    expect(await callerMayReadExperimentReview(admin, 'persona-1', 'EXP-P1')).toBe(false);
  });

  it('never authorizes freeze/canonise/publish — this function answers a read question only', () => {
    // Source-authority, not behavioural: the function's own return type is
    // boolean (a single yes/no for READ), and the surrounding module never
    // wires it into any write/governance path.
    const src = stripComments(readSource('services/passport/participationAccess.ts'));
    const fn = src.match(/export async function callerMayReadExperimentReview[\s\S]*?\n\}/);
    expect(fn).not.toBeNull();
    expect(fn![0]).not.toMatch(/freeze|canonize|canonise|publish|ratify/i);
  });
});

describe('getReviewReadableExperiments — the set-returning gate behind Review Queue/Result', () => {
  it('returns the union of a single scoped grant', async () => {
    const admin = fakeAdminReturning([{ role: 'reviewer', allowed_experiments: ['EXP-P1'] }]);
    const result = await getReviewReadableExperiments(admin, 'persona-1');
    expect(result).not.toBe('all');
    expect([...(result as Set<string>)]).toEqual(['EXP-P1']);
  });

  it('unions experiment ids across multiple scoped grants', async () => {
    const admin = fakeAdminReturning([
      { role: 'reviewer', allowed_experiments: ['EXP-P1'] },
      { role: 'reviewer', allowed_experiments: ['EXP-P2'] },
    ]);
    const result = await getReviewReadableExperiments(admin, 'persona-1');
    expect(new Set(result as Set<string>)).toEqual(new Set(['EXP-P1', 'EXP-P2']));
  });

  it('returns "all" the moment any qualifying grant is unrestricted', async () => {
    const admin = fakeAdminReturning([
      { role: 'reviewer', allowed_experiments: ['EXP-P1'] },
      { role: 'research-steward', allowed_experiments: null },
    ]);
    expect(await getReviewReadableExperiments(admin, 'persona-1')).toBe('all');
  });

  it('ignores a research-participant grant — never contributes to the readable set', async () => {
    const admin = fakeAdminReturning([{ role: 'research-participant', allowed_experiments: null }]);
    const result = await getReviewReadableExperiments(admin, 'persona-1');
    expect(result).not.toBe('all');
    expect((result as Set<string>).size).toBe(0);
  });

  it('returns an empty set with no grants at all — fails closed, never "all"', async () => {
    const admin = fakeAdminReturning([]);
    const result = await getReviewReadableExperiments(admin, 'persona-1');
    expect(result).not.toBe('all');
    expect((result as Set<string>).size).toBe(0);
  });
});

describe('Crystal route — admits a scoped reviewer, never widens freeze-preview', () => {
  it('the GET route imports and calls callerMayReadExperimentReview', () => {
    const src = stripComments(readSource('app/api/research/crystal/[experimentId]/route.ts'));
    const graph = importAuthority(readSource('app/api/research/crystal/[experimentId]/route.ts'));
    const imported = graph.records.some(
      (r) => r.specifier.includes('participationAccess') && r.names.includes('callerMayReadExperimentReview'),
    );
    expect(imported).toBe(true);
    expect(src).toContain('callerMayReadExperimentReview(');
  });

  it('the sibling freeze-preview route is untouched — still isAdmin-only, no reviewer path', () => {
    const src = stripComments(readSource('app/api/research/crystal/[experimentId]/freeze-preview/route.ts'));
    expect(src).not.toContain('callerMayReadExperimentReview');
    expect(src).toMatch(/cartridgeFlags\?\.isAdmin/);
  });
});

describe('PartnerProgrammesTab — lockedWorkspaceId renders one workspace bare', () => {
  const src = stripComments(readSource('app/triad/components/codex/tabs/PartnerProgrammesTab.tsx'));

  it('accepts lockedWorkspaceId and narrows `workspaces` to it', () => {
    expect(src).toContain('lockedWorkspaceId');
    expect(src).toMatch(/scoped\.filter\(\(w\) => w\.id === lockedWorkspaceId\)/);
  });

  it('suppresses the workspace picker and Command Center chrome when locked', () => {
    expect(src).toMatch(/kind === "research" && !lockedWorkspaceId/);
    expect(src).toMatch(/surface !== "journey" && !lockedWorkspaceId/);
  });

  it('locking never WIDENS reach — the grant-scope filter still runs before the lock filter', () => {
    const fn = src.match(/const workspaces = useMemo\(\(\) => \{[\s\S]*?\n {2}\}, \[/);
    expect(fn).not.toBeNull();
    const scopedIdx = fn![0].indexOf('grantedScopes ===');
    const lockIdx = fn![0].indexOf('lockedWorkspaceId ? scoped.filter');
    expect(scopedIdx).toBeGreaterThan(-1);
    expect(lockIdx).toBeGreaterThan(scopedIdx);
  });
});

describe('VALIDATION_PROGRAMME_JOURNEY — structure and reuse', () => {
  it('has exactly the four spec stages, in order', () => {
    expect(VALIDATION_PROGRAMME_JOURNEY.stages.map((s) => s.id)).toEqual([
      'overview',
      'crystal-review',
      'submit-review',
      'experiment-progress',
    ]);
  });

  it('every stage surface resolves to a real, registered journeySurfaceRegistry entry', () => {
    for (const stage of VALIDATION_PROGRAMME_JOURNEY.stages) {
      for (const surfaceRef of stage.surfaces) {
        expect(JOURNEY_SURFACES[surfaceRef.ref], `${stage.id}'s surface '${surfaceRef.ref}' is not registered`).toBeTruthy();
      }
    }
  });

  it('every component-kind surface locks to VALIDATION_PROGRAMME_WORKSPACE_ID — never an unscoped workspace picker', () => {
    for (const stage of VALIDATION_PROGRAMME_JOURNEY.stages) {
      for (const surfaceRef of stage.surfaces) {
        const descriptor = JOURNEY_SURFACES[surfaceRef.ref];
        if (descriptor.kind === 'component' && descriptor.component === 'PartnerProgrammesTab') {
          expect(surfaceRef.props?.lockedWorkspaceId).toBe(VALIDATION_PROGRAMME_WORKSPACE_ID);
          expect(surfaceRef.props?.workspaceDomain).toBe('research');
        }
      }
    }
  });

  it('the locked workspace id is a real entry in RESEARCH_WORKSPACES (SPEC-IRL-WORKSPACE-001 §1 use 1)', () => {
    expect(RESEARCH_WORKSPACES.some((w) => w.id === VALIDATION_PROGRAMME_WORKSPACE_ID)).toBe(true);
  });

  it('the Crystal Review stage grants only inspect/comment/recommend/contest actions — never a governance verb', () => {
    // Scoped to `permittedActions` specifically, not the whole stage block —
    // the stage's own `note` field legitimately NAMES freeze/ratify/etc. in
    // prose to explain that they do NOT exist on the composed surface, and a
    // whole-block scan would fail on that prose (the grep-vs-comment defect
    // class tests/_lib/sourceAuthority.ts documents, extended here to string
    // literals that are explanatory prose rather than executable code).
    const crystalStage = VALIDATION_PROGRAMME_JOURNEY.stages.find((s) => s.id === 'crystal-review');
    expect(crystalStage).toBeTruthy();
    expect(crystalStage!.permittedActions).toEqual(['comment', 'recommend-change', 'contest-finding']);
    for (const forbidden of ['freeze-crystal', 'ratify', 'approve-governance', 'modify-corpus', 'change-lifecycle']) {
      expect(crystalStage!.permittedActions).not.toContain(forbidden);
    }
  });
});

describe('resolveJourneyState over the Validation Programme journey (behavioural, pure)', () => {
  it('with zero evidence, only Overview is READY and everything after is BLOCKED', () => {
    const state = resolveJourneyState(VALIDATION_PROGRAMME_JOURNEY, { stages: {} });
    const byId = Object.fromEntries(state.stages.map((s) => [s.stageId, s.state]));
    expect(byId.overview).toBe('READY');
    expect(byId['crystal-review']).toBe('BLOCKED');
    expect(byId['submit-review']).toBe('BLOCKED');
    expect(byId['experiment-progress']).toBe('BLOCKED');
  });

  it('reviewer access confirmed completes Overview and unblocks Crystal Review', () => {
    const state = resolveJourneyState(VALIDATION_PROGRAMME_JOURNEY, {
      stages: { overview: { reviewerAccessConfirmed: true } },
    });
    const byId = Object.fromEntries(state.stages.map((s) => [s.stageId, s.state]));
    expect(byId.overview).toBe('COMPLETE');
    expect(byId['crystal-review']).toBe('READY');
  });

  it('a submitted review decision completes Crystal Review and unblocks Submit Review', () => {
    const state = resolveJourneyState(VALIDATION_PROGRAMME_JOURNEY, {
      stages: {
        overview: { reviewerAccessConfirmed: true },
        'crystal-review': { reviewDecisionSubmitted: true },
      },
    });
    const byId = Object.fromEntries(state.stages.map((s) => [s.stageId, s.state]));
    expect(byId['crystal-review']).toBe('COMPLETE');
    expect(byId['submit-review']).toBe('READY');
  });

  it('an empty Submit Review evidence record (agreement wiring not yet built) never fabricates COMPLETE', () => {
    const state = resolveJourneyState(VALIDATION_PROGRAMME_JOURNEY, {
      stages: {
        overview: { reviewerAccessConfirmed: true },
        'crystal-review': { reviewDecisionSubmitted: true },
        'submit-review': {},
      },
    });
    const byId = Object.fromEntries(state.stages.map((s) => [s.stageId, s.state]));
    expect(byId['submit-review']).not.toBe('COMPLETE');
  });

  it('Experiment Progress (empty completionEvidence) never resolves COMPLETE even with every prior stage done', () => {
    const state = resolveJourneyState(VALIDATION_PROGRAMME_JOURNEY, {
      stages: {
        overview: { reviewerAccessConfirmed: true },
        'crystal-review': { reviewDecisionSubmitted: true },
        'submit-review': { collaborationAgreementAuthorized: true },
      },
    });
    const byId = Object.fromEntries(state.stages.map((s) => [s.stageId, s.state]));
    expect(byId['experiment-progress']).not.toBe('COMPLETE');
  });
});

describe('State route — real state resolution, no fabrication', () => {
  it('imports the real reviewer-reach check and the real review store, never a stub', () => {
    const graph = importAuthority(readSource('app/api/journey/validation-programme/state/route.ts'));
    expect(graph.records.some((r) => r.names.includes('callerMayReadExperimentReview'))).toBe(true);
    expect(graph.records.some((r) => r.names.includes('listReviews'))).toBe(true);
    expect(graph.records.some((r) => r.names.includes('resolveJourneyState'))).toBe(true);
  });

  it('never writes a value for submit-review evidence — the honest, not-yet-wired gap', () => {
    const src = stripComments(readSource('app/api/journey/validation-programme/state/route.ts'));
    const block = src.match(/'submit-review':\s*\{[^}]*\}/);
    expect(block).not.toBeNull();
    expect(block![0].replace(/\s/g, '')).toBe("'submit-review':{}");
  });
});

describe('IRL OS Laboratory — the Validation Programme tab is registered and reachable', () => {
  it('a tab exists in the laboratory group pointing at ValidationProgrammeJourneyTab', () => {
    const tab = IRL_OS_CARTRIDGE.tabs.find((t) => t.id === 'irl-os-validation-programme');
    expect(tab).toBeTruthy();
    expect(tab?.group).toBe('laboratory');
    expect(tab?.enabled).toBe(true);
    expect((tab?.config as { component?: string } | undefined)?.component).toBe('ValidationProgrammeJourneyTab');
  });

  it('is not adminOnly — an external reviewer, not staff, is the intended audience', () => {
    const tab = IRL_OS_CARTRIDGE.tabs.find((t) => t.id === 'irl-os-validation-programme');
    expect((tab as { adminOnly?: boolean } | undefined)?.adminOnly).toBeFalsy();
  });

  it('TabRenderer imports and registers ValidationProgrammeJourneyTab', () => {
    const src = readSource('app/triad/components/codex/TabRenderer.tsx');
    expect(src).toContain('import { ValidationProgrammeJourneyTab } from "./tabs/ValidationProgrammeJourneyTab"');
    expect(src).toMatch(/\n {2}ValidationProgrammeJourneyTab,/);
  });

  it('its icon resolves to a real registered icon (no inert fallback)', () => {
    const iconMapSrc = readSource('app/triad/components/codex/iconMap.ts');
    const tab = IRL_OS_CARTRIDGE.tabs.find((t) => t.id === 'irl-os-validation-programme');
    const icon = (tab?.metadata as { icon?: string } | undefined)?.icon;
    expect(icon).toBeTruthy();
    expect(iconMapSrc).toContain(`  ${icon},`);
  });
});

describe('validationProgrammeJourney.ts constants', () => {
  it('exports the workspace and experiment ids used throughout the journey', () => {
    expect(VALIDATION_PROGRAMME_WORKSPACE_ID).toBe('autonomi-review-exp-p1');
    expect(VALIDATION_PROGRAMME_EXPERIMENT_ID).toBe('EXP-P1');
  });
});
