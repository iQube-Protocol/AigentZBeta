/**
 * Resolve the URL Horizen's Pulse should health-check for an agent — from
 * the agent's canonical Agent Runtime Endpoint descriptor
 * (`registry_assets.metadata.runtime`, services/registry/runtimeDescriptor.ts),
 * never invented (operator ruling, 2026-08-04):
 *
 *   > "Replace the recently added services[] lookup entirely. Pulse should
 *   >  resolve: runtime.endpoint + runtime.health ... Do not retain
 *   >  services[] as a fallback. That would recreate two sources of truth
 *   >  and make the migration permanent."
 *
 * No Agent Card in this codebase declares a runtime descriptor yet — so this
 * resolves to `null` for every agent today, and the caller (the Verify
 * route) refuses locally (NO_RUNTIME_ENDPOINT) rather than calling Horizen
 * with a guessed URL. Populating an asset's `metadata.runtime.endpoint` via
 * `setAssetRuntimeDescriptor` is what makes this resolve to something; this
 * function never substitutes one.
 */

import { resolveRuntimeHealthUrl, type RuntimeDescriptor } from '@/services/registry/runtimeDescriptor';

/**
 * `agentCard.metadata.runtime`, as served by the canonical Agent Card
 * routes (a pure projection of `registry_assets.metadata.runtime` — never a
 * second, hand-authored value). Structural resolution only, per
 * `resolveRuntimeHealthUrl`'s own rules; no network call.
 */
export function resolvePulseEndpoint(agentCard: unknown): string | null {
  if (!agentCard || typeof agentCard !== 'object') return null;
  const metadata = (agentCard as Record<string, unknown>).metadata;
  const runtime = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).runtime : undefined;
  if (!runtime || typeof runtime !== 'object') return null;
  return resolveRuntimeHealthUrl(runtime as RuntimeDescriptor);
}
