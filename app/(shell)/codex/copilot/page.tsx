"use client";

import { useState } from "react";
import { CodexCopilotLayer } from "@/app/components/codex/CodexCopilotLayer";
import { Brain, Settings, Code, Sparkles, Bot, MessageSquare } from "lucide-react";

export default function CopilotViewerPage() {
  const [isCopilotOpen, setIsCopilotOpen] = useState(true); // Start open for testing
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [density, setDensity] = useState<'narrow' | 'wide'>('wide');

  // Debug logging for copilot state
  const handleOpenCopilot = () => {
    console.log('🔥 Opening copilot - setting isCopilotOpen to true');
    setIsCopilotOpen(true);
  };

  const handleCloseCopilot = () => {
    console.log('🔥 Closing copilot - setting isCopilotOpen to false');
    setIsCopilotOpen(false);
  };

  // Sample agent data - in real app this would come from context
  const agent = {
    id: "codex-agent",
    name: "Codex Explorer",
    fioHandle: "codex@explorer",
    evmSepolia: "0x1234567890123456789012345678901234567890" as `0x${string}`,
  };

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-700/50 bg-slate-800/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-emerald-400" />
            <div>
              <h1 className="text-xl font-bold text-white">Codex Copilot</h1>
              <p className="text-sm text-slate-400">Enhanced AI assistant with Codex knowledge base</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenCopilot}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              Open Copilot
            </button>
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-slate-400" />
              <span className="text-sm text-slate-400">Enhanced Mode</span>
            </div>
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
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Enhanced Features</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  Codex knowledge base integration
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  Context-aware responses
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  Smart Wallet integration
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  KNYT/Qriptopian mode switching
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  MetaAvatar integration
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  Enhanced UI from Netlify
                </div>
              </div>
            </div>

            {/* Knowledge Base */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Knowledge Sources</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Code className="w-4 h-4" />
                  Codex episodes & content
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Bot className="w-4 h-4" />
                  Character information
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Sparkles className="w-4 h-4" />
                  Lore & world-building
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Brain className="w-4 h-4" />
                  MetaKnyts universe
                </div>
              </div>
            </div>

            {/* Usage */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Usage Examples</h3>
              <div className="space-y-2 text-xs text-slate-400">
                <p>"Tell me about Episode 1"</p>
                <p>"Who are the main characters?"</p>
                <p>"What are rare editions?"</p>
                <p>"How do I earn more KNYT?"</p>
                <p>"What's the difference between motion and print?"</p>
                <p>"Explain the metaKnyts story"</p>
              </div>
            </div>

            {/* Instructions */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Instructions</h3>
              <div className="text-xs text-slate-400 space-y-1">
                <p>• Click "Open Copilot" to start chatting</p>
                <p>• Switch between KNYT and Qriptopian modes</p>
                <p>• Access Smart Wallet from copilot</p>
                <p>• Ask about any Codex content</p>
                <p>• Get personalized recommendations</p>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 bg-slate-900/50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Bot className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Codex Copilot Ready</h3>
            <p className="text-slate-400 mb-6 max-w-md">
              Enhanced AI assistant with deep knowledge of the Codex content library. 
              Ask questions about episodes, characters, lore, and more.
            </p>
            <button
              onClick={handleOpenCopilot}
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
            >
              <MessageSquare className="w-5 h-5" />
              Start Chatting
            </button>
          </div>
        </div>
      </div>

      {/* Codex Copilot Layer */}
      <CodexCopilotLayer
        isOpen={isCopilotOpen}
        onClose={handleCloseCopilot}
        onOpen={handleOpenCopilot}
        enableInferenceRendering
        quickPrompts={[
          "Summarize the latest Codex lore",
          "Show the metaKNYT episode catalog",
          "Find experience cartridges for onboarding",
          "Best templates for a rewards flow",
          "Explain KNYT personas and identity modes",
        ]}
        promptPlaceholder="Ask about Codex, KNYT, templates, or experiences..."
        agent={agent}
      />
    </div>
  );
}
