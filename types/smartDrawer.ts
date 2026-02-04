/**
 * SmartDrawer / SmartMenu Type Definitions
 * 
 * The arrangement layer in the Smart Triad:
 * - SmartContentQube → what the content IS
 * - SmartWalletQube → what the user HAS/OWES/CAN EARN
 * - SmartDrawerManifest → how content + agents are ARRANGED
 * 
 * Drawers can be:
 * - Static: defined at configuration time and persisted
 * - Dynamic: computed per prompt/content by Aigent Z and updated on-the-fly
 */

import type { ContentModality } from './smartContent';
import type { DrawerSize, SmartMenuBehavior } from '@/ui/smartLayout/types';

// =============================================================================
// CORE TYPES
// =============================================================================

/** Device types for responsive rendering */
export type Device = 'mobile' | 'desktop' | 'tv';

/** Modality alias for drawer context */
export type Modality = ContentModality;

/** Dynamic mode for drawer sets */
export type DynamicMode = 'static-only' | 'allow-dynamic' | 'dynamic-by-default';

/** Drawer side position */
export type DrawerSide = 'left' | 'right';

/** Agent panel mode */
export type AgentPanelMode = 'copilot' | 'franchise' | 'hybrid';

// =============================================================================
// DRAWER SET - TOP LEVEL
// =============================================================================

/**
 * DrawerSet - All drawers for a given tenant/app/persona
 */
export interface DrawerSet {
  /** Unique ID (e.g., "ds:metaknyts:tenant-main:persona-metaknyts") */
  id: string;
  
  /** Application context (e.g., "metaKnyts", "Qriptopian") */
  appId: string;
  
  /** Tenant context */
  tenantId: string;
  
  /** Persona context (DIDQube persona) */
  personaId: string;
  
  /** All drawers in this set */
  drawers: Drawer[];
  
  /** Dynamic mode configuration */
  dynamicMode?: DynamicMode;
  
  /** Created timestamp */
  createdAt?: string;
  
  /** Updated timestamp */
  updatedAt?: string;
}

// =============================================================================
// DRAWER - SINGLE SIDE MENU ITEM
// =============================================================================

/**
 * Drawer - One side menu item ("Story", "Wallet", "Codex", "Agents", etc.)
 */
export interface Drawer {
  /** Drawer ID (e.g., "story", "wallet", "codex", "agents") */
  id: string;
  
  /** UI label */
  label: string;
  
  /** Icon identifier (Lucide icon name) */
  icon?: string;
  
  /** Which side the drawer appears on */
  side?: DrawerSide;
  
  /** Tabs within this drawer */
  tabs: DrawerTab[];
  
  /** Visibility rules */
  visibilityRules?: VisibilityRules;
  
  // =========================================================================
  // LAYOUT PROPERTIES (Smart Triad Orchestration)
  // =========================================================================
  
  /** Default drawer size (wallet-narrow, wallet-wide, panel-3q, immersive-3q, modal-centered, full-immersive) */
  defaultSize?: DrawerSize;
  
  /** Menu behavior when this drawer is open */
  defaultMenuBehavior?: SmartMenuBehavior;
}

// =============================================================================
// DRAWER TAB
// =============================================================================

/**
 * DrawerTab - Individual tab in a drawer
 */
export interface DrawerTab {
  /** Tab ID (e.g., "summary", "watch", "tasks") */
  id: string;
  
  /** UI label */
  label: string;
  
  /** Modality focus for this tab */
  modalityFocus?: Modality[];
  
  /** Slots (content areas) in this tab */
  slots: DrawerSlot[];
  
  /** Agent panel configuration */
  agentPanel?: AgentPanelConfig;
  
  // =========================================================================
  // LAYOUT OVERRIDES (Smart Triad Orchestration)
  // =========================================================================
  
  /** Override drawer size for this specific tab */
  sizeOverride?: DrawerSize;
  
  /** Override menu behavior for this specific tab */
  menuBehaviorOverride?: SmartMenuBehavior;
}

// =============================================================================
// DRAWER SLOT
// =============================================================================

/**
 * DrawerSlot - A layout slot in the tab that renders content using card variants
 */
export interface DrawerSlot {
  /** Slot ID */
  id: string;
  
  /** Card variant to use (from CardVariantRegistry) */
  cardVariant: string;
  
  /** Data source for this slot */
  dataSource: SlotDataSource;
  
  /** Behavioural rules */
  behaviour?: SlotBehaviour;
}

// =============================================================================
// SLOT DATA SOURCE
// =============================================================================

/** DeFi position status filter */
export type DefiPositionStatusFilter = 'open' | 'closed' | 'pending';

/** DeFi strategy status filter */
export type DefiStrategyStatusFilter = 'idle' | 'running' | 'cooldown';

/** DeFi strategy category filter */
export type DefiStrategyCategoryFilter = 'yield' | 'marketNeutral' | 'directional' | 'hedging' | 'index';

/** Risk band filter */
export type RiskBandFilter = 'low' | 'medium' | 'high' | 'experimental';

/**
 * SlotDataSource - How a slot knows what to show
 * Supports content, wallet, and DeFi data sources
 */
export type SlotDataSource =
  // Content sources
  | { type: 'currentContent'; modalities?: Modality[] }
  | { type: 'relatedContent'; relationType: RelationType; limit?: number }
  | { type: 'library'; scope: LibraryScope; limit?: number }
  | { type: 'recommended'; strategy: RecommendationStrategy; limit?: number }
  | { type: 'customQuery'; queryId: string }
  // Wallet sources
  | { type: 'walletBalances'; assetFilter?: string[] }
  | { type: 'walletEntitlements'; categoryFilter?: string[]; statusFilter?: string[] }
  | { type: 'walletTasks'; statusFilter?: string[]; contextFilter?: string }
  | { type: 'walletQuests'; statusFilter?: string[]; contextFilter?: string }
  // DeFi portfolio sources (MoneyPenny)
  | { type: 'walletDefiPositions'; statusFilter?: DefiPositionStatusFilter[]; riskFilter?: RiskBandFilter[] }
  | { type: 'walletDefiStrategies'; statusFilter?: DefiStrategyStatusFilter[]; categoryFilter?: DefiStrategyCategoryFilter[] }
  | { type: 'walletDefiRiskSummary' }
  // Agent panel source
  | { type: 'agentPanel'; primaryAgentId?: string; secondaryAgentIds?: string[] };

/** Relation types for content */
export type RelationType = 'series' | 'issue' | 'topic' | 'questPath' | 'strategy' | 'education' | 'mythos';

/** Library scope */
export type LibraryScope = 'owned' | 'recent' | 'wishlist';

/** Recommendation strategy */
export type RecommendationStrategy = 'trending' | 'forPersona' | 'forAgentContext';

// =============================================================================
// SLOT BEHAVIOUR
// =============================================================================

/**
 * SlotBehaviour - Behavioural rules for a slot
 */
export interface SlotBehaviour {
  /** Refresh when current content changes */
  refreshOnContentChange?: boolean;
  
  /** Refresh when user prompt changes (for dynamic drawers) */
  refreshOnPromptChange?: boolean;
  
  /** Allow Copilot to dynamically reconfigure this slot */
  dynamicReconfigureAllowed?: boolean;
  
  /** Visible on specific devices only */
  visibleOnDevices?: Device[];
}

// =============================================================================
// AGENT PANEL CONFIG
// =============================================================================

/**
 * AgentPanelConfig - Agent/metavatar configuration for a tab
 */
export interface AgentPanelConfig {
  /** Panel mode */
  mode: AgentPanelMode;
  
  /** Primary agent ID (e.g., "Kn0w1", "MoneyPenny", "Nakamoto", "Copilot") */
  primaryAgentId?: string;
  
  /** Secondary agents */
  secondaryAgents?: string[];
  
  /** Metavatar ID for visual rendering */
  metavatarId?: string;
  
  /** Should the panel be open by default */
  openByDefault?: boolean;
}

// =============================================================================
// VISIBILITY RULES
// =============================================================================

/**
 * VisibilityRules - Controls for drawers/tabs based on persona, agent, context
 */
export interface VisibilityRules {
  /** Allowed persona IDs */
  allowedPersonas?: string[];
  
  /** Allowed agent IDs */
  allowedAgents?: string[];
  
  /** Minimum reputation score required */
  minReputationScore?: number;
  
  /** Requires paid entitlement */
  requirePaidEntitlement?: boolean;
}

// =============================================================================
// DRAWER SESSION (FOR DYNAMIC UPDATES)
// =============================================================================

/** Added tab with context */
export interface SessionAddedTab {
  drawerId: string;
  tabId: string;
  tab: DrawerTab;
}

/** Added slot with context */
export interface SessionAddedSlot {
  drawerId: string;
  tabId: string;
  slotId: string;
  slot: DrawerSlot;
}

/** Updated slot with context */
export interface SessionUpdatedSlot {
  drawerId: string;
  tabId: string;
  slotId: string;
  updates: Partial<DrawerSlot>;
}

/** Session overlay for tracking changes */
export interface SessionOverlay {
  addedDrawers?: Drawer[];
  removedDrawerIds?: string[];
  modifiedDrawers?: Partial<Drawer>[];
  addedTabs?: SessionAddedTab[];
  addedSlots?: SessionAddedSlot[];
  updatedSlots?: SessionUpdatedSlot[];
}

/**
 * DrawerSession - Persisted session overlay for dynamic drawer updates
 * Used for Copilot training and refinement
 */
export interface DrawerSession {
  /** Session ID */
  id: string;
  
  /** Reference to base drawer set */
  drawerSetId: string;
  
  /** Session identifier */
  sessionId: string;
  
  /** Persona ID */
  personaId: string;
  
  /** Prompt context that triggered this configuration */
  promptContext?: string;
  
  /** Overlay changes */
  overlay: SessionOverlay;
  
  /** Effectiveness score (for training feedback) */
  effectivenessScore?: number;
  
  /** Created timestamp */
  createdAt: string;
}

// =============================================================================
// DRAWER CONTEXT (FOR RENDERING)
// =============================================================================

/**
 * DrawerContext - Context passed to drawer renderer
 */
export interface DrawerContext {
  /** Current app */
  appId: string;
  
  /** Current tenant */
  tenantId: string;
  
  /** Current persona */
  personaId: string;
  
  /** Current device */
  device: Device;
  
  /** Current content ID (if viewing content) */
  currentContentId?: string;
  
  /** Current agent ID (if interacting with agent) */
  currentAgentId?: string;
  
  /** User's reputation score */
  reputationScore?: number;
  
  /** User's entitlement IDs */
  entitlementIds?: string[];
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/** Create a new DrawerSet with minimal required fields */
export function createDrawerSet(
  partial: Partial<DrawerSet> & Pick<DrawerSet, 'id' | 'appId' | 'tenantId' | 'personaId'>
): DrawerSet {
  const now = new Date().toISOString();
  return {
    drawers: [],
    dynamicMode: 'static-only',
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

/** Create a new Drawer with minimal required fields */
export function createDrawer(
  partial: Partial<Drawer> & Pick<Drawer, 'id' | 'label'>
): Drawer {
  return {
    tabs: [],
    side: 'left',
    ...partial,
  };
}

/** Create a new DrawerTab with minimal required fields */
export function createDrawerTab(
  partial: Partial<DrawerTab> & Pick<DrawerTab, 'id' | 'label'>
): DrawerTab {
  return {
    slots: [],
    ...partial,
  };
}

/** Create a new DrawerSlot with minimal required fields */
export function createDrawerSlot(
  partial: Partial<DrawerSlot> & Pick<DrawerSlot, 'id' | 'cardVariant' | 'dataSource'>
): DrawerSlot {
  return {
    behaviour: {
      refreshOnContentChange: true,
      visibleOnDevices: ['mobile', 'desktop', 'tv'],
    },
    ...partial,
  };
}
