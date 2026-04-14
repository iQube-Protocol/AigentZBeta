/**
 * AigentQube Type Definitions
 * 
 * Agent registry for the iQube ecosystem.
 * AigentQubes represent AI agents and metavatars that can:
 * - Interact with users in drawer panels
 * - Be assigned to specific tabs/drawers
 * - Have different visual representations (metavatars)
 * - Be bound by iQube policies
 * 
 * Core agents:
 * - Copilot: The main Aigent Z assistant
 * - Kn0w1: metaKnyts franchise agent
 * - MoneyPenny: Financial/wallet assistant
 * - Nakamoto: Crypto/blockchain specialist
 */

// =============================================================================
// CORE TYPES
// =============================================================================

/** Agent type classification */
export type AgentType = 'copilot' | 'franchise' | 'metavatar' | 'specialist';

/** Agent capability categories */
export type AgentCapabilityCategory = 
  | 'chat'
  | 'content'
  | 'wallet'
  | 'tasks'
  | 'codex'
  | 'commerce'
  | 'analytics'
  | 'creative';

// =============================================================================
// AGENT CAPABILITY
// =============================================================================

/**
 * AgentCapability - What an agent can do
 */
export interface AgentCapability {
  /** Capability ID */
  id: string;
  
  /** Category */
  category: AgentCapabilityCategory;
  
  /** Human-readable label */
  label: string;
  
  /** Description */
  description?: string;
  
  /** Is this capability enabled */
  enabled: boolean;
  
  /** Required identity state to use this capability */
  requiredIdentityState?: 'anon' | 'pseudo' | 'semi' | 'full';
}

// =============================================================================
// POLICY BINDING
// =============================================================================

/**
 * PolicyBinding - iQube policy reference for agent behaviour
 */
export interface PolicyBinding {
  /** Policy ID */
  policyId: string;
  
  /** Policy type */
  policyType: 'access' | 'content' | 'payment' | 'privacy' | 'behaviour';
  
  /** Policy name */
  policyName: string;
  
  /** Is this policy enforced */
  enforced: boolean;
  
  /** Policy parameters */
  parameters?: Record<string, any>;
}

// =============================================================================
// METAVATAR
// =============================================================================

/**
 * Metavatar - Visual representation of an agent
 */
export interface Metavatar {
  /** Metavatar ID (e.g., "metaknyts:kn0w1", "qriptopian:moneypenny") */
  id: string;
  
  /** Display name */
  name: string;
  
  /** Avatar image URL */
  avatarUrl?: string;
  
  /** Video/animated avatar URL (for D-ID, etc.) */
  videoUrl?: string;
  
  /** Iframe embed URL */
  iframeUrl?: string;
  
  /** Voice ID (for TTS) */
  voiceId?: string;
  
  /** Style/theme */
  style?: 'realistic' | 'animated' | 'stylized' | 'minimal';
  
  /** Background color/gradient */
  backgroundColor?: string;
}

// =============================================================================
// AIGENT QUBE - MAIN INTERFACE
// =============================================================================

/**
 * AigentQube - Agent definition in the iQube registry
 */
export interface AigentQube {
  /** Unique agent ID (e.g., "Copilot", "Kn0w1", "MoneyPenny", "Nakamoto") */
  id: string;
  
  /** Display label */
  label: string;
  
  /** Description */
  description?: string;
  
  /** Agent type */
  type: AgentType;
  
  /** Applications this agent can be used in */
  appIds: string[];
  
  /** Available metavatar IDs */
  metavatarIds: string[];
  
  /** Agent capabilities */
  capabilities: AgentCapability[];
  
  /** Policy bindings */
  policyBindings: PolicyBinding[];
  
  /** Is this agent active */
  isActive: boolean;
  
  /** Default metavatar ID */
  defaultMetavatarId?: string;
  
  /** System prompt override (for specialized behaviour) */
  systemPrompt?: string;
  
  /** Model preference (e.g., "gpt-4o-mini", "claude-3-sonnet") */
  modelPreference?: string;
  
  /** Temperature setting */
  temperature?: number;
  
  /** Created timestamp */
  createdAt?: string;
  
  /** Updated timestamp */
  updatedAt?: string;
}

// =============================================================================
// AGENT CONTEXT
// =============================================================================

/**
 * AgentInteractionContext - Context for agent interactions
 */
export interface AgentInteractionContext {
  /** Agent ID */
  agentId: string;
  
  /** Session ID */
  sessionId: string;
  
  /** User's persona ID */
  personaId: string;
  
  /** Current app */
  appId: string;
  
  /** Current content ID (if viewing content) */
  currentContentId?: string;
  
  /** Current drawer/tab context */
  drawerContext?: {
    drawerId: string;
    tabId: string;
  };
  
  /** Wallet context summary */
  walletContext?: {
    balance: number;
    asset: string;
    pendingTasks: number;
  };
}

// =============================================================================
// AGENT PANEL STATE
// =============================================================================

/**
 * AgentPanelState - Runtime state for agent panel
 */
export interface AgentPanelState {
  /** Is panel open */
  isOpen: boolean;
  
  /** Active agent ID */
  activeAgentId: string;
  
  /** Active metavatar ID */
  activeMetavatarId?: string;
  
  /** Messages in current session */
  messages: AgentMessage[];
  
  /** Is agent thinking/loading */
  isLoading: boolean;
  
  /** Current session ID */
  sessionId: string;
}

/**
 * AgentMessage - Single message in agent conversation
 */
export interface AgentMessage {
  /** Message ID */
  id: string;
  
  /** Role */
  role: 'user' | 'assistant' | 'system';
  
  /** Content */
  content: string;
  
  /** Timestamp */
  timestamp: string;
  
  /** Agent ID (for assistant messages) */
  agentId?: string;
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/** Create a new AigentQube with minimal required fields */
export function createAigentQube(
  partial: Partial<AigentQube> & Pick<AigentQube, 'id' | 'label' | 'type'>
): AigentQube {
  const now = new Date().toISOString();
  return {
    appIds: [],
    metavatarIds: [],
    capabilities: [],
    policyBindings: [],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

/** Create a default agent capability */
export function createAgentCapability(
  partial: Partial<AgentCapability> & Pick<AgentCapability, 'id' | 'category' | 'label'>
): AgentCapability {
  return {
    enabled: true,
    ...partial,
  };
}

// =============================================================================
// SEED AGENT IDS
// =============================================================================

/** Well-known agent IDs */
export const AGENT_IDS = {
  AIGENT_Z: 'aigent-z',
  COPILOT: 'Copilot',
  KN0W1: 'aigent-kn0w1',
  MARKETA: 'aigent-marketa',
  MONEYPENNY: 'MoneyPenny',
  NAKAMOTO: 'Nakamoto',
} as const;

/** Well-known metavatar IDs */
export const METAVATAR_IDS = {
  // metaKnyts
  METAKNYTS_KN0W1: 'metaknyts:kn0w1',
  METAKNYTS_MONEYPENNY: 'metaknyts:moneypenny',
  METAKNYTS_CODEX_SPIRIT: 'metaknyts:codex-spirit',
  // Qriptopian
  QRIPTOPIAN_KN0W1: 'qriptopian:kn0w1',
  QRIPTOPIAN_MONEYPENNY: 'qriptopian:moneypenny',
  QRIPTOPIAN_COPILOT: 'qriptopian:copilot',
} as const;
