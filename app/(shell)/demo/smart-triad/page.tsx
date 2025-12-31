"use client";

import React, { useState } from "react";
import { TrendingUp, Wallet, Bot, Zap, BookOpen, Film } from "lucide-react";
import { SmartDrawerShell, SmartMenuRail } from "@/ui/smartLayout";
import type { DrawerSize } from "@/ui/smartLayout/types";

export default function SmartTriadDemo() {
  const [activeDrawerId, setActiveDrawerId] = useState<string | undefined>();
  const [selectedApp, setSelectedApp] = useState<"MoneyPenny" | "Qriptopian" | "metaKnyts">("MoneyPenny");
  
  // MoneyPenny drawers - modal-centered focus
  const moneyPennyItems = [
    { id: "portfolio", icon: <TrendingUp className="w-5 h-5" />, label: "Portfolio", size: "modal-centered" as DrawerSize },
    { id: "insights", icon: <Zap className="w-5 h-5" />, label: "Live Insights", size: "modal-centered" as DrawerSize },
    { id: "metavatar", icon: <Bot className="w-5 h-5" />, label: "MetaVatar", size: "modal-centered" as DrawerSize },
    { id: "wallet", icon: <Wallet className="w-5 h-5" />, label: "Wallet", size: "wallet-narrow" as DrawerSize },
  ];
  
  // Qriptopian drawers - panel-3q standard
  const qriptopianItems = [
    { id: "scrolls", icon: <BookOpen className="w-5 h-5" />, label: "Scrolls", size: "panel-3q" as DrawerSize },
    { id: "wallet", icon: <Wallet className="w-5 h-5" />, label: "Wallet", size: "wallet-narrow" as DrawerSize },
  ];
  
  // metaKnyts drawers - immersive modes
  const metaKnytsItems = [
    { id: "codex", icon: <Film className="w-5 h-5" />, label: "Codex", size: "immersive-3q" as DrawerSize },
    { id: "wallet", icon: <Wallet className="w-5 h-5" />, label: "Wallet", size: "wallet-narrow" as DrawerSize },
  ];
  
  const menuItems = selectedApp === "MoneyPenny" ? moneyPennyItems
    : selectedApp === "Qriptopian" ? qriptopianItems
    : metaKnytsItems;
  
  const activeItem = menuItems.find(item => item.id === activeDrawerId);
  const drawerSize = activeItem?.size || "wallet-narrow";
  
  const handleMenuSelect = (id: string) => {
    setActiveDrawerId(id);
  };
  
  const handleClose = () => {
    setActiveDrawerId(undefined);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* App Selector */}
      <div className="fixed top-4 left-4 z-[110]">
        <select
          value={selectedApp}
          onChange={(e) => {
            setSelectedApp(e.target.value as typeof selectedApp);
            setActiveDrawerId(undefined);
          }}
          className="px-4 py-2 rounded-lg bg-slate-800/80 backdrop-blur-sm border border-slate-700 text-white"
        >
          <option value="MoneyPenny">MoneyPenny (modal-centered)</option>
          <option value="Qriptopian">Qriptopian (panel-3q)</option>
          <option value="metaKnyts">metaKnyts (immersive-3q)</option>
        </select>
      </div>
      
      {/* Smart Menu Rail */}
      <SmartMenuRail
        items={menuItems.map(item => ({
          id: item.id,
          icon: item.icon,
          label: item.label,
          tooltip: item.label,
        }))}
        activeItemId={activeDrawerId}
        behavior={{
          mode: selectedApp === "metaKnyts" && activeDrawerId === "codex" ? "collapsed-pill" : "fixed-rail",
          side: selectedApp === "metaKnyts" ? "left" : "right",
        }}
        onSelect={handleMenuSelect}
      />
      
      {/* Portfolio Drawer - modal-centered */}
      {activeDrawerId === "portfolio" && (
        <SmartDrawerShell
          isOpen={true}
          size="modal-centered"
          onClose={handleClose}
          title="Portfolio"
          subtitle="Real-time performance and analytics"
        >
          <div className="p-6">
            <h3 className="text-xl font-bold mb-6">DeFi Portfolio Overview</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <p className="text-sm text-slate-400 mb-1">Total Value</p>
                <p className="text-3xl font-bold text-cyan-400">$7,020</p>
                <p className="text-xs text-emerald-400 mt-1">+12.5% this month</p>
              </div>
              
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <p className="text-sm text-slate-400 mb-1">Win Rate</p>
                <p className="text-3xl font-bold text-purple-400">68%</p>
                <p className="text-xs text-slate-400 mt-1">17 wins / 8 losses</p>
              </div>
              
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <p className="text-sm text-slate-400 mb-1">Avg Capture</p>
                <p className="text-3xl font-bold text-orange-400">0.45 bps</p>
                <p className="text-xs text-slate-400 mt-1">Per trade</p>
              </div>
            </div>
            
            <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <p className="text-sm font-semibold mb-2 text-cyan-400">💡 Note: modal-centered variant</p>
              <ul className="text-xs text-slate-300 space-y-1">
                <li>• Centered horizontally and vertically</li>
                <li>• z-index 60 (menu hidden behind)</li>
                <li>• Rounded corners with max-width</li>
                <li>• Perfect for immersive focus tasks</li>
              </ul>
            </div>
          </div>
        </SmartDrawerShell>
      )}
      
      {/* Live Insights Drawer - modal-centered */}
      {activeDrawerId === "insights" && (
        <SmartDrawerShell
          isOpen={true}
          size="modal-centered"
          onClose={handleClose}
          title="Live Insights"
          subtitle="Real-time execution feed and agent insights"
        >
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  Live Execution Feed
                </h4>
                <p className="text-sm text-slate-400">Waiting for trade executions...</p>
              </div>
              
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <h4 className="font-semibold mb-3">Agent Insights</h4>
                <p className="text-sm text-slate-400">No insights yet</p>
              </div>
            </div>
          </div>
        </SmartDrawerShell>
      )}
      
      {/* MetaVatar Drawer - modal-centered */}
      {activeDrawerId === "metavatar" && (
        <SmartDrawerShell
          isOpen={true}
          size="modal-centered"
          onClose={handleClose}
          title="MetaVatar"
          subtitle="AI-powered avatar interface"
        >
          <div className="p-8 flex flex-col items-center justify-center min-h-[500px]">
            <Bot className="w-24 h-24 text-cyan-400 mb-6" />
            <h3 className="text-2xl font-bold mb-2">Money Penny</h3>
            <p className="text-slate-400 mb-6 text-center max-w-md">
              Your AI-powered DeFi trading assistant
            </p>
            <button className="px-8 py-3 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white font-semibold transition-colors">
              Start Conversation
            </button>
          </div>
        </SmartDrawerShell>
      )}
      
      {/* Wallet Drawer - wallet-narrow */}
      {activeDrawerId === "wallet" && (
        <SmartDrawerShell
          isOpen={true}
          size="wallet-narrow"
          onClose={handleClose}
          title="Wallet"
        >
          <div className="p-4">
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-400 mb-2">Balances</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-slate-800/50">
                    <span className="text-sm">QCT</span>
                    <span className="font-mono font-semibold">25,000.00</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-slate-800/50">
                    <span className="text-sm">QOYN</span>
                    <span className="font-mono font-semibold">12.50</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SmartDrawerShell>
      )}
      
      {/* Scrolls Drawer - panel-3q */}
      {activeDrawerId === "scrolls" && (
        <SmartDrawerShell
          isOpen={true}
          size="panel-3q"
          onClose={handleClose}
          title="Scrolls"
          subtitle="Content discovery"
        >
          <div className="p-6">
            <h3 className="text-xl font-bold mb-4">Featured Content</h3>
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-video rounded-lg bg-slate-800/50 border border-slate-700 flex items-center justify-center">
                  <p className="text-slate-500">Content {i}</p>
                </div>
              ))}
            </div>
          </div>
        </SmartDrawerShell>
      )}
      
      {/* Codex Drawer - immersive-3q */}
      {activeDrawerId === "codex" && (
        <SmartDrawerShell
          isOpen={true}
          size="immersive-3q"
          onClose={handleClose}
          heroSlot={
            <div className="w-full h-full bg-gradient-to-br from-purple-900/50 to-slate-900/50 flex items-center justify-center">
              <div className="text-center">
                <Film className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                <h2 className="text-3xl font-bold">Episode Hero</h2>
                <p className="text-slate-400 mt-2">Immersive hero content area</p>
              </div>
            </div>
          }
          feedSlot={
            <div>
              <h3 className="text-xl font-bold mb-4">More Episodes</h3>
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="aspect-video rounded-lg bg-slate-800/50 border border-slate-700"></div>
                ))}
              </div>
            </div>
          }
        >
          <div />
        </SmartDrawerShell>
      )}
      
      {/* Main Content */}
      <main className="p-8 max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-4 mt-16">
          Smart Triad Demo: {selectedApp}
        </h1>
        <p className="text-slate-400 mb-8">
          Select a drawer from the menu to test different layout variants
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-lg bg-slate-800/30 border border-slate-700">
            <h3 className="font-semibold mb-2 text-cyan-400">MoneyPenny</h3>
            <p className="text-sm text-slate-400">
              Features <strong>modal-centered</strong> drawers that sit above the menu (z-60) for immersive focus.
            </p>
          </div>
          
          <div className="p-6 rounded-lg bg-slate-800/30 border border-slate-700">
            <h3 className="font-semibold mb-2 text-purple-400">Qriptopian</h3>
            <p className="text-sm text-slate-400">
              Uses <strong>panel-3q</strong> drawers (75vw) with menu visible for content exploration.
            </p>
          </div>
          
          <div className="p-6 rounded-lg bg-slate-800/30 border border-slate-700">
            <h3 className="font-semibold mb-2 text-orange-400">metaKnyts</h3>
            <p className="text-sm text-slate-400">
              Features <strong>immersive-3q</strong> with hero + feed layout for cinematic experiences.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
