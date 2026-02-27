"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import SmartWalletDrawer from "../../../components/content/SmartWalletDrawer";
import { Wallet, Settings, Code } from "lucide-react";

function SmartWalletViewerContent() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [density, setDensity] = useState<'narrow' | 'wide'>('wide');
  const searchParams = useSearchParams();
  const personaId = searchParams?.get('personaId') || undefined;

  // Sample agent data - in real app this would come from context
  const agent = {
    id: "agent-123",
    name: "Demo Agent",
    fioHandle: "demo@agentiq",
  };

  const embedUrl = `https://dev-beta.aigentz.me/triad/embed/wallet?theme=${theme}&density=${density}`;

  return (
    <div className="h-screen flex flex-col bg-slate-900">
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
            <Settings className="w-5 h-5 text-slate-400" />
            <span className="text-sm text-slate-400">Embedded Mode</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Control Panel */}
        <div className="w-80 flex-shrink-0 border-r border-slate-700/50 bg-slate-800/30 p-6 overflow-y-auto">
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
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    density === 'narrow'
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Narrow
                </button>
                <button
                  onClick={() => setDensity('wide')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    density === 'wide'
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Wide
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
        </div>

        {/* Component Preview */}
        <div className="flex-1 overflow-hidden">
          <SmartWalletDrawer
            open={true}
            onClose={() => {}} // No-op in embedded mode
            variant="embedded"
            embeddedWidth={density === 'wide' ? 'fill' : 'fixed'}
            agent={agent}
            personaId={personaId}
            codexMode={true}
          />
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
