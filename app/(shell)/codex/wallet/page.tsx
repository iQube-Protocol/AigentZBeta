"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import SmartWalletDrawer from "../../../components/content/SmartWalletDrawer";
import {
  Wallet,
  Settings,
  Code,
  PanelLeftClose,
  PanelLeftOpen,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  AlignHorizontalSpaceAround,
} from "lucide-react";

function SmartWalletViewerContent() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [density, setDensity] = useState<'narrow' | 'wide'>('narrow');
  const [allowNarrow, setAllowNarrow] = useState(true);
  const [allowWide, setAllowWide] = useState(true);
  const [walletAnchor, setWalletAnchor] = useState<'left' | 'right'>('right');
  const [walletCopilotOpen, setWalletCopilotOpen] = useState(false);
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarOffset, setSidebarOffset] = useState(64);
  const searchParams = useSearchParams();
  const personaId = searchParams?.get('personaId') || undefined;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const readSidebarWidth = () => {
      const sidebar = document.querySelector("aside");
      if (!sidebar) {
        setSidebarOffset(0);
        return;
      }
      setSidebarOffset(Math.max(0, Math.round(sidebar.getBoundingClientRect().width)));
    };

    readSidebarWidth();
    const sidebar = document.querySelector("aside");
    const observer =
      sidebar && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => readSidebarWidth())
        : null;
    if (sidebar && observer) observer.observe(sidebar);
    window.addEventListener("resize", readSidebarWidth);

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener("resize", readSidebarWidth);
    };
  }, []);

  // Sample agent data - in real app this would come from context
  const agent = {
    id: "agent-123",
    name: "Demo Agent",
    fioHandle: "demo@agentiq",
  };

  useEffect(() => {
    if (density === "narrow" && !allowNarrow && allowWide) setDensity("wide");
    if (density === "wide" && !allowWide && allowNarrow) setDensity("narrow");
  }, [allowNarrow, allowWide, density]);

  const effectiveDensity: 'narrow' | 'wide' =
    walletCopilotOpen && allowWide
      ? 'wide'
      : density === 'wide' && !allowWide
        ? 'narrow'
        : density === 'narrow' && !allowNarrow
          ? 'wide'
          : density;
  const walletWidthClass = effectiveDensity === 'wide' ? 'w-[32.25rem]' : 'w-[22.25rem]';
  const embedUrl = `https://dev-beta.aigentz.me/triad/embed/wallet?theme=${theme}&density=${effectiveDensity}&anchor=${walletAnchor}`;

  return (
    <div
      className={`flex flex-col bg-slate-900 ${
        isFullscreen ? "fixed inset-y-0 right-0 z-[200]" : "h-screen"
      }`}
      style={isFullscreen ? { left: `${sidebarOffset}px` } : undefined}
    >
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-700/50 bg-slate-800/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wallet className="w-6 h-6 text-cyan-400" />
            <div>
              <h1 className="text-xl font-bold text-white">SmartWallet - Codex Integration</h1>
              <p className="text-sm text-slate-400">Enhanced SmartWallet with Codex features</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-600/60 bg-slate-700/40 p-2 text-slate-200 hover:bg-slate-700"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <Settings className="w-5 h-5 text-slate-400" />
            <span className="text-sm text-slate-400">Embedded Mode</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Control Panel */}
        <div
          className={`flex-shrink-0 border-r border-slate-700/50 bg-slate-800/30 overflow-y-auto transition-all duration-250 ${
            controlsCollapsed ? "w-16 p-2" : "w-80 p-6"
          }`}
        >
          <div className="mb-4 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setControlsCollapsed((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-600/60 bg-slate-700/40 p-2 text-slate-200 hover:bg-slate-700"
              title={controlsCollapsed ? "Expand controls" : "Collapse controls"}
              aria-label={controlsCollapsed ? "Expand controls" : "Collapse controls"}
            >
              {controlsCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>
          {controlsCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-600/60 bg-slate-700/40 text-slate-200 hover:bg-slate-700"
                title="Toggle theme"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </button>
              {(["narrow", "wide"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDensity(d)}
                  disabled={(d === "narrow" && !allowNarrow) || (d === "wide" && !allowWide)}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border text-xs font-semibold transition-colors ${
                    effectiveDensity === d
                      ? "border-indigo-400/70 bg-indigo-500/30 text-white"
                      : "border-slate-600/60 bg-slate-700/40 text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  }`}
                  title={d}
                  aria-label={`Set ${d} density`}
                >
                  {d === "narrow" ? "N" : "W"}
                </button>
              ))}
              <AlignHorizontalSpaceAround className="mt-2 h-4 w-4 text-slate-500" />
            </div>
          ) : (
          <div className="space-y-6">
            {/* Theme Control */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-3">Theme</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setTheme('dark')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    theme === 'dark'
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Dark
                </button>
                <button
                  onClick={() => setTheme('light')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    theme === 'light'
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Light
                </button>
              </div>
            </div>

            {/* Density Control */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-3">Density</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setDensity('narrow')}
                  disabled={!allowNarrow}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    effectiveDensity === 'narrow'
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40'
                  }`}
                >
                  Narrow
                </button>
                <button
                  onClick={() => setDensity('wide')}
                  disabled={!allowWide}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    effectiveDensity === 'wide'
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40'
                  }`}
                >
                  Wide
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-3">Allowed Widths (Per Codex)</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setAllowNarrow((prev) => (allowWide ? !prev : true))}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    allowNarrow
                      ? 'bg-cyan-500/30 text-cyan-100 ring-1 ring-cyan-400/60'
                      : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Allow Narrow
                </button>
                <button
                  onClick={() => setAllowWide((prev) => (allowNarrow ? !prev : true))}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    allowWide
                      ? 'bg-cyan-500/30 text-cyan-100 ring-1 ring-cyan-400/60'
                      : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Allow Wide
                </button>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">At least one width stays enabled.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-3">Anchor</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setWalletAnchor('left')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    walletAnchor === 'left'
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Left
                </button>
                <button
                  onClick={() => setWalletAnchor('right')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    walletAnchor === 'right'
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Right
                </button>
              </div>
            </div>

            {/* Features */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Codex Features</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  Embedded mode support
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  Codex integration
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  Enhanced UI from Netlify
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  Multi-variant support
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Usage</h3>
              <div className="text-xs text-slate-400 space-y-1">
                <p>• This SmartWallet is running in embedded mode</p>
                <p>• Codex integration features are enabled</p>
                <p>• All wallet functionality is available</p>
                <p>• Theme and density can be adjusted</p>
                <p>• Can be used in main app or Codex context</p>
              </div>
            </div>

            {/* Embed Code */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Code className="w-4 h-4 text-slate-400" />
                <label className="text-sm font-semibold text-slate-300">Embed URL</label>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                <code className="text-xs text-emerald-400 break-all">{embedUrl}</code>
              </div>
            </div>

            {/* Iframe Code */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Code className="w-4 h-4 text-slate-400" />
                <label className="text-sm font-semibold text-slate-300">Iframe Code</label>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                <code className="text-xs text-cyan-400 break-all">
                  {`<iframe src="${embedUrl}" width="100%" height="600px" />`}
                </code>
              </div>
            </div>

            {/* Info */}
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
              <p className="text-xs text-cyan-300">
                <strong>Testing Mode:</strong> Changes here update the component in real-time. Use this to ensure predictable behavior before embedding in thin clients.
              </p>
            </div>

            {/* Data Source Info */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <p className="text-xs text-amber-300">
                <strong>Live Data:</strong> This component uses real blockchain data from Ethereum Sepolia and Arbitrum Sepolia testnets.
              </p>
            </div>
          </div>
          )}
        </div>

        {/* Component Preview */}
        <div className="flex-1 overflow-hidden p-3 md:p-4">
          <div className={`${walletAnchor === "right" ? "ml-auto" : "mr-auto"} h-full max-h-full ${walletWidthClass}`}>
            <SmartWalletDrawer
              open={true}
              onClose={() => {}} // No-op in embedded mode
              variant="embedded"
              embeddedWidth="fixed"
              embeddedAnchor={walletAnchor}
              allowWideLayout={allowWide}
              agent={agent}
              personaId={personaId}
              codexMode={true}
              onCopilotStateChange={(open) => {
                setWalletCopilotOpen(open);
                if (open && allowWide) {
                  setDensity('wide');
                } else if (!open && allowNarrow) {
                  setDensity('narrow');
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SmartWalletViewerPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-slate-900" />}>
      <SmartWalletViewerContent />
    </Suspense>
  );
}
