/**
 * DrawerService
 * 
 * CRUD operations and validation for DrawerSets.
 * Handles static drawer configurations and dynamic session overlays.
 */

import type {
  DrawerSet,
  Drawer,
  DrawerTab,
  DrawerSlot,
  DrawerSession,
  DrawerContext,
  SlotDataSource,
  SlotBehaviour,
  AgentPanelConfig,
  VisibilityRules,
  DynamicMode,
} from '@/types/smartDrawer';
import { drawerSetFixtures } from './fixtures/drawerSetFixtures';

// =============================================================================
// TYPES
// =============================================================================

export interface DrawerSetQuery {
  appId: string;
  tenantId: string;
  personaId: string;
}

export interface DrawerValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ApplySessionResult {
  mergedDrawerSet: DrawerSet;
  appliedOverlays: string[];
}

// =============================================================================
// DRAWER SERVICE CLASS
// =============================================================================

class DrawerService {
  private cache: Map<string, DrawerSet> = new Map();
  private sessions: Map<string, DrawerSession[]> = new Map();

  constructor() {
    // Pre-load fixtures into cache
    this.cache.set(drawerSetFixtures.metaKnyts.id, drawerSetFixtures.metaKnyts);
    this.cache.set(drawerSetFixtures.qriptopian.id, drawerSetFixtures.qriptopian);
    this.cache.set(drawerSetFixtures.moneyPenny.id, drawerSetFixtures.moneyPenny);
  }

  // ---------------------------------------------------------------------------
  // CRUD OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Get DrawerSet by query
   */
  async getDrawerSet(query: DrawerSetQuery): Promise<DrawerSet | null> {
    const id = this.buildDrawerSetId(query);
    
    // Check cache first
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }

    // Handle StayBull explicitly
    if (query.appId === 'StayBull') {
      return drawerSetFixtures.moneyPenny;
    }

    // TODO: Fetch from database
    // For now, try to match by appId
    for (const [, drawerSet] of this.cache) {
      if (
        drawerSet.appId === query.appId &&
        drawerSet.tenantId === query.tenantId &&
        (drawerSet.personaId === query.personaId || drawerSet.personaId === 'shared')
      ) {
        return drawerSet;
      }
    }

    return null;
  }

  /**
   * Get DrawerSet by ID
   */
  async getDrawerSetById(id: string): Promise<DrawerSet | null> {
    return this.cache.get(id) ?? null;
  }

  /**
   * Create or update DrawerSet
   */
  async upsertDrawerSet(drawerSet: DrawerSet): Promise<DrawerSet> {
    const validation = this.validateDrawerSet(drawerSet);
    if (!validation.isValid) {
      throw new Error(`Invalid DrawerSet: ${validation.errors.join(', ')}`);
    }

    const now = new Date().toISOString();
    const updated: DrawerSet = {
      ...drawerSet,
      updatedAt: now,
      createdAt: drawerSet.createdAt ?? now,
    };

    this.cache.set(updated.id, updated);

    // TODO: Persist to database

    return updated;
  }

  /**
   * Delete DrawerSet
   */
  async deleteDrawerSet(id: string): Promise<boolean> {
    if (!this.cache.has(id)) {
      return false;
    }

    this.cache.delete(id);
    this.sessions.delete(id);

    // TODO: Delete from database

    return true;
  }

  /**
   * List all DrawerSets for an app
   */
  async listDrawerSets(appId: string): Promise<DrawerSet[]> {
    const results: DrawerSet[] = [];
    for (const [, drawerSet] of this.cache) {
      if (drawerSet.appId === appId) {
        results.push(drawerSet);
      }
    }
    return results;
  }

  // ---------------------------------------------------------------------------
  // DRAWER OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Get a specific drawer from a DrawerSet
   */
  getDrawer(drawerSet: DrawerSet, drawerId: string): Drawer | null {
    return drawerSet.drawers.find((d) => d.id === drawerId) ?? null;
  }

  /**
   * Get a specific tab from a drawer
   */
  getTab(drawer: Drawer, tabId: string): DrawerTab | null {
    return drawer.tabs.find((t) => t.id === tabId) ?? null;
  }

  /**
   * Get a specific slot from a tab
   */
  getSlot(tab: DrawerTab, slotId: string): DrawerSlot | null {
    return tab.slots.find((s) => s.id === slotId) ?? null;
  }

  /**
   * Add a drawer to a DrawerSet
   */
  addDrawer(drawerSet: DrawerSet, drawer: Drawer): DrawerSet {
    if (drawerSet.drawers.some((d) => d.id === drawer.id)) {
      throw new Error(`Drawer with id ${drawer.id} already exists`);
    }

    return {
      ...drawerSet,
      drawers: [...drawerSet.drawers, drawer],
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Update a drawer in a DrawerSet
   */
  updateDrawer(drawerSet: DrawerSet, drawerId: string, updates: Partial<Drawer>): DrawerSet {
    const idx = drawerSet.drawers.findIndex((d) => d.id === drawerId);
    if (idx === -1) {
      throw new Error(`Drawer with id ${drawerId} not found`);
    }

    const updatedDrawers = [...drawerSet.drawers];
    updatedDrawers[idx] = { ...updatedDrawers[idx], ...updates };

    return {
      ...drawerSet,
      drawers: updatedDrawers,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Remove a drawer from a DrawerSet
   */
  removeDrawer(drawerSet: DrawerSet, drawerId: string): DrawerSet {
    return {
      ...drawerSet,
      drawers: drawerSet.drawers.filter((d) => d.id !== drawerId),
      updatedAt: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // TAB OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Add a tab to a drawer
   */
  addTab(drawerSet: DrawerSet, drawerId: string, tab: DrawerTab): DrawerSet {
    const drawerIdx = drawerSet.drawers.findIndex((d) => d.id === drawerId);
    if (drawerIdx === -1) {
      throw new Error(`Drawer with id ${drawerId} not found`);
    }

    const drawer = drawerSet.drawers[drawerIdx];
    if (drawer.tabs.some((t) => t.id === tab.id)) {
      throw new Error(`Tab with id ${tab.id} already exists in drawer ${drawerId}`);
    }

    const updatedDrawers = [...drawerSet.drawers];
    updatedDrawers[drawerIdx] = {
      ...drawer,
      tabs: [...drawer.tabs, tab],
    };

    return {
      ...drawerSet,
      drawers: updatedDrawers,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Update a tab in a drawer
   */
  updateTab(
    drawerSet: DrawerSet,
    drawerId: string,
    tabId: string,
    updates: Partial<DrawerTab>
  ): DrawerSet {
    const drawerIdx = drawerSet.drawers.findIndex((d) => d.id === drawerId);
    if (drawerIdx === -1) {
      throw new Error(`Drawer with id ${drawerId} not found`);
    }

    const drawer = drawerSet.drawers[drawerIdx];
    const tabIdx = drawer.tabs.findIndex((t) => t.id === tabId);
    if (tabIdx === -1) {
      throw new Error(`Tab with id ${tabId} not found in drawer ${drawerId}`);
    }

    const updatedTabs = [...drawer.tabs];
    updatedTabs[tabIdx] = { ...updatedTabs[tabIdx], ...updates };

    const updatedDrawers = [...drawerSet.drawers];
    updatedDrawers[drawerIdx] = { ...drawer, tabs: updatedTabs };

    return {
      ...drawerSet,
      drawers: updatedDrawers,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Remove a tab from a drawer
   */
  removeTab(drawerSet: DrawerSet, drawerId: string, tabId: string): DrawerSet {
    const drawerIdx = drawerSet.drawers.findIndex((d) => d.id === drawerId);
    if (drawerIdx === -1) {
      throw new Error(`Drawer with id ${drawerId} not found`);
    }

    const drawer = drawerSet.drawers[drawerIdx];
    const updatedDrawers = [...drawerSet.drawers];
    updatedDrawers[drawerIdx] = {
      ...drawer,
      tabs: drawer.tabs.filter((t) => t.id !== tabId),
    };

    return {
      ...drawerSet,
      drawers: updatedDrawers,
      updatedAt: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // SLOT OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Add a slot to a tab
   */
  addSlot(
    drawerSet: DrawerSet,
    drawerId: string,
    tabId: string,
    slot: DrawerSlot
  ): DrawerSet {
    const drawerIdx = drawerSet.drawers.findIndex((d) => d.id === drawerId);
    if (drawerIdx === -1) {
      throw new Error(`Drawer with id ${drawerId} not found`);
    }

    const drawer = drawerSet.drawers[drawerIdx];
    const tabIdx = drawer.tabs.findIndex((t) => t.id === tabId);
    if (tabIdx === -1) {
      throw new Error(`Tab with id ${tabId} not found in drawer ${drawerId}`);
    }

    const tab = drawer.tabs[tabIdx];
    if (tab.slots.some((s) => s.id === slot.id)) {
      throw new Error(`Slot with id ${slot.id} already exists in tab ${tabId}`);
    }

    const updatedTabs = [...drawer.tabs];
    updatedTabs[tabIdx] = { ...tab, slots: [...tab.slots, slot] };

    const updatedDrawers = [...drawerSet.drawers];
    updatedDrawers[drawerIdx] = { ...drawer, tabs: updatedTabs };

    return {
      ...drawerSet,
      drawers: updatedDrawers,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Update a slot in a tab
   */
  updateSlot(
    drawerSet: DrawerSet,
    drawerId: string,
    tabId: string,
    slotId: string,
    updates: Partial<DrawerSlot>
  ): DrawerSet {
    const drawerIdx = drawerSet.drawers.findIndex((d) => d.id === drawerId);
    if (drawerIdx === -1) {
      throw new Error(`Drawer with id ${drawerId} not found`);
    }

    const drawer = drawerSet.drawers[drawerIdx];
    const tabIdx = drawer.tabs.findIndex((t) => t.id === tabId);
    if (tabIdx === -1) {
      throw new Error(`Tab with id ${tabId} not found in drawer ${drawerId}`);
    }

    const tab = drawer.tabs[tabIdx];
    const slotIdx = tab.slots.findIndex((s) => s.id === slotId);
    if (slotIdx === -1) {
      throw new Error(`Slot with id ${slotId} not found in tab ${tabId}`);
    }

    const updatedSlots = [...tab.slots];
    updatedSlots[slotIdx] = { ...updatedSlots[slotIdx], ...updates };

    const updatedTabs = [...drawer.tabs];
    updatedTabs[tabIdx] = { ...tab, slots: updatedSlots };

    const updatedDrawers = [...drawerSet.drawers];
    updatedDrawers[drawerIdx] = { ...drawer, tabs: updatedTabs };

    return {
      ...drawerSet,
      drawers: updatedDrawers,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Remove a slot from a tab
   */
  removeSlot(
    drawerSet: DrawerSet,
    drawerId: string,
    tabId: string,
    slotId: string
  ): DrawerSet {
    const drawerIdx = drawerSet.drawers.findIndex((d) => d.id === drawerId);
    if (drawerIdx === -1) {
      throw new Error(`Drawer with id ${drawerId} not found`);
    }

    const drawer = drawerSet.drawers[drawerIdx];
    const tabIdx = drawer.tabs.findIndex((t) => t.id === tabId);
    if (tabIdx === -1) {
      throw new Error(`Tab with id ${tabId} not found in drawer ${drawerId}`);
    }

    const tab = drawer.tabs[tabIdx];
    const updatedTabs = [...drawer.tabs];
    updatedTabs[tabIdx] = { ...tab, slots: tab.slots.filter((s) => s.id !== slotId) };

    const updatedDrawers = [...drawerSet.drawers];
    updatedDrawers[drawerIdx] = { ...drawer, tabs: updatedTabs };

    return {
      ...drawerSet,
      drawers: updatedDrawers,
      updatedAt: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // SESSION OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Create a dynamic session overlay
   */
  async createSession(
    drawerSetId: string,
    sessionId: string,
    personaId: string,
    promptContext?: string
  ): Promise<DrawerSession> {
    const session: DrawerSession = {
      id: crypto.randomUUID(),
      drawerSetId,
      sessionId,
      personaId,
      promptContext,
      overlay: {},
      createdAt: new Date().toISOString(),
    };

    const existing = this.sessions.get(drawerSetId) ?? [];
    this.sessions.set(drawerSetId, [...existing, session]);

    // TODO: Persist to database

    return session;
  }

  /**
   * Get sessions for a DrawerSet
   */
  async getSessions(drawerSetId: string): Promise<DrawerSession[]> {
    return this.sessions.get(drawerSetId) ?? [];
  }

  /**
   * Update session overlay
   */
  async updateSessionOverlay(
    sessionId: string,
    overlay: DrawerSession['overlay']
  ): Promise<DrawerSession | null> {
    for (const [drawerSetId, sessions] of this.sessions) {
      const idx = sessions.findIndex((s) => s.id === sessionId);
      if (idx !== -1) {
        const updated = { ...sessions[idx], overlay };
        const updatedSessions = [...sessions];
        updatedSessions[idx] = updated;
        this.sessions.set(drawerSetId, updatedSessions);
        return updated;
      }
    }
    return null;
  }

  /**
   * Apply session overlays to a DrawerSet
   */
  applySessionOverlays(
    drawerSet: DrawerSet,
    sessions: DrawerSession[]
  ): ApplySessionResult {
    if (drawerSet.dynamicMode === 'static-only') {
      return { mergedDrawerSet: drawerSet, appliedOverlays: [] };
    }

    let merged = structuredClone(drawerSet);
    const appliedOverlays: string[] = [];

    for (const session of sessions) {
      if (!session.overlay) continue;

      // Apply drawer additions
      if (session.overlay.addedDrawers) {
        for (const drawer of session.overlay.addedDrawers) {
          if (!merged.drawers.some((d) => d.id === drawer.id)) {
            merged.drawers.push(drawer);
            appliedOverlays.push(`added drawer: ${drawer.id}`);
          }
        }
      }

      // Apply tab additions
      if (session.overlay.addedTabs) {
        for (const { drawerId, tab } of session.overlay.addedTabs) {
          const drawer = merged.drawers.find((d) => d.id === drawerId);
          if (drawer && !drawer.tabs.some((t) => t.id === tab.id)) {
            drawer.tabs.push(tab);
            appliedOverlays.push(`added tab: ${drawerId}/${tab.id}`);
          }
        }
      }

      // Apply slot additions
      if (session.overlay.addedSlots) {
        for (const { drawerId, tabId, slot } of session.overlay.addedSlots) {
          const drawer = merged.drawers.find((d) => d.id === drawerId);
          const tab = drawer?.tabs.find((t) => t.id === tabId);
          if (tab && !tab.slots.some((s) => s.id === slot.id)) {
            tab.slots.push(slot);
            appliedOverlays.push(`added slot: ${drawerId}/${tabId}/${slot.id}`);
          }
        }
      }

      // Apply slot updates
      if (session.overlay.updatedSlots) {
        for (const { drawerId, tabId, slotId, updates } of session.overlay.updatedSlots) {
          const drawer = merged.drawers.find((d) => d.id === drawerId);
          const tab = drawer?.tabs.find((t) => t.id === tabId);
          const slot = tab?.slots.find((s) => s.id === slotId);
          if (slot) {
            Object.assign(slot, updates);
            appliedOverlays.push(`updated slot: ${drawerId}/${tabId}/${slotId}`);
          }
        }
      }
    }

    return { mergedDrawerSet: merged, appliedOverlays };
  }

  // ---------------------------------------------------------------------------
  // VALIDATION
  // ---------------------------------------------------------------------------

  /**
   * Validate a DrawerSet
   */
  validateDrawerSet(drawerSet: DrawerSet): DrawerValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!drawerSet.id) errors.push('DrawerSet id is required');
    if (!drawerSet.appId) errors.push('DrawerSet appId is required');
    if (!drawerSet.tenantId) errors.push('DrawerSet tenantId is required');
    if (!drawerSet.personaId) errors.push('DrawerSet personaId is required');

    // Dynamic mode
    const validModes: DynamicMode[] = ['static-only', 'allow-dynamic', 'dynamic-by-default'];
    if (drawerSet.dynamicMode && !validModes.includes(drawerSet.dynamicMode)) {
      errors.push(`Invalid dynamicMode: ${drawerSet.dynamicMode}`);
    }

    // Validate drawers
    const drawerIds = new Set<string>();
    for (const drawer of drawerSet.drawers) {
      if (!drawer.id) {
        errors.push('Drawer id is required');
        continue;
      }

      if (drawerIds.has(drawer.id)) {
        errors.push(`Duplicate drawer id: ${drawer.id}`);
      }
      drawerIds.add(drawer.id);

      // Validate tabs
      const tabIds = new Set<string>();
      for (const tab of drawer.tabs) {
        if (!tab.id) {
          errors.push(`Tab id is required in drawer ${drawer.id}`);
          continue;
        }

        if (tabIds.has(tab.id)) {
          errors.push(`Duplicate tab id: ${tab.id} in drawer ${drawer.id}`);
        }
        tabIds.add(tab.id);

        // Validate slots
        const slotIds = new Set<string>();
        for (const slot of tab.slots) {
          if (!slot.id) {
            errors.push(`Slot id is required in tab ${tab.id}`);
            continue;
          }

          if (slotIds.has(slot.id)) {
            errors.push(`Duplicate slot id: ${slot.id} in tab ${tab.id}`);
          }
          slotIds.add(slot.id);

          // Validate data source
          if (!slot.dataSource?.type) {
            warnings.push(`Slot ${slot.id} has no dataSource type`);
          }

          // Validate card variant
          if (!slot.cardVariant) {
            warnings.push(`Slot ${slot.id} has no cardVariant`);
          }
        }

        // Validate agent panel
        if (tab.agentPanel) {
          if (!tab.agentPanel.primaryAgentId) {
            warnings.push(`Tab ${tab.id} has agentPanel but no primaryAgentId`);
          }
        }
      }

      // Check for empty drawers
      if (drawer.tabs.length === 0) {
        warnings.push(`Drawer ${drawer.id} has no tabs`);
      }
    }

    // Check for empty drawer set
    if (drawerSet.drawers.length === 0) {
      warnings.push('DrawerSet has no drawers');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  private buildDrawerSetId(query: DrawerSetQuery): string {
    return `ds:${query.appId}:${query.tenantId}:${query.personaId}`;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const drawerService = new DrawerService();

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

export async function getDrawerSet(query: DrawerSetQuery): Promise<DrawerSet | null> {
  return drawerService.getDrawerSet(query);
}

export async function getDrawerSetById(id: string): Promise<DrawerSet | null> {
  return drawerService.getDrawerSetById(id);
}

export async function upsertDrawerSet(drawerSet: DrawerSet): Promise<DrawerSet> {
  return drawerService.upsertDrawerSet(drawerSet);
}

export function validateDrawerSet(drawerSet: DrawerSet): DrawerValidationResult {
  return drawerService.validateDrawerSet(drawerSet);
}
