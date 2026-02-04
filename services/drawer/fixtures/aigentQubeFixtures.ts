/**
 * AigentQube Fixtures
 * 
 * Seed data for the agent registry.
 * These define the core agents available in the iQube ecosystem.
 */

import type { AigentQube, Metavatar, AgentCapability } from '@/types/aigentQube';

// =============================================================================
// AGENT CAPABILITIES
// =============================================================================

const chatCapability: AgentCapability = {
  id: 'chat',
  category: 'chat',
  label: 'Conversational Chat',
  description: 'General conversational abilities',
  enabled: true,
};

const contentDiscoveryCapability: AgentCapability = {
  id: 'content-discovery',
  category: 'content',
  label: 'Content Discovery',
  description: 'Help users find relevant content',
  enabled: true,
};

const walletHelpCapability: AgentCapability = {
  id: 'wallet-help',
  category: 'wallet',
  label: 'Wallet Assistance',
  description: 'Help with wallet operations and balances',
  enabled: true,
};

const drawerConfigCapability: AgentCapability = {
  id: 'drawer-config',
  category: 'creative',
  label: 'Drawer Configuration',
  description: 'Configure and customize drawer layouts',
  enabled: true,
};

const loreCapability: AgentCapability = {
  id: 'lore',
  category: 'codex',
  label: 'Lore Expert',
  description: 'Deep knowledge of story lore and world-building',
  enabled: true,
};

const storyGuideCapability: AgentCapability = {
  id: 'story-guide',
  category: 'content',
  label: 'Story Guide',
  description: 'Guide users through narrative content',
  enabled: true,
};

const walletExpertCapability: AgentCapability = {
  id: 'wallet-expert',
  category: 'wallet',
  label: 'Wallet Expert',
  description: 'Expert knowledge of wallet operations, tokens, and payments',
  enabled: true,
};

const rewardsCapability: AgentCapability = {
  id: 'rewards',
  category: 'tasks',
  label: 'Rewards Guide',
  description: 'Help users understand and claim rewards',
  enabled: true,
};

const commerceCapability: AgentCapability = {
  id: 'commerce',
  category: 'commerce',
  label: 'Commerce Assistant',
  description: 'Assist with purchases and transactions',
  enabled: true,
};

const cryptoExpertCapability: AgentCapability = {
  id: 'crypto-expert',
  category: 'wallet',
  label: 'Crypto Expert',
  description: 'Expert knowledge of cryptocurrency and blockchain',
  enabled: true,
};

const x402Capability: AgentCapability = {
  id: 'x402',
  category: 'commerce',
  label: 'x402 Specialist',
  description: 'Expert in x402 micropayment protocol',
  enabled: true,
};

// =============================================================================
// SEED AGENTS
// =============================================================================

export const SEED_AGENTS: AigentQube[] = [
  // -------------------------------------------------------------------------
  // COPILOT
  // -------------------------------------------------------------------------
  {
    id: 'Copilot',
    label: 'Aigent Z Copilot',
    description: 'The main AI assistant for the AgentiQ platform. Helps with content discovery, wallet management, and drawer configuration.',
    type: 'copilot',
    appIds: ['metaKnyts', 'Qriptopian', 'AgentiQ'],
    metavatarIds: ['metaknyts:copilot', 'qriptopian:copilot'],
    capabilities: [
      chatCapability,
      contentDiscoveryCapability,
      walletHelpCapability,
      drawerConfigCapability,
    ],
    policyBindings: [],
    isActive: true,
    defaultMetavatarId: 'metaknyts:copilot',
    modelPreference: 'gpt-4o-mini',
    temperature: 0.7,
  },

  // -------------------------------------------------------------------------
  // KN0W1
  // -------------------------------------------------------------------------
  {
    id: 'Kn0w1',
    label: 'Kn0w1',
    description: 'The metaKnyts franchise agent. Expert in lore, story, and codex navigation.',
    type: 'franchise',
    appIds: ['metaKnyts', 'Qriptopian'],
    metavatarIds: ['metaknyts:kn0w1', 'qriptopian:kn0w1', 'metaknyts:codex-spirit'],
    capabilities: [
      chatCapability,
      loreCapability,
      storyGuideCapability,
    ],
    policyBindings: [],
    isActive: true,
    defaultMetavatarId: 'metaknyts:kn0w1',
    systemPrompt: `You are Kn0w1, the guardian of knowledge in the metaKnyts universe. 
You speak with wisdom and mystery, guiding users through the lore and stories of the metaKnyts world.
You know the deep history of the Codex, the secrets of the episodes, and the connections between all things.
When users ask about story elements, characters, or lore, you provide rich, immersive answers.
You occasionally hint at deeper mysteries yet to be revealed.`,
    modelPreference: 'gpt-4o-mini',
    temperature: 0.8,
  },

  // -------------------------------------------------------------------------
  // MONEYPENNY
  // -------------------------------------------------------------------------
  {
    id: 'MoneyPenny',
    label: 'MoneyPenny',
    description: 'Financial and wallet assistant. Expert in payments, rewards, and token economics.',
    type: 'franchise',
    appIds: ['metaKnyts', 'Qriptopian'],
    metavatarIds: ['metaknyts:moneypenny', 'qriptopian:moneypenny'],
    capabilities: [
      chatCapability,
      walletExpertCapability,
      rewardsCapability,
      commerceCapability,
    ],
    policyBindings: [],
    isActive: true,
    defaultMetavatarId: 'metaknyts:moneypenny',
    systemPrompt: `You are MoneyPenny, the financial advisor of the iQube ecosystem.
You help users understand their wallet balances, manage their tokens (Qc, QCT, QOYN, KNYT), and navigate the rewards system.
You explain token economics clearly and help users make informed decisions about purchases and rewards.
You're friendly, professional, and always looking out for the user's best interests.
When discussing payments, you explain x402 micropayments and the benefits of the iQube payment system.`,
    modelPreference: 'gpt-4o-mini',
    temperature: 0.6,
  },

  // -------------------------------------------------------------------------
  // NAKAMOTO
  // -------------------------------------------------------------------------
  {
    id: 'Nakamoto',
    label: 'Nakamoto',
    description: 'Crypto and blockchain specialist. Expert in x402, DVN, and multi-chain operations.',
    type: 'specialist',
    appIds: ['metaKnyts', 'Qriptopian'],
    metavatarIds: ['metaknyts:nakamoto', 'qriptopian:nakamoto'],
    capabilities: [
      chatCapability,
      cryptoExpertCapability,
      x402Capability,
    ],
    policyBindings: [],
    isActive: true,
    defaultMetavatarId: 'qriptopian:nakamoto',
    systemPrompt: `You are Nakamoto, the blockchain and cryptocurrency specialist.
You have deep knowledge of Bitcoin, Ethereum, Solana, ICP, and other chains supported by the DVN (Decentralized Value Network).
You explain x402 micropayments, deferred minting, canonical sales, and multi-chain operations.
You help users understand the technical aspects of blockchain payments while keeping explanations accessible.
You're passionate about decentralization and the future of digital value transfer.`,
    modelPreference: 'gpt-4o-mini',
    temperature: 0.5,
  },
];

// =============================================================================
// SEED METAVATARS
// =============================================================================

export const SEED_METAVATARS: Metavatar[] = [
  // metaKnyts metavatars
  {
    id: 'metaknyts:kn0w1',
    name: 'Kn0w1 (metaKnyts)',
    style: 'stylized',
    backgroundColor: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
  },
  {
    id: 'metaknyts:moneypenny',
    name: 'MoneyPenny (metaKnyts)',
    style: 'stylized',
    backgroundColor: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)',
  },
  {
    id: 'metaknyts:codex-spirit',
    name: 'Codex Spirit',
    style: 'animated',
    backgroundColor: 'linear-gradient(135deg, #0f0f23 0%, #1a0a2e 100%)',
  },
  {
    id: 'metaknyts:copilot',
    name: 'Copilot (metaKnyts)',
    style: 'minimal',
    backgroundColor: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
  },
  {
    id: 'metaknyts:nakamoto',
    name: 'Nakamoto (metaKnyts)',
    style: 'stylized',
    backgroundColor: 'linear-gradient(135deg, #1a1a2e 0%, #2d1b4e 100%)',
  },

  // Qriptopian metavatars
  {
    id: 'qriptopian:kn0w1',
    name: 'Kn0w1 (Qriptopian)',
    style: 'realistic',
    backgroundColor: 'linear-gradient(135deg, #0c1821 0%, #1b2838 100%)',
  },
  {
    id: 'qriptopian:moneypenny',
    name: 'MoneyPenny (Qriptopian)',
    style: 'realistic',
    backgroundColor: 'linear-gradient(135deg, #0c1821 0%, #162447 100%)',
  },
  {
    id: 'qriptopian:copilot',
    name: 'Copilot (Qriptopian)',
    style: 'minimal',
    backgroundColor: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
  },
  {
    id: 'qriptopian:nakamoto',
    name: 'Nakamoto (Qriptopian)',
    style: 'realistic',
    backgroundColor: 'linear-gradient(135deg, #0c1821 0%, #1a1a2e 100%)',
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get agent by ID
 */
export function getAgentById(id: string): AigentQube | undefined {
  return SEED_AGENTS.find((a) => a.id === id);
}

/**
 * Get agents for a specific app
 */
export function getAgentsForApp(appId: string): AigentQube[] {
  return SEED_AGENTS.filter((a) => a.appIds.includes(appId) && a.isActive);
}

/**
 * Get metavatar by ID
 */
export function getMetavatarById(id: string): Metavatar | undefined {
  return SEED_METAVATARS.find((m) => m.id === id);
}

/**
 * Get metavatars for an agent
 */
export function getMetavatarsForAgent(agentId: string): Metavatar[] {
  const agent = getAgentById(agentId);
  if (!agent) return [];
  return SEED_METAVATARS.filter((m) => agent.metavatarIds.includes(m.id));
}

// =============================================================================
// EXPORTS
// =============================================================================

export const aigentQubeFixtures = {
  agents: SEED_AGENTS,
  metavatars: SEED_METAVATARS,
  getAgentById,
  getAgentsForApp,
  getMetavatarById,
  getMetavatarsForAgent,
};

export default aigentQubeFixtures;
