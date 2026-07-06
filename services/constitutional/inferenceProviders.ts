/**
 * Constitutional Inference Providers — the provider abstraction (CFS-015,
 * Strand Two, Phase 2).
 *
 * Providers contribute INFERENCE ONLY (CFS-015): no provider holds identity,
 * memory, or constitutional state — those live in the platform's own organs.
 * The sovereign fallback is the open-weight provider (venice): sovereignty
 * survives any frontier provider becoming unreachable.
 *
 * Real adapters WRAP services/experiments/llm.ts callChatWithUsage (the
 * usage-instrumented, allowlist-disciplined, timeout-hardened caller) — they
 * never fork the provider chain. Deferred providers (gemini, codex) are
 * honest stubs: `{ evaluated: false, reason }` per the CFS-014 precedent,
 * never fabricated output.
 *
 * Server-only.
 */

import {
  callChatWithUsage,
  providerAvailable,
  type ExperimentProvider,
} from '@/services/experiments/llm';
import type { MaybeEvaluated } from '@/types/constitutional';

export interface ConstitutionalInferenceInput {
  system: string;
  user: string;
  maxTokens?: number;
  model?: string;
}

export interface ConstitutionalInferenceResult {
  text: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface ConstitutionalInferenceProvider {
  id: string;
  kind: 'frontier' | 'open-weight';
  available(): boolean;
  infer(
    input: ConstitutionalInferenceInput,
  ): Promise<MaybeEvaluated<ConstitutionalInferenceResult>>;
}

/**
 * Real adapter over the existing provider chain. `infer` reports honestly:
 * `{ evaluated: true, ... }` on success, `{ evaluated: false, reason }` on a
 * thrown provider error — it never rethrows and never fabricates output.
 */
function realAdapter(
  id: ExperimentProvider,
  kind: 'frontier' | 'open-weight',
): ConstitutionalInferenceProvider {
  return {
    id,
    kind,
    available: () => providerAvailable(id),
    async infer(input) {
      try {
        const result = await callChatWithUsage(
          id,
          input.system,
          input.user,
          input.maxTokens ?? 1000,
          input.model,
        );
        return {
          evaluated: true,
          text: result.text,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        };
      } catch (err) {
        return {
          evaluated: false,
          reason: `${id}: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  };
}

/** Honest stub for a provider slot whose adapter is not yet implemented. */
function stubAdapter(id: string, kind: 'frontier' | 'open-weight'): ConstitutionalInferenceProvider {
  return {
    id,
    kind,
    available: () => false,
    infer: async () => ({
      evaluated: false,
      reason: 'provider adapter not implemented — CFS-015 Strand Two Phase Two slot',
    }),
  };
}

/**
 * All five provider slots. Order is informational, not a fallback ladder —
 * ladder discipline lives in the Model Router (modelRouter.ts), which always
 * terminates at the open-weight provider.
 */
export const CONSTITUTIONAL_PROVIDERS: ConstitutionalInferenceProvider[] = [
  realAdapter('anthropic', 'frontier'),
  realAdapter('openai', 'frontier'),
  realAdapter('venice', 'open-weight'),
  stubAdapter('gemini', 'frontier'),
  stubAdapter('codex', 'frontier'),
];

export function getProvider(id: string): ConstitutionalInferenceProvider | null {
  return CONSTITUTIONAL_PROVIDERS.find((p) => p.id === id) ?? null;
}
