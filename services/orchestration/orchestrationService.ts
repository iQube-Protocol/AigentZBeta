/**
 * Orchestration Service
 * 
 * Unified service that:
 * - Builds FlowContext from available data
 * - Runs the narrative pipeline
 * - Returns drawer changes and narrative hints
 */

import { 
  buildFlowContext, 
  createEmptyFlowContext,
  updateFlowContext,
  type FlowContext, 
  type BuildFlowContextParams,
  type AppId,
  type AgentId,
} from './flowContext';

import {
  orchestrate,
  type OrchestrationDecision,
  type DrawerChange,
  type NarrativeHints,
} from './narrativeEngine';

import type { SmartWalletQube } from '@/types/smartWalletQube';
import type { DrawerSet } from '@/types/smartDrawer';

// =============================================================================
// SERVICE TYPES
// =============================================================================

export interface OrchestrationRequest {
  userId?: string;
  tenantId: string;
  appId: AppId;
  personaId: string;
  activeAgentId?: AgentId;
  smartContentId?: string;
  activeDrawerId?: string;
  activeTabId?: string;
  explicitGoal?: string;
}

export interface OrchestrationResponse {
  success: boolean;
  decision?: OrchestrationDecision;
  error?: string;
}

// =============================================================================
// ORCHESTRATION SERVICE CLASS
// =============================================================================

export class OrchestrationService {
  private currentContext: FlowContext | null = null;

  /**
   * Run full orchestration pipeline
   */
  async orchestrateFlow(
    request: OrchestrationRequest,
    wallet?: SmartWalletQube | null,
    drawerSet?: DrawerSet | null
  ): Promise<OrchestrationResponse> {
    try {
      // Build flow context
      const params: BuildFlowContextParams = {
        userId: request.userId,
        tenantId: request.tenantId,
        appId: request.appId,
        personaId: request.personaId,
        activeAgentId: request.activeAgentId,
        smartContentId: request.smartContentId,
        activeDrawerId: request.activeDrawerId,
        activeTabId: request.activeTabId,
        explicitGoal: request.explicitGoal,
      };

      const flowContext = buildFlowContext(params, wallet, drawerSet);
      this.currentContext = flowContext;

      // Run orchestration
      const decision = orchestrate(flowContext);

      return {
        success: true,
        decision,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update context and re-orchestrate
   */
  async updateAndOrchestrate(
    updates: Partial<OrchestrationRequest>,
    wallet?: SmartWalletQube | null
  ): Promise<OrchestrationResponse> {
    if (!this.currentContext) {
      return {
        success: false,
        error: 'No existing context to update',
      };
    }

    try {
      // Apply updates to context
      const updatedContext = updateFlowContext(this.currentContext, {
        location: {
          ...this.currentContext.location,
          activeDrawerId: updates.activeDrawerId,
          activeTabId: updates.activeTabId,
          activeAgentId: updates.activeAgentId,
        },
        intent: updates.explicitGoal ? {
          explicitGoal: updates.explicitGoal,
        } : undefined,
      });

      this.currentContext = updatedContext;

      // Re-run orchestration
      const decision = orchestrate(updatedContext);

      return {
        success: true,
        decision,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get current context
   */
  getCurrentContext(): FlowContext | null {
    return this.currentContext;
  }

  /**
   * Get narrative hints for current context
   */
  getNarrativeHints(): NarrativeHints | null {
    if (!this.currentContext) return null;
    const decision = orchestrate(this.currentContext);
    return decision.narrativeHints;
  }

  /**
   * Get drawer changes for current context
   */
  getDrawerChanges(): DrawerChange[] {
    if (!this.currentContext) return [];
    const decision = orchestrate(this.currentContext);
    return decision.drawerChanges;
  }

  /**
   * Clear context
   */
  clearContext(): void {
    this.currentContext = null;
  }
}

// Singleton instance
let orchestrationServiceInstance: OrchestrationService | null = null;

export function getOrchestrationService(): OrchestrationService {
  if (!orchestrationServiceInstance) {
    orchestrationServiceInstance = new OrchestrationService();
  }
  return orchestrationServiceInstance;
}

export default OrchestrationService;
