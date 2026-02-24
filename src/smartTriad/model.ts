/**
 * Smart Triad Unified Model
 * Combines layout + drawer config + content variants
 */

import type { DrawerSize, SmartMenuBehavior } from './ui/types';

// Re-export types for external use
export type { DrawerSize, SmartMenuBehavior };

// Slot configuration
export type SlotModality = "content-card" | "content-carousel" | "wallet-section" | "agent-panel" | "custom";

export interface TriadDrawerSlotConfig {
  id: string;
  label: string;
  modality: SlotModality;
  variantId?: string; // e.g., 'card-hero-wide'
}

export interface TriadDrawerTabConfig {
  id: string;
  label: string;
  sizeOverride?: DrawerSize;
  menuBehaviorOverride?: SmartMenuBehavior;
  slots: TriadDrawerSlotConfig[];
}

export interface TriadDrawerConfig {
  id: string;
  label: string;
  side: "left" | "right" | "center";
  defaultSize: DrawerSize;
  defaultMenuBehavior?: SmartMenuBehavior;
  tabs: TriadDrawerTabConfig[];
}

// Wallet configuration
export interface SmartWalletConfig {
  defaultDrawerId: string;
  defaultTabId: string;
  personaAware: boolean;
  showTasks: boolean;
  showRewards: boolean;
  showLibrary: boolean;
  sections: {
    overviewSlotId?: string;
    tasksSlotId?: string;
    librarySlotId?: string;
    rewardsSlotId?: string;
  };
}

// Content variant reference
export interface SmartContentVariantRef {
  id: string;
  type: "card" | "carousel" | "thumbnail" | "full";
}

export interface SmartContentConfig {
  allowedVariants: SmartContentVariantRef[];
  slotBindings?: Record<string, string>; // slot.id -> variant.id
}

// Main unified model
export interface SmartTriadSet {
  id: string;
  appId: "Qriptopian" | "metaKnyts" | "MoneyPenny" | string;
  personaId: string;
  dynamicMode: "static-only" | "copilot-suggest" | "copilot-adaptive";
  drawers: TriadDrawerConfig[];
  wallet: SmartWalletConfig;
  content: SmartContentConfig;
}
