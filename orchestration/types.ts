/**
 * Orchestration Types
 * 
 * Smart Triad flow orchestration and narrative engine types
 */

import type { DrawerSize, SmartMenuBehavior } from "@/ui/smartLayout/types";

// =============================================================================
// FLOW CONTEXT
// =============================================================================

export type IdentityState = "anon" | "pseudo" | "semi" | "full";

export interface FlowContext {
  persona: {
    id: string;
    identityState: IdentityState;
    claimsCount?: number;
  };
  
  location: {
    appId: string;
    activeAgentId: string;
    activeDrawerId?: string;
    activeTabId?: string;
  };
  
  content?: {
    smartContentId?: string;
    category?: string;
    modality?: "read" | "watch" | "listen" | "interact";
    ownedByUser?: boolean;
    priceQc?: number;
  };
  
  wallet?: {
    walletId?: string;
    totalQc?: number;
    hasRequiredFunds?: boolean;
    entitlements?: string[];
    supportsRemoteCustody?: boolean;
    supportsDeferredMint?: boolean;
    supportsCanonicalSale?: boolean;
  };
  
  defi?: {
    hasOpenPositions?: boolean;
    portfolioValue?: number;
    dominantRiskBand?: "low" | "medium" | "high" | "experimental";
  };
  
  intent?: {
    inferredGoal?: "understand" | "unlock" | "optimise" | "explore" | "cashflow";
    explicitGoal?: string;
  };
}

// =============================================================================
// ORCHESTRATION DECISIONS
// =============================================================================

export interface DrawerChange {
  action:
    | "focusDrawer"
    | "focusTab"
    | "openDrawer"
    | "highlightDrawer"
    | "resizeDrawer"
    | "updateMenuBehavior"
    | "noChange";
  drawerId?: string;
  tabId?: string;
  size?: DrawerSize;
  menuBehavior?: SmartMenuBehavior;
  reason?: string;
}

export interface NarrativeHints {
  arrive?: string;
  align?: string;
  assess?: string;
  adapt?: string;
  act?: string;
  anchor?: string;
}

export interface OrchestrationDecision {
  flowContext: FlowContext;
  primaryAgentId: string;
  secondaryAgentIds: string[];
  drawerChanges: DrawerChange[];
  narrativeHints: NarrativeHints;
}

// =============================================================================
// DRAWER STATE DELTA
// =============================================================================

export interface DrawerStateDelta {
  focusDrawerId?: string;
  focusTabId?: string;
  openDrawerIds?: string[];
  resize?: Array<{ drawerId: string; size: DrawerSize }>;
  menuBehavior?: SmartMenuBehavior;
  highlightDrawerIds?: string[];
}
