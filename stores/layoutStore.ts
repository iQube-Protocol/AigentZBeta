/**
 * Layout Store
 * 
 * Global state management for Smart Triad drawer layout
 */

import { create } from "zustand";
import type { DrawerSize, SmartMenuBehavior } from "@/ui/smartLayout/types";
import type { DrawerStateDelta } from "@/orchestration/types";

export interface LayoutState {
  // Active drawer state
  activeDrawerId?: string;
  activeTabId?: string;
  openDrawerIds: string[];
  
  // Drawer sizes (per drawer)
  drawerSizes: Record<string, DrawerSize>;
  
  // Menu behavior
  menuBehavior: SmartMenuBehavior;
  
  // Highlighted drawers (for attention/tutorial)
  highlightedDrawerIds: string[];
  
  // Actions
  setActiveDrawer: (drawerId: string, tabId?: string) => void;
  setDrawerSize: (drawerId: string, size: DrawerSize) => void;
  setMenuBehavior: (behavior: SmartMenuBehavior) => void;
  openDrawer: (drawerId: string) => void;
  closeDrawer: (drawerId: string) => void;
  highlightDrawer: (drawerId: string) => void;
  clearHighlights: () => void;
  
  // Apply orchestration delta
  applyDrawerDelta: (delta: DrawerStateDelta) => void;
  
  // Reset
  reset: () => void;
}

const initialState = {
  openDrawerIds: [],
  drawerSizes: {},
  menuBehavior: { mode: "fixed-rail" as const, side: "right" as const },
  highlightedDrawerIds: [],
};

export const useLayoutStore = create<LayoutState>((set) => ({
  ...initialState,
  
  setActiveDrawer: (drawerId, tabId) =>
    set({ activeDrawerId: drawerId, activeTabId: tabId }),
  
  setDrawerSize: (drawerId, size) =>
    set((state) => ({
      drawerSizes: { ...state.drawerSizes, [drawerId]: size },
    })),
  
  setMenuBehavior: (behavior) =>
    set({ menuBehavior: behavior }),
  
  openDrawer: (drawerId) =>
    set((state) => ({
      openDrawerIds: state.openDrawerIds.includes(drawerId)
        ? state.openDrawerIds
        : [...state.openDrawerIds, drawerId],
    })),
  
  closeDrawer: (drawerId) =>
    set((state) => ({
      openDrawerIds: state.openDrawerIds.filter((id) => id !== drawerId),
      activeDrawerId: state.activeDrawerId === drawerId ? undefined : state.activeDrawerId,
    })),
  
  highlightDrawer: (drawerId) =>
    set((state) => ({
      highlightedDrawerIds: state.highlightedDrawerIds.includes(drawerId)
        ? state.highlightedDrawerIds
        : [...state.highlightedDrawerIds, drawerId],
    })),
  
  clearHighlights: () =>
    set({ highlightedDrawerIds: [] }),
  
  applyDrawerDelta: (delta) =>
    set((state) => {
      const newSizes = { ...state.drawerSizes };
      
      // Apply resize changes
      delta.resize?.forEach(({ drawerId, size }) => {
        newSizes[drawerId] = size;
      });
      
      // Merge open drawer IDs
      const newOpenIds = delta.openDrawerIds
        ? [...new Set([...state.openDrawerIds, ...delta.openDrawerIds])]
        : state.openDrawerIds;
      
      return {
        activeDrawerId: delta.focusDrawerId || state.activeDrawerId,
        activeTabId: delta.focusTabId || state.activeTabId,
        openDrawerIds: newOpenIds,
        drawerSizes: newSizes,
        menuBehavior: delta.menuBehavior || state.menuBehavior,
        highlightedDrawerIds: delta.highlightDrawerIds || state.highlightedDrawerIds,
      };
    }),
  
  reset: () => set(initialState),
}));
