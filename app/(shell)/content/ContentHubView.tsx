"use client";

import React, { useState, useEffect } from "react";
import { SmartContentCard, SmartWalletDrawer, ContentCopilotPanel, useSmartTriad } from "@/app/components/content";
import { PersonaSetupWizard } from "@/app/components/wallet";
import { agentConfigs } from "@/app/data/agentConfig";
import type { SmartContentQube } from "@/types/smartContent";

const PAYER_AGENT = agentConfigs["aigent-z"];
const RECIPIENT_AGENT = agentConfigs["aigent-kn0w1"];

export default function ContentHubView() {
  const { state, actions } = useSmartTriad();
  const [content, setContent] = useState<SmartContentQube[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [showPersonaWizard, setShowPersonaWizard] = useState(false);

  useEffect(() => {
    fetch("/api/content/smart?status=published")
      .then(r => r.json())
      .then(d => setContent(d.data || []))
      .catch(() => setContent([]))
      .finally(() => setLoading(false));
  }, []);

  const apps = [...new Set(content.map(c => c.app))];
  const filtered = activeApp ? content.filter(c => c.app === activeApp) : content;

  const handleSelect = (c: SmartContentQube) => {
    actions.setContent(c);
  };

  const handlePurchase = (c: SmartContentQube) => {
    actions.setContent(c);
    actions.openWallet("full");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      <header className="sticky top-0 z-40 bg-black/30 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Smart Content Hub</h1>
            <p className="text-sm text-slate-400">Powered by Aigent Z • {content.length} items</p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/content/library" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 ring-1 ring-white/10 text-slate-400 hover:text-white text-sm">
              <span>📚</span><span>Library</span>
              {state.ownedContentIds.size > 0 && <span className="px-1.5 py-0.5 rounded-full bg-fuchsia-500/30 text-fuchsia-300 text-xs">{state.ownedContentIds.size}</span>}
            </a>
            <a href="/content/create" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/20 ring-1 ring-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 text-sm">
              <span>✨</span><span>Create</span>
            </a>
            <button onClick={() => setCopilotOpen(!copilotOpen)} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${copilotOpen ? "bg-fuchsia-500/30 ring-1 ring-fuchsia-500/50 text-fuchsia-300" : "bg-white/5 ring-1 ring-white/10 text-slate-400"}`}>
              <span>🤖</span><span className="text-sm">Copilot</span>
            </button>
            <button onClick={() => actions.openWallet()} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-fuchsia-500/20 ring-1 ring-fuchsia-500/30 text-fuchsia-300">
              <span>💰</span><span className="text-sm">{PAYER_AGENT.name}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-2 mb-6 flex-wrap">
          <button onClick={() => setActiveApp(null)} className={`px-3 py-1.5 rounded-lg text-sm ${!activeApp ? "bg-fuchsia-500/20 text-fuchsia-300" : "bg-white/5 text-slate-400"}`}>All</button>
          {apps.map(app => <button key={app} onClick={() => setActiveApp(app)} className={`px-3 py-1.5 rounded-lg text-sm ${activeApp === app ? "bg-fuchsia-500/20 text-fuchsia-300" : "bg-white/5 text-slate-400"}`}>{app}</button>)}
        </div>

        {loading ? <div className="text-center py-12 text-slate-400">Loading...</div> : filtered.length === 0 ? (
          <div className="text-center py-12"><p className="text-slate-400 mb-4">No content</p><button onClick={() => setCopilotOpen(true)} className="px-4 py-2 rounded-lg bg-fuchsia-500/20 text-fuchsia-300">Ask Copilot</button></div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(c => <SmartContentCard key={c.id} content={c} variant="standard" onSelect={handleSelect} onPurchase={handlePurchase} isOwned={state.ownedContentIds.has(c.id)} />)}
          </div>
        )}
      </main>

      <SmartWalletDrawer
        open={state.walletOpen}
        onClose={() => actions.closeWallet()}
        agent={{ id: PAYER_AGENT.id, name: PAYER_AGENT.name, evmSepolia: PAYER_AGENT.walletAddresses.evmAddress as `0x${string}`, evmArb: PAYER_AGENT.walletAddresses.evmAddress as `0x${string}`, btcAddress: PAYER_AGENT.walletAddresses.btcAddress }}
        recipientAddress={RECIPIENT_AGENT.walletAddresses.evmAddress}
        currentContent={state.currentContent || undefined}
        onPurchaseComplete={() => actions.refreshLibrary()}
        onCreatePersona={() => setShowPersonaWizard(true)}
      />

      {/* Persona Setup Wizard */}
      {showPersonaWizard && (
        <PersonaSetupWizard
          onComplete={(persona) => {
            setShowPersonaWizard(false);
            // Optionally refresh wallet state here
          }}
          onCancel={() => setShowPersonaWizard(false)}
        />
      )}

      <ContentCopilotPanel isOpen={copilotOpen} onClose={() => setCopilotOpen(false)} />
    </div>
  );
}
