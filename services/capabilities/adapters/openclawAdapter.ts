/**
 * OpenClaw adapter — Phase 2 slice.
 *
 * Executes `CapabilityWorkOrder`s issued by the gateway. The adapter
 * ships with a small, hand-curated tool table for Pattern A (pre-flight
 * gather) — all read/search-class tools that enrich a specialist's
 * context before it replies.
 *
 * Phase 2b will replace the in-file tool table with the extracted
 * MCPInvoker / registry from `clawhack-group-agents/openclaw-wrapper/`.
 * The CLI worker will then share the same execution core. Until that
 * extract lands, this adapter and the CLI worker run independent tool
 * loops — flagged explicitly so we don't drift them by accident.
 *
 * Tool registry (Phase 2 starter set):
 *   - 'web-search'           Pattern A · class 'search'   · stub (returns canned result hint)
 *   - 'owned-content-scan'   Pattern A · class 'read'     · counts owned content in active cartridge
 *   - 'echo'                 Pattern A · class 'read'     · smoke test — returns input verbatim
 *
 * Each tool returns `{ ok: true, data, summary }` or `{ ok: false, reason, detail }`.
 */

import type { CapabilityWorkOrder } from '../types';
import type { AdapterArtifactRef, AdapterResult, CapabilityAdapter } from './types';

type ToolHandler = (input: Record<string, unknown>) => Promise<AdapterResult>;

const TOOL_HANDLERS: Record<string, ToolHandler> = {
  echo: async (input) => ({
    ok: true,
    data: input,
    summary: 'echo returned the input verbatim',
  }),
  'web-search': async (input) => {
    const query = typeof input.query === 'string' ? input.query.trim() : '';
    if (!query) {
      return { ok: false, reason: 'invalid-input', detail: 'query (string) required' };
    }
    // Phase 2 stub — Phase 2b replaces with a real MCP-resolved search
    // tool. We return a deterministic placeholder so the specialist
    // wiring can be exercised end-to-end without a third-party API key.
    return {
      ok: true,
      data: {
        query,
        results: [
          {
            title: `Stubbed result for "${query}"`,
            snippet: 'web-search is a Phase 2 stub. Phase 2b wires the real MCP-resolved search.',
            url: 'about:capability-gateway-phase-2-stub',
          },
        ],
      },
      summary: `web-search ran (stub) for "${query.slice(0, 60)}"`,
    };
  },
  'owned-content-scan': async (input) => {
    // Phase 2 placeholder — Phase 2b will resolve via getOwnedAssetIds()
    // from services/rewards/assetOwnership. We don't take a hard
    // dependency here yet so the adapter has zero spine reach-around.
    const cartridge = typeof input.cartridge === 'string' ? input.cartridge : 'metame';
    return {
      ok: true,
      data: { cartridge, ownedCount: 0, sampled: [] },
      summary: `owned-content-scan ran (stub) for cartridge "${cartridge}"`,
    };
  },
};

function listForbidden(tool_name: string, capability_class: string, forbidden: string[]): boolean {
  return forbidden.includes(`${capability_class}:${tool_name}`) || forbidden.includes(capability_class);
}

export const openclawAdapter: CapabilityAdapter = {
  id: 'openclaw',

  listTools() {
    return Object.keys(TOOL_HANDLERS);
  },

  async execute(workOrder: CapabilityWorkOrder): Promise<AdapterResult> {
    // Defence in depth — the gateway already checks these, but the
    // adapter re-verifies so a bypass of the gateway (which would be
    // a bug) still fails closed.
    if (workOrder.approval_state === 'pending') {
      return {
        ok: false,
        reason: 'approval-pending',
        detail: `work order ${workOrder.workOrderId} requires guardian approval before execution`,
      };
    }
    if (listForbidden(workOrder.tool_name, workOrder.capability_class, workOrder.policy.forbidden_actions)) {
      return {
        ok: false,
        reason: 'action-forbidden',
        detail: `${workOrder.capability_class}:${workOrder.tool_name} is in the policy's forbidden_actions list`,
      };
    }

    const handler = TOOL_HANDLERS[workOrder.tool_name];
    if (!handler) {
      return {
        ok: false,
        reason: 'tool-not-found',
        detail: `openclaw adapter has no handler for tool '${workOrder.tool_name}'`,
      };
    }

    try {
      return await handler(workOrder.input);
    } catch (err) {
      return {
        ok: false,
        reason: 'tool-failed',
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  },
};

// Re-export for callers that want the artifact type without importing
// from the adapter types module separately.
export type { AdapterArtifactRef };
