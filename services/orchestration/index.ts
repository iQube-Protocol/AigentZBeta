/**
 * Orchestration Module
 * 
 * Exports:
 * - FlowContext types and builders
 * - Narrative engine pipeline functions
 * - OrchestrationService
 * - Agent voices
 */

// FlowContext
export {
  buildFlowContext,
  createEmptyFlowContext,
  updateFlowContext,
  type FlowContext,
  type BuildFlowContextParams,
  type AppId,
  type AgentId,
  type ContentCategory,
  type ContentModality,
  type InferredGoal,
  type IdentityState,
} from './flowContext';

// Narrative Engine
export {
  orchestrate,
  arrive,
  align,
  assess,
  adapt,
  act,
  anchor,
  type OrchestrationDecision,
  type DrawerChange,
  type NarrativeHints,
} from './narrativeEngine';

// Orchestration Service
export {
  OrchestrationService,
  getOrchestrationService,
  type OrchestrationRequest,
  type OrchestrationResponse,
} from './orchestrationService';

// Agent Voices
export {
  agentVoices,
  getAgentVoice,
  generateNarrative,
  kn0w1Voice,
  moneyPennyVoice,
  nakamotoVoice,
  copilotVoice,
  type AgentVoice,
} from './agentVoices';
