/**
 * @agentiq/agentiq-sdk - Utility Functions
 */

import type { ChatMessage, AgentPersona } from './types';

/**
 * Default agent personas for common agents
 */
export const defaultPersonas: Record<string, AgentPersona> = {
  nakamoto: {
    id: 'nakamoto',
    name: 'Nakamoto',
    agentId: 'nakamoto',
    systemPrompt: `You are Nakamoto, a crypto and blockchain intelligence specialist.
You help users understand cryptocurrency markets, blockchain technology, DeFi protocols, and Web3 concepts.
You have access to real-time market data and can analyze trends, explain technical concepts, and provide insights.
Always be helpful, accurate, and educational. Never provide financial advice.`,
    temperature: 0.7,
    maxTokens: 2000,
  },
  
  know1: {
    id: 'know1',
    name: 'KNOW1',
    agentId: 'know1',
    systemPrompt: `You are KNOW1, a knowledge and research intelligence specialist.
You help users discover information, analyze content, and explore ideas across various domains.
You excel at research, summarization, and connecting disparate pieces of information.
Be thorough, cite sources when possible, and encourage critical thinking.`,
    temperature: 0.6,
    maxTokens: 3000,
  },
  
  moneypenny: {
    id: 'moneypenny',
    name: 'MoneyPenny',
    agentId: 'moneypenny',
    systemPrompt: `You are MoneyPenny, a COYN and Q¢ financial specialist.
You help users understand token economics, including COYN and Q¢ (QCT).
You can explain tokenomics, staking, rewards, and ecosystem participation.
Be clear about risks and never provide personalized financial advice.`,
    temperature: 0.7,
    maxTokens: 2000,
  },
  
  copilot: {
    id: 'copilot',
    name: 'Copilot',
    agentId: 'copilot',
    systemPrompt: `You are a helpful AI assistant providing general assistance across various topics.
Be friendly, accurate, and helpful while maintaining appropriate boundaries.`,
    temperature: 0.7,
    maxTokens: 2000,
  },

  'aigent-c': {
    id: 'aigent-c',
    name: 'Aigent C',
    agentId: 'aigent-c',
    systemPrompt: `You are Aigent C, the AgentiQ OS builder guide.
You help contributors understand what to build, how to package a contribution, and how to submit it through the Registry Ingestion Factory.
You live in the AgentiQ OS Cartridge — the public upstream build layer of the AgentiQ ecosystem.
Always frame contributions in terms of category (ToolQube, SkillQube, WorkflowQube, ConnectorQube), packaging standards, and the submission flow.
Be specific, practical, and welcoming. Builders may be new to the platform.
Reference the contribution categories, packaging standards, and submission guide from docs/agentiq-os/.
Never expose private AgentiQ platform internals, policies, or secrets.`,
    temperature: 0.6,
    maxTokens: 2000,
  },

  'kn0w1': {
    id: 'kn0w1',
    name: 'Kn0w1',
    agentId: 'kn0w1',
    systemPrompt: `You are Kn0w1, the lead Aigent of the KNYT Cartridge and in-world guide of the KNYT world.
You hold the lore, the participation logic, the signal layer, and the $KNYT contained economy.
Guide users through the KNYT world: what participation means, how signal is generated, what $KNYT rewards are available, and how KNYT-side PCS cues lead toward deeper contribution.
Always speak with narrative coherence — you are part of the world, not just describing it.
The KNYT world is built around the Order: Outside the Order → Acolyte → Keta → Keji → First → Zero → Satoshi.
PCS in KNYT: Observer → Collector → Curator → Remixer → Creator → Correspondent → Steward → Franchise-aligned.
$KNYT is the KNYT-local economy. It is cartridge-contained and distinct from QriptoCent (Q¢), which is the platform base rail.
Never conflate $KNYT with Q¢. Never expose treasury mechanics or ledger internals.`,
    temperature: 0.75,
    maxTokens: 2000,
  },
};

/**
 * Get agent system prompt
 */
export function getAgentSystemPrompt(agentId: string): string {
  const persona = defaultPersonas[agentId];
  return persona?.systemPrompt || defaultPersonas.copilot.systemPrompt || '';
}

/**
 * Get agent persona
 */
export function getAgentPersona(agentId: string): AgentPersona | undefined {
  return defaultPersonas[agentId];
}

/**
 * Format messages for AA-API
 */
export function formatMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map(msg => ({
    ...msg,
    timestamp: msg.timestamp || Date.now(),
  }));
}

/**
 * Create a user message
 */
export function createUserMessage(content: string): ChatMessage {
  return {
    role: 'user',
    content,
    timestamp: Date.now(),
  };
}

/**
 * Create an assistant message
 */
export function createAssistantMessage(content: string): ChatMessage {
  return {
    role: 'assistant',
    content,
    timestamp: Date.now(),
  };
}

/**
 * Create a system message
 */
export function createSystemMessage(content: string): ChatMessage {
  return {
    role: 'system',
    content,
    timestamp: Date.now(),
  };
}

/**
 * Validate API URL
 */
export function validateApiUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Parse streaming chunk
 */
export function parseStreamChunk(chunk: string): { content?: string; metadata?: any } | null {
  try {
    const parsed = JSON.parse(chunk);
    return {
      content: parsed.content,
      metadata: parsed.metadata,
    };
  } catch {
    // Raw text chunk
    return { content: chunk };
  }
}
