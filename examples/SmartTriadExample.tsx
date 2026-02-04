/**
 * Smart Triad Integration Example
 * 
 * Demonstrates how to use SmartDrawerShell, SmartMenuRail, and orchestration
 */

"use client";

import React, { useEffect } from "react";
import { BookOpen, Wallet, Bot, TrendingUp } from "lucide-react";
import { SmartDrawerShell, SmartMenuRail } from "@/ui/smartLayout";
import { useLayoutStore } from "@/stores/layoutStore";
import { useOrchestration } from "@/hooks/useOrchestration";

export function SmartTriadExample() {
  const {
    activeDrawerId,
    drawerSizes,
    menuBehavior,
    setActiveDrawer,
    openDrawer,
    closeDrawer,
  } = useLayoutStore();
  
  const { orchestrate, isOrchestrating, narrativeHints } = useOrchestration();
  
  // Example: Orchestrate on mount
  useEffect(() => {
    orchestrate({
      appId: "MoneyPenny",
      tenantId: "tenant-main",
      personaId: "DeFiTrader",
      activeAgentId: "MoneyPenny",
    });
  }, []);
  
  // Menu items
  const menuItems = [
    {
      id: "portfolio",
      icon: <TrendingUp className="w-5 h-5" />,
      label: "Portfolio",
      tooltip: "View Portfolio",
    },
    {
      id: "wallet",
      icon: <Wallet className="w-5 h-5" />,
      label: "Wallet",
      tooltip: "Your Wallet",
    },
    {
      id: "metavatar",
      icon: <Bot className="w-5 h-5" />,
      label: "MetaVatar",
      tooltip: "Talk to MoneyPenny",
    },
  ];
  
  const handleMenuSelect = async (drawerId: string) => {
    setActiveDrawer(drawerId);
    openDrawer(drawerId);
    
    // Optionally re-orchestrate when changing drawers
    await orchestrate({
      appId: "MoneyPenny",
      tenantId: "tenant-main",
      personaId: "DeFiTrader",
      activeAgentId: "MoneyPenny",
      explicitGoal: `Show ${drawerId}`,
    });
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Smart Menu Rail */}
      <SmartMenuRail
        items={menuItems}
        activeItemId={activeDrawerId}
        behavior={menuBehavior}
        onSelect={handleMenuSelect}
      />
      
      {/* Portfolio Drawer - modal-centered (menu hidden behind) */}
      <SmartDrawerShell
        isOpen={activeDrawerId === "portfolio"}
        size={drawerSizes["portfolio"] || "modal-centered"}
        onClose={() => closeDrawer("portfolio")}
        title="Portfolio"
        subtitle="Real-time performance and analytics"
      >
        <div className="p-6">
          <h3 className="text-xl font-bold mb-4">DeFi Portfolio</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-card">
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold">$7,020</p>
            </div>
            <div className="p-4 rounded-lg bg-card">
              <p className="text-sm text-muted-foreground">Win Rate</p>
              <p className="text-2xl font-bold">68%</p>
            </div>
          </div>
          
          {/* Show narrative hints */}
          {narrativeHints && (
            <div className="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm font-semibold mb-2">Narrative Context:</p>
              <p className="text-xs">{narrativeHints.arrive}</p>
              <p className="text-xs mt-1">{narrativeHints.assess}</p>
            </div>
          )}
        </div>
      </SmartDrawerShell>
      
      {/* Wallet Drawer - wallet-narrow */}
      <SmartDrawerShell
        isOpen={activeDrawerId === "wallet"}
        size={drawerSizes["wallet"] || "wallet-narrow"}
        onClose={() => closeDrawer("wallet")}
        title="Wallet"
      >
        <div className="p-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">QCT</span>
              <span className="font-mono">25,000.00</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">QOYN</span>
              <span className="font-mono">12.50</span>
            </div>
          </div>
        </div>
      </SmartDrawerShell>
      
      {/* MetaVatar Drawer - modal-centered with auto-hide menu */}
      <SmartDrawerShell
        isOpen={activeDrawerId === "metavatar"}
        size={drawerSizes["metavatar"] || "modal-centered"}
        onClose={() => closeDrawer("metavatar")}
        title="MetaVatar"
        subtitle="AI-powered avatar interface"
      >
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Bot className="w-20 h-20 mx-auto mb-4 text-primary" />
            <h3 className="text-xl font-bold mb-2">Money Penny</h3>
            <button className="mt-4 px-6 py-3 rounded-lg bg-primary text-primary-foreground">
              Start conversation
            </button>
          </div>
        </div>
      </SmartDrawerShell>
      
      {/* Main content area */}
      <main className="p-8">
        <h1 className="text-3xl font-bold mb-4">MoneyPenny Dashboard</h1>
        <p className="text-muted-foreground mb-8">
          Select a drawer from the menu to begin
        </p>
        
        {isOrchestrating && (
          <div className="text-sm text-muted-foreground">
            Orchestrating...
          </div>
        )}
      </main>
    </div>
  );
}
