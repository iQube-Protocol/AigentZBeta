/**
 * AgentiQ Core Types
 * 
 * Shared types for AgentiQ framework integration
 */

export interface AgentiQConfig {
  agentClass: string;
  tenantId?: string;
  enableA2A?: boolean;
  enableMetaMask?: boolean;
  enableUniSat?: boolean;
  enablePhantom?: boolean;
  tavilyApiKey?: string;
  redisUrl?: string;
  apiBaseUrl?: string;
  quotesUrl?: string;
  personaId?: string;
}

export interface AgentScope {
  userId?: string;
  tenantId?: string;
  personaId?: string;
}

export interface AgentiQClient {
  getConfig(): AgentiQConfig;
  fetch(url: string, options?: RequestInit): Promise<any>;
  disconnect(): Promise<void>;
}
