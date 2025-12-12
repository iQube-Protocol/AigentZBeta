"use client";

/**
 * Content Library Page
 * 
 * Full-page library experience showing:
 * - Owned content with progress tracking
 * - Custom shelves and organization
 * - Reading/watching/listening history
 * - Favorites and bookmarks
 */

import React, { useState } from "react";
import { SmartTriadProvider, useSmartTriad, LibraryShelf, ContentCopilotPanel } from "@/app/components/content";

function LibraryPageInner() {
  const { state, actions, personaId } = useSmartTriad();
  const [copilotOpen, setCopilotOpen] = useState(false);

  const handleContentSelect = (content: any) => {
    actions.setContent(content);
    // Could navigate to content viewer or open modal
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/30 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">My Library</h1>
            <p className="text-sm text-slate-400">
              {state.ownedContentIds.size} items in your collection
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCopilotOpen(!copilotOpen)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${
                copilotOpen 
                  ? "bg-fuchsia-500/30 ring-1 ring-fuchsia-500/50 text-fuchsia-300"
                  : "bg-white/5 ring-1 ring-white/10 text-slate-400 hover:text-white"
              }`}
            >
              <span>🤖</span>
              <span className="text-sm font-medium">Copilot</span>
            </button>
            <a
              href="/content"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-fuchsia-500/20 ring-1 ring-fuchsia-500/30 text-fuchsia-300 hover:bg-fuchsia-500/30 transition-colors"
            >
              <span>🔍</span>
              <span className="text-sm font-medium">Browse</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {personaId ? (
          <LibraryShelf
            personaId={personaId}
            variant="page"
            onContentSelect={handleContentSelect}
          />
        ) : (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">🔐</div>
            <p className="text-slate-400">Please sign in to view your library</p>
          </div>
        )}
      </main>

      {/* Copilot Panel */}
      <ContentCopilotPanel
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
      />
    </div>
  );
}

export default function LibraryPage() {
  return (
    <SmartTriadProvider 
      personaId="00000000-0000-0000-0000-000000000001" 
      agentId="aigent-z"
    >
      <LibraryPageInner />
    </SmartTriadProvider>
  );
}
