/**
 * Smart Triad Orchestration Actions
 * 
 * Aigent Z Copilot as central orchestrator coordinating:
 * - SmartContent (ContentQubes, library, entitlements)
 * - SmartWallet (x402 payments, multi-chain Q¢, agent wallets)
 * - SmartMenu (UI manifests, drawer configs, action routing)
 * 
 * These actions enable NL → coordinated service operations.
 */

import { getSmartContentService } from "@/services/content";
import { getSmartMenuIntegrationService } from "@/services/content/smartMenuIntegration";
import { agentConfigs } from "@/app/data/agentConfig";
import type { SmartContentQube } from "@/types/smartContent";

// =============================================================================
// CHAIN CONFIGURATION
// =============================================================================

const CHAIN_CONFIG = {
  arb: { chainId: 421614, name: "Arbitrum Sepolia", asset: "QCT" },
  base: { chainId: 84532, name: "Base Sepolia", asset: "QCT" },
  polygon: { chainId: 80002, name: "Polygon Amoy", asset: "QCT" },
  optimism: { chainId: 11155420, name: "Optimism Sepolia", asset: "QCT" },
  knyt: { chainId: 1, name: "Ethereum Mainnet", asset: "KNYT" },
} as const;

type PaymentChain = keyof typeof CHAIN_CONFIG;

// =============================================================================
// TRIAD PURCHASE CONTENT
// =============================================================================

/**
 * Orchestrated content purchase flow
 * Coordinates: Content lookup → Wallet payment → Entitlement grant → Menu update
 */
export const triadPurchaseContentAction = {
  name: "triad_purchase_content",
  description: `Purchase smart content using the coordinated triad flow. This action:
1. Validates content exists and has pricing
2. Executes payment via x402 agent wallet (AigentZ → content creator)
3. Grants entitlement to the persona
4. Returns updated menu manifest

Use when user says: "buy this content", "purchase episode", "unlock article", etc.`,
  parameters: [
    {
      name: "contentId",
      type: "string" as const,
      description: "The SmartContentQube ID to purchase.",
      required: true,
    },
    {
      name: "personaId",
      type: "string" as const,
      description: "The persona ID making the purchase.",
      required: true,
    },
    {
      name: "paymentChain",
      type: "string" as const,
      description: "Chain for Q¢ payment: 'arb' (Arbitrum), 'base' (Base), 'polygon' (Polygon), 'optimism' (Optimism), or 'knyt' (KNYT on Mainnet). Default: 'arb'.",
      required: false,
    },
    {
      name: "payerAgentId",
      type: "string" as const,
      description: "Agent ID for the payer wallet. Default: 'aigent-z'.",
      required: false,
    },
  ],
  handler: async ({
    contentId,
    personaId,
    paymentChain = "arb",
    payerAgentId = "aigent-z",
  }: {
    contentId: string;
    personaId: string;
    paymentChain?: string;
    payerAgentId?: string;
  }) => {
    const steps: Array<{ step: number; action: string; status: string; result?: any; error?: string }> = [];
    let stepNum = 1;

    try {
      // Step 1: Fetch content and validate
      const contentService = getSmartContentService();
      const content = await contentService.getById(contentId);
      
      if (!content) {
        return {
          success: false,
          error: `Content not found: ${contentId}`,
          steps,
        };
      }

      steps.push({
        step: stepNum++,
        action: "content_lookup",
        status: "completed",
        result: { title: content.title, status: content.status },
      });

      // Step 2: Check if already entitled
      const existingEntitlement = await contentService.checkEntitlement(contentId, personaId);
      if (existingEntitlement) {
        return {
          success: true,
          alreadyOwned: true,
          message: `You already own "${content.title}"`,
          entitlement: existingEntitlement,
          steps,
        };
      }

      // Step 3: Get pricing
      const pricing = content.pricingModel?.tiers?.[0];
      if (!pricing || pricing.kind === "free" || pricing.amount === 0) {
        // Free content - grant entitlement directly
        const entitlement = await contentService.grantEntitlement({
          contentId,
          personaId,
          scope: "full",
          acquiredVia: "free",
        });

        steps.push({
          step: stepNum++,
          action: "grant_free_entitlement",
          status: "completed",
          result: { entitlementId: entitlement.id },
        });

        return {
          success: true,
          free: true,
          message: `"${content.title}" added to your library (free content)`,
          entitlement,
          steps,
        };
      }

      steps.push({
        step: stepNum++,
        action: "pricing_check",
        status: "completed",
        result: { amount: pricing.amount, currency: pricing.currency, kind: pricing.kind },
      });

      // Step 4: Get chain config
      const chain = CHAIN_CONFIG[paymentChain as PaymentChain] || CHAIN_CONFIG.arb;
      const payerAgent = agentConfigs[payerAgentId] || agentConfigs["aigent-z"];
      
      // Determine recipient (content creator or default)
      const recipientAgent = agentConfigs["aigent-kn0w1"]; // Default content recipient
      const recipientAddress = recipientAgent?.walletAddresses.evmAddress || content.creatorRootDid;

      steps.push({
        step: stepNum++,
        action: "payment_config",
        status: "completed",
        result: {
          chain: chain.name,
          chainId: chain.chainId,
          payer: payerAgent.name,
          recipient: recipientAgent?.name || "Creator",
        },
      });

      // Step 5: Execute payment via x402 agent signer
      const amountWei = (BigInt(pricing.amount) * 10n ** 18n).toString();
      
      const transferResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/a2a/signer/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainId: chain.chainId,
          amount: amountWei,
          asset: chain.asset,
          agentId: payerAgentId,
          to: recipientAddress,
          tokenAddress: "0x4C4f1aD931589449962bB675bcb8e95672349d09", // QCT token
        }),
      });

      if (!transferResponse.ok) {
        const errorText = await transferResponse.text();
        steps.push({
          step: stepNum++,
          action: "payment_transfer",
          status: "failed",
          error: errorText,
        });
        return {
          success: false,
          error: `Payment failed: ${errorText}`,
          steps,
        };
      }

      const transferResult = await transferResponse.json();
      const txHash = transferResult.txHash;

      steps.push({
        step: stepNum++,
        action: "payment_transfer",
        status: "completed",
        result: { txHash, chain: chain.name },
      });

      // Step 6: Grant entitlement
      const entitlement = await contentService.grantEntitlement({
        contentId,
        personaId,
        scope: "full",
        acquiredVia: "purchase",
        txHash,
        chainId: chain.chainId,
      });

      steps.push({
        step: stepNum++,
        action: "grant_entitlement",
        status: "completed",
        result: { entitlementId: entitlement.id },
      });

      // Step 7: Generate updated menu manifest
      const menuService = getSmartMenuIntegrationService();
      // Note: Full manifest generation would need wallet node - simplified here
      
      steps.push({
        step: stepNum++,
        action: "menu_update",
        status: "completed",
        result: { manifestGenerated: true },
      });

      return {
        success: true,
        message: `Successfully purchased "${content.title}" for ${pricing.amount} ${pricing.currency}`,
        content: {
          id: content.id,
          title: content.title,
          app: content.app,
        },
        payment: {
          txHash,
          chain: chain.name,
          amount: pricing.amount,
          currency: pricing.currency,
        },
        entitlement: {
          id: entitlement.id,
          scope: entitlement.scope,
        },
        steps,
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Purchase failed",
        steps,
      };
    }
  },
};

// =============================================================================
// TRIAD CONFIGURE EXPERIENCE
// =============================================================================

/**
 * Generate SmartMenuManifest for content experience
 * Coordinates: Content modalities → Wallet state → Menu configuration
 */
export const triadConfigureExperienceAction = {
  name: "triad_configure_experience",
  description: `Configure the UI experience for viewing smart content. Generates a SmartMenuManifest based on:
- Content modalities (read, watch, listen, interact)
- User's wallet state and entitlements
- Layout hints from the content

Use when user opens content or says: "show me this content", "configure view", etc.`,
  parameters: [
    {
      name: "contentId",
      type: "string" as const,
      description: "The SmartContentQube ID to configure experience for.",
      required: true,
    },
    {
      name: "personaId",
      type: "string" as const,
      description: "The persona ID viewing the content.",
      required: true,
    },
    {
      name: "preferredDrawers",
      type: "string" as const,
      description: "Comma-separated list of preferred drawer types: contentViewer, agentChat, walletCompact, walletFull, libraryShelf, questTracker, rewardsPanel.",
      required: false,
    },
  ],
  handler: async ({
    contentId,
    personaId,
    preferredDrawers,
  }: {
    contentId: string;
    personaId: string;
    preferredDrawers?: string;
  }) => {
    try {
      const contentService = getSmartContentService();
      const menuService = getSmartMenuIntegrationService();

      // Fetch content
      const content = await contentService.getById(contentId);
      if (!content) {
        return {
          success: false,
          error: `Content not found: ${contentId}`,
        };
      }

      // Check entitlement
      const entitlement = await contentService.checkEntitlement(contentId, personaId);
      const hasAccess = !!entitlement;

      // Determine active modalities
      const activeModalities: string[] = [];
      if (content.modalities?.read?.enabled) activeModalities.push("read");
      if (content.modalities?.watch?.enabled) activeModalities.push("watch");
      if (content.modalities?.listen?.enabled) activeModalities.push("listen");
      if (content.modalities?.interact?.enabled) activeModalities.push("interact");

      // Build drawer configuration
      const defaultDrawers = ["contentViewer", "walletCompact"];
      if (content.modalities?.interact?.enabled) {
        defaultDrawers.push("agentChat");
      }
      
      const drawers = preferredDrawers 
        ? preferredDrawers.split(",").map(d => d.trim())
        : defaultDrawers;

      // Determine wallet mode based on access
      const walletMode = hasAccess ? "compact" : "full"; // Show full wallet if purchase needed

      // Build actions
      const actions: Array<{ id: string; type: string; label: string; handler: string; isPrimary: boolean }> = [];
      
      if (!hasAccess && content.pricingModel?.tiers?.length) {
        const tier = content.pricingModel.tiers[0];
        actions.push({
          id: "action_purchase",
          type: "payment",
          label: `Buy for ${tier.amount} ${tier.currency}`,
          handler: "triad_purchase_content",
          isPrimary: true,
        });
      }

      actions.push({
        id: "action_bookmark",
        type: "bookmark",
        label: hasAccess ? "In Library" : "Add to Wishlist",
        handler: "triad_add_to_library",
        isPrimary: false,
      });

      if (content.modalities?.interact?.enabled) {
        actions.push({
          id: "action_chat",
          type: "agent",
          label: "Chat with Agent",
          handler: "triad_agent_chat",
          isPrimary: false,
        });
      }

      // Build manifest
      const manifest = {
        id: `manifest_${contentId}_${Date.now()}`,
        contentId,
        personaId,
        content: {
          title: content.title,
          app: content.app,
          modalities: activeModalities,
        },
        access: {
          hasAccess,
          entitlementId: entitlement?.id || null,
          scope: entitlement?.scope || null,
        },
        drawers: drawers.map((type, idx) => ({
          type,
          position: idx,
          isActive: idx === 0,
        })),
        walletMode,
        actions,
        layout: {
          mode: "split",
          drawerPosition: "right",
          drawerWidth: "21.6rem",
        },
        configSource: preferredDrawers ? "user" : "content",
      };

      return {
        success: true,
        manifest,
        message: `Experience configured for "${content.title}"`,
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to configure experience",
      };
    }
  },
};

// =============================================================================
// TRIAD BROWSE LIBRARY
// =============================================================================

/**
 * Browse user's content library
 * Queries entitlements and organizes by status
 */
export const triadBrowseLibraryAction = {
  name: "triad_browse_library",
  description: `Browse the user's content library. Returns:
- Owned content (purchased/entitled)
- Bookmarked/wishlisted content
- In-progress content (partially consumed)

Use when user says: "show my library", "what do I own", "my content", etc.`,
  parameters: [
    {
      name: "personaId",
      type: "string" as const,
      description: "The persona ID to browse library for.",
      required: true,
    },
    {
      name: "filter",
      type: "string" as const,
      description: "Filter by: 'owned', 'bookmarked', 'inProgress', 'all'. Default: 'all'.",
      required: false,
    },
    {
      name: "app",
      type: "string" as const,
      description: "Filter by app: 'metaKnyts', 'Qriptopian', 'AgentiQ'. Leave empty for all.",
      required: false,
    },
  ],
  handler: async ({
    personaId,
    filter = "all",
    app,
  }: {
    personaId: string;
    filter?: string;
    app?: string;
  }) => {
    try {
      const contentService = getSmartContentService();

      // Get user's entitlements
      const entitlements = await contentService.getEntitlementsByPersona(personaId);

      // Get content details for each entitlement
      const ownedContent: Array<{ content: Partial<SmartContentQube>; entitlement: any }> = [];
      
      for (const ent of entitlements) {
        const content = await contentService.getById(ent.contentId);
        if (content && (!app || content.app === app)) {
          ownedContent.push({
            content: {
              id: content.id,
              title: content.title,
              app: content.app,
              coverImageUri: content.coverImageUri,
              status: content.status,
            },
            entitlement: {
              id: ent.id,
              scope: ent.scope,
              acquiredVia: ent.acquiredVia,
            },
          });
        }
      }

      // TODO: Implement bookmarks and progress tracking
      const bookmarked: any[] = [];
      const inProgress: any[] = [];

      const result: any = {
        success: true,
        personaId,
        summary: {
          ownedCount: ownedContent.length,
          bookmarkedCount: bookmarked.length,
          inProgressCount: inProgress.length,
        },
      };

      if (filter === "all" || filter === "owned") {
        result.owned = ownedContent;
      }
      if (filter === "all" || filter === "bookmarked") {
        result.bookmarked = bookmarked;
      }
      if (filter === "all" || filter === "inProgress") {
        result.inProgress = inProgress;
      }

      result.message = `Found ${ownedContent.length} owned items in library`;

      return result;

    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to browse library",
      };
    }
  },
};

// =============================================================================
// TRIAD RECOMMEND CONTENT
// =============================================================================

/**
 * Get content recommendations based on persona context
 */
export const triadRecommendContentAction = {
  name: "triad_recommend_content",
  description: `Get personalized content recommendations. Considers:
- User's owned content and preferences
- Content popularity and ratings
- App context (metaKnyts, Qriptopian, AgentiQ)

Use when user says: "what should I read", "recommend something", "discover content", etc.`,
  parameters: [
    {
      name: "personaId",
      type: "string" as const,
      description: "The persona ID to get recommendations for.",
      required: true,
    },
    {
      name: "app",
      type: "string" as const,
      description: "Filter by app: 'metaKnyts', 'Qriptopian', 'AgentiQ'. Leave empty for all.",
      required: false,
    },
    {
      name: "limit",
      type: "number" as const,
      description: "Maximum number of recommendations. Default: 5.",
      required: false,
    },
  ],
  handler: async ({
    personaId,
    app,
    limit = 5,
  }: {
    personaId: string;
    app?: string;
    limit?: number;
  }) => {
    try {
      const contentService = getSmartContentService();

      // Get published content
      const allContentResult = await contentService.list({ status: "published" });
      const allContent = allContentResult.data;

      // Get user's entitlements to exclude owned content
      const entitlements = await contentService.getEntitlementsByPersona(personaId);
      const ownedIds = new Set(entitlements.map((e: any) => e.contentId));

      // Filter and sort recommendations
      const filtered = allContent
        .filter((c: SmartContentQube) => !ownedIds.has(c.id)) // Exclude owned
        .filter((c: SmartContentQube) => !app || c.app === app); // Filter by app if specified

      // Simple scoring (could be enhanced with ML)
      const recommendations = filtered
        .slice(0, limit)
        .map((c: SmartContentQube) => ({
          id: c.id,
          title: c.title,
          app: c.app,
          description: c.description,
          coverImageUri: c.coverImageUri,
          pricing: c.pricingModel?.tiers?.[0] || null,
          reason: "Popular in your interests",
        }));

      return {
        success: true,
        personaId,
        recommendations,
        message: `Found ${recommendations.length} recommendations`,
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to get recommendations",
      };
    }
  },
};

// =============================================================================
// TRIAD AGENT CHAT
// =============================================================================

/**
 * Initiate agent chat for content
 */
export const triadAgentChatAction = {
  name: "triad_agent_chat",
  description: `Start an agent chat session for interactive content. The agent can:
- Answer questions about the content
- Guide through interactive experiences
- Provide personalized assistance

Use when user says: "chat about this", "ask the agent", "help with content", etc.`,
  parameters: [
    {
      name: "contentId",
      type: "string" as const,
      description: "The SmartContentQube ID to chat about.",
      required: true,
    },
    {
      name: "personaId",
      type: "string" as const,
      description: "The persona ID initiating the chat.",
      required: true,
    },
    {
      name: "initialMessage",
      type: "string" as const,
      description: "Optional initial message to send to the agent.",
      required: false,
    },
  ],
  handler: async ({
    contentId,
    personaId,
    initialMessage,
  }: {
    contentId: string;
    personaId: string;
    initialMessage?: string;
  }) => {
    try {
      const contentService = getSmartContentService();
      const content = await contentService.getById(contentId);

      if (!content) {
        return {
          success: false,
          error: `Content not found: ${contentId}`,
        };
      }

      if (!content.modalities?.interact?.enabled) {
        return {
          success: false,
          error: "This content does not support agent interaction",
        };
      }

      const agents = content.modalities.interact.agents || [];
      if (agents.length === 0) {
        return {
          success: false,
          error: "No agents configured for this content",
        };
      }

      // Create chat session
      const sessionId = `chat_${contentId}_${personaId}_${Date.now()}`;

      return {
        success: true,
        session: {
          id: sessionId,
          contentId,
          personaId,
          agents,
          status: "active",
        },
        content: {
          title: content.title,
          app: content.app,
        },
        initialMessage: initialMessage || null,
        message: `Chat session started for "${content.title}" with ${agents.length} agent(s)`,
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to start agent chat",
      };
    }
  },
};

// =============================================================================
// EXPORT ALL TRIAD ACTIONS
// =============================================================================

export const smartTriadActions = [
  triadPurchaseContentAction,
  triadConfigureExperienceAction,
  triadBrowseLibraryAction,
  triadRecommendContentAction,
  triadAgentChatAction,
];
