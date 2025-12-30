"use client";

import { useState } from "react";
import { Brain, Settings, Code, Sparkles } from "lucide-react";

export default function CopilotViewerPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [density, setDensity] = useState<'narrow' | 'wide'>('wide');

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-700/50 bg-slate-800/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-emerald-400" />
            <div>
              <h1 className="text-xl font-bold text-white">Copilot Interface</h1>
              <p className="text-sm text-slate-400">Test and configure the Copilot embed component</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-400" />
            <span className="text-sm text-slate-400">Component Tester</span>
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
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Narrow
                </button>
                <button
                  onClick={() => setDensity('wide')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    density === 'wide'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Wide
                </button>
              </div>
            </div>

            {/* Component Info */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-3">Features</label>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                  <span>AI-powered assistance</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                  <span>Context-aware suggestions</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                  <span>Natural language interface</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                  <span>Action execution</span>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-amber-300">Coming Soon</span>
              </div>
              <p className="text-xs text-amber-300">
                The Copilot embed component is currently under development. This page will provide a full testing interface once the component is ready.
              </p>
            </div>

            {/* Planned Features */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-3">Planned Features</label>
              <div className="space-y-2">
                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                  <div className="text-xs font-medium text-slate-300 mb-1">Chat Interface</div>
                  <div className="text-xs text-slate-500">Natural language conversation with AI agents</div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                  <div className="text-xs font-medium text-slate-300 mb-1">Action Cards</div>
                  <div className="text-xs text-slate-500">Visual cards for suggested actions and workflows</div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                  <div className="text-xs font-medium text-slate-300 mb-1">Context Panel</div>
                  <div className="text-xs text-slate-500">Display relevant context and data</div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                  <div className="text-xs font-medium text-slate-300 mb-1">History</div>
                  <div className="text-xs text-slate-500">View and replay previous interactions</div>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
              <p className="text-xs text-emerald-300">
                <strong>Testing Mode:</strong> This page will allow you to test and configure the Copilot interface before embedding in thin clients.
              </p>
            </div>
          </div>
        </div>

        {/* Component Preview */}
        <div className="flex-1 overflow-hidden bg-slate-900 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md">
            <div className="w-20 h-20 mx-auto bg-emerald-500/10 rounded-full flex items-center justify-center">
              <Brain className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Copilot Interface</h2>
            <p className="text-slate-400">
              The Copilot embed component is currently under development. Check back soon for a full testing interface.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
              <Sparkles className="w-4 h-4" />
              <span>Coming Soon</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
