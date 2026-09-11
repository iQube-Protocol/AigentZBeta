/**
 * ImplementationActorAdapter — the provider-neutral seam between "an
 * Implementation Pack has been approved" and "some actor executes it"
 * (Phase F bounded-execution repair, operator-directed 2026-08-16).
 *
 * Canonized finding this seam exists to honor: capabilities become
 * constitutional; vendors remain interchangeable. DevOn/IDE select an
 * `ExecutionRoute` (`services/constitutional/executionRouting.ts`) from the
 * pack's own risk/uncertainty/protected-surface/prior-failure signals — pure
 * domain reasoning that names a PROFILE, never a vendor. This module is the
 * ONLY place a profile's route becomes a concrete provider call.
 *
 * `anthropics/claude-code-action@v1` (the live CI transport this whole
 * workstream audited) is the first and, for now, only LIVE adapter
 * (`anthropicClaudeCodeAdapter.ts`). Every other provider named in
 * `IMPLEMENTATION_ACTOR_PROVIDERS` (executionRouting.ts) is a STUB here —
 * `isConfigured()` returns false, `dispatch()` fails immediately with an
 * explicit routing error, BEFORE any spend, never a silent no-op and never a
 * speculative integration built ahead of real credentials/harness (operator
 * instruction: "stub provider plurality now, integrate only Anthropic now").
 *
 * No new domain logic anywhere in this codebase should depend on a
 * `claude-*` identifier directly — callers select via `ExecutionRoute`
 * (provider + model), never by importing `anthropicClaudeCodeAdapter`
 * by name outside this registry.
 */

import type { ExecutionRoute, ImplementationActorProvider } from '@/services/constitutional/executionRouting';
import { anthropicClaudeCodeAdapter } from '@/services/constitutional/actors/anthropicClaudeCodeAdapter';

/**
 * The exact subset of `ImplementationPack` a dispatch needs — deliberately
 * NOT the full type. The dispatch route (`app/api/dev-command-center/
 * implement/route.ts`) never holds a full, server-regenerated
 * `ImplementationPack` (packs are generated once, client-side-held, and
 * dispatched from their rendered markdown — no server-side pack store
 * exists today); it reconstructs exactly these fields itself
 * (`forbiddenFiles` always server-derived, never client-trusted).
 */
export interface DispatchablePack {
  id: string;
  goal: string;
  forbiddenFiles: string[];
  knownBaselineFailures: string[];
}

export interface ImplementationActorDispatchInput {
  pack: DispatchablePack;
  packMarkdown: string;
  /** The CI working branch this pack's implementation lands on. */
  branch: string;
  route: ExecutionRoute;
}

export interface ImplementationActorDispatchResult {
  ok: boolean;
  dispatched: boolean;
  provider: ImplementationActorProvider;
  /** Human-readable outcome detail (success note, or why it failed). */
  detail?: string;
  /** Set only on failure — an explicit, named routing/dispatch error, never
   *  a caller having to infer failure from a missing field. */
  error?: string;
}

export interface ImplementationActorAdapter {
  readonly provider: ImplementationActorProvider;
  /** Whether this adapter has real credentials/harness wired. A stub always
   *  returns false — callers MUST check this before assuming `dispatch()`
   *  will do anything, and `dispatch()` itself re-checks it defensively. */
  isConfigured(): boolean;
  /** Fire the dispatch. MUST fail before any spend when `!isConfigured()` —
   *  the hard constraint this whole contract exists to make structurally
   *  true, not just documented. */
  dispatch(input: ImplementationActorDispatchInput): Promise<ImplementationActorDispatchResult>;
}

/**
 * A provider with no live harness — `isConfigured()` is always false, and
 * `dispatch()` never attempts a network call. One factory, reused for every
 * currently-stubbed provider, so "not configured" behaves identically
 * regardless of which future provider it names (canary requirement:
 * "an unavailable provider fails before spend, with an explicit routing
 * error").
 */
function stubAdapter(provider: ImplementationActorProvider): ImplementationActorAdapter {
  return {
    provider,
    isConfigured: () => false,
    async dispatch(): Promise<ImplementationActorDispatchResult> {
      return {
        ok: false,
        dispatched: false,
        provider,
        error: 'not-configured',
        detail: `No implementation-actor adapter is wired for '${provider}' yet — credentials/harness not supplied. Stub only, per Phase F scope.`,
      };
    },
  };
}

/**
 * The registry: provider identifier → adapter. The ONLY function any caller
 * (the dispatch route, tests, future callers) should use to obtain an
 * adapter — never import a concrete adapter class directly.
 */
export function getImplementationActorAdapter(provider: ImplementationActorProvider): ImplementationActorAdapter {
  switch (provider) {
    case 'anthropic-claude-code':
      return anthropicClaudeCodeAdapter;
    case 'openai-codex':
    case 'google-jules':
      return stubAdapter(provider);
  }
}
