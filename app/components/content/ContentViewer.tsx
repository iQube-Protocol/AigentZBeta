"use client";

import React, { useEffect, useState, useCallback } from "react";
import type {
  SmartContentQube,
  ContentModality,
  ReadModality,
  WatchModality,
  ListenModality,
  InteractModality,
} from "@/types/smartContent";

interface ContentViewerProps {
  content: SmartContentQube;
  initialModality?: ContentModality;
  onProgressUpdate?: (progress: number, timeSpent: number) => void;
  onPanelPayment?: (panelIndex: number) => void;
  onClose?: () => void;
  hasAccess?: boolean;
  accessScope?: "full" | "preview" | "panel";
  unlockedPanels?: number[];
}

interface PanelViewerProps {
  panels: ReadModality["panels"];
  currentPanel: number;
  onPanelChange: (index: number) => void;
  onPanelPayment?: (index: number) => void;
  hasAccess: boolean;
  accessScope: "full" | "preview" | "panel";
  unlockedPanels: number[];
  previewPanels: number;
}

function PanelViewer({
  panels,
  currentPanel,
  onPanelChange,
  onPanelPayment,
  hasAccess,
  accessScope,
  unlockedPanels,
  previewPanels,
}: PanelViewerProps) {
  const canViewPanel = (index: number) => {
    if (hasAccess && accessScope === "full") return true;
    if (index < previewPanels) return true;
    if (accessScope === "panel" && unlockedPanels.includes(index)) return true;
    return false;
  };

  const panel = panels[currentPanel];
  const isLocked = !canViewPanel(currentPanel);

  return (
    <div className="flex flex-col h-full">
      {/* Panel Display */}
      <div className="flex-1 relative bg-black/40 rounded-xl overflow-hidden">
        {isLocked ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="text-4xl mb-4">🔒</div>
            <p className="text-slate-300 text-sm mb-4">Panel {currentPanel + 1} is locked</p>
            <button
              onClick={() => onPanelPayment?.(currentPanel)}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white text-sm font-medium hover:from-fuchsia-400 hover:to-purple-400 transition-colors"
            >
              Unlock Panel
            </button>
          </div>
        ) : panel ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-4">
            {panel.storageUri ? (
              <img
                src={panel.storageUri}
                alt={panel.altText || `Panel ${currentPanel + 1}`}
                className="max-w-full max-h-[70%] object-contain rounded-lg"
              />
            ) : (
              <div className="text-slate-400 text-sm">No panel content</div>
            )}
            {/* Caption */}
            {panel.altText && (
              <div className="mt-4 px-6 py-3 bg-black/40 rounded-lg max-w-2xl">
                <p className="text-slate-200 text-center text-sm leading-relaxed italic">
                  "{panel.altText}"
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400">
            Panel not found
          </div>
        )}
      </div>

      {/* Panel Navigation */}
      <div className="flex items-center justify-between mt-4 px-2">
        <button
          onClick={() => onPanelChange(Math.max(0, currentPanel - 1))}
          disabled={currentPanel === 0}
          className="px-3 py-1.5 rounded-lg bg-white/5 ring-1 ring-white/10 text-slate-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
        >
          ← Previous
        </button>

        <div className="flex items-center gap-1">
          {panels.map((_, idx) => (
            <button
              key={idx}
              onClick={() => onPanelChange(idx)}
              className={`w-2 h-2 rounded-full transition-colors ${
                idx === currentPanel
                  ? "bg-fuchsia-500"
                  : canViewPanel(idx)
                  ? "bg-white/30 hover:bg-white/50"
                  : "bg-white/10"
              }`}
              title={canViewPanel(idx) ? `Panel ${idx + 1}` : `Panel ${idx + 1} (Locked)`}
            />
          ))}
        </div>

        <button
          onClick={() => onPanelChange(Math.min(panels.length - 1, currentPanel + 1))}
          disabled={currentPanel === panels.length - 1}
          className="px-3 py-1.5 rounded-lg bg-white/5 ring-1 ring-white/10 text-slate-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
        >
          Next →
        </button>
      </div>

      {/* Panel Info */}
      <div className="mt-2 text-center text-xs text-slate-400">
        Panel {currentPanel + 1} of {panels.length}
        {!hasAccess && accessScope !== "full" && (
          <span className="ml-2 text-fuchsia-400">
            ({unlockedPanels.length + previewPanels} / {panels.length} unlocked)
          </span>
        )}
      </div>
    </div>
  );
}

function VideoViewer({ watch }: { watch: WatchModality }) {
  const primaryAsset = watch.videoAssets?.[0];

  if (!primaryAsset) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        No video content available
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-black rounded-xl overflow-hidden">
      <video
        src={primaryAsset.storageUri}
        controls
        className="max-w-full max-h-full"
        poster={primaryAsset.thumbnailUri}
      >
        Your browser does not support video playback.
      </video>
    </div>
  );
}

function AudioViewer({ listen }: { listen: ListenModality }) {
  const primaryAsset = listen.audioAssets?.[0];

  if (!primaryAsset) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        No audio content available
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6">
      {/* Album Art / Waveform Placeholder */}
      <div className="w-48 h-48 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-purple-500/20 ring-1 ring-white/10 flex items-center justify-center">
        <span className="text-6xl">🎧</span>
      </div>

      {/* Audio Player */}
      <audio src={primaryAsset.storageUri} controls className="w-full max-w-md">
        Your browser does not support audio playback.
      </audio>

      {/* Transcript Toggle */}
      {listen.transcriptAsset && (
        <button className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
          Show Transcript
        </button>
      )}
    </div>
  );
}

function InteractViewer({
  interact,
  contentId,
}: {
  interact: InteractModality;
  contentId: string;
}) {
  const [messages, setMessages] = useState<Array<{ role: "user" | "agent"; content: string }>>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const primaryAgent = interact.agents[0];

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !primaryAgent) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      // TODO: Integrate with actual agent chat API
      // For now, simulate a response
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content: `[${primaryAgent}] This is a placeholder response. Agent integration coming soon.`,
        },
      ]);
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  }, [input, primaryAgent]);

  return (
    <div className="flex flex-col h-full">
      {/* Agent Info */}
      <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl ring-1 ring-white/10 mb-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-500 flex items-center justify-center text-white font-medium">
          {primaryAgent?.charAt(0) || "A"}
        </div>
        <div>
          <div className="text-sm font-medium text-slate-100">{primaryAgent || "Agent"}</div>
          <div className="text-xs text-slate-400">Interactive content agent</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 text-sm py-8">
            Start a conversation with the content agent
          </div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                msg.role === "user"
                  ? "bg-fuchsia-500/20 text-slate-100 ring-1 ring-fuchsia-500/30"
                  : "bg-white/5 text-slate-200 ring-1 ring-white/10"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/5 ring-1 ring-white/10 px-3 py-2 rounded-xl">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100" />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 rounded-xl bg-black/40 ring-1 ring-white/10 text-slate-200 text-sm placeholder:text-slate-500 focus:ring-fuchsia-500/50 focus:outline-none"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || isLoading}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-fuchsia-400 hover:to-purple-400 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}

const MODALITY_TABS: Record<ContentModality, { icon: string; label: string }> = {
  read: { icon: "📖", label: "Read" },
  watch: { icon: "🎬", label: "Watch" },
  listen: { icon: "🎧", label: "Listen" },
  interact: { icon: "💬", label: "Chat" },
};

export default function ContentViewer({
  content,
  initialModality,
  onProgressUpdate,
  onPanelPayment,
  onClose,
  hasAccess = false,
  accessScope = "preview",
  unlockedPanels = [],
}: ContentViewerProps) {
  const isModalityEnabled = (mod?: { enabled?: boolean; available?: boolean }) => {
    if (!mod) return false;
    if (typeof mod.enabled === "boolean") return mod.enabled;
    if (typeof mod.available === "boolean") return mod.available;
    return false;
  };

  // Get available modalities - guard against undefined modalities
  const availableModalities = content.modalities 
    ? Object.entries(content.modalities)
        .filter(([_, mod]) => isModalityEnabled(mod as { enabled?: boolean; available?: boolean }))
        .map(([key]) => key as ContentModality)
    : ["read" as ContentModality];

  const resolveModality = (preferred?: ContentModality) => {
    if (preferred && availableModalities.includes(preferred)) return preferred;
    return availableModalities[0] || "read";
  };

  const [activeModality, setActiveModality] = useState<ContentModality>(
    resolveModality(initialModality)
  );
  const [currentPanel, setCurrentPanel] = useState(0);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    setActiveModality(resolveModality(initialModality));
  }, [content.id, initialModality, availableModalities.join(",")]);

  // Track progress
  const handlePanelChange = useCallback(
    (index: number) => {
      setCurrentPanel(index);
      const panels = content.modalities?.read?.panels || [];
      if (panels.length > 0) {
        const progress = Math.round(((index + 1) / panels.length) * 100);
        const timeSpent = Math.round((Date.now() - startTime) / 1000);
        onProgressUpdate?.(progress, timeSpent);
      }
    },
    [content.modalities?.read?.panels, startTime, onProgressUpdate]
  );

  const previewPanels = content.pricingModel?.freePreview?.panels || 2;

  return (
    <div className="flex flex-col h-full bg-black/30 backdrop-blur-xl rounded-2xl ring-1 ring-white/10 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white/5 ring-1 ring-white/10">
        <div className="flex items-center gap-3">
          <h3 className="text-slate-100 text-sm font-medium">{content.title}</h3>
          {content.structure?.kind && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-white/10 text-slate-400">
              {content.structure.kind}
            </span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="px-2 py-1 text-xs rounded-md bg-white/5 ring-1 ring-white/10 text-slate-200 hover:bg-white/10"
          >
            Close
          </button>
        )}
      </header>

      {/* Modality Tabs */}
      {availableModalities.length > 1 && (
        <div className="flex gap-1 px-4 py-2 bg-white/5">
          {availableModalities.map((mod) => (
            <button
              key={mod}
              onClick={() => setActiveModality(mod)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeModality === mod
                  ? "bg-fuchsia-500/20 text-fuchsia-300 ring-1 ring-fuchsia-500/30"
                  : "bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10"
              }`}
            >
              {MODALITY_TABS[mod].icon} {MODALITY_TABS[mod].label}
            </button>
          ))}
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 p-4 overflow-hidden">
        {activeModality === "read" && isModalityEnabled(content.modalities?.read) && (
          <PanelViewer
            panels={content.modalities?.read?.panels || []}
            currentPanel={currentPanel}
            onPanelChange={handlePanelChange}
            onPanelPayment={onPanelPayment}
            hasAccess={hasAccess}
            accessScope={accessScope}
            unlockedPanels={unlockedPanels}
            previewPanels={previewPanels}
          />
        )}

        {activeModality === "watch" && isModalityEnabled(content.modalities?.watch) && (
          <VideoViewer watch={content.modalities.watch} />
        )}

        {activeModality === "listen" && isModalityEnabled(content.modalities?.listen) && (
          <AudioViewer listen={content.modalities.listen} />
        )}

        {activeModality === "interact" && isModalityEnabled(content.modalities?.interact) && (
          <InteractViewer interact={content.modalities.interact} contentId={content.id} />
        )}

        {/* Fallback for content without modalities */}
        {!isModalityEnabled(content.modalities?.read) &&
         !isModalityEnabled(content.modalities?.watch) &&
         !isModalityEnabled(content.modalities?.listen) &&
         !isModalityEnabled(content.modalities?.interact) && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-4">📄</div>
            <h3 className="text-lg font-medium text-white mb-2">{content.title}</h3>
            <p className="text-sm text-slate-400 max-w-md">{content.description}</p>
          </div>
        )}
      </div>

      {/* Footer with Access Info */}
      {!hasAccess && accessScope !== "full" && (
        <div className="px-4 py-3 bg-gradient-to-r from-fuchsia-500/10 to-purple-500/10 border-t border-white/10">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-300">
              {accessScope === "preview" && `Preview mode - ${previewPanels} panels free`}
              {accessScope === "panel" && `Pay-per-panel - ${unlockedPanels.length} unlocked`}
            </div>
            <button
              onClick={() => onPanelPayment?.(currentPanel)}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white text-xs font-medium hover:from-fuchsia-400 hover:to-purple-400 transition-colors"
            >
              Unlock Full Access
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
