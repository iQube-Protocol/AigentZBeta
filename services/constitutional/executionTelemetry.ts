/**
 * Execution telemetry — the observation ledger for an implementation
 * actor's run (Phase F bounded-execution repair, operator-directed
 * 2026-08-16).
 *
 * "This telemetry is an observation ledger, not the primary live governor"
 * (operator instruction) — `evaluateBudget`
 * (`services/constitutional/executionBudget.ts`) is the governor; this
 * module only EXTRACTS what happened, from whatever result payload a
 * provider's transport produces, and records it durably via the existing
 * receipt framework. Never a second measurement mechanism: the shape parsed
 * here is exactly the terminal JSON `anthropics/claude-code-action@v1`
 * already writes today (confirmed live, 2026-08-16 forensic audit — two
 * real failed runs both produced this exact shape) — this module reads it,
 * it does not invent a new one.
 *
 * Deliberately provider-agnostic in its OUTPUT shape (`ExecutionTelemetry`)
 * even though today's only parser (`extractClaudeCodeTelemetry`) knows one
 * provider's result JSON — a future adapter's own parser normalizes into the
 * SAME `ExecutionTelemetry` shape, so callers (the budget check, the
 * receipt writer) never need to know which provider produced it.
 */

import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import type { ImplementationActorProvider } from '@/services/constitutional/executionRouting';
import type { ObservedExecutionCounters } from '@/services/constitutional/executionBudget';

export interface ExecutionTelemetry {
  provider: ImplementationActorProvider;
  /** The model that actually ran — closes the forensic audit's "unpinned
   *  default" finding by recording ground truth, not the requested model. */
  model: string | null;
  turns: number | null;
  wallClockMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheCreationInputTokens: number | null;
  cacheReadInputTokens: number | null;
  observedCostUsd: number | null;
  permissionDenialsCount: number;
  terminalReason: string | null;
}

/**
 * Parse the Claude Code CLI's terminal result JSON — the SAME shape
 * confirmed live in both forensic-audit runs (`type: 'result'`, carrying
 * `num_turns`, `duration_ms`, `total_cost_usd`, `usage`, `modelUsage`,
 * `permission_denials`, `terminal_reason`). Defensive throughout: an
 * unexpected/malformed shape degrades to nulls, never throws — a
 * misshapen telemetry payload must not fail the run it is only OBSERVING.
 */
export function extractClaudeCodeTelemetry(resultJson: unknown): ExecutionTelemetry {
  const empty: ExecutionTelemetry = {
    provider: 'anthropic-claude-code',
    model: null,
    turns: null,
    wallClockMs: null,
    inputTokens: null,
    outputTokens: null,
    cacheCreationInputTokens: null,
    cacheReadInputTokens: null,
    observedCostUsd: null,
    permissionDenialsCount: 0,
    terminalReason: null,
  };
  if (!resultJson || typeof resultJson !== 'object') return empty;
  const r = resultJson as Record<string, unknown>;

  const usage = (r.usage && typeof r.usage === 'object' ? (r.usage as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >;
  const modelUsage = r.modelUsage && typeof r.modelUsage === 'object' ? (r.modelUsage as Record<string, unknown>) : {};
  const modelKeys = Object.keys(modelUsage);
  // modelUsage is keyed by the model id that actually ran — there is
  // exactly one key in every observed run; take the first defensively
  // rather than assume.
  const observedModel = modelKeys.length > 0 ? modelKeys[0] : null;
  const modelStats =
    observedModel && typeof modelUsage[observedModel] === 'object'
      ? (modelUsage[observedModel] as Record<string, unknown>)
      : null;

  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  return {
    provider: 'anthropic-claude-code',
    model: observedModel,
    turns: num(r.num_turns),
    wallClockMs: num(r.duration_ms),
    inputTokens: num(usage.input_tokens) ?? (modelStats ? num(modelStats.inputTokens) : null),
    outputTokens: num(usage.output_tokens) ?? (modelStats ? num(modelStats.outputTokens) : null),
    cacheCreationInputTokens:
      num(usage.cache_creation_input_tokens) ?? (modelStats ? num(modelStats.cacheCreationInputTokens) : null),
    cacheReadInputTokens: num(usage.cache_read_input_tokens) ?? (modelStats ? num(modelStats.cacheReadInputTokens) : null),
    observedCostUsd: num(r.total_cost_usd) ?? (modelStats ? num(modelStats.costUSD) : null),
    permissionDenialsCount: Array.isArray(r.permission_denials) ? r.permission_denials.length : 0,
    terminalReason: typeof r.terminal_reason === 'string' ? r.terminal_reason : null,
  };
}

/** Telemetry → the counters `evaluateBudget` compares against a pack's
 *  `executionRoute.budget`. `validationPasses`/`contextExpansionEvents`
 *  are NOT observable from this result JSON alone today (the CLI's result
 *  does not distinguish a validation tool-call from any other) — they
 *  default to 0, an honest "not observed" rather than a guess, until a
 *  future increment can count them from the full tool-call stream. */
export function toObservedExecutionCounters(telemetry: ExecutionTelemetry): ObservedExecutionCounters {
  return {
    turns: telemetry.turns,
    wallClockMinutes: telemetry.wallClockMs !== null ? telemetry.wallClockMs / 60000 : null,
    validationPasses: 0,
    contextExpansionEvents: 0,
  };
}

/**
 * Persist telemetry via the existing receipt framework — best-effort, never
 * gates anything. T0-safe: no persona/root/kybe identifiers, just the
 * public packId/branch and the numeric/string observation fields.
 */
export async function recordExecutionTelemetry(input: {
  actingPersonaId: string;
  packId: string;
  branch: string;
  executionState: 'proceeding' | 'awaiting-escalation' | 'complete';
  telemetry: ExecutionTelemetry;
}): Promise<string | null> {
  try {
    const receipt = await createActivityReceipt({
      personaId: input.actingPersonaId,
      activeCartridge: 'agentiq',
      actionType: 'implementation_execution_observed',
      summary:
        `Implementation pack ${input.packId} — execution observed on ${input.branch}: ` +
        `${input.telemetry.provider}/${input.telemetry.model ?? 'unknown model'}, ` +
        `${input.telemetry.turns ?? '?'} turns, ${input.executionState}.`,
      actionInput: {
        pack_id: input.packId,
        branch: input.branch,
        execution_state: input.executionState,
        provider: input.telemetry.provider,
        model: input.telemetry.model,
        turns: input.telemetry.turns,
        wall_clock_ms: input.telemetry.wallClockMs,
        input_tokens: input.telemetry.inputTokens,
        output_tokens: input.telemetry.outputTokens,
        cache_creation_input_tokens: input.telemetry.cacheCreationInputTokens,
        cache_read_input_tokens: input.telemetry.cacheReadInputTokens,
        observed_cost_usd: input.telemetry.observedCostUsd,
        permission_denials_count: input.telemetry.permissionDenialsCount,
        terminal_reason: input.telemetry.terminalReason,
      },
    });
    return receipt?.id ?? null;
  } catch {
    // Observation ledger, never a gate — a failed write here must not fail
    // the caller.
    return null;
  }
}
