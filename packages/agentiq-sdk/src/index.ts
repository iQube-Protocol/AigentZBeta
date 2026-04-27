/**
 * @agentiqos/agentiq-sdk
 * AA-API and A2A client SDK for AgentiQ Platform
 * 
 * @example
 * ```typescript
 * import { AgentIQClient, createUserMessage, defaultPersonas } from '@agentiqos/agentiq-sdk';
 * 
 * // Create client
 * const client = new AgentIQClient({
 *   apiUrl: 'https://api.agentiq.ai',
 *   defaultTenantId: 'my-tenant',
 *   defaultFranchiseId: 'my-franchise',
 * });
 * 
 * // Send a chat message
 * const response = await client.chat(
 *   [createUserMessage('What is blockchain?')],
 *   { agentId: 'nakamoto' }
 * );
 * 
 * // Stream a response
 * await client.stream(
 *   [createUserMessage('Explain DeFi')],
 *   { agentId: 'nakamoto' },
 *   {
 *     onChunk: (chunk) => console.log(chunk),
 *     onComplete: () => console.log('Done'),
 *     onError: (error) => console.error(error),
 *   }
 * );
 * ```
 */

export { AgentIQClient } from './AgentIQClient';
export { A2AClient } from './A2AClient';
export { AigentQubeRegistry } from './registry';
export { PersonaCreation } from './persona';
export { DelegationService } from './delegation';

export type { QubeType, AigentQubeRegistration, PolicyBinding, RegistryDraftResult } from './registry';
export type { PersonaCreateOptions, CreatedPersona } from './persona';
export type { DelegationGrantOptions, PolicyEnvelope, HandoffResult, DelegationStateResult } from './delegation';
export {
  defaultPersonas,
  getAgentSystemPrompt,
  getAgentPersona,
  formatMessages,
  createUserMessage,
  createAssistantMessage,
  createSystemMessage,
  validateApiUrl,
  parseStreamChunk,
} from './utils';

export type {
  ChatMessage,
  AgentConfig,
  AgentIQConfig,
  ChatResponse,
  ActionResponse,
  StreamCallbacks,
  AgentPersona,
  AAAPIRequest,
  A2AMessage,
  A2AResponse,
  SDKConfig,
} from './types';
