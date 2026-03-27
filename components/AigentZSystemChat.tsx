"use client";

/**
 * AigentZSystemChat
 *
 * Aigent Z System AI chat panel — mode: system.
 * Operational, conservative, grounded on the AgentiQ Codex KB.
 *
 * Uses its own CopilotKit provider pointing at /api/copilotkit/system
 * so it is fully isolated from the Platform Copilot (/api/copilotkit).
 *
 * The wallet drawer is separate (AgentWalletDrawer) and not touched here.
 */

import React from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import { X } from "lucide-react";

interface AigentZSystemChatProps {
  open: boolean;
  onClose: () => void;
}

export default function AigentZSystemChat({
  open,
  onClose,
}: AigentZSystemChatProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 pointer-events-auto"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 flex flex-col w-full max-w-md bg-slate-900 border-l border-slate-700 shadow-2xl pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-semibold text-slate-100">
              Aigent Z — System AI
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 font-mono">
              mode:system
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 transition-colors"
            aria-label="Close Aigent Z System AI"
          >
            <X size={18} />
          </button>
        </div>

        {/* CopilotKit scoped to system endpoint */}
        <div className="flex-1 overflow-hidden">
          <CopilotKit runtimeUrl="/api/copilotkit/system" showDevConsole={false}>
            <CopilotChat
              className="h-full"
              instructions="You are Aigent Z in system mode. Be precise, cite codex sources, and stay operational."
              labels={{
                title: "Aigent Z System AI",
                initial:
                  "Hi — I'm Aigent Z in system mode. Ask me about platform architecture, recent PRs, design decisions, or how specific flows work. I draw from the AgentiQ Codex.",
                placeholder: "Ask about architecture, decisions, or recent changes...",
              }}
            />
          </CopilotKit>
        </div>
      </div>
    </div>
  );
}
