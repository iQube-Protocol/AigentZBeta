"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Save } from "lucide-react";
import type { SmartTriadSet } from '@/src/smartTriad';
import { getSmartTriadSet, saveSmartTriadSet } from '@/src/smartTriad/service';
import { DynamicModeSelector } from '@/components/smartDrawer/DynamicModeSelector';
import { DrawerMenuList } from '@/components/smartDrawer/DrawerMenuList';
import { DrawerDetailEditor } from '@/components/smartDrawer/DrawerDetailEditor';
import { LivePreviewPanel } from '@/components/smartDrawer/LivePreviewPanel';
import { ResizableLayout } from '@/components/smartDrawer/ResizableLayout';

const DEMO_APPS = [
  { id: "Qriptopian", label: "Qriptopian" },
  { id: "metaKnyts", label: "metaKnyts" },
  { id: "MoneyPenny", label: "MoneyPenny" },
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function SmartDrawerDemoPage() {
  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  
  const [selectedApp, setSelectedApp] = useState(DEMO_APPS[0]);
  const [selectedDevice, setSelectedDevice] = useState<Device>("desktop");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSetId, setDrawerSetId] = useState<string | null>(null);
  const [drawerSet, setDrawerSet] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copilotInput, setCopilotInput] = useState("");
  const [showCopilotPanel, setShowCopilotPanel] = useState(false);

  // ---------------------------------------------------------------------------
  // COPILOT HOOK
  // ---------------------------------------------------------------------------
  
  const copilot = useCopilotDrawer({
    drawerSetId: drawerSetId ?? "demo-drawer-set",
    appId: selectedApp.id,
    tenantId: "tenant-main",
    personaId: selectedApp.id.toLowerCase(),
    device: selectedDevice,
    autoCreateSession: false,
    welcomeMessage: `Hi! I can help you customize the ${selectedApp.label} drawer. Try saying "show my tasks" or "add a wallet section".`,
    onDrawerModified: (newDrawerSet) => {
      console.log("Drawer modified:", newDrawerSet);
    },
  });

  // ---------------------------------------------------------------------------
  // FETCH DRAWER SET
  // ---------------------------------------------------------------------------
  
  const fetchDrawerSet = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/drawer/sets?appId=${encodeURIComponent(selectedApp.id)}&tenantId=tenant-main&personaId=${encodeURIComponent(selectedApp.id.toLowerCase())}`
      );

      if (!response.ok) {
        // Try to get fixture
        const fixtureResponse = await fetch(`/api/drawer/sets?appId=${selectedApp.id}`);
        if (fixtureResponse.ok) {
          const data = await fixtureResponse.json();
          if (data.drawerSets?.length > 0) {
            setDrawerSet(data.drawerSets[0]);
            setDrawerSetId(data.drawerSets[0].id);
            return;
          }
        }
        throw new Error("No drawer set found");
      }

      const data = await response.json();
      setDrawerSet(data.drawerSet);
      setDrawerSetId(data.drawerSet.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch drawer set");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrawerSet();
  }, [selectedApp]);

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------
  
  const handleSendPrompt = async () => {
    if (!copilotInput.trim()) return;
    
    if (!copilot.sessionId) {
      await copilot.createSession();
    }
    
    await copilot.sendPrompt(copilotInput);
    setCopilotInput("");
  };

  const handleQuickPrompt = async (prompt: string) => {
    if (!copilot.sessionId) {
      await copilot.createSession();
    }
    await copilot.sendPrompt(prompt);
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold">Smart Drawer Demo</h1>
                <p className="text-xs text-white/50">Smart Triad Framework</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Link to Smart Triad Demo */}
              <a
                href="/demo/smart-triad"
                className="px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-semibold hover:bg-cyan-500/30 transition-colors"
              >
                ✨ New: Smart Triad Demo
              </a>
              
              {/* App Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50">App:</span>
                <select
                  value={selectedApp.id}
                  onChange={(e) => {
                    const app = DEMO_APPS.find((a) => a.id === e.target.value);
                    if (app) setSelectedApp(app);
                  }}
                  className="bg-white/10 text-white text-sm rounded-lg px-3 py-1.5 border border-white/20"
                >
                  {DEMO_APPS.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Device Selector */}
              <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
                {DEVICE_OPTIONS.map((device) => {
                  const Icon = device.icon;
                  return (
                    <button
                      key={device.id}
                      onClick={() => setSelectedDevice(device.id)}
                      className={`p-2 rounded-md transition-colors ${
                        selectedDevice === device.id
                          ? "bg-purple-500/30 text-purple-300"
                          : "text-white/50 hover:text-white/80 hover:bg-white/10"
                      }`}
                      title={device.label}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>

              {/* Open Drawer Button */}
              <button
                onClick={() => setDrawerOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-colors"
              >
                <Play className="w-4 h-4" />
                Open Drawer
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Drawer Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Card */}
            <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-400" />
                Drawer Configuration
              </h2>

              {loading && (
                <div className="flex items-center gap-2 text-white/50">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Loading drawer set...
                </div>
              )}

              {error && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300">
                  {error}
                </div>
              )}

              {drawerSet && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-white/5">
                      <div className="text-xs text-white/50 mb-1">Drawer Set ID</div>
                      <div className="text-sm font-mono text-white/90">{drawerSet.id}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5">
                      <div className="text-xs text-white/50 mb-1">Dynamic Mode</div>
                      <div className="text-sm text-white/90">{drawerSet.dynamicMode}</div>
                    </div>
                  </div>

                  {/* Drawers */}
                  <div>
                    <div className="text-sm font-medium text-white/70 mb-2">
                      Drawers ({drawerSet.drawers?.length ?? 0})
                    </div>
                    <div className="space-y-2">
                      {drawerSet.drawers?.map((drawer: any) => (
                        <div
                          key={drawer.id}
                          className="p-3 rounded-lg bg-white/5 ring-1 ring-white/10"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-white/90">{drawer.label}</span>
                            <span className="text-xs text-white/50">{drawer.side}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {drawer.tabs?.map((tab: any) => (
                              <span
                                key={tab.id}
                                className="px-2 py-1 rounded-full text-xs bg-purple-500/20 text-purple-300"
                              >
                                {tab.label} ({tab.slots?.length ?? 0} slots)
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Copilot Panel */}
            <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Bot className="w-5 h-5 text-purple-400" />
                  Copilot Drawer Compiler
                </h2>
                {copilot.sessionId && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Session Active
                  </span>
                )}
              </div>

              {/* Messages */}
              <div className="mb-4 max-h-64 overflow-y-auto space-y-3">
                {copilot.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-3.5 h-3.5 text-purple-400" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                        msg.role === "user"
                          ? "bg-white/10 text-white/90"
                          : "bg-white/5 text-white/80"
                      }`}
                    >
                      {msg.content}
                      {msg.changes && msg.changes.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/10">
                          <div className="text-xs text-purple-300">Changes:</div>
                          <ul className="text-xs text-white/60 mt-1">
                            {msg.changes.map((c, i) => (
                              <li key={i}>• {c}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {copilot.loading && (
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <Bot className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <div className="flex items-center gap-1 px-3 py-2">
                      <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Prompts */}
              <div className="mb-4 flex flex-wrap gap-2">
                {SAMPLE_PROMPTS.slice(0, 4).map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleQuickPrompt(prompt)}
                    disabled={copilot.loading}
                    className="px-3 py-1.5 rounded-full text-xs bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-white/60 hover:text-white/90 disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={copilotInput}
                  onChange={(e) => setCopilotInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendPrompt();
                    }
                  }}
                  placeholder="Try: 'Show my wallet balance' or 'Add a tasks section'"
                  disabled={copilot.loading}
                  className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/90 placeholder:text-white/40 focus:outline-none focus:border-purple-500/50 transition-colors disabled:opacity-50"
                />
                <button
                  onClick={handleSendPrompt}
                  disabled={copilot.loading || !copilotInput.trim()}
                  className="px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {/* Last Compilation */}
              {copilot.lastCompilation && (
                <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white/50">Last Compilation</span>
                    <span className="text-xs text-purple-300">
                      {Math.round(copilot.lastCompilation.confidence * 100)}% confidence
                    </span>
                  </div>
                  <div className="text-xs text-white/70">
                    {copilot.lastCompilation.changes.length} change(s)
                    {copilot.lastCompilation.warnings.length > 0 && (
                      <span className="text-amber-400 ml-2">
                        ({copilot.lastCompilation.warnings.length} warning(s))
                      </span>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Right Column - Quick Actions */}
          <div className="space-y-6">
            {/* API Endpoints */}
            <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                API Endpoints
              </h2>
              <div className="space-y-2 text-sm">
                <div className="p-2 rounded bg-white/5 font-mono text-xs text-white/70">
                  GET /api/drawer/sets
                </div>
                <div className="p-2 rounded bg-white/5 font-mono text-xs text-white/70">
                  POST /api/drawer/resolve
                </div>
                <div className="p-2 rounded bg-white/5 font-mono text-xs text-white/70">
                  GET /api/drawer/variants
                </div>
                <div className="p-2 rounded bg-white/5 font-mono text-xs text-white/70">
                  POST /api/copilot/compile
                </div>
                <div className="p-2 rounded bg-white/5 font-mono text-xs text-white/70">
                  POST /api/copilot/session
                </div>
                <div className="p-2 rounded bg-white/5 font-mono text-xs text-white/70">
                  POST /api/copilot/prompt
                </div>
              </div>
            </section>

            {/* Features */}
            <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-400" />
                Features
              </h2>
              <ul className="space-y-2 text-sm text-white/70">
                <li className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                  Visibility filtering by persona
                </li>
                <li className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                  Slot data resolution
                </li>
                <li className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                  25+ card variants
                </li>
                <li className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                  Copilot NL compilation
                </li>
                <li className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                  Session overlays
                </li>
                <li className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                  Agent panel integration
                </li>
              </ul>
            </section>

            {/* Fixtures */}
            <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-400" />
                Available Fixtures
              </h2>
              <div className="space-y-2 text-sm">
                <div className="p-2 rounded bg-white/5">
                  <div className="text-white/90">metaKnyts Wallet</div>
                  <div className="text-xs text-white/50">Gaming persona with KNYT tokens</div>
                </div>
                <div className="p-2 rounded bg-white/5">
                  <div className="text-white/90">Qriptopian Wallet</div>
                  <div className="text-xs text-white/50">Content creator with Q¢</div>
                </div>
                <div className="p-2 rounded bg-white/5">
                  <div className="text-white/90">StayBull Wallet</div>
                  <div className="text-xs text-white/50">DeFi trader with live positions & strategies</div>
                </div>
                <div className="p-2 rounded bg-white/5">
                  <div className="text-white/90">4 AigentQubes</div>
                  <div className="text-xs text-white/50">Copilot, Kn0w1, MoneyPenny, Nakamoto</div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Drawer */}
      {drawerOpen && drawerSet && (
        <SmartDrawerRenderer
          drawerSet={drawerSet}
          personaId={selectedApp.id.toLowerCase()}
          device={selectedDevice}
          appId={selectedApp.id}
          tenantId="tenant-main"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          position="right"
        />
      )}
    </div>
  );
}
