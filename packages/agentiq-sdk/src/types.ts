/**
 * @agentiqos/agentiq-sdk - Type Definitions
 * AA-API and A2A protocol types for AgentiQ Platform
 */

/** Shared config for AigentQubeRegistry, PersonaCreation, and DelegationService. */
export interface SDKConfig {
  /** Base URL of your AgentiQ OS instance. Falls back to AGENTIQ_API_URL env var. */
  apiUrl?: string;
  /** Default persona ID for operations that require one. */
  personaId?: string;
  /** SDK API key — passed as Authorization header if provided. */
  apiKey?: string;
}

/**
 * Chat message structure for AA-API
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
  timestamp?: number;
}

/**
 * Agent configuration for requests
 */
export interface AgentConfig {
  agentId: string;
  personaId?: string;
  tenantId?: string;
  franchiseId?: string;
  metadata?: Record<string, any>;
}

/**
 * SDK client configuration
 */
export interface AgentIQConfig {
  apiUrl: string;
  defaultTenantId?: string;
  defaultFranchiseId?: string;
  defaultPersonaId?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

/**
 * Chat response from AA-API
 */
export interface ChatResponse {
  success: boolean;
  message?: string;
  content?: string;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Action execution response
 */
export interface ActionResponse {
  success: boolean;
  result?: any;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Streaming callbacks
 */
export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: () => void;
  onError: (error: string) => void;
  onMetadata?: (metadata: Record<string, any>) => void;
}

/**
 * Agent persona definition
 */
export interface AgentPersona {
  id: string;
  name: string;
  agentId: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, any>;
}

/**
 * AA-API request payload
 */
export interface AAAPIRequest {
  messages?: ChatMessage[];
  action?: string;
  parameters?: Record<string, any>;
  agentId: string;
  personaId?: string;
  tenantId: string;
  franchiseId: string;
  stream?: boolean;
  metadata?: Record<string, any>;
}

/**
 * A2A protocol message
 */
export interface A2AMessage {
  type: 'request' | 'response' | 'event' | 'error';
  from: string;  // Agent ID
  to: string;    // Agent ID
  payload: any;
  messageId?: string;
  correlationId?: string;
  timestamp?: number;
}

/**
 * A2A protocol response
 */
export interface A2AResponse {
  success: boolean;
  data?: any;
  error?: string;
  messageId?: string;
  correlationId?: string;
}
