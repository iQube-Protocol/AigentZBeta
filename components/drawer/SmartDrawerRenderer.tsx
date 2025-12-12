"use client";

/**
 * SmartDrawerRenderer
 * 
 * Main component for rendering a DrawerSet with visibility filtering,
 * slot data resolution, and agent panel integration.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  X,
  Bot,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import type { DrawerSet, Drawer, DrawerTab, DrawerSlot, Device } from "@/types/smartDrawer";
import type { SmartWalletQube } from "@/types/smartWalletQube";
import type { FilteredDrawerSet, FilteredDrawer, FilteredTab, VisibilityContext } from "@/services/drawer/visibilityEvaluator";
import type { ResolvedSlotData, ResolutionContext } from "@/services/drawer/slotDataResolver";
import { SlotRenderer } from "./SlotRenderer";
import { AgentPanelRenderer } from "./AgentPanelRenderer";
import { DrawerTabBar } from "./DrawerTabBar";

// =============================================================================
// TYPES
// =============================================================================

export interface SmartDrawerRendererProps {
  /** The drawer set to render */
  drawerSet: DrawerSet;
  
  /** Current persona ID */
  personaId: string;
  
  /** Current device */
  device: Device;
  
  /** Wallet data */
  wallet?: SmartWalletQube;
  
  /** App ID */
  appId: string;
  
  /** Tenant ID */
  tenantId: string;
  
  /** Current content (for slot resolution) */
  currentContent?: any;
  
  /** Which drawer to show (by ID) */
  activeDrawerId?: string;
  
  /** Which tab to show (by ID) */
  activeTabId?: string;
  
  /** Callback when drawer changes */
  onDrawerChange?: (drawerId: string) => void;
  
  /** Callback when tab changes */
  onTabChange?: (tabId: string) => void;
  
  /** Callback when slot item is selected */
  onSlotItemSelect?: (item: any, slotId: string) => void;
  
  /** Callback when agent panel sends message */
  onAgentMessage?: (message: string, agentId: string) => void;
  
  /** Callback to close drawer */
  onClose?: () => void;
  
  /** Whether drawer is open */
  open?: boolean;
  
  /** Position (left or right) */
  position?: "left" | "right";
  
  /** Custom class name */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SmartDrawerRenderer({
  drawerSet,
  personaId,
  device,
  wallet,
  appId,
  tenantId,
  currentContent,
  activeDrawerId,
  activeTabId,
  onDrawerChange,
  onTabChange,
  onSlotItemSelect,
  onAgentMessage,
  onClose,
  open = true,
  position = "right",
  className = "",
}: SmartDrawerRendererProps) {
  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  
  const [filteredSet, setFilteredSet] = useState<FilteredDrawerSet | null>(null);
  const [slotData, setSlotData] = useState<Map<string, ResolvedSlotData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDrawerId, setCurrentDrawerId] = useState<string | undefined>(activeDrawerId);
  const [currentTabId, setCurrentTabId] = useState<string | undefined>(activeTabId);
  const [agentPanelOpen, setAgentPanelOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // VISIBILITY CONTEXT
  // ---------------------------------------------------------------------------
  
  const visibilityContext: VisibilityContext = useMemo(() => ({
    personaId,
    device,
    wallet,
    appId,
    tenantId,
    reputationScore: wallet?.rewards?.reduce((sum, r) => sum + r.progress * 100, 0) ?? 0,
    identityState: wallet?.identityState,
  }), [personaId, device, wallet, appId, tenantId]);

  // ---------------------------------------------------------------------------
  // RESOLUTION CONTEXT
  // ---------------------------------------------------------------------------
  
  const resolutionContext: ResolutionContext = useMemo(() => ({
    currentContentId: currentContent?.id,
    currentContent,
    wallet,
    device,
    appId,
    personaId,
    tenantId,
  }), [currentContent, wallet, device, appId, personaId, tenantId]);

  // ---------------------------------------------------------------------------
  // FETCH FILTERED DATA
  // ---------------------------------------------------------------------------
  
  const fetchFilteredData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/drawer/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drawerSetId: drawerSet.id,
          personaId,
          device,
          appId,
          tenantId,
          resolveSlotData: true,
          drawerId: currentDrawerId,
          tabId: currentTabId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to resolve drawer: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Convert API response to FilteredDrawerSet
      const filtered: FilteredDrawerSet = {
        originalId: data.drawerSet.id,
        drawers: data.filtered.drawers.map((fd: any) => ({
          drawer: drawerSet.drawers.find((d) => d.id === fd.id)!,
          tabs: fd.tabs.map((ft: any) => ({
            tab: drawerSet.drawers
              .find((d) => d.id === fd.id)
              ?.tabs.find((t) => t.id === ft.id)!,
            slots: drawerSet.drawers
              .find((d) => d.id === fd.id)
              ?.tabs.find((t) => t.id === ft.id)
              ?.slots ?? [],
            hiddenSlotCount: ft.hiddenSlotCount,
            isVisible: ft.isVisible,
            hiddenReason: ft.hiddenReason,
          })),
          hiddenTabCount: fd.hiddenTabCount,
          isVisible: fd.isVisible,
          hiddenReason: fd.hiddenReason,
        })),
        hiddenDrawerCount: data.filtered.hiddenDrawerCount,
      };

      setFilteredSet(filtered);

      // Set slot data
      if (data.slotData) {
        const newSlotData = new Map<string, ResolvedSlotData>();
        for (const [key, value] of Object.entries(data.slotData)) {
          newSlotData.set(key, value as ResolvedSlotData);
        }
        setSlotData(newSlotData);
      }

      // Set default drawer/tab if not set
      if (!currentDrawerId && filtered.drawers.length > 0) {
        setCurrentDrawerId(filtered.drawers[0].drawer.id);
        onDrawerChange?.(filtered.drawers[0].drawer.id);
      }
      if (!currentTabId && filtered.drawers.length > 0 && filtered.drawers[0].tabs.length > 0) {
        setCurrentTabId(filtered.drawers[0].tabs[0].tab.id);
        onTabChange?.(filtered.drawers[0].tabs[0].tab.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [drawerSet, personaId, device, appId, tenantId, currentDrawerId, currentTabId, onDrawerChange, onTabChange]);

  useEffect(() => {
    if (open) {
      fetchFilteredData();
    }
  }, [open, fetchFilteredData]);

  // ---------------------------------------------------------------------------
  // CURRENT DRAWER/TAB
  // ---------------------------------------------------------------------------
  
  const currentDrawer = useMemo(() => {
    if (!filteredSet) return null;
    return filteredSet.drawers.find((fd) => fd.drawer.id === currentDrawerId) ?? filteredSet.drawers[0];
  }, [filteredSet, currentDrawerId]);

  const currentTab = useMemo(() => {
    if (!currentDrawer) return null;
    return currentDrawer.tabs.find((ft) => ft.tab.id === currentTabId) ?? currentDrawer.tabs[0];
  }, [currentDrawer, currentTabId]);

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------
  
  const handleDrawerChange = (drawerId: string) => {
    setCurrentDrawerId(drawerId);
    onDrawerChange?.(drawerId);
    
    // Reset tab to first tab of new drawer
    const drawer = filteredSet?.drawers.find((fd) => fd.drawer.id === drawerId);
    if (drawer && drawer.tabs.length > 0) {
      setCurrentTabId(drawer.tabs[0].tab.id);
      onTabChange?.(drawer.tabs[0].tab.id);
    }
  };

  const handleTabChange = (tabId: string) => {
    setCurrentTabId(tabId);
    onTabChange?.(tabId);
  };

  const handleSlotItemSelect = (item: any, slotId: string) => {
    onSlotItemSelect?.(item, slotId);
  };

  const handleAgentMessage = (message: string) => {
    const agentId = currentTab?.tab.agentPanel?.primaryAgentId ?? "copilot";
    onAgentMessage?.(message, agentId);
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  
  if (!open) return null;

  const slideDirection = position === "right" ? "animate-slide-in-left" : "animate-slide-in-right";
  const positionClass = position === "right" ? "ml-auto" : "mr-auto";

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div
        className={`${positionClass} h-full w-[22rem] ${slideDirection} bg-black/30 backdrop-blur-xl ring-1 ring-white/10 border-l border-white/10 overflow-hidden flex flex-col ${className}`}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-3 py-2 bg-white/5 ring-1 ring-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Drawer Selector (if multiple drawers) */}
            {filteredSet && filteredSet.drawers.length > 1 && (
              <select
                value={currentDrawerId}
                onChange={(e) => handleDrawerChange(e.target.value)}
                className="bg-white/10 text-white/90 text-sm rounded px-2 py-1 border border-white/20"
              >
                {filteredSet.drawers.map((fd) => (
                  <option key={fd.drawer.id} value={fd.drawer.id}>
                    {fd.drawer.label}
                  </option>
                ))}
              </select>
            )}
            {filteredSet && filteredSet.drawers.length === 1 && (
              <span className="text-sm font-medium text-white/90">
                {currentDrawer?.drawer.label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Agent Panel Toggle */}
            {currentTab?.tab.agentPanel && (
              <button
                onClick={() => setAgentPanelOpen(!agentPanelOpen)}
                className={`p-1.5 rounded transition-colors ${
                  agentPanelOpen
                    ? "bg-purple-500/20 text-purple-400"
                    : "text-white/60 hover:text-white/90 hover:bg-white/10"
                }`}
                title="Toggle Copilot"
              >
                <Bot className="w-4 h-4" />
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 text-white/60 hover:text-white/90 hover:bg-white/10 rounded transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Tab Bar */}
        {currentDrawer && currentDrawer.tabs.length > 1 && (
          <DrawerTabBar
            tabs={currentDrawer.tabs.map((ft) => ft.tab)}
            activeTabId={currentTabId}
            onTabChange={handleTabChange}
          />
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex">
          {/* Main Content */}
          <div className={`flex-1 overflow-y-auto p-4 ${agentPanelOpen ? "w-1/2" : "w-full"}`}>
            {loading && (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
              </div>
            )}

            {error && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                {error}
              </div>
            )}

            {!loading && !error && currentTab && (
              <div className="space-y-4">
                {currentTab.slots.map((slot) => {
                  const slotKey = `${currentDrawerId}/${currentTabId}/${slot.id}`;
                  const resolved = slotData.get(slotKey);

                  return (
                    <SlotRenderer
                      key={slot.id}
                      slot={slot}
                      resolvedData={resolved}
                      onItemSelect={(item) => handleSlotItemSelect(item, slot.id)}
                      device={device}
                    />
                  );
                })}

                {currentTab.slots.length === 0 && (
                  <div className="text-center py-8 text-white/50 text-sm">
                    No content in this tab.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Agent Panel (slides in from right) */}
          {agentPanelOpen && currentTab?.tab.agentPanel && (
            <div className="w-1/2 border-l border-white/10 overflow-hidden">
              <AgentPanelRenderer
                config={currentTab.tab.agentPanel}
                onSendMessage={handleAgentMessage}
                onClose={() => setAgentPanelOpen(false)}
                wallet={wallet}
                currentContent={currentContent}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SmartDrawerRenderer;
