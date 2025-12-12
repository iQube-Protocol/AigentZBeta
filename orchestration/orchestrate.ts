/**
 * Main Orchestration Function
 * 
 * Brings together FlowContext building, agent selection, and narrative generation
 */

import type { OrchestrationDecision, FlowContext } from "./types";
import { arrive, align, assess, adapt, act, anchor } from "./narrativeEngine";
import { selectAgents } from "./agentSelector";

export async function orchestrateFlow(params: {
  userId: string;
  tenantId: string;
  appId: string;
  personaId: string;
  activeAgentId: string;
  smartContentId?: string;
  activeDrawerId?: string;
  activeTabId?: string;
  explicitGoal?: string;
}): Promise<OrchestrationDecision> {
  
  // TODO: Build real FlowContext by fetching from services:
  // - DIDQube for persona.identityState
  // - SmartWalletQube for wallet data
  // - SmartContentQube for content data
  // For now, create minimal context
  
  const flowContext: FlowContext = {
    persona: {
      id: params.personaId,
      identityState: "pseudo", // TODO: fetch from DIDQube
      claimsCount: 0,
    },
    location: {
      appId: params.appId,
      activeAgentId: params.activeAgentId,
      activeDrawerId: params.activeDrawerId,
      activeTabId: params.activeTabId,
    },
    intent: {
      explicitGoal: params.explicitGoal,
    },
  };
  
  // Select primary and secondary agents
  const { primaryAgentId, secondaryAgentIds } = selectAgents(flowContext);
  
  // Run ARRIVE→ANCHOR narrative pipeline
  const adaptResult = adapt(flowContext);
  
  return {
    flowContext,
    primaryAgentId,
    secondaryAgentIds,
    drawerChanges: adaptResult.changes,
    narrativeHints: {
      arrive: arrive(flowContext),
      align: align(flowContext),
      assess: assess(flowContext),
      adapt: adaptResult.text,
      act: act(flowContext),
      anchor: anchor(flowContext),
    },
  };
}
