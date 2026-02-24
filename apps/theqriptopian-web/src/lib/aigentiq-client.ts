/**
 * AigentiQ AA-API Client for Qriptopian
 * 
 * Connects Qriptopian to the AigentiQ Platform Copilot
 * for AI-powered responses from Nakamoto, KNOW1, and MoneyPenny agents.
 * 
 * This file now uses @agentiq/agentiq-sdk
 */

import { 
  AgentIQClient, 
  createUserMessage,
  getAgentSystemPrompt,
  type ChatMessage,
  type ChatResponse 
} from '@agentiq/agentiq-sdk';

// Configure this to point to your AigentiQ instance
const AIGENTIQ_API_URL = import.meta.env.VITE_AIGENTIQ_API_URL || 'http://localhost:3000';

// Create singleton client instance
const client = new AgentIQClient({
  apiUrl: AIGENTIQ_API_URL,
  defaultTenantId: 'qriptopian',
  defaultFranchiseId: 'qriptopian',
});

// Legacy type for backwards compatibility
export interface AigentConfig {
  agentId: 'nakamoto' | 'know1' | 'moneypenny';
  personaId?: string;
  tenantId?: string;
}

// Re-export types from SDK
export type { ChatMessage, ChatResponse };

/**
 * Send a chat message to the AigentiQ AA-API
 * Now uses @agentiq/agentiq-sdk
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  config: AigentConfig
): Promise<ChatResponse> {
  return client.chat(messages, {
    agentId: config.agentId,
    personaId: config.personaId,
    tenantId: config.tenantId,
  });
}

/**
 * Stream chat response from AigentiQ AA-API
 * Now uses @agentiq/agentiq-sdk
 */
export async function streamChatMessage(
  messages: ChatMessage[],
  config: AigentConfig,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: string) => void
): Promise<void> {
  return client.stream(
    messages, 
    {
      agentId: config.agentId,
      personaId: config.personaId,
      tenantId: config.tenantId,
    },
    { onChunk, onComplete, onError }
  );
}

/**
 * Get agent system prompt based on agent ID
 * Re-exported from @agentiq/agentiq-sdk
 */
export { getAgentSystemPrompt };

/**
 * Execute a copilot action via AA-API
 * Now uses @agentiq/agentiq-sdk
 */
export async function executeAction(
  actionName: string,
  parameters: Record<string, any>,
  config: AigentConfig
): Promise<{ success: boolean; result?: any; error?: string }> {
  return client.executeAction(actionName, parameters, {
    agentId: config.agentId,
    personaId: config.personaId,
    tenantId: config.tenantId,
  });
}
