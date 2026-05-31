/**
 * Capability Gateway — shared pre-flight gather helper.
 *
 * Pattern A enrichment used by every aigentMe entry point that hits an
 * LLM / inference layer: ask-agent (per-specialist) and the aigentMe-
 * direct experience-model surfaces (brief, move-forward, venture-
 * progress).
 *
 * Centralising the call here means:
 *   - One place to read the CAPABILITY_GATEWAY_PREFLIGHT env allowlist.
 *   - One place to build the persona-scope PolicyEnvelope for gathers.
 *   - One place that catches throws so a gateway hiccup never blocks
 *     a user-facing request — gather enriches, never blocks.
 *
 * Returns null when:
 *   - Pre-flight is disabled for this surface.
 *   - No query was provided (nothing to search).
 *   - The gateway denied (insufficient identifiability, forbidden,
 *     surface not allowed, cartridge mismatch, alias service down).
 *   - The adapter failed.
 * In every "null" case the caller proceeds with the original request.
 */

import type { ActivePersonaContext } from '@/types/access';
import { executeCapability } from './execute';
import type { CapabilityClass, PolicyEnvelope } from './types';

export interface PreflightGatherInput {
  persona: ActivePersonaContext;
  /** Surface id checked against CAPABILITY_GATEWAY_PREFLIGHT allowlist. */
  surfaceId: string;
  /** Query / intent string the gather should research. */
  query: string;
  /** Cartridge for the policy envelope's cartridge_scope. */
  cartridge: string;
  /** Optional intent linkage for the receipt. */
  intentId?: string | null;
  /** Capability class — default 'search'. Override for 'read'-style gathers. */
  capability_class?: Extract<CapabilityClass, 'read' | 'search'>;
  /** Tool name — default 'web-search'. Override per surface as more tools land. */
  tool_name?: string;
}

export interface PreflightContext {
  workOrderId: string;
  summary: string;
  policyHash: string;
}

/**
 * Is the Capability Gateway pre-flight gather enabled for this caller?
 * Reads CAPABILITY_GATEWAY_PREFLIGHT:
 *   - unset / 'off' / 'false' / ''  → false (default — production safe)
 *   - 'all' / 'true'                 → true for every caller
 *   - 'kn0w1,brief,move-forward'     → comma-separated allowlist
 *
 * Tokens are matched after a `toLowerCase().trim()` so 'KN0W1' / ' brief '
 * both work. Unknown tokens are ignored.
 */
export function isPreflightEnabledFor(surfaceId: string): boolean {
  const raw = process.env.CAPABILITY_GATEWAY_PREFLIGHT?.trim().toLowerCase();
  if (!raw || raw === 'off' || raw === 'false') return false;
  if (raw === 'all' || raw === 'true') return true;
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .includes(surfaceId.toLowerCase());
}

export async function runPreflightGather(
  input: PreflightGatherInput,
): Promise<PreflightContext | null> {
  if (!isPreflightEnabledFor(input.surfaceId)) return null;
  const query = input.query?.trim();
  if (!query) return null;

  const envelope: PolicyEnvelope = {
    tenant_id: 'default',
    persona_id: input.persona.personaId,
    disclosure_class: 'persona',
    allowed_surfaces: [],
    forbidden_actions: [],
    requires_guardian_approval: false,
    cartridge_scope: input.cartridge,
  };

  const result = await executeCapability({
    persona: input.persona,
    envelope,
    adapter: 'openclaw',
    capability_intent: 'tool_gather',
    capability_class: input.capability_class ?? 'search',
    tool_name: input.tool_name ?? 'web-search',
    input: { query: query.slice(0, 200) },
    origin_surface: input.surfaceId,
    cartridge: input.cartridge,
    intentId: input.intentId ?? null,
  }).catch((err) => {
    console.warn(`[preflight ${input.surfaceId}] gather threw:`, err instanceof Error ? err.message : err);
    return null;
  });

  if (!result || !result.ok || !result.adapterResult.ok) return null;
  return {
    workOrderId: result.workOrder.workOrderId,
    summary: result.adapterResult.summary,
    policyHash: result.workOrder.policy.policyHash,
  };
}
