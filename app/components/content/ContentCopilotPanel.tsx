"use client";

/**
 * Content Copilot Panel
 * 
 * Embedded Copilot chat for content-specific interactions:
 * - "Buy this content"
 * - "Show my library"
 * - "What can I read?"
 * - "Recommend something"
 */

import React, { useState, useRef, useEffect } from "react";
import { CopilotChat } from "@copilotkit/react-ui";
import { useCopilotAction } from "@copilotkit/react-core";
import { useSmartTriad } from "./SmartTriadProvider";

interface ContentCopilotPanelProps {
  isOpen: boolean;
  onClose: () => void;
  position?: "right" | "bottom";
}

export default function ContentCopilotPanel({
  isOpen,
  onClose,
  position = "right",
}: ContentCopilotPanelProps) {
  const { state, actions, personaId } = useSmartTriad();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const contentTitle = state.currentContent?.title || "content";
  const contentId = state.currentContent?.id;

  // Register frontend actions that Copilot can trigger
  useCopilotAction({
    name: "open_wallet_for_purchase",
    description: "Open the wallet drawer to purchase the current content",
    parameters: [],
    handler: async () => {
      actions.openWallet("full");
      return "Wallet opened for purchase";
    },
  });

  useCopilotAction({
    name: "show_library",
    description: "Show the user's content library",
    parameters: [],
    handler: async () => {
      await actions.refreshLibrary();
      return `You own ${state.ownedContentIds.size} content items`;
    },
  });

  if (!isOpen) return null;

  const instructions = `You are the Content Copilot for the Smart Content Hub. 
You help users browse, purchase, and consume content using the Smart Triad system.

Current context:
- Persona ID: ${personaId}
- Current content: ${contentTitle} (ID: ${contentId || "none selected"})
- Content owned: ${state.ownedContentIds.size} items
- Wallet open: ${state.walletOpen}
- Purchase in progress: ${state.purchaseInProgress}

Available backend actions:
- triad_purchase_content: Buy content using Q¢ on Arbitrum, Base, Polygon, or Optimism
- triad_browse_library: Show user's owned content  
- triad_recommend_content: Get personalized recommendations
- triad_configure_experience: Configure the viewing experience
- smartmenu_configure_for_content: Configure menu for content display

Available frontend actions:
- open_wallet_for_purchase: Open wallet drawer to make a purchase
- show_library: Refresh and show library status

When users want to buy content:
1. First use open_wallet_for_purchase to show the wallet
2. The user can then complete the purchase in the wallet UI

Default to Arbitrum (arb) for Q¢ payments unless they specify otherwise.
Be concise and helpful. Use emojis sparingly.`;

  const handleQuickAction = async (action: string) => {
    setPendingAction(action);
    
    switch (action) {
      case "buy":
        if (contentId) {
          actions.openWallet("full");
        }
        break;
      case "library":
        await actions.refreshLibrary();
        break;
      case "recommend":
        // This will be handled by Copilot
        break;
    }
    
    setTimeout(() => setPendingAction(null), 1000);
  };

  return (
    <div
      className={`fixed z-50 bg-slate-900/95 backdrop-blur-xl border-l border-white/10 shadow-2xl transition-transform duration-300 ${
        position === "right"
          ? "top-0 right-0 h-full w-96"
          : "bottom-0 left-0 right-0 h-96"
      } ${isOpen ? "translate-x-0" : "translate-x-full"}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/20">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <span className="font-semibold text-white">Content Copilot</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Context Bar */}
      {state.currentContent && (
        <div className="px-4 py-2 bg-fuchsia-500/10 border-b border-fuchsia-500/20">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-fuchsia-400">📄</span>
            <span className="text-fuchsia-300 truncate">{contentTitle}</span>
            {state.ownedContentIds.has(contentId || "") && (
              <span className="ml-auto px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs">Owned</span>
            )}
          </div>
        </div>
      )}

      {/* Chat */}
      <div className={`overflow-hidden ${state.currentContent ? "h-[calc(100%-140px)]" : "h-[calc(100%-100px)]"}`}>
        <CopilotChat
          instructions={instructions}
          labels={{
            title: "Content Copilot",
            initial: `Hi! I can help you with content. Try:\n• "Buy this"\n• "Show my library"\n• "Recommend something"`,
            placeholder: "Ask about content, purchases, library...",
          }}
          className="h-full [&_.copilotKitChat]:bg-transparent [&_.copilotKitMessages]:bg-transparent"
        />
      </div>

      {/* Quick Actions */}
      <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="flex flex-wrap gap-2">
          <QuickAction 
            label="Buy this" 
            icon="💰" 
            onClick={() => handleQuickAction("buy")}
            disabled={!contentId || state.purchaseInProgress}
            loading={pendingAction === "buy"}
          />
          <QuickAction 
            label="My library" 
            icon="📚" 
            onClick={() => handleQuickAction("library")}
            loading={pendingAction === "library" || state.libraryLoading}
            badge={state.ownedContentIds.size > 0 ? state.ownedContentIds.size.toString() : undefined}
          />
          <QuickAction 
            label="Recommend" 
            icon="✨" 
            onClick={() => handleQuickAction("recommend")}
            loading={pendingAction === "recommend"}
          />
        </div>
      </div>
    </div>
  );
}

interface QuickActionProps {
  label: string;
  icon: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  badge?: string;
}

function QuickAction({ label, icon, onClick, disabled, loading, badge }: QuickActionProps) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled || loading}
      className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-all ${
        disabled 
          ? "bg-white/5 text-slate-500 cursor-not-allowed"
          : loading
          ? "bg-fuchsia-500/20 text-fuchsia-300 ring-1 ring-fuchsia-500/30"
          : "bg-white/5 ring-1 ring-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className={loading ? "animate-pulse" : ""}>{icon}</span>
      <span>{label}</span>
      {badge && (
        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-fuchsia-500/30 text-fuchsia-300 text-xs">{badge}</span>
      )}
    </button>
  );
}
