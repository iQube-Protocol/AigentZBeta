"use client";

import React from "react";
import type { SmartContentQube } from "@/types/smartContent";

type SmartContentCardProps = {
  content: SmartContentQube;
  variant?: string;
  templateVariant?: string;
  device?: string;
  heroHeight?: string;
  className?: string;
  isLimited?: boolean;
  showProgress?: boolean;
  progressPercentage?: number;
  priceBadge?: string;
  rewardBadge?: string;
  isSelected?: boolean;
  onSelect?: (content: SmartContentQube) => void;
  onOpen?: () => void;
  onPreview?: () => void;
  onShare?: () => void;
  onPurchase?: (content: SmartContentQube) => void;
  onAddToLibrary?: (content: SmartContentQube) => void;
  [key: string]: any;
};

export function SmartContentCard({
  content,
  className = "",
  onSelect,
  onPurchase,
  onAddToLibrary,
  onPreview,
  onShare,
}: SmartContentCardProps) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/5 p-4 text-white shadow-[0_10px_30px_rgba(0,0,0,0.35)] ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{content.title || "Untitled Content"}</div>
          {content.description && <div className="text-xs text-white/60">{content.description}</div>}
        </div>
        <div className="flex items-center gap-2">
          {onPreview && (
            <button
              className="rounded-full border border-white/10 px-2 py-1 text-xs text-white/70 hover:text-white"
              onClick={onPreview}
            >
              Preview
            </button>
          )}
          {onShare && (
            <button
              className="rounded-full border border-white/10 px-2 py-1 text-xs text-white/70 hover:text-white"
              onClick={onShare}
            >
              Share
            </button>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {onSelect && (
          <button
            className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80 hover:bg-white/20"
            onClick={() => onSelect(content)}
          >
            Open
          </button>
        )}
        {onPurchase && (
          <button
            className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/30"
            onClick={() => onPurchase(content)}
          >
            Purchase
          </button>
        )}
        {onAddToLibrary && (
          <button
            className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs text-indigo-200 hover:bg-indigo-500/30"
            onClick={() => onAddToLibrary(content)}
          >
            Add to Library
          </button>
        )}
      </div>
    </div>
  );
}

type ContentViewerProps = {
  content: SmartContentQube;
  onClose: () => void;
  hasAccess?: boolean;
  accessScope?: string;
  unlockedPanels?: number[];
  onPanelPayment?: (panelIndex: number) => void;
};

export function ContentViewer({
  content,
  onClose,
  hasAccess,
  accessScope,
  unlockedPanels,
  onPanelPayment,
}: ContentViewerProps) {
  return (
    <div className="h-full w-full rounded-2xl border border-white/10 bg-slate-900/90 p-6 text-white shadow-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{content.title || "Content Viewer"}</h3>
          <p className="text-sm text-white/60">{content.description || "Preview content details."}</p>
        </div>
        <button
          className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 hover:text-white"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <div className="mt-4 space-y-3 text-sm text-white/70">
        <p><strong>Access:</strong> {hasAccess ? "Granted" : "Limited"} ({accessScope || "unknown"})</p>
        {Array.isArray(unlockedPanels) && unlockedPanels.length > 0 && (
          <p><strong>Unlocked Panels:</strong> {unlockedPanels.join(", ")}</p>
        )}
        {onPanelPayment && (
          <button
            className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80 hover:bg-white/20"
            onClick={() => onPanelPayment(0)}
          >
            Unlock Next Panel
          </button>
        )}
      </div>
    </div>
  );
}

type SmartWalletDrawerProps = {
  open: boolean;
  onClose: () => void;
  agent?: any;
  personaId?: string;
  walletNode?: any;
  currentContent?: SmartContentQube;
  onContentSelect?: (content: SmartContentQube) => void;
  onPurchaseComplete?: (content?: SmartContentQube) => void;
  recipientAddress?: string;
  onCreatePersona?: () => void;
  onPersonaChange?: (personaId: string) => void;
  onTaskAction?: (task: any, action: string) => void;
  onSubmitReputationClaim?: () => void;
  onOpenCopilot?: () => void;
};

export function SmartWalletDrawer({
  open,
  onClose,
  currentContent,
  onPurchaseComplete,
  onOpenCopilot,
}: SmartWalletDrawerProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40">
      <div className="h-full w-full max-w-md bg-slate-950 p-6 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Smart Wallet</h3>
          <button className="text-sm text-white/60 hover:text-white" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mt-4 space-y-3 text-sm text-white/70">
          <p>Wallet drawer placeholder. Connect flows and receipts will render here.</p>
          {currentContent && <p><strong>Current:</strong> {currentContent.title}</p>}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80 hover:bg-white/20"
            onClick={() => onPurchaseComplete?.(currentContent)}
          >
            Simulate Purchase
          </button>
          <button
            className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80 hover:bg-white/20"
            onClick={() => onOpenCopilot?.()}
          >
            Open Copilot
          </button>
        </div>
      </div>
    </div>
  );
}

type SmartTriadProviderProps = {
  children: React.ReactNode;
  personaId?: string;
  agentId?: string;
  initialContent?: SmartContentQube;
};

export function SmartTriadProvider({ children }: SmartTriadProviderProps) {
  return <>{children}</>;
}

export function SmartTriadSurfaces(_props: { personaId?: string; [key: string]: any }) {
  return null;
}
