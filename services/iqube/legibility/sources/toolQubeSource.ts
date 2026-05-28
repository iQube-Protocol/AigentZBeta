/**
 * ToolQube source adapter — reads from the in-process openclawCore
 * registry (`services/capabilities/openclawCore/registry.ts`) where
 * tools self-register at module load.
 *
 * iqube_id convention:
 *   tool-<tool-name>  e.g. tool-echo, tool-web-search,
 *   tool-owned-content-scan
 *
 * The hyphen-prefixed format is canonical and matches the aigent
 * naming (`aigent-me`, `aigent-marketa`). The underscore form
 * (`tool_web_search`) is accepted as a fallback for backward
 * compatibility — internal lookups convert underscores to hyphens
 * because the real registry names use hyphens.
 *
 * Spine note: tool execution is mediated by the capability gateway
 * which already runs identity-aware policy. The card surface
 * advertises the tool's *existence* and *invocation shape* — the
 * gateway is where actual policy evaluation happens.
 */

import { listToolDescriptions, getTool } from '@/services/capabilities/openclawCore/registry';
import type { LegibilitySource } from '../cardBuilder';

const TOOL_PREFIX_HYPHEN = 'tool-';
const TOOL_PREFIX_UNDERSCORE = 'tool_';

/**
 * Encode an openclawCore tool name (which may contain hyphens) into
 * a canonical iqube_id. Tools register as e.g. `web-search`; the
 * iqube_id becomes `tool-web-search`.
 */
function toolIdFor(toolName: string): string {
  return `${TOOL_PREFIX_HYPHEN}${toolName}`;
}

/**
 * Decode an iqube_id back to a tool name. Accepts both:
 * - canonical `tool-<name>` (hyphens preserved)
 * - legacy `tool_<name>` (underscores swapped to hyphens for lookup)
 *
 * Returns null when the id doesn't start with either prefix.
 */
function toolNameFor(iqubeId: string): string | null {
  if (iqubeId.startsWith(TOOL_PREFIX_HYPHEN)) {
    return iqubeId.slice(TOOL_PREFIX_HYPHEN.length);
  }
  if (iqubeId.startsWith(TOOL_PREFIX_UNDERSCORE)) {
    // Convert underscores to hyphens so `tool_web_search` →
    // `web-search`, which IS the registered name.
    return iqubeId.slice(TOOL_PREFIX_UNDERSCORE.length).replace(/_/g, '-');
  }
  return null;
}

/**
 * Load a ToolQube as a LegibilitySource. Returns null when the
 * id doesn't decode to a registered tool. Tools are public by
 * default — agents need to discover them to call them. Payload
 * (i.e. tool execution result) is policy-mediated through the
 * gateway, not through this card surface.
 */
export function getToolQubeSource(iqubeId: string): LegibilitySource | null {
  const toolName = toolNameFor(iqubeId);
  if (!toolName) return null;
  const tool = getTool(toolName);
  if (!tool) return null;

  return {
    iqube_id: iqubeId,
    name: tool.name,
    description: tool.description,
    primitive_type: 'ToolQube',
    raw_lifecycle_state: 'canonized', // Code-defined tools are canonical by virtue of being in main.
    visibility_state: 'public',
    gating: ['open'],
    private_payload_available: false,
    creator_identity_state: 'identifiable',
    owner_identity_state: 'identifiable',
    title: tool.name,
    summary: tool.description,
    tags: ['tool', 'openclaw', 'capability'],
    canonicalized_at: undefined, // No timestamp available for code-defined tools.
  };
}

/**
 * Enumerate every registered tool as a LegibilitySource. Catalog
 * uses this directly — ToolQubes are always discoverable.
 */
export function listToolQubeSources(): LegibilitySource[] {
  return listToolDescriptions().map((t) => ({
    iqube_id: toolIdFor(t.name),
    name: t.name,
    description: t.description,
    primitive_type: 'ToolQube' as const,
    raw_lifecycle_state: 'canonized',
    visibility_state: 'public' as const,
    gating: ['open'] as const,
    private_payload_available: false,
    creator_identity_state: 'identifiable' as const,
    owner_identity_state: 'identifiable' as const,
    title: t.name,
    summary: t.description,
    tags: ['tool', 'openclaw', 'capability'],
  }));
}
