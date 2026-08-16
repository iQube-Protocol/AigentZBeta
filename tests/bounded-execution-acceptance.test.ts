/**
 * Deterministic bounded-execution acceptance fixture (Phase F repair,
 * operator-directed 2026-08-16).
 *
 * The operator required proof of ten specific properties BEFORE the expensive
 * live Crystal 2.0 pack is ever re-run through DevOn, plus mutation-style
 * boundary tests on the max-turns/escalation and validation-order logic
 * specifically (the two places a silent off-by-one or reordering would
 * reopen the exact defects the forensic audit found). This file is the
 * fixture: no live CI dispatch, no network call — every property is checked
 * against the real modules and the real workflow source, deterministically.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { routeExecution, type RoutingInput } from '@/services/constitutional/executionRouting';
import { evaluateBudget, DEFAULT_EXECUTION_BUDGETS } from '@/services/constitutional/executionBudget';
import { deriveForbiddenFiles } from '@/services/constitutional/protectedFiles';
import { anthropicClaudeCodeAdapter } from '@/services/constitutional/actors/anthropicClaudeCodeAdapter';

const REPO = path.join(__dirname, '..');
const WORKFLOW_PATH = path.join(REPO, '.github', 'workflows', 'claude-implement.yml');
const workflowSource = fs.readFileSync(WORKFLOW_PATH, 'utf8');
const workflowYaml = yaml.load(workflowSource) as any;
const claudeStep = workflowYaml.jobs.implement.steps.find((s: any) => s.id === 'claude');

const routineInput: RoutingInput = {
  areasToTouch: ['services/foo/bar.ts'],
  forbiddenFiles: deriveForbiddenFiles(),
  preflight: { disposition: 'proceed', risk: { score: 10 } },
};

describe('1 — model is explicitly reported, never left to an implicit default', () => {
  it('the selected route always names a concrete model string', () => {
    const route = routeExecution(routineInput, false);
    expect(typeof route.model).toBe('string');
    expect(route.model.length).toBeGreaterThan(0);
  });

  it('the dispatch payload carries the route\'s model verbatim', async () => {
    const fetchSpy = vi.fn(async () => ({ status: 204, text: async () => '' }) as any);
    vi.stubGlobal('fetch', fetchSpy);
    process.env.GITHUB_TOKEN = 'test-token';
    const route = routeExecution(routineInput, false);
    await anthropicClaudeCodeAdapter.dispatch({
      pack: { id: 'p', goal: 'g', forbiddenFiles: [], knownBaselineFailures: [] },
      packMarkdown: '# pack',
      branch: 'aigentz/pack-p-00000000',
      route,
    });
    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.client_payload.model).toBe(route.model);
    vi.unstubAllGlobals();
    delete process.env.GITHUB_TOKEN;
  });

  it('the workflow templates --model from the routed value, not a hardcoded string', () => {
    expect(claudeStep.with.claude_args).toMatch(/--model \$\{\{\s*steps\.route\.outputs\.route_model\s*\}\}/);
  });
});

describe('2 — maxTurns is present in the payload and mapped to the real --max-turns flag', () => {
  it('the dispatch payload carries maxTurns from the route budget', async () => {
    const fetchSpy = vi.fn(async () => ({ status: 204, text: async () => '' }) as any);
    vi.stubGlobal('fetch', fetchSpy);
    process.env.GITHUB_TOKEN = 'test-token';
    const route = routeExecution(routineInput, false);
    await anthropicClaudeCodeAdapter.dispatch({
      pack: { id: 'p', goal: 'g', forbiddenFiles: [], knownBaselineFailures: [] },
      packMarkdown: '# pack',
      branch: 'aigentz/pack-p-00000000',
      route,
    });
    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.client_payload.maxTurns).toBe(route.budget.maxTurns);
    vi.unstubAllGlobals();
    delete process.env.GITHUB_TOKEN;
  });

  it('the workflow templates --max-turns from the routed value', () => {
    expect(claudeStep.with.claude_args).toMatch(/--max-turns \$\{\{\s*steps\.route\.outputs\.route_max_turns\s*\}\}/);
  });

  it('enforced: evaluateBudget flags maxTurns exceeded when turns exceed the budget', () => {
    const evalu = evaluateBudget(DEFAULT_EXECUTION_BUDGETS.routine, {
      turns: DEFAULT_EXECUTION_BUDGETS.routine.maxTurns + 1,
      wallClockMinutes: 1,
      validationPasses: 0,
      contextExpansionEvents: 0,
    });
    expect(evalu.exceeded).toContain('maxTurns');
  });
});

describe('3 — a narrow pack does not require reading full CLAUDE.md', () => {
  it('the prompt no longer mandates an unconditional CLAUDE.md read', () => {
    const prompt = claudeStep.with.prompt as string;
    expect(prompt).not.toMatch(/Read CLAUDE\.md at the repo root FIRST/);
    expect(prompt).toMatch(/do not\s*\n?\s*re-read\s*\n?\s*CLAUDE\.md/i);
  });

  it('forbidden files and baseline failures are embedded in the dispatch payload instead', () => {
    expect(claudeStep.with.prompt).toMatch(/forbiddenFiles/);
    expect(claudeStep.with.prompt).toMatch(/knownBaselineFailures/);
  });
});

describe('4 — declared (non-forbidden) files remain accessible', () => {
  it('deriveForbiddenFiles() protects everything by default but releases an explicitly authorized file', () => {
    const authorized = 'services/identity/getActivePersona.ts';
    const fullyForbidden = deriveForbiddenFiles();
    const withAuthorization = deriveForbiddenFiles([authorized]);
    expect(fullyForbidden).toContain(authorized);
    expect(withAuthorization).not.toContain(authorized);
    // Every OTHER protected file stays forbidden — authorization is per-file,
    // never a blanket release.
    const others = fullyForbidden.filter((f) => f !== authorized);
    for (const f of others) expect(withAuthorization).toContain(f);
  });

  it('a pack whose areasToTouch stay outside forbiddenFiles resolves to a non-protected profile', () => {
    const route = routeExecution(routineInput, false);
    expect(route.profile).not.toBe('protected');
  });
});

describe('5 — unrelated exploration requires an explicit, recorded expansion', () => {
  it('the prompt requires a named "Scope expansions" section rather than silent exploration', () => {
    const prompt = claudeStep.with.prompt as string;
    expect(prompt).toMatch(/Scope expansions/);
    expect(prompt).toMatch(/never expand silently/i);
  });
});

describe('6 — targeted validation runs before full regression', () => {
  it('the template validation ladder orders touched-surface checks ahead of full regression', async () => {
    const { generateImplementationPack } = await import('@/services/constitutional/implementationPack');
    const pack = await generateImplementationPack({ goal: 'a narrow test goal with no LLM available' });
    const ladder = pack.validationPlan;
    const fullRegressionIndex = ladder.findIndex((s) => /full regression/i.test(s));
    const touchedSurfaceIndex = ladder.findIndex((s) => /touched files|touched-surface/i.test(s));
    expect(fullRegressionIndex).toBeGreaterThan(-1);
    expect(touchedSurfaceIndex).toBeGreaterThan(-1);
    expect(touchedSurfaceIndex).toBeLessThan(fullRegressionIndex);
  });

  it('the unscoped "existing test suite" fallback is gone', async () => {
    const { generateImplementationPack } = await import('@/services/constitutional/implementationPack');
    const pack = await generateImplementationPack({ goal: 'a narrow test goal with no LLM available' });
    expect(pack.validationPlan.join(' ')).not.toMatch(/^existing test suite$/i);
    expect(pack.validationPlan).not.toContain('existing test suite');
  });
});

describe('7 — full regression runs at most once, at the final gate', () => {
  it('the ladder names full regression exactly once and marks it as the final gate', async () => {
    const { generateImplementationPack } = await import('@/services/constitutional/implementationPack');
    const pack = await generateImplementationPack({ goal: 'a narrow test goal with no LLM available' });
    const fullRegressionEntries = pack.validationPlan.filter((s) => /full regression/i.test(s));
    expect(fullRegressionEntries).toHaveLength(1);
    expect(fullRegressionEntries[0]).toMatch(/exactly once/i);
    expect(fullRegressionEntries[0]).toMatch(/final/i);
  });

  it('the prompt itself instructs at-most-once full regression, never a per-step habit', () => {
    expect(claudeStep.with.prompt).toMatch(/AT MOST\s*\n?\s*ONCE/i);
  });
});

describe('8 — gh pr list is allowed, closing the evidenced permission-denial gap', () => {
  it('the allowedTools list grants gh pr list and gh pr comment', () => {
    expect(claudeStep.with.claude_args).toMatch(/Bash\(gh pr list:\*\)/);
    expect(claudeStep.with.claude_args).toMatch(/Bash\(gh pr comment:\*\)/);
  });

  it('the prompt directs Claude to check for an existing PR via gh pr list before creating one', () => {
    expect(claudeStep.with.prompt).toMatch(/gh pr list --head/);
  });
});

describe('9 — budget exhaustion yields awaiting-escalation, never another autonomous invocation', () => {
  it('exceeding any single budget dimension resolves to awaiting-escalation', () => {
    const budget = DEFAULT_EXECUTION_BUDGETS.routine;
    const overTurns = evaluateBudget(budget, { turns: budget.maxTurns + 1, wallClockMinutes: 1, validationPasses: 0, contextExpansionEvents: 0 });
    const overWallClock = evaluateBudget(budget, { turns: 1, wallClockMinutes: budget.maxWallClockMinutes + 1, validationPasses: 0, contextExpansionEvents: 0 });
    const overValidation = evaluateBudget(budget, { turns: 1, wallClockMinutes: 1, validationPasses: budget.maxValidationPasses + 1, contextExpansionEvents: 0 });
    const overExpansion = evaluateBudget(budget, { turns: 1, wallClockMinutes: 1, validationPasses: 0, contextExpansionEvents: budget.maxContextExpansionEvents + 1 });
    expect(overTurns.state).toBe('awaiting-escalation');
    expect(overWallClock.state).toBe('awaiting-escalation');
    expect(overValidation.state).toBe('awaiting-escalation');
    expect(overExpansion.state).toBe('awaiting-escalation');
  });

  it('the telemetry callback source never re-dispatches or invokes another implementation run on escalation', () => {
    const telemetrySrc = fs.readFileSync(
      path.join(REPO, 'app', 'api', 'dev-command-center', 'implement', 'telemetry', 'route.ts'),
      'utf8',
    );
    expect(telemetrySrc).not.toMatch(/repository_dispatch/);
    expect(telemetrySrc).not.toMatch(/dispatch\(/);
    expect(telemetrySrc).toMatch(/awaiting-escalation/);
  });
});

describe('10 — human merge remains untouched by any part of this repair', () => {
  it('the workflow explicitly forbids merging, pushing to dev/main, or enabling auto-merge', () => {
    const prompt = claudeStep.with.prompt as string;
    expect(prompt).toMatch(/NEVER push to dev or main directly/);
    expect(prompt).toMatch(/NEVER merge the PR/);
    expect(prompt).toMatch(/NEVER\s*\n?\s*enable auto-merge/);
  });

  it('the working branch stays under aigentz/pack-* — never claude/** (which auto-merges to dev)', () => {
    const createBranchStep = workflowYaml.jobs.implement.steps.find((s: any) => s.name === 'Create working branch');
    expect(createBranchStep.run).toMatch(/aigentz\/pack-\*/);
  });

  it('neither the dispatch route nor the telemetry route ever calls a PR-merge API', () => {
    const dispatchSrc = fs.readFileSync(
      path.join(REPO, 'app', 'api', 'dev-command-center', 'implement', 'route.ts'),
      'utf8',
    );
    const telemetrySrc = fs.readFileSync(
      path.join(REPO, 'app', 'api', 'dev-command-center', 'implement', 'telemetry', 'route.ts'),
      'utf8',
    );
    for (const src of [dispatchSrc, telemetrySrc]) {
      expect(src).not.toMatch(/merge_pull_request/);
      expect(src).not.toMatch(/pulls\/\d*\/?merge/);
      expect(src).not.toMatch(/enable[_-]?auto[_-]?merge/i);
    }
  });
});

describe('Mutation-focused boundary tests — max-turns/escalation', () => {
  it('turns exactly AT the ceiling does NOT exceed (proves ">" not ">=")', () => {
    const budget = DEFAULT_EXECUTION_BUDGETS.routine;
    const atCeiling = evaluateBudget(budget, { turns: budget.maxTurns, wallClockMinutes: 1, validationPasses: 0, contextExpansionEvents: 0 });
    expect(atCeiling.exceeded).not.toContain('maxTurns');
    expect(atCeiling.state).toBe('proceeding');
  });

  it('turns one OVER the ceiling exceeds (proves the boundary is enforced, not off-by-one in the other direction)', () => {
    const budget = DEFAULT_EXECUTION_BUDGETS.routine;
    const overCeiling = evaluateBudget(budget, { turns: budget.maxTurns + 1, wallClockMinutes: 1, validationPasses: 0, contextExpansionEvents: 0 });
    expect(overCeiling.exceeded).toEqual(['maxTurns']);
    expect(overCeiling.state).toBe('awaiting-escalation');
  });

  it('multiple simultaneous exceedances all surface — proves no early-return after the first check', () => {
    const budget = DEFAULT_EXECUTION_BUDGETS.routine;
    const allOver = evaluateBudget(budget, {
      turns: budget.maxTurns + 1,
      wallClockMinutes: budget.maxWallClockMinutes + 1,
      validationPasses: budget.maxValidationPasses + 1,
      contextExpansionEvents: budget.maxContextExpansionEvents + 1,
    });
    expect(allOver.exceeded.sort()).toEqual(
      ['maxContextExpansionEvents', 'maxTurns', 'maxValidationPasses', 'maxWallClockMinutes'].sort(),
    );
  });

  it('a null (unobserved) counter never falsely triggers escalation', () => {
    const budget = DEFAULT_EXECUTION_BUDGETS.routine;
    const unobserved = evaluateBudget(budget, { turns: null, wallClockMinutes: null, validationPasses: 0, contextExpansionEvents: 0 });
    expect(unobserved.state).toBe('proceeding');
    expect(unobserved.exceeded).toEqual([]);
  });
});

describe('Mutation-focused boundary tests — validation-order', () => {
  it('the ladder has exactly four rungs in the exact operator-specified order', async () => {
    const { generateImplementationPack } = await import('@/services/constitutional/implementationPack');
    const pack = await generateImplementationPack({ goal: 'a narrow test goal with no LLM available' });
    expect(pack.validationPlan).toHaveLength(4);
    expect(pack.validationPlan[0]).toMatch(/typecheck|parse/i);
    expect(pack.validationPlan[1]).toMatch(/targeted canaries/i);
    expect(pack.validationPlan[2]).toMatch(/affected-subsystem/i);
    expect(pack.validationPlan[3]).toMatch(/full regression/i);
  });

  it('reordering rung 0 and rung 3 would be caught (index-anchored, not substring-anchored)', async () => {
    const { generateImplementationPack } = await import('@/services/constitutional/implementationPack');
    const pack = await generateImplementationPack({ goal: 'a narrow test goal with no LLM available' });
    // The FIRST rung must never be the full-regression rung — this is the
    // exact shape the pre-fix template defect had (an unscoped, unstaged
    // 'existing test suite' as the ONLY entry, functionally equivalent to
    // full regression running first and only).
    expect(pack.validationPlan[0]).not.toMatch(/full regression/i);
  });
});
