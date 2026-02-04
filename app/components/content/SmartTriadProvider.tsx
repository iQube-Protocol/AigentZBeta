"use client";

/**
 * Smart Triad Provider
 * 
 * React context that coordinates the SmartContent + SmartWallet + SmartMenu triad,
 * with Aigent Z Copilot as the central orchestrator.
 * 
 * Provides:
 * - Unified state for content, wallet, and menu
 * - Copilot action hooks for NL commands
 * - Event coordination across services
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import type { SmartContentQube } from "@/types/smartContent";
import type { SmartWalletNode } from "@/types/smartWallet";
import { selectCompassActions } from "@/services/content/smartMenuIntegration";

// =============================================================================
// TYPES
// =============================================================================

export type PaymentChain = "arb" | "base" | "polygon" | "optimism" | "knyt";

function deriveCompassDirective(
  content: SmartContentQube | null,
  hasAccess: boolean,
  viewerModality: string | null
): string | undefined {
  if (!content) return undefined;
  const hasPaidTier = !!content.pricingModel?.tiers?.some((tier) => (tier.amount ?? 0) > 0);
  if (!hasAccess && hasPaidTier) return "buy";
  if (viewerModality) return viewerModality;
  if (content.modalities?.interact?.enabled) return "play";
  if (
    content.modalities?.read?.enabled ||
    content.modalities?.watch?.enabled ||
    content.modalities?.listen?.enabled
  ) {
    return "play";
  }
  return undefined;
}

export interface SmartMenuManifest {
  id: string;
  contentId: string;
  personaId: string;
  content: {
    title: string;
    app: string;
    modalities: string[];
  };
  access: {
    hasAccess: boolean;
    entitlementId: string | null;
    scope: string | null;
  };
  drawers: Array<{
    type: string;
    position: number;
    isActive: boolean;
  }>;
  walletMode: "hidden" | "compact" | "full";
  actions: Array<{
    id: string;
    type: string;
    label: string;
    handler: string;
    isPrimary: boolean;
  }>;
  layout: {
    mode: string;
    drawerPosition: string;
    drawerWidth: string;
  };
  configSource: string;
}

export interface TriadState {
  // Content state
  currentContent: SmartContentQube | null;
  contentLoading: boolean;
  contentError: string | null;
  viewerModality: string | null;
  
  // Wallet state
  walletOpen: boolean;
  walletMode: "compact" | "full";
  walletUI: Array<import("@/app/types/knytLiquidUI").WalletUIComponent>;
  walletDrawerMode: import("@/app/types/knytLiquidUI").DrawerMode;
  
  // Menu state
  menuManifest: SmartMenuManifest | null;
  activeDrawer: string | null;
  
  // Purchase state
  purchaseInProgress: boolean;
  purchaseError: string | null;
  lastPurchase: {
    contentId: string;
    txHash: string;
    chain: string;
  } | null;
  
  // Library state
  ownedContentIds: Set<string>;
  libraryLoading: boolean;

  // Developer overrides
  devGatingOverride: boolean;
}

export interface TriadActions {
  // Content actions
  setContent: (content: SmartContentQube | null) => void;
  loadContent: (contentId: string) => Promise<void>;
  setViewerModality: (modality: string | null) => void;
  
  // Wallet actions
  openWallet: (mode?: "compact" | "full") => void;
  closeWallet: () => void;
  setWalletUI: (components: Array<import("@/app/types/knytLiquidUI").WalletUIComponent>) => void;
  setWalletDrawerMode: (mode: import("@/app/types/knytLiquidUI").DrawerMode) => void;
  
  // Menu actions
  setActiveDrawer: (drawer: string | null) => void;
  configureExperience: (contentId: string, directive?: string) => Promise<SmartMenuManifest | null>;
  
  // Purchase actions (Copilot-orchestrated)
  purchaseContent: (contentId: string, chain?: PaymentChain) => Promise<boolean>;
  
  // Library actions
  refreshLibrary: () => Promise<void>;
  checkOwnership: (contentId: string) => boolean;

  // Developer overrides
  setDevGatingOverride: (enabled: boolean) => void;
  
  // Copilot integration
  executeTriadAction: (actionName: string, params: Record<string, any>) => Promise<any>;
}

interface SmartTriadContextValue {
  state: TriadState;
  actions: TriadActions;
  personaId: string | null;
  agentId: string;
}

// =============================================================================
// CONTEXT
// =============================================================================

const SmartTriadContext = createContext<SmartTriadContextValue | null>(null);
const DEV_OVERRIDE_STORAGE_KEY = "agentiq_dev_gating_override";

// =============================================================================
// PROVIDER
// =============================================================================

interface SmartTriadProviderProps {
  children: ReactNode;
  personaId?: string;
  agentId?: string;
  initialContent?: SmartContentQube;
}

export function SmartTriadProvider({
  children,
  personaId = "00000000-0000-0000-0000-000000000001", // Default demo persona
  agentId = "aigent-z",
  initialContent,
}: SmartTriadProviderProps) {
  // State
  const [state, setState] = useState<TriadState>({
    currentContent: initialContent || null,
    contentLoading: false,
    contentError: null,
    viewerModality: null,
    walletOpen: false,
    walletMode: "compact",
    walletUI: [],
    walletDrawerMode: "narrow",
    menuManifest: null,
    activeDrawer: "contentViewer",
    purchaseInProgress: false,
    purchaseError: null,
    lastPurchase: null,
    ownedContentIds: new Set(),
    libraryLoading: false,
    devGatingOverride: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const envOverride = process.env.NEXT_PUBLIC_DEV_TOKEN_OVERRIDE === "true";
    const storedOverride = localStorage.getItem(DEV_OVERRIDE_STORAGE_KEY) === "true";
    if (envOverride || storedOverride) {
      setState(prev => ({ ...prev, devGatingOverride: true }));
    }
  }, []);

  // Load library on mount
  useEffect(() => {
    if (personaId) {
      refreshLibrary();
    }
  }, [personaId]);

  // Configure experience when content changes
  useEffect(() => {
    if (state.currentContent && personaId) {
      configureExperience(state.currentContent.id);
    }
  }, [state.currentContent?.id, personaId]);

  // ==========================================================================
  // CONTENT ACTIONS
  // ==========================================================================

  const setContent = useCallback((content: SmartContentQube | null) => {
    setState(prev => ({
      ...prev,
      currentContent: content,
      contentError: null,
    }));
  }, []);

  const setViewerModality = useCallback((modality: string | null) => {
    setState(prev => ({
      ...prev,
      viewerModality: modality,
    }));
  }, []);

  const loadContent = useCallback(async (contentId: string) => {
    setState(prev => ({ ...prev, contentLoading: true, contentError: null }));
    
    try {
      const res = await fetch(`/api/content/smart/${contentId}`);
      if (!res.ok) throw new Error("Content not found");
      
      const data = await res.json();
      if (data.success && data.data) {
        setState(prev => ({
          ...prev,
          currentContent: data.data,
          contentLoading: false,
        }));
      } else {
        throw new Error(data.error || "Failed to load content");
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        contentLoading: false,
        contentError: error.message,
      }));
    }
  }, []);

  // ==========================================================================
  // WALLET ACTIONS
  // ==========================================================================

  const openWallet = useCallback((mode: "compact" | "full" = "compact") => {
    setState(prev => ({
      ...prev,
      walletOpen: true,
      walletMode: mode,
    }));
  }, []);

  const closeWallet = useCallback(() => {
    setState(prev => ({
      ...prev,
      walletOpen: false,
    }));
  }, []);

  const setWalletUI = useCallback((components: Array<import("@/app/types/knytLiquidUI").WalletUIComponent>) => {
    setState(prev => ({
      ...prev,
      walletUI: components,
    }));
  }, []);

  const setWalletDrawerMode = useCallback((mode: import("@/app/types/knytLiquidUI").DrawerMode) => {
    setState(prev => ({
      ...prev,
      walletDrawerMode: mode,
    }));
  }, []);

  // ==========================================================================
  // MENU ACTIONS
  // ==========================================================================

  const setActiveDrawer = useCallback((drawer: string | null) => {
    setState(prev => ({
      ...prev,
      activeDrawer: drawer,
    }));
  }, []);

  const configureExperience = useCallback(async (
    contentId: string,
    directiveOverride?: string
  ): Promise<SmartMenuManifest | null> => {
    try {
      // Call Copilot triad action via API
      const res = await fetch("/api/copilotkit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "triad_configure_experience",
          params: { contentId, personaId },
        }),
      });

      // For now, generate manifest locally (Copilot integration will be via chat)
      const content = state.currentContent;
      if (!content) return null;

      const hasAccess = state.devGatingOverride || state.ownedContentIds.has(contentId);
      
      const directive = directiveOverride || deriveCompassDirective(content, hasAccess, state.viewerModality);
      const compassActions = selectCompassActions(
        {
          directive,
          content,
          ownedContent: hasAccess,
          hasActivePersona: Boolean(personaId),
          recentActions: state.lastPurchase ? ["pay"] : [],
          mode: "runtime",
        },
        {
          handlerOverrides: {
            pay: "triad_purchase_content",
          },
        }
      );

      const manifest: SmartMenuManifest = {
        id: `manifest_${contentId}_${Date.now()}`,
        contentId,
        personaId: personaId || "",
        content: {
          title: content.title,
          app: content.app,
          modalities: Object.entries(content.modalities || {})
            .filter(([_, v]) => {
              const mod = v as any;
              if (typeof mod?.enabled === "boolean") return mod.enabled;
              if (typeof mod?.available === "boolean") return mod.available;
              return false;
            })
            .map(([k]) => k),
        },
        access: {
          hasAccess,
          entitlementId: null,
          scope: hasAccess ? "full" : null,
        },
        drawers: [
          { type: "contentViewer", position: 0, isActive: true },
          { type: "walletCompact", position: 1, isActive: false },
        ],
        walletMode: hasAccess ? "compact" : "full",
        actions: compassActions.map(({ id, type, label, handler, isPrimary }) => ({
          id,
          type,
          label,
          handler,
          isPrimary,
        })),
        layout: {
          mode: "split",
          drawerPosition: "right",
          drawerWidth: "21.6rem",
        },
        configSource: "content",
      };

      setState(prev => ({
        ...prev,
        menuManifest: manifest,
      }));

      return manifest;
    } catch (error) {
      console.error("Failed to configure experience:", error);
      return null;
    }
  }, [
    personaId,
    state.currentContent,
    state.ownedContentIds,
    state.devGatingOverride,
    state.viewerModality,
    state.lastPurchase,
  ]);

  // ==========================================================================
  // PURCHASE ACTIONS (Copilot-orchestrated)
  // ==========================================================================

  const purchaseContent = useCallback(async (
    contentId: string,
    chain: PaymentChain = "arb"
  ): Promise<boolean> => {
    if (!personaId) {
      setState(prev => ({ ...prev, purchaseError: "No persona ID" }));
      return false;
    }

    setState(prev => ({
      ...prev,
      purchaseInProgress: true,
      purchaseError: null,
    }));

    try {
      // Execute via Copilot triad action
      const result = await executeTriadAction("triad_purchase_content", {
        contentId,
        personaId,
        paymentChain: chain,
        payerAgentId: agentId,
      });

      if (result.success) {
        setState(prev => ({
          ...prev,
          purchaseInProgress: false,
          lastPurchase: {
            contentId,
            txHash: result.payment?.txHash || "",
            chain: result.payment?.chain || chain,
          },
          ownedContentIds: new Set([...prev.ownedContentIds, contentId]),
        }));

        // Refresh menu manifest
        await configureExperience(contentId);
        
        return true;
      } else {
        throw new Error(result.error || "Purchase failed");
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        purchaseInProgress: false,
        purchaseError: error.message,
      }));
      return false;
    }
  }, [personaId, agentId, configureExperience]);

  // ==========================================================================
  // LIBRARY ACTIONS
  // ==========================================================================

  const refreshLibrary = useCallback(async () => {
    if (!personaId) return;

    setState(prev => ({ ...prev, libraryLoading: true }));

    try {
      const result = await executeTriadAction("triad_browse_library", {
        personaId,
        filter: "owned",
      });

      if (result.success && result.owned) {
        const ownedIds = new Set<string>(
          result.owned.map((item: any) => item.content?.id).filter(Boolean)
        );
        setState(prev => ({
          ...prev,
          ownedContentIds: ownedIds,
          libraryLoading: false,
        }));
      }
    } catch (error) {
      console.error("Failed to refresh library:", error);
      setState(prev => ({ ...prev, libraryLoading: false }));
    }
  }, [personaId]);

  const checkOwnership = useCallback((contentId: string): boolean => {
    if (state.devGatingOverride) return true;
    return state.ownedContentIds.has(contentId);
  }, [state.ownedContentIds, state.devGatingOverride]);

  const setDevGatingOverride = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, devGatingOverride: enabled }));
    if (typeof window !== "undefined") {
      localStorage.setItem(DEV_OVERRIDE_STORAGE_KEY, enabled ? "true" : "false");
    }
  }, []);

  // ==========================================================================
  // COPILOT INTEGRATION
  // ==========================================================================

  const executeTriadAction = useCallback(async (
    actionName: string,
    params: Record<string, any>
  ): Promise<any> => {
    try {
      // Direct API call to execute triad action
      // In production, this would go through CopilotKit
      const actionMap: Record<string, string> = {
        triad_purchase_content: "/api/content/triad/purchase",
        triad_configure_experience: "/api/content/triad/configure",
        triad_browse_library: "/api/content/triad/library",
        triad_recommend_content: "/api/content/triad/recommend",
        triad_agent_chat: "/api/content/triad/chat",
      };

      const endpoint = actionMap[actionName];
      
      // Fallback: execute action handler directly
      // This simulates what Copilot would do
      if (actionName === "triad_browse_library") {
        // Direct service call for library
        const res = await fetch(`/api/content/smart?personaId=${params.personaId}`);
        const data = await res.json();
        return {
          success: true,
          owned: data.data?.map((c: any) => ({ content: c })) || [],
        };
      }

      if (actionName === "triad_purchase_content") {
        // Use existing purchase flow
        const content = state.currentContent;
        if (!content) return { success: false, error: "No content selected" };

        const pricing = content.pricingModel?.tiers?.[0];
        if (!pricing || pricing.amount === 0) {
          // Free content
          return { success: true, free: true };
        }

        // Execute payment via a2a signer
        const chainConfig: Record<PaymentChain, number> = {
          arb: 421614,
          base: 84532,
          polygon: 80002,
          optimism: 11155420,
          knyt: 1,
        };

        const chainId = chainConfig[params.paymentChain as PaymentChain] || 421614;
        const amountWei = (BigInt(pricing.amount) * 10n ** 18n).toString();

        const transferRes = await fetch("/api/a2a/signer/transfer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chainId,
            amount: amountWei,
            asset: "QCT",
            agentId: params.payerAgentId || "aigent-z",
            to: "0x875E825E0341b330065152ddaE37CBb843FC8D84", // Kn0w1
            tokenAddress: "0x4C4f1aD931589449962bB675bcb8e95672349d09",
          }),
        });

        if (!transferRes.ok) {
          const err = await transferRes.text();
          return { success: false, error: err };
        }

        const transferData = await transferRes.json();
        
        // Grant entitlement
        if (transferData.txHash) {
          await fetch(`/api/content/pricing/${content.id}/entitlement`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              personaId: params.personaId,
              scope: "full",
              acquiredVia: "purchase",
              txHash: transferData.txHash,
              chainId,
            }),
          });
        }

        return {
          success: true,
          payment: {
            txHash: transferData.txHash,
            chain: params.paymentChain,
          },
        };
      }

      return { success: false, error: "Unknown action" };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }, [state.currentContent]);

  // ==========================================================================
  // CONTEXT VALUE
  // ==========================================================================

  const contextValue: SmartTriadContextValue = {
    state,
    actions: {
      setContent,
      loadContent,
      setViewerModality,
      openWallet,
      closeWallet,
      setWalletUI,
      setWalletDrawerMode,
      setActiveDrawer,
      configureExperience,
      purchaseContent,
      refreshLibrary,
      checkOwnership,
      setDevGatingOverride,
      executeTriadAction,
    },
    personaId,
    agentId,
  };

  return (
    <SmartTriadContext.Provider value={contextValue}>
      {children}
    </SmartTriadContext.Provider>
  );
}

// =============================================================================
// HOOKS
// =============================================================================

export function useSmartTriad() {
  const context = useContext(SmartTriadContext);
  if (!context) {
    throw new Error("useSmartTriad must be used within a SmartTriadProvider");
  }
  return context;
}

export function useOptionalSmartTriad() {
  return useContext(SmartTriadContext);
}

export function useTriadContent() {
  const { state, actions } = useSmartTriad();
  return {
    content: state.currentContent,
    loading: state.contentLoading,
    error: state.contentError,
    setContent: actions.setContent,
    loadContent: actions.loadContent,
  };
}

export function useTriadWallet() {
  const { state, actions } = useSmartTriad();
  return {
    isOpen: state.walletOpen,
    mode: state.walletMode,
    open: actions.openWallet,
    close: actions.closeWallet,
  };
}

export function useTriadMenu() {
  const { state, actions } = useSmartTriad();
  return {
    manifest: state.menuManifest,
    activeDrawer: state.activeDrawer,
    setActiveDrawer: actions.setActiveDrawer,
    configureExperience: actions.configureExperience,
  };
}

export function useTriadPurchase() {
  const { state, actions } = useSmartTriad();
  return {
    inProgress: state.purchaseInProgress,
    error: state.purchaseError,
    lastPurchase: state.lastPurchase,
    purchase: actions.purchaseContent,
    checkOwnership: actions.checkOwnership,
  };
}

export function useTriadLibrary() {
  const { state, actions } = useSmartTriad();
  return {
    ownedIds: state.ownedContentIds,
    loading: state.libraryLoading,
    refresh: actions.refreshLibrary,
    checkOwnership: actions.checkOwnership,
  };
}
