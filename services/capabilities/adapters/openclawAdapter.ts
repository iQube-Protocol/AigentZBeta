/**
 * OpenClaw adapter — Phase 2b.
 *
 * Now dispatches through `services/capabilities/openclawCore/`. The
 * tool registry is populated at module load by the openclawCore
 * barrel; this file is the thin shim that maps a `CapabilityWorkOrder`
 * onto a registered tool handler.
 *
 * Phase 2b — what changed from Phase 2a:
 *   - In-file tool table replaced with the shared openclawCore registry.
 *   - web-search now hits Serper / Tavily when SERPER_API_KEY /
 *     TAVILY_API_KEY is set; stub fallback otherwise.
 *   - owned-content-scan calls the real getOwnedAssetIds(personaId,
 *     series) via the new serverContext side-channel (T0 stays out
 *     of the work order).
 *
 * Phase 2b convergence (still pending — separate session):
 *   The CLI worker (clawhack-group-agents/run.ts) keeps its own
 *   MCPInvoker for now. Pointing it at openclawCore is the final
 *   convergence step — flagged with @todo phase 2b-convergence
 *   markers in the worker.
 */

// Importing the barrel triggers side-effect tool registration AND
// gives us the registry accessors in one statement.
import { getTool, listTools as coreListTools } from '@/services/capabilities/openclawCore';
import type { CapabilityWorkOrder } from '../types';
import type { AdapterResult, AdapterServerContext, CapabilityAdapter } from './types';

function listForbidden(tool_name: string, capability_class: string, forbidden: string[]): boolean {
  return forbidden.includes(`${capability_class}:${tool_name}`) || forbidden.includes(capability_class);
}

export const openclawAdapter: CapabilityAdapter = {
  id: 'openclaw',

  listTools() {
    return coreListTools();
  },

  async execute(
    workOrder: CapabilityWorkOrder,
    serverContext?: AdapterServerContext,
  ): Promise<AdapterResult> {
    // Defence in depth — gateway already checked these; adapter
    // re-verifies so a bypass of the gateway (which would be a bug)
    // still fails closed.
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

    const tool = getTool(workOrder.tool_name);
    if (!tool) {
      return {
        ok: false,
        reason: 'tool-not-found',
        detail: `openclaw adapter has no handler for tool '${workOrder.tool_name}'`,
      };
    }

    if (tool.needsServerContext && !serverContext) {
      return {
        ok: false,
        reason: 'server-context-required',
        detail: `tool '${tool.name}' needs serverContext (T0); the current adapter dispatch did not provide one`,
      };
    }

    try {
      const toolResult = await tool.handler(workOrder.input, serverContext);
      if (toolResult.ok) {
        return {
          ok: true,
          data: toolResult.data,
          artifacts: toolResult.artifacts,
          summary: toolResult.summary,
        };
      }
      return {
        ok: false,
        reason: toolResult.reason,
        detail: toolResult.detail,
      };
    } catch (err) {
      return {
        ok: false,
        reason: 'tool-failed',
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
