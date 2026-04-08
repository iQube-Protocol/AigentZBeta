"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { theQriptopianStyleGuide } from "@agentiq/article-reader";
import type {
  SmartContentQube,
  ContentModality,
  ReadModality,
  WatchModality,
  ListenModality,
  InteractModality,
} from "@/types/smartContent";
import { getCoverImageUrl } from "./mediaVariants";

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

interface TextReaderProps {
  title: string;
  description?: string;
  coverImageUri?: string;
  text: string;
  hasAccess: boolean;
  accessScope: "full" | "preview" | "panel";
  previewParagraphs: number;
  onUnlock?: () => void;
  theme?: "qriptopian" | "default";
  fontSize: number;
  onFontSizeChange: (delta: number) => void;
}

function getPreviewText(rawText: string, previewParagraphs: number) {
  const paragraphs = rawText
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const previewCount = Math.max(1, previewParagraphs);
  return {
    text: paragraphs.slice(0, previewCount).join("\n\n"),
    total: paragraphs.length,
  };
}

function TextReader({
  title,
  description,
  coverImageUri,
  text,
  hasAccess,
  accessScope,
  previewParagraphs,
  onUnlock,
  theme = "default",
  fontSize,
  onFontSizeChange,
}: TextReaderProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);
  const isPreview = !hasAccess && accessScope !== "full";
  const preview = useMemo(() => getPreviewText(text, previewParagraphs), [text, previewParagraphs]);
  const markdownSource = isPreview ? preview.text : text;
  const truncated = isPreview && preview.total > previewParagraphs;

  const styleGuide = theme === "qriptopian" ? theQriptopianStyleGuide : null;
  const typography = styleGuide?.typography;
  const readerStyles = styleGuide?.articleReader;
  const colors = styleGuide?.colors;

  const themeClasses =
    theme === "qriptopian"
      ? {
          container: "bg-[#0a1628] text-[#f3f7ff]",
          border: "border-[#1a2942]",
          accent: "text-cyan-300",
          muted: colors?.muted || "#6b7280",
          primary: colors?.primary || "#5eead4",
          secondary: colors?.secondary || "#2dd4bf",
          text: readerStyles?.textColor || "#f3f7ff",
          fontFamily: typography?.fontFamily?.body || "Inter, system-ui, sans-serif",
        }
      : {
          container: "bg-slate-950/30 text-slate-100",
          border: "border-white/10",
          accent: "text-fuchsia-300",
          muted: "#94a3b8",
          primary: "#f8fafc",
          secondary: "#e2e8f0",
          text: "#e2e8f0",
          fontFamily: "Inter, system-ui, sans-serif",
        };

  return (
    <div
      className={`h-full rounded-xl ${themeClasses.container}`}
      style={{
        fontFamily: themeClasses.fontFamily,
        backgroundColor: readerStyles?.backgroundColor,
        color: readerStyles?.textColor,
      }}
    >
      <div className="sticky top-0 z-10">
        <div className="h-1 w-full bg-white/5">
          <div
            className="h-full transition-all"
            style={{ width: `${progress}%`, backgroundColor: themeClasses.primary }}
          />
        </div>
        <div className="flex items-center justify-end gap-2 bg-[#0a1628]/95 px-4 py-2">
          <span className="text-[11px]" style={{ color: themeClasses.muted }}>
            Text Size:
          </span>
          <button
            onClick={() => onFontSizeChange(-2)}
            className="rounded-full px-3 py-1 text-[11px] font-semibold text-[#d0f6ff] bg-white/5 ring-1 ring-white/10 hover:bg-white/10"
          >
            A-
          </button>
          <span className="text-[11px] font-semibold" style={{ color: themeClasses.text }}>
            {fontSize}px
          </span>
          <button
            onClick={() => onFontSizeChange(2)}
            className="rounded-full px-3 py-1 text-[11px] font-semibold text-[#d0f6ff] bg-white/5 ring-1 ring-white/10 hover:bg-white/10"
          >
            A+
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="h-[calc(100%-44px)] overflow-y-auto"
        onScroll={() => {
          const node = scrollRef.current;
          if (!node) return;
          const max = node.scrollHeight - node.clientHeight;
          const next = max > 0 ? Math.min(100, Math.round((node.scrollTop / max) * 100)) : 0;
          setProgress(next);
        }}
      >
        <div className="mx-auto" style={{ maxWidth: "42rem", padding: "3rem 2rem" }}>
        {coverImageUri && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImageUri}
            alt={title}
            className={`mb-6 w-full rounded-xl border ${themeClasses.border} object-cover`}
          />
        )}
        <h1
          className="font-semibold tracking-tight"
          style={{
            fontSize: typography?.fontSize?.h1 || "2.5rem",
            lineHeight: typography?.lineHeight?.heading || 1.2,
            color: themeClasses.primary,
            fontFamily: typography?.fontFamily?.heading || themeClasses.fontFamily,
          }}
        >
          {title}
        </h1>
        {description && (
          <p
            className="mt-2"
            style={{ fontSize: typography?.fontSize?.body || "1.125rem", color: themeClasses.muted }}
          >
            {description}
          </p>
        )}
        <div className={`mt-6 border-t ${themeClasses.border} pt-6`}>
          {markdownSource.trim().length === 0 ? (
            <p className="text-sm text-slate-400">No article content available.</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1
                    style={{
                      fontFamily: typography?.fontFamily?.heading || themeClasses.fontFamily,
                      fontSize: typography?.fontSize?.h1 || "2.5rem",
                      lineHeight: typography?.lineHeight?.heading || 1.2,
                      color: themeClasses.primary,
                      marginBottom: "1.5rem",
                      marginTop: "2rem",
                    }}
                  >
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2
                    style={{
                      fontFamily: typography?.fontFamily?.heading || themeClasses.fontFamily,
                      fontSize: typography?.fontSize?.h2 || "2rem",
                      lineHeight: typography?.lineHeight?.heading || 1.2,
                      color: themeClasses.primary,
                      marginBottom: "1rem",
                      marginTop: "1.5rem",
                    }}
                  >
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3
                    style={{
                      fontFamily: typography?.fontFamily?.heading || themeClasses.fontFamily,
                      fontSize: typography?.fontSize?.h3 || "1.5rem",
                      lineHeight: typography?.lineHeight?.heading || 1.2,
                      color: themeClasses.secondary,
                      marginBottom: "0.75rem",
                      marginTop: "1.25rem",
                    }}
                  >
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p
                    style={{
                      fontFamily: typography?.fontFamily?.body || themeClasses.fontFamily,
                      fontSize: `${fontSize}px`,
                      lineHeight: typography?.lineHeight?.body || 1.7,
                      color: themeClasses.text,
                      marginBottom: "1rem",
                    }}
                  >
                    {children}
                  </p>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: readerStyles?.linkColor || themeClasses.primary,
                      textDecoration: "underline",
                      textDecorationColor: `${readerStyles?.linkColor || themeClasses.primary}40`,
                    }}
                  >
                    {children}
                  </a>
                ),
                code: ({ inline, children }) =>
                  inline ? (
                    <code
                      style={{
                        fontFamily: typography?.fontFamily?.code || "JetBrains Mono, monospace",
                        fontSize: `${Math.max(12, fontSize - 2)}px`,
                        backgroundColor: readerStyles?.codeBlockBackground || "#1e293b",
                        color: themeClasses.secondary,
                        padding: "0.2em 0.4em",
                        borderRadius: "0.25rem",
                      }}
                    >
                      {children}
                    </code>
                  ) : (
                    <code
                      style={{
                        fontFamily: typography?.fontFamily?.code || "JetBrains Mono, monospace",
                        fontSize: `${Math.max(12, fontSize - 2)}px`,
                        lineHeight: typography?.lineHeight?.code || 1.5,
                        backgroundColor: readerStyles?.codeBlockBackground || "#1e293b",
                        color: themeClasses.text,
                        display: "block",
                        padding: "1rem",
                        borderRadius: "0.5rem",
                        border: `1px solid ${readerStyles?.codeBlockBorder || "#334155"}`,
                        marginBottom: "1rem",
                        overflowX: "auto",
                      }}
                    >
                      {children}
                    </code>
                  ),
                blockquote: ({ children }) => (
                  <blockquote
                    style={{
                      borderLeft: `4px solid ${readerStyles?.blockquoteBorder || themeClasses.primary}`,
                      backgroundColor:
                        readerStyles?.blockquoteBackground || "rgba(94, 234, 212, 0.05)",
                      padding: "1rem 1.5rem",
                      marginBottom: "1rem",
                      fontStyle: "italic",
                      color: themeClasses.text,
                    }}
                  >
                    {children}
                  </blockquote>
                ),
                ul: ({ children }) => (
                  <ul style={{ paddingLeft: "1.5rem", marginBottom: "1rem", color: themeClasses.text }}>
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol style={{ paddingLeft: "1.5rem", marginBottom: "1rem", color: themeClasses.text }}>
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li style={{ marginBottom: "0.5rem", fontSize: `${fontSize}px` }}>{children}</li>
                ),
                table: ({ children }) => (
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      marginBottom: "1.5rem",
                      fontSize: `${Math.max(12, fontSize - 2)}px`,
                      backgroundColor: "rgba(0, 0, 0, 0.3)",
                      borderRadius: "0.5rem",
                      overflow: "hidden",
                    }}
                  >
                    {children}
                  </table>
                ),
                thead: ({ children }) => (
                  <thead style={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}>{children}</thead>
                ),
                tr: ({ children }) => (
                  <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>{children}</tr>
                ),
                th: ({ children }) => (
                  <th
                    style={{
                      padding: "0.75rem 1rem",
                      textAlign: "left",
                      fontWeight: "bold",
                      color: themeClasses.primary,
                      fontFamily: typography?.fontFamily?.heading || themeClasses.fontFamily,
                    }}
                  >
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td style={{ padding: "0.75rem 1rem", color: themeClasses.text, verticalAlign: "top" }}>
                    {children}
                  </td>
                ),
                hr: () => (
                  <hr
                    style={{
                      border: "none",
                      borderTop: `1px solid ${themeClasses.muted}40`,
                      margin: "2rem 0",
                    }}
                  />
                ),
              }}
            >
              {markdownSource}
            </ReactMarkdown>
          )}
        </div>
        </div>

      {truncated && (
        <div className={`sticky bottom-0 border-t ${themeClasses.border} bg-[#0a1628]/95`}>
          <div className="mx-auto flex items-center justify-between gap-3 px-6 py-4" style={{ maxWidth: "42rem" }}>
            <div className="text-xs" style={{ color: themeClasses.muted }}>
              Unlock to read the full article.
            </div>
            <button
              onClick={onUnlock}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${themeClasses.accent} bg-white/5 ring-1 ring-white/10 hover:bg-white/10`}
            >
              Unlock Full Read
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
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
  // Handle legacy content format where video URL is stored directly
  const videoUrl = primaryAsset?.storageUri || (watch as any).video_url || null;
  const posterUrl = primaryAsset?.thumbnailUri || null;
  // Respect loop flag set in admin (stored as watch.loop or watch.loop_video)
  const shouldLoop = (watch as any).loop === true || (watch as any).loop_video === true;

  if (!videoUrl) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        No video content available
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-black rounded-xl overflow-hidden">
      <video
        src={videoUrl}
        controls
        loop={shouldLoop}
        className="max-w-full max-h-full"
        poster={posterUrl ?? undefined}
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

const MODALITY_TABS: Record<string, { icon: string; label: string }> = {
  read: { icon: "📖", label: "Read" },
  watch: { icon: "🎬", label: "Watch" },
  listen: { icon: "🎧", label: "Listen" },
  interact: { icon: "💬", label: "Chat" },
  view: { icon: "🖼️", label: "View" },
  link: { icon: "🔗", label: "Link" },
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
  const isModalityEnabled = (mod?: {
    enabled?: boolean;
    available?: boolean;
    panels?: unknown[];
    textAssets?: unknown[];
    text?: string;
    video_url?: string;
    audio_url?: string;
    url?: string;
  }) => {
    if (!mod) return false;
    if (typeof mod.enabled === "boolean") return mod.enabled;
    if (typeof mod.available === "boolean") return mod.available;
    if (Array.isArray(mod.panels) && mod.panels.length > 0) return true;
    if (Array.isArray(mod.textAssets) && mod.textAssets.length > 0) return true;
    if (typeof mod.text === "string" && mod.text.trim().length > 0) return true;
    // Detect by URL presence (DB format without explicit available flag)
    if (typeof mod.video_url === "string" && mod.video_url.trim().length > 0) return true;
    if (typeof mod.audio_url === "string" && mod.audio_url.trim().length > 0) return true;
    if (typeof mod.image_url === "string" && (mod as any).image_url.trim().length > 0) return true;
    if (typeof mod.url === "string" && mod.url.trim().length > 0) return true;
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
    // Default: prefer read (text) over video for View/unspecified
    if (availableModalities.includes("read")) return "read";
    return availableModalities[0] || "read";
  };

  const [activeModality, setActiveModality] = useState<ContentModality>(
    resolveModality(initialModality)
  );
  const [currentPanel, setCurrentPanel] = useState(0);
  const [startTime] = useState(Date.now());
  const [textAssetBody, setTextAssetBody] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(18);

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
  const previewParagraphs = content.pricingModel?.freePreview?.paragraphs || 3;
  const readModality: any = content.modalities?.read || {};
  const readTextInline = typeof readModality?.text === "string" ? readModality.text : "";
  const readTextAsset = readModality?.textAssets?.[0];
  const resolvedReadText = readTextInline || textAssetBody || "";
  const isTextLoading = !readTextInline && !!readTextAsset?.storageUri && textAssetBody === null;
  const isQriptopian = String(content.app || "").toLowerCase().includes("qripto");

  const handleFontSizeChange = useCallback((delta: number) => {
    setFontSize(prev => Math.min(24, Math.max(14, prev + delta)));
  }, []);

  useEffect(() => {
    let active = true;
    if (readTextInline || !readTextAsset?.storageUri) {
      setTextAssetBody(null);
      return;
    }

    const resolveUri = (uri: string) => {
      if (uri.startsWith("http")) return uri;
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!base) return uri;
      return `${base}/storage/v1/object/public/content-assets/${uri}`;
    };

    const load = async () => {
      try {
        const res = await fetch(resolveUri(readTextAsset.storageUri));
        if (!res.ok) throw new Error("Failed to load article text");
        const text = await res.text();
        if (active) setTextAssetBody(text);
      } catch {
        if (active) setTextAssetBody("");
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [readTextInline, readTextAsset?.storageUri]);

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
              {MODALITY_TABS[mod]?.icon ?? "▶"} {MODALITY_TABS[mod]?.label ?? mod}
            </button>
          ))}
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 p-4 overflow-hidden">
        {activeModality === "read" && isModalityEnabled(content.modalities?.read) && (
          isTextLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Loading article...
            </div>
          ) : resolvedReadText ? (
            <TextReader
              title={content.title}
              description={content.description}
              coverImageUri={getCoverImageUrl(content)}
              text={resolvedReadText}
              hasAccess={hasAccess}
              accessScope={accessScope}
              previewParagraphs={previewParagraphs}
              onUnlock={() => onPanelPayment?.(0)}
              theme={isQriptopian ? "qriptopian" : "default"}
              fontSize={fontSize}
              onFontSizeChange={handleFontSizeChange}
            />
          ) : (
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
          )
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

        {activeModality === "view" && (content.modalities as any)?.view && (
          <div className="w-full h-full flex items-center justify-center bg-black/30 rounded-xl overflow-hidden">
            {(content.modalities as any).view.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={(content.modalities as any).view.image_url}
                alt={content.title}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="text-slate-400 text-sm">No image available</div>
            )}
          </div>
        )}

        {/* Fallback for content without modalities */}
        {!isModalityEnabled(content.modalities?.read) &&
         !isModalityEnabled(content.modalities?.watch) &&
         !isModalityEnabled(content.modalities?.listen) &&
         !isModalityEnabled(content.modalities?.interact) &&
         !isModalityEnabled((content.modalities as any)?.view) && (
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
