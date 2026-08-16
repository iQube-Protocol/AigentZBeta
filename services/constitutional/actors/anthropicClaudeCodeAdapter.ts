/**
 * The live `ImplementationActorAdapter` for the CI transport this whole
 * Phase F workstream audited: `anthropics/claude-code-action@v1`, fired via
 * a GitHub `repository_dispatch` (event_type `claude-implement`) that
 * `.github/workflows/claude-implement.yml` receives.
 *
 * Encapsulates EXACTLY the `repository_dispatch` fetch call that used to
 * live inline in `app/api/dev-command-center/implement/route.ts` — moved
 * here so the route calls `getImplementationActorAdapter(route.provider)`
 * instead of knowing GitHub's dispatch API directly; no behavior change to
 * the dispatch itself beyond the new bounded-execution payload fields
 * (`model`, `executionProfile`, `maxTurns`, `forbiddenFiles`,
 * `knownBaselineFailures`) the rewritten workflow now reads.
 *
 * Transport fix (2026-08-18): GitHub's `repository_dispatch` API allows at
 * most 10 top-level properties in `client_payload`. The flat Phase F shape
 * had grown to 12 (packId, goal, branch, packMarkdown, model,
 * executionProfile, maxTurns, maxWallClockMinutes, maxValidationPasses,
 * maxContextExpansionEvents, forbiddenFiles, knownBaselineFailures) —
 * confirmed as the direct cause of a live `dispatch_failed_422`. The
 * bounded-execution fields are now nested under `execution`/`constraints`
 * (6 top-level keys total), carrying the exact same data — the workflow's
 * materialize step reads the nested shape.
 */

import {
  GITHUB_REPO,
  githubConfigured,
} from '@/app/api/dev-command-center/_lib/github';
import type {
  ImplementationActorAdapter,
  ImplementationActorDispatchInput,
  ImplementationActorDispatchResult,
} from '@/services/constitutional/actors/implementationActorAdapter';

export const anthropicClaudeCodeAdapter: ImplementationActorAdapter = {
  provider: 'anthropic-claude-code',

  isConfigured(): boolean {
    return githubConfigured();
  },

  async dispatch(input: ImplementationActorDispatchInput): Promise<ImplementationActorDispatchResult> {
    if (!githubConfigured()) {
      return {
        ok: false,
        dispatched: false,
        provider: 'anthropic-claude-code',
        error: 'not-configured',
        detail: 'GITHUB_TOKEN is not set on this server — cannot fire repository_dispatch.',
      };
    }

    const { pack, packMarkdown, branch, route } = input;

    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'claude-implement',
        // 6 top-level keys — well under GitHub's 10-property client_payload
        // ceiling. Bounded-execution fields are nested (execution/
        // constraints), never re-derived by the CI actor itself; the
        // rewritten workflow's materialize step reads this exact shape.
        client_payload: {
          packId: pack.id,
          goal: pack.goal.slice(0, 300),
          branch,
          packMarkdown,
          execution: {
            model: route.model,
            profile: route.profile,
            budget: {
              maxTurns: route.budget.maxTurns,
              maxWallClockMinutes: route.budget.maxWallClockMinutes,
              maxValidationPasses: route.budget.maxValidationPasses,
              maxContextExpansionEvents: route.budget.maxContextExpansionEvents,
            },
          },
          constraints: {
            forbiddenFiles: pack.forbiddenFiles,
            knownBaselineFailures: pack.knownBaselineFailures,
          },
        },
      }),
      cache: 'no-store',
    });

    if (res.status !== 204) {
      const detail = await res.text().catch(() => '');
      return {
        ok: false,
        dispatched: false,
        provider: 'anthropic-claude-code',
        error: `dispatch_failed_${res.status}`,
        detail:
          `GitHub dispatch failed (${res.status}). ` +
          (res.status === 404
            ? 'Common causes: the claude-implement.yml workflow is not on the default branch yet, or GITHUB_TOKEN lacks repo scope.'
            : detail.slice(0, 300)),
      };
    }

    return {
      ok: true,
      dispatched: true,
      provider: 'anthropic-claude-code',
      detail: `Dispatched on ${branch} — model ${route.model} (${route.profile} profile).`,
    };
  },
};
