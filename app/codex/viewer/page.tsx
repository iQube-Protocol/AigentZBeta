"use client";

import { useState } from "react";
import CodexPanel from "../../triad/components/CodexPanel";
import { BookOpen, Settings, Code } from "lucide-react";

export default function CodexViewerPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [density, setDensity] = useState<'narrow' | 'wide'>('wide');
  const [activeTab, setActiveTab] = useState('scrolls');

  const embedUrl = `https://dev-beta.aigentz.me/triad/embed/codex?tab=${activeTab}&theme=${theme}&density=${density}`;

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-700/50 bg-slate-800/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-purple-400" />
            <div>
              <h1 className="text-xl font-bold text-white">KNYT Codex Viewer</h1>
              <p className="text-sm text-slate-400">Test and configure the Codex embed component</p>
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
                      ? 'bg-purple-500 text-white'
                      : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Narrow
                </button>
                <button
                  onClick={() => setDensity('wide')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    density === 'wide'
                      ? 'bg-purple-500 text-white'
                      : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Wide
                </button>
              </div>
            </div>

            {/* Tab Selection */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-3">Initial Tab</label>
              <div className="grid grid-cols-2 gap-2">
                {['scrolls', 'characters', 'lore', 'digiterra', 'terra', 'order'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors capitalize ${
                      activeTab === tab
                        ? 'bg-purple-500 text-white'
                        : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
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
            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4">
              <p className="text-xs text-indigo-300">
                <strong>Testing Mode:</strong> Changes here update the component in real-time. Use this to ensure predictable behavior before embedding in thin clients.
              </p>
            </div>
          </div>
        </div>

        {/* Component Preview */}
        <div className="flex-1 overflow-hidden">
          <CodexPanel theme={theme} density={density} initialTab={activeTab} />
        </div>
      </div>
    </div>
  );
}
