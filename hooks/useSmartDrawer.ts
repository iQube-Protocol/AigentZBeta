"use client";

/**
 * useSmartDrawer Hook
 * 
 * React hook for managing Smart Drawer state and interactions.
 * Handles fetching, filtering, and resolving drawer data.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type { DrawerSet, Drawer, DrawerTab, DrawerSlot, Device } from "@/types/smartDrawer";
import type { SmartWalletQube } from "@/types/smartWalletQube";
import type { FilteredDrawerSet } from "@/services/drawer/visibilityEvaluator";
import type { ResolvedSlotData } from "@/services/drawer/slotDataResolver";

// =============================================================================
// TYPES
// =============================================================================

export interface UseSmartDrawerOptions {
  /** App ID */
  appId: string;
  
  /** Tenant ID */
  tenantId: string;
  
  /** Persona ID */
  personaId: string;
  
  /** Current device */
  device: Device;
  
  /** Wallet data */
  wallet?: SmartWalletQube;
  
  /** Current content (for slot resolution) */
  currentContent?: any;
  
  /** Initial drawer ID */
  initialDrawerId?: string;
  
  /** Initial tab ID */
  initialTabId?: string;
  
  /** Auto-fetch on mount */
  autoFetch?: boolean;
}

export interface UseSmartDrawerReturn {
  /** The drawer set */
  drawerSet: DrawerSet | null;
  
  /** Filtered drawer set */
  filteredSet: FilteredDrawerSet | null;
  
  /** Resolved slot data */
  slotData: Map<string, ResolvedSlotData>;
  
  /** Current drawer */
  currentDrawer: Drawer | null;
  
  /** Current tab */
  currentTab: DrawerTab | null;
  
  /** Loading state */
  loading: boolean;
  
  /** Error state */
  error: string | null;
  
  /** Is drawer open */
  isOpen: boolean;
  
  /** Open drawer */
  open: () => void;
  
  /** Close drawer */
  close: () => void;
  
  /** Toggle drawer */
  toggle: () => void;
  
  /** Change drawer */
  setDrawer: (drawerId: string) => void;
  
  /** Change tab */
  setTab: (tabId: string) => void;
  
  /** Refresh data */
  refresh: () => Promise<void>;
  
  /** Get slot data for a specific slot */
  getSlotData: (drawerId: string, tabId: string, slotId: string) => ResolvedSlotData | undefined;
}

// =============================================================================
// HOOK
// =============================================================================

export function useSmartDrawer(options: UseSmartDrawerOptions): UseSmartDrawerReturn {
  const {
    appId,
    tenantId,
    personaId,
    device,
    wallet,
    currentContent,
    initialDrawerId,
    initialTabId,
    autoFetch = true,
  } = options;

  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  
  const [drawerSet, setDrawerSet] = useState<DrawerSet | null>(null);
  const [filteredSet, setFilteredSet] = useState<FilteredDrawerSet | null>(null);
  const [slotData, setSlotData] = useState<Map<string, ResolvedSlotData>>(new Map());
  const [currentDrawerId, setCurrentDrawerId] = useState<string | undefined>(initialDrawerId);
  const [currentTabId, setCurrentTabId] = useState<string | undefined>(initialTabId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // FETCH DRAWER SET
  // ---------------------------------------------------------------------------
  
  const fetchDrawerSet = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch drawer set
      const setResponse = await fetch(
        `/api/drawer/sets?appId=${encodeURIComponent(appId)}&tenantId=${encodeURIComponent(tenantId)}&personaId=${encodeURIComponent(personaId)}`
      );

      if (!setResponse.ok) {
        throw new Error(`Failed to fetch drawer set: ${setResponse.statusText}`);
      }

      const setData = await setResponse.json();
      setDrawerSet(setData.drawerSet);

      // Resolve with visibility and slot data
      const resolveResponse = await fetch("/api/drawer/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drawerSetId: setData.drawerSet.id,
          personaId,
          device,
          appId,
          tenantId,
          resolveSlotData: true,
        }),
      });

      if (!resolveResponse.ok) {
        throw new Error(`Failed to resolve drawer: ${resolveResponse.statusText}`);
      }

      const resolveData = await resolveResponse.json();

      // Build filtered set from response
      const filtered: FilteredDrawerSet = {
        originalId: setData.drawerSet.id,
        drawers: resolveData.filtered.drawers.map((fd: any) => ({
          drawer: setData.drawerSet.drawers.find((d: Drawer) => d.id === fd.id)!,
          tabs: fd.tabs.map((ft: any) => ({
            tab: setData.drawerSet.drawers
              .find((d: Drawer) => d.id === fd.id)
              ?.tabs.find((t: DrawerTab) => t.id === ft.id)!,
            slots: setData.drawerSet.drawers
              .find((d: Drawer) => d.id === fd.id)
              ?.tabs.find((t: DrawerTab) => t.id === ft.id)
              ?.slots ?? [],
            hiddenSlotCount: ft.hiddenSlotCount,
            isVisible: ft.isVisible,
            hiddenReason: ft.hiddenReason,
          })),
          hiddenTabCount: fd.hiddenTabCount,
          isVisible: fd.isVisible,
          hiddenReason: fd.hiddenReason,
        })),
        hiddenDrawerCount: resolveData.filtered.hiddenDrawerCount,
      };

      setFilteredSet(filtered);

      // Set slot data
      if (resolveData.slotData) {
        const newSlotData = new Map<string, ResolvedSlotData>();
        for (const [key, value] of Object.entries(resolveData.slotData)) {
          newSlotData.set(key, value as ResolvedSlotData);
        }
        setSlotData(newSlotData);
      }

      // Set default drawer/tab if not set
      if (!currentDrawerId && filtered.drawers.length > 0) {
        setCurrentDrawerId(filtered.drawers[0].drawer.id);
      }
      if (!currentTabId && filtered.drawers.length > 0 && filtered.drawers[0].tabs.length > 0) {
        setCurrentTabId(filtered.drawers[0].tabs[0].tab.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [appId, tenantId, personaId, device, currentDrawerId, currentTabId]);

  // ---------------------------------------------------------------------------
  // EFFECTS
  // ---------------------------------------------------------------------------
  
  useEffect(() => {
    if (autoFetch) {
      fetchDrawerSet();
    }
  }, [autoFetch, fetchDrawerSet]);

  // ---------------------------------------------------------------------------
  // COMPUTED VALUES
  // ---------------------------------------------------------------------------
  
  const currentDrawer = useMemo(() => {
    if (!filteredSet) return null;
    const fd = filteredSet.drawers.find((fd) => fd.drawer.id === currentDrawerId);
    return fd?.drawer ?? filteredSet.drawers[0]?.drawer ?? null;
  }, [filteredSet, currentDrawerId]);

  const currentTab = useMemo(() => {
    if (!filteredSet || !currentDrawerId) return null;
    const fd = filteredSet.drawers.find((fd) => fd.drawer.id === currentDrawerId);
    if (!fd) return null;
    const ft = fd.tabs.find((ft) => ft.tab.id === currentTabId);
    return ft?.tab ?? fd.tabs[0]?.tab ?? null;
  }, [filteredSet, currentDrawerId, currentTabId]);

  // ---------------------------------------------------------------------------
  // ACTIONS
  // ---------------------------------------------------------------------------
  
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const setDrawer = useCallback((drawerId: string) => {
    setCurrentDrawerId(drawerId);
    // Reset tab to first tab of new drawer
    const fd = filteredSet?.drawers.find((fd) => fd.drawer.id === drawerId);
    if (fd && fd.tabs.length > 0) {
      setCurrentTabId(fd.tabs[0].tab.id);
    }
  }, [filteredSet]);

  const setTab = useCallback((tabId: string) => {
    setCurrentTabId(tabId);
  }, []);

  const refresh = useCallback(async () => {
    await fetchDrawerSet();
  }, [fetchDrawerSet]);

  const getSlotData = useCallback(
    (drawerId: string, tabId: string, slotId: string) => {
      const key = `${drawerId}/${tabId}/${slotId}`;
      return slotData.get(key);
    },
    [slotData]
  );

  // ---------------------------------------------------------------------------
  // RETURN
  // ---------------------------------------------------------------------------
  
  return {
    drawerSet,
    filteredSet,
    slotData,
    currentDrawer,
    currentTab,
    loading,
    error,
    isOpen,
    open,
    close,
    toggle,
    setDrawer,
    setTab,
    refresh,
    getSlotData,
  };
}

export default useSmartDrawer;
