/**
 * SmartMenu Types
 * 
 * Defines the menu system that determines which drawers and menu items
 * are presented to the user based on their persona, app, and context.
 */

import type { AppId, AgentId } from '@/services/orchestration/flowContext';

// =============================================================================
// MENU ITEM TYPES
// =============================================================================

/** Menu item action types */
export type MenuItemAction =
  | 'openDrawer'
  | 'focusTab'
  | 'navigate'
  | 'openAgent'
  | 'openModal'
  | 'external'
  // Experience Laddering actions — Living Canon / 21 Sats
  // These map to MENU_ACTION bridge messages (ShellOutboundType) in iframe-bridge.
  // The Lovable thin client smart menu exposes these; platform smart menu must match.
  | 'vote'              // Open active election for eligible item
  | 'submitContribution' // Open guided submission shell (RuntimeCapsuleAdminEditor, democratised)
  | 'correspond'        // Open correspondent submission flow (requires knyt:correspondent entitlement)
  | 'viewProgress';     // Open Order of Metaiye progression panel

/** Menu item definition */
export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  action: MenuItemAction;
  targetId?: string;
  targetUrl?: string;
  shortcut?: string;
  badge?: {
    type: 'count' | 'dot' | 'text';
    value?: string | number;
    color?: 'primary' | 'warning' | 'error' | 'success';
  };
  children?: MenuItem[];
  visibilityRules?: MenuVisibilityRules;
  /** Extra context for Experience Laddering actions */
  ladderingContext?: {
    /** Election ID for 'vote' actions */
    electionId?: string;
    /** Branch target for 'submitContribution' / 'correspond' actions */
    branchTarget?: 'canon' | 'community' | 'correspondent';
    /** Contribution schema slug for 'submitContribution' actions */
    contributionSchema?: string;
    /** World ID (defaults to '21sats') */
    worldId?: string;
  };
}

/** Menu visibility rules */
export interface MenuVisibilityRules {
  allowedPersonas?: string[];
  requiredEntitlements?: string[];
  minReputationScore?: number;
  requiresAuth?: boolean;
  hideOnMobile?: boolean;
  hideOnDesktop?: boolean;
}

// =============================================================================
// MENU SECTION TYPES
// =============================================================================

/** Menu section (group of items) */
export interface MenuSection {
  id: string;
  label?: string;
  items: MenuItem[];
  visibilityRules?: MenuVisibilityRules;
}

// =============================================================================
// SMART MENU CONFIGURATION
// =============================================================================

/** Complete menu configuration for an app */
export interface SmartMenuConfig {
  id: string;
  appId: AppId;
  tenantId: string;
  personaId?: string;
  
  /** Primary navigation items (top-level) */
  primaryNav: MenuSection[];
  
  /** Secondary navigation (footer, settings) */
  secondaryNav?: MenuSection[];
  
  /** Quick actions (floating action buttons, etc.) */
  quickActions?: MenuItem[];
  
  /** Agent shortcuts */
  agentShortcuts?: AgentShortcut[];
  
  /** Drawer order (left to right) */
  drawerOrder?: string[];
  
  createdAt?: string;
  updatedAt?: string;
}

/** Agent shortcut in menu */
export interface AgentShortcut {
  agentId: AgentId;
  label: string;
  icon?: string;
  hotkey?: string;
  defaultOpen?: boolean;
}

// =============================================================================
// MENU STATE
// =============================================================================

/** Runtime menu state */
export interface MenuState {
  activeMenuItemId?: string;
  expandedSections: string[];
  openDrawerIds: string[];
  focusedDrawerId?: string;
  focusedTabId?: string;
  activeAgentId?: AgentId;
}

/** Menu state delta (for updates) */
export interface MenuStateDelta {
  activeMenuItemId?: string;
  expandedSections?: string[];
  openDrawerIds?: string[];
  focusedDrawerId?: string;
  focusedTabId?: string;
  activeAgentId?: AgentId;
}

// =============================================================================
// MENU CONTEXT
// =============================================================================

/** Context for menu rendering */
export interface MenuContext {
  appId: AppId;
  personaId: string;
  identityState: 'anon' | 'pseudo' | 'semi' | 'full';
  reputationScore?: number;
  entitlements?: string[];
  deviceType: 'mobile' | 'desktop' | 'tv';
}

export default {
  // Type exports only
};
