/**
 * VisibilityEvaluator
 * 
 * Evaluates visibility rules for drawers, tabs, and slots.
 * Filters UI elements based on persona, device, entitlements, and reputation.
 */

import type {
  DrawerSet,
  Drawer,
  DrawerTab,
  DrawerSlot,
  VisibilityRules,
  SlotBehaviour,
  Device,
} from '@/types/smartDrawer';
import type { SmartWalletQube } from '@/types/smartWalletQube';

// =============================================================================
// TYPES
// =============================================================================

/** Visibility evaluation context */
export interface VisibilityContext {
  /** Current persona ID */
  personaId: string;
  
  /** Current device */
  device: Device;
  
  /** Wallet data (for entitlements and reputation) */
  wallet?: SmartWalletQube;
  
  /** App ID */
  appId: string;
  
  /** Tenant ID */
  tenantId: string;
  
  /** User's reputation score (if available) */
  reputationScore?: number;
  
  /** User's identity state */
  identityState?: 'anon' | 'pseudo' | 'semi' | 'full';
}

/** Filtered drawer set result */
export interface FilteredDrawerSet {
  /** Original drawer set ID */
  originalId: string;
  
  /** Filtered drawers */
  drawers: FilteredDrawer[];
  
  /** Count of hidden drawers */
  hiddenDrawerCount: number;
}

/** Filtered drawer */
export interface FilteredDrawer {
  /** Drawer data */
  drawer: Drawer;
  
  /** Filtered tabs */
  tabs: FilteredTab[];
  
  /** Count of hidden tabs */
  hiddenTabCount: number;
  
  /** Is this drawer visible */
  isVisible: boolean;
  
  /** Reason if hidden */
  hiddenReason?: string;
}

/** Filtered tab */
export interface FilteredTab {
  /** Tab data */
  tab: DrawerTab;
  
  /** Filtered slots */
  slots: DrawerSlot[];
  
  /** Count of hidden slots */
  hiddenSlotCount: number;
  
  /** Is this tab visible */
  isVisible: boolean;
  
  /** Reason if hidden */
  hiddenReason?: string;
}

// =============================================================================
// VISIBILITY EVALUATOR CLASS
// =============================================================================

class VisibilityEvaluator {
  // ---------------------------------------------------------------------------
  // MAIN FILTERING
  // ---------------------------------------------------------------------------

  /**
   * Filter a DrawerSet based on visibility rules
   */
  filterDrawerSet(drawerSet: DrawerSet, ctx: VisibilityContext): FilteredDrawerSet {
    const filteredDrawers: FilteredDrawer[] = [];
    let hiddenDrawerCount = 0;

    for (const drawer of drawerSet.drawers) {
      const filtered = this.filterDrawer(drawer, ctx);
      
      if (filtered.isVisible) {
        filteredDrawers.push(filtered);
      } else {
        hiddenDrawerCount++;
      }
    }

    return {
      originalId: drawerSet.id,
      drawers: filteredDrawers,
      hiddenDrawerCount,
    };
  }

  /**
   * Filter a single drawer
   */
  filterDrawer(drawer: Drawer, ctx: VisibilityContext): FilteredDrawer {
    // Check drawer-level visibility rules
    const drawerVisibility = this.evaluateVisibilityRules(drawer.visibilityRules, ctx);
    
    if (!drawerVisibility.isVisible) {
      return {
        drawer,
        tabs: [],
        hiddenTabCount: drawer.tabs.length,
        isVisible: false,
        hiddenReason: drawerVisibility.reason,
      };
    }

    // Filter tabs
    const filteredTabs: FilteredTab[] = [];
    let hiddenTabCount = 0;

    for (const tab of drawer.tabs) {
      const filtered = this.filterTab(tab, ctx);
      
      if (filtered.isVisible) {
        filteredTabs.push(filtered);
      } else {
        hiddenTabCount++;
      }
    }

    // Drawer is visible only if it has at least one visible tab
    const isVisible = filteredTabs.length > 0;

    return {
      drawer,
      tabs: filteredTabs,
      hiddenTabCount,
      isVisible,
      hiddenReason: isVisible ? undefined : 'No visible tabs',
    };
  }

  /**
   * Filter a single tab
   */
  filterTab(tab: DrawerTab, ctx: VisibilityContext): FilteredTab {
    // DrawerTab doesn't have visibilityRules, tabs are always visible
    // Only slots have visibility constraints

    // Filter slots by device
    const filteredSlots: DrawerSlot[] = [];
    let hiddenSlotCount = 0;

    for (const slot of tab.slots) {
      const slotVisible = this.evaluateSlotVisibility(slot, ctx);
      
      if (slotVisible) {
        filteredSlots.push(slot);
      } else {
        hiddenSlotCount++;
      }
    }

    return {
      tab,
      slots: filteredSlots,
      hiddenSlotCount,
      isVisible: true, // Tab is visible even with no slots (might have agent panel)
    };
  }

  // ---------------------------------------------------------------------------
  // VISIBILITY RULE EVALUATION
  // ---------------------------------------------------------------------------

  /**
   * Evaluate visibility rules against context
   */
  evaluateVisibilityRules(
    rules: VisibilityRules | undefined,
    ctx: VisibilityContext
  ): { isVisible: boolean; reason?: string } {
    if (!rules) {
      return { isVisible: true };
    }

    // Check allowed personas
    if (rules.allowedPersonas && rules.allowedPersonas.length > 0) {
      if (!rules.allowedPersonas.includes(ctx.personaId)) {
        return {
          isVisible: false,
          reason: `Persona '${ctx.personaId}' not in allowed list`,
        };
      }
    }

    // Check minimum reputation score
    if (rules.minReputationScore !== undefined) {
      const userScore = ctx.reputationScore ?? 0;
      if (userScore < rules.minReputationScore) {
        return {
          isVisible: false,
          reason: `Reputation score ${userScore} below minimum ${rules.minReputationScore}`,
        };
      }
    }

    // Check requirePaidEntitlement
    if (rules.requirePaidEntitlement) {
      const userEntitlements = ctx.wallet?.entitlements ?? [];
      const hasActiveEntitlement = userEntitlements.some(
        (e) => e.status === 'active' && (e.acquiredVia === 'purchase' || e.acquiredVia === 'subscription')
      );

      if (!hasActiveEntitlement) {
        return {
          isVisible: false,
          reason: 'Requires paid entitlement',
        };
      }
    }

    return { isVisible: true };
  }

  /**
   * Evaluate slot visibility based on device and behaviour
   */
  evaluateSlotVisibility(slot: DrawerSlot, ctx: VisibilityContext): boolean {
    const behaviour = slot.behaviour;
    
    if (!behaviour) {
      return true;
    }

    // Check device visibility
    if (behaviour.visibleOnDevices && behaviour.visibleOnDevices.length > 0) {
      if (!behaviour.visibleOnDevices.includes(ctx.device)) {
        return false;
      }
    }

    return true;
  }

  // ---------------------------------------------------------------------------
  // CONVENIENCE METHODS
  // ---------------------------------------------------------------------------

  /**
   * Get visible drawers for a context
   */
  getVisibleDrawers(drawerSet: DrawerSet, ctx: VisibilityContext): Drawer[] {
    const filtered = this.filterDrawerSet(drawerSet, ctx);
    return filtered.drawers.map((fd) => fd.drawer);
  }

  /**
   * Get visible tabs for a drawer
   */
  getVisibleTabs(drawer: Drawer, ctx: VisibilityContext): DrawerTab[] {
    const filtered = this.filterDrawer(drawer, ctx);
    return filtered.tabs.map((ft) => ft.tab);
  }

  /**
   * Get visible slots for a tab
   */
  getVisibleSlots(tab: DrawerTab, ctx: VisibilityContext): DrawerSlot[] {
    const filtered = this.filterTab(tab, ctx);
    return filtered.slots;
  }

  /**
   * Check if a specific drawer is visible
   */
  isDrawerVisible(drawer: Drawer, ctx: VisibilityContext): boolean {
    const filtered = this.filterDrawer(drawer, ctx);
    return filtered.isVisible;
  }

  /**
   * Check if a specific tab is visible
   */
  isTabVisible(tab: DrawerTab, ctx: VisibilityContext): boolean {
    const filtered = this.filterTab(tab, ctx);
    return filtered.isVisible;
  }

  /**
   * Get visibility summary for debugging
   */
  getVisibilitySummary(
    drawerSet: DrawerSet,
    ctx: VisibilityContext
  ): {
    totalDrawers: number;
    visibleDrawers: number;
    totalTabs: number;
    visibleTabs: number;
    totalSlots: number;
    visibleSlots: number;
  } {
    const filtered = this.filterDrawerSet(drawerSet, ctx);

    let totalTabs = 0;
    let visibleTabs = 0;
    let totalSlots = 0;
    let visibleSlots = 0;

    for (const drawer of drawerSet.drawers) {
      totalTabs += drawer.tabs.length;
      for (const tab of drawer.tabs) {
        totalSlots += tab.slots.length;
      }
    }

    for (const fd of filtered.drawers) {
      visibleTabs += fd.tabs.length;
      for (const ft of fd.tabs) {
        visibleSlots += ft.slots.length;
      }
    }

    return {
      totalDrawers: drawerSet.drawers.length,
      visibleDrawers: filtered.drawers.length,
      totalTabs,
      visibleTabs,
      totalSlots,
      visibleSlots,
    };
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const visibilityEvaluator = new VisibilityEvaluator();

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

export function filterDrawerSet(
  drawerSet: DrawerSet,
  ctx: VisibilityContext
): FilteredDrawerSet {
  return visibilityEvaluator.filterDrawerSet(drawerSet, ctx);
}

export function getVisibleDrawers(
  drawerSet: DrawerSet,
  ctx: VisibilityContext
): Drawer[] {
  return visibilityEvaluator.getVisibleDrawers(drawerSet, ctx);
}

export function getVisibleTabs(drawer: Drawer, ctx: VisibilityContext): DrawerTab[] {
  return visibilityEvaluator.getVisibleTabs(drawer, ctx);
}

export function getVisibleSlots(tab: DrawerTab, ctx: VisibilityContext): DrawerSlot[] {
  return visibilityEvaluator.getVisibleSlots(tab, ctx);
}

export function isDrawerVisible(drawer: Drawer, ctx: VisibilityContext): boolean {
  return visibilityEvaluator.isDrawerVisible(drawer, ctx);
}

export function isTabVisible(tab: DrawerTab, ctx: VisibilityContext): boolean {
  return visibilityEvaluator.isTabVisible(tab, ctx);
}
