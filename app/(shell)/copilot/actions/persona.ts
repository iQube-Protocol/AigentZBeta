/**
 * Persona CopilotKit Actions
 * 
 * Backend actions for persona management via CopilotKit.
 * Allows the AI assistant to help users create and manage personas.
 */

import { 
  getPersonaById, 
  getPersonasByAuthProfile,
  getActivePersona,
  setActivePersona,
} from '@/services/wallet/personaService';
import { 
  getPersonaFioService,
  SUPPORTED_DOMAINS,
} from '@/services/wallet/personaFioService';
import { isWalletUnlocked, getSessionInfo } from '@/services/wallet/sessionService';
import { CHAINS, getEnabledChains } from '@/types/chains';

// =============================================================================
// READ ACTIONS
// =============================================================================

/**
 * Get current active persona
 */
export const getActivePersonaAction = {
  name: "getActivePersona",
  description: "Get the currently active persona for the user, including FIO handle, reputation, and wallet status.",
  parameters: [],
  handler: async () => {
    try {
      const persona = await getActivePersona();
      
      if (!persona) {
        return {
          success: true,
          hasPersona: false,
          message: "No active persona. User should create a persona first.",
        };
      }
      
      const sessionInfo = getSessionInfo();
      
      return {
        success: true,
        hasPersona: true,
        persona: {
          id: persona.id,
          fioHandle: persona.fioHandle,
          displayName: persona.displayName,
          domain: persona.fioDomain,
          reputationScore: persona.reputationScore,
          reputationBucket: persona.reputationBucket,
          badges: persona.badges,
          status: persona.status,
          walletAddress: persona.evmKey?.address,
          isWalletUnlocked: sessionInfo.isUnlocked,
          sessionTimeRemaining: sessionInfo.timeRemaining,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
};

/**
 * List all personas for user
 */
export const listUserPersonasAction = {
  name: "listUserPersonas",
  description: "List all personas owned by the user. Shows FIO handles, reputation, and status for each.",
  parameters: [
    {
      name: "authProfileId",
      type: "string" as const,
      description: "The auth profile ID to list personas for.",
      required: true,
    },
  ],
  handler: async ({ authProfileId }: { authProfileId: string }) => {
    try {
      const personas = await getPersonasByAuthProfile(authProfileId);
      
      return {
        success: true,
        count: personas.length,
        personas: personas.map(p => ({
          id: p.id,
          fioHandle: p.fioHandle,
          displayName: p.displayName,
          domain: p.fioDomain,
          reputationScore: p.reputationScore,
          reputationBucket: p.reputationBucket,
          status: p.status,
          createdAt: p.createdAt,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
};

/**
 * Check FIO handle availability
 */
export const checkFioHandleAction = {
  name: "checkFioHandle",
  description: "Check if a FIO handle is available for registration. Supports @qripto and @knyt domains.",
  parameters: [
    {
      name: "username",
      type: "string" as const,
      description: "The username part of the FIO handle (without @domain).",
      required: true,
    },
    {
      name: "domain",
      type: "string" as const,
      description: "The FIO domain: 'qripto' or 'knyt'.",
      required: true,
    },
  ],
  handler: async ({ username, domain }: { username: string; domain: string }) => {
    try {
      if (!SUPPORTED_DOMAINS.includes(domain as any)) {
        return {
          success: false,
          error: `Invalid domain. Supported domains: ${SUPPORTED_DOMAINS.join(', ')}`,
        };
      }
      
      const fioService = getPersonaFioService();
      const result = await fioService.checkHandleAvailability(username, domain as any);
      
      return {
        success: true,
        handle: result.handle,
        available: result.available,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
};

/**
 * Get supported chains
 */
export const getSupportedChainsAction = {
  name: "getSupportedChains",
  description: "Get list of supported blockchain networks for persona wallets. Shows which chains are enabled in Phase 1.",
  parameters: [],
  handler: async () => {
    const enabledChains = getEnabledChains();
    
    return {
      success: true,
      chains: enabledChains.map(chain => ({
        id: chain.id,
        name: chain.name,
        shortName: chain.shortName,
        nativeToken: chain.nativeToken,
        supportedTokens: chain.supportedTokens,
        isEvm: chain.isEvm,
        phase: chain.phase,
      })),
      phase1Chains: ['base', 'optimism', 'polygon', 'knyt'],
    };
  },
};

/**
 * Get wallet session status
 */
export const getWalletSessionAction = {
  name: "getWalletSession",
  description: "Check if the wallet is currently unlocked and get session information.",
  parameters: [
    {
      name: "personaId",
      type: "string" as const,
      description: "The persona ID to check session for.",
      required: false,
    },
  ],
  handler: async ({ personaId }: { personaId?: string }) => {
    const sessionInfo = getSessionInfo();
    
    return {
      success: true,
      isUnlocked: sessionInfo.isUnlocked,
      personaId: sessionInfo.personaId,
      timeRemaining: sessionInfo.timeRemaining,
      expiresAt: sessionInfo.expiresAt?.toISOString(),
      message: sessionInfo.isUnlocked 
        ? `Wallet unlocked. ${Math.floor(sessionInfo.timeRemaining / 60)} minutes remaining.`
        : 'Wallet is locked. User needs to enter password to unlock.',
    };
  },
};

// =============================================================================
// WRITE ACTIONS
// =============================================================================

/**
 * Switch active persona
 */
export const switchPersonaAction = {
  name: "switchPersona",
  description: "Switch to a different persona. This changes the active identity for wallet operations.",
  parameters: [
    {
      name: "personaId",
      type: "string" as const,
      description: "The ID of the persona to switch to.",
      required: true,
    },
  ],
  handler: async ({ personaId }: { personaId: string }) => {
    try {
      const persona = await getPersonaById(personaId);
      
      if (!persona) {
        return {
          success: false,
          error: 'Persona not found.',
        };
      }
      
      await setActivePersona(personaId);
      
      return {
        success: true,
        message: `Switched to persona: ${persona.fioHandle}`,
        persona: {
          id: persona.id,
          fioHandle: persona.fioHandle,
          displayName: persona.displayName,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
};

// =============================================================================
// GUIDANCE ACTIONS
// =============================================================================

/**
 * Get persona setup guidance
 */
export const getPersonaSetupGuidanceAction = {
  name: "getPersonaSetupGuidance",
  description: "Get step-by-step guidance for creating a new persona. Explains the process and requirements.",
  parameters: [],
  handler: async () => {
    return {
      success: true,
      steps: [
        {
          step: 1,
          title: "Choose Domain",
          description: "Select @qripto for content & reputation or @knyt for gaming & rewards.",
        },
        {
          step: 2,
          title: "Pick Username",
          description: "Choose a unique username (1-64 characters, alphanumeric and hyphens).",
        },
        {
          step: 3,
          title: "Set Up Wallet",
          description: "Generate a new EVM key or import an existing one.",
        },
        {
          step: 4,
          title: "Create Password",
          description: "Set a strong password to encrypt your private key (8+ chars, uppercase, lowercase, number).",
        },
        {
          step: 5,
          title: "Confirm",
          description: "Review and create your persona. Your wallet will work across Base, Optimism, Polygon, and KNYT chains.",
        },
      ],
      supportedDomains: [
        { domain: 'qripto', description: 'Content & Reputation ecosystem', icon: '🔮' },
        { domain: 'knyt', description: 'Gaming & Rewards ecosystem', icon: '🗡️' },
      ],
      supportedChains: ['Base', 'Optimism', 'Polygon', 'KNYT Chain'],
    };
  },
};

// =============================================================================
// EXPORT
// =============================================================================

export const personaActions = [
  // Read actions
  getActivePersonaAction,
  listUserPersonasAction,
  checkFioHandleAction,
  getSupportedChainsAction,
  getWalletSessionAction,
  // Write actions
  switchPersonaAction,
  // Guidance
  getPersonaSetupGuidanceAction,
];
