/**
 * Model Router v1 — per-STAGE provider/model routing (CFS-015, Strand One).
 *
 * Each reasoning stage of the constitutional pipeline is independently
 * routable. The router WRAPS the existing provider chain — it never forks it:
 * calls execute through services/experiments/llm.ts callChatWithUsage (the
 * platform's usage-instrumented, allowlist-disciplined, timeout-hardened
 * caller, env-name-identical to llmDraftHelper).
 *
 * Sovereign-survivability contract (CFS-015 principle 4): the fallback
 * ladder always terminates at the open-weight provider (venice). A routed
 * call may DEGRADE to a fallback provider — flagged, receipted by callers —
 * but it does not constitutionally fail while any provider is reachable.
 *
 * Route configuration:
 *   1. Per-stage defaults below (allowlist-validated at module init).
 *   2. Env override per stage: CONSTITUTIONAL_ROUTE_<STAGE>=provider:model
 *      (e.g. CONSTITUTIONAL_ROUTE_CONSEQUENCE=anthropic:claude-sonnet-4-6).
 *      Invalid overrides are ignored with a warning — never guessed through.
 *   3. ModelQube-driven routes (agentLlmOrchestra precedent) are the Phase 2
 *      config source; the `source: 'modelqube'` slot is reserved for it.
 *
 * Server-only.
 */

import {
  EXPERIMENT_PROVIDERS,
  callChatWithUsage,
  isAllowedExperimentModel,
  providerAvailable,
  type ExperimentProvider,
} from '@/services/experiments/llm';
import type {
  ConstitutionalProviderId,
  ModelRouter,
  ReasoningStage,
  RoutedCallResult,
  StageRoute,
} from '@/types/constitutional';
import { REASONING_STAGES } from '@/types/constitutional';
import { resolveModelQubeRoute } from '@/services/constitutional/modelQube';

// Per-stage defaults: cheap/fast models for mechanical stages, stronger
// models where the reasoning is consequence-bearing. Every id is on the
// per-provider allowlist (EXPERIMENT_MODEL_OPTIONS).
const DEFAULT_ROUTES: Record<ReasoningStage, { provider: ConstitutionalProviderId; model: string }> = {
  intent: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  context: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  capability: { provider: 'openai', model: 'gpt-4o-mini' },
  risk: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  value: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  price: { provider: 'openai', model: 'gpt-4o-mini' },
  consequence: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  validation: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
};

// Fallback ladder order — ALWAYS terminates at venice (open-weight, the
// sovereign fallback). A provider is only attempted if its key is configured.
const FALLBACK_LADDER: ConstitutionalProviderId[] = ['anthropic', 'openai', 'venice'];

function envOverrideFor(stage: ReasoningStage): { provider: ConstitutionalProviderId; model: string } | null {
  const raw = process.env[`CONSTITUTIONAL_ROUTE_${stage.toUpperCase()}`];
  if (!raw) return null;
  const [provider, ...modelParts] = raw.split(':');
  const model = modelParts.join(':');
  if (!provider || !model || !(provider in EXPERIMENT_PROVIDERS)) {
    console.warn(`[ModelRouter] ignoring invalid route override for ${stage}: '${raw}'`);
    return null;
  }
  if (!isAllowedExperimentModel(provider as ExperimentProvider, model)) {
    console.warn(`[ModelRouter] ignoring off-allowlist route override for ${stage}: '${raw}'`);
    return null;
  }
  return { provider: provider as ConstitutionalProviderId, model };
}

export function routeFor(stage: ReasoningStage): StageRoute {
  // 1. Operator env override — highest precedence, unchanged.
  const override = envOverrideFor(stage);
  if (override) return { stage, ...override, source: 'override' };
  // 2. ModelQube-driven route (CFS-015 Phase 2): the routing decision is
  //    constitutional data — object-model-driven, standing-ranked, invariant-
  //    citing, provider-sovereign. The seed registry mirrors DEFAULT_ROUTES, so
  //    the target is unchanged today; the mechanism is now invariant-aware.
  const mq = resolveModelQubeRoute(stage);
  if (mq) {
    return {
      stage,
      provider: mq.provider,
      model: mq.model,
      source: 'modelqube',
      governingInvariants: mq.governingInvariants,
      sovereignFloor: mq.sovereignFloor,
    };
  }
  // 3. Literal default — defensive fallback if no ModelQube is fit for a stage.
  const def = DEFAULT_ROUTES[stage];
  return { stage, ...def, source: 'default' };
}

/**
 * Execute one stage call: routed target first, then down the fallback
 * ladder (skipping unconfigured providers), each fallback using that
 * provider's platform default draft model. `degraded: true` marks any
 * result that did not come from the routed target.
 */
export async function callStage(
  stage: ReasoningStage,
  system: string,
  user: string,
  maxTokens = 1000,
): Promise<RoutedCallResult> {
  const route = routeFor(stage);
  const attempts: { provider: ConstitutionalProviderId; model?: string }[] = [
    { provider: route.provider, model: route.model },
    ...FALLBACK_LADDER.filter((p) => p !== route.provider).map((p) => ({ provider: p })),
  ];

  const errors: string[] = [];
  for (let i = 0; i < attempts.length; i += 1) {
    const attempt = attempts[i];
    if (!providerAvailable(attempt.provider)) {
      errors.push(`${attempt.provider}: not configured`);
      continue;
    }
    try {
      const result = await callChatWithUsage(
        attempt.provider,
        system,
        user,
        maxTokens,
        attempt.model,
      );
      const degraded = i > 0;
      if (degraded) {
        console.warn(
          `[ModelRouter] stage=${stage} degraded to ${attempt.provider}/${result.model} (routed target ${route.provider}/${route.model} failed: ${errors[errors.length - 1] ?? 'error'})`,
        );
      }
      return {
        text: result.text,
        provider: attempt.provider,
        model: result.model,
        degraded,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      };
    } catch (err) {
      errors.push(`${attempt.provider}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  // Constitutional failure — only when NO provider is reachable.
  throw new Error(`[ModelRouter] stage=${stage}: all providers failed — ${errors.join(' | ')}`);
}

/** Object form of the contract, for injection into pipeline stages. */
export const modelRouter: ModelRouter = {
  routeFor,
  call: callStage,
};

/** Every stage's current route — for diagnostics and the failover drill. */
export function describeRoutes(): StageRoute[] {
  return REASONING_STAGES.map((stage) => routeFor(stage));
}
