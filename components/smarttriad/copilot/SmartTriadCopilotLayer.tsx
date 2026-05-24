/**
 * SmartTriad Copilot Layer
 * 
 * Enhanced copilot layer using the SmartTriad Inference Rendering System.
 * Replaces the standard CodexCopilotLayer with cyan-based theming and
 * advanced inference rendering capabilities.
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useMetaAvatar } from "@/app/contexts/MetaAvatarContext";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { SmartTriadInferenceRenderer, type SmartTriadMessage } from "./SmartTriadInferenceRenderer";
import {
  Bot,
  User,
  MessageSquare,
  ChevronDown,
  Send,
  Loader2,
  Mic,
  MicOff,
  PanelRightClose,
} from "lucide-react";

// Import CSS
import "./styles/smarttriad-copilot.css";

interface SmartTriadCopilotLayerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  variant?: "floating" | "embedded" | "panel";
  className?: string;
  hideAvatarToggle?: boolean;
  contextOptions?: Array<{ id: string; label: string }>;
  contextId?: string;
  onContextChange?: (contextId: string) => void;
  inputPanelClassName?: string;
  inputPanelInputClassName?: string;
  quickPrompts?: QuickPrompt[];
  onPrompt?: (prompt: string) => void;
  initialMessage?: string;
  seedMessages?: SmartTriadMessage[];
  messages?: SmartTriadMessage[];
  onMessagesChange?: (messages: SmartTriadMessage[]) => void;
  promptPlaceholder?: string;
  footerContent?: React.ReactNode;
  panelClassName?: string;
  floatingInput?: boolean;
  disablePromptInput?: boolean;
  disableActivationButton?: boolean;
  showQuickPromptsToggle?: boolean;
  showTrustIndicators?: boolean;
  trustProvider?: "openai" | "venice" | "chaingpt" | "thirdweb" | "anthropic";
  showNavMenu?: boolean;
  showWalletMenu?: boolean;
  walletBalance?: number;
  nftCount?: number;
  isFirstVisit?: boolean;
  visitCount?: number;
  panelBorder?: boolean;
  agent?: {
    id: string;
    name: string;
    evmSepolia?: `0x${string}`;
    evmArb?: `0x${string}`;
    btcAddress?: string;
    fioHandle?: string;
    walletAddress?: string;
  };
  agentSubtitle?: string;
  personaId?: string;
  // SmartTriad specific props
  tenantConfig?: {
    enableModelSelection?: boolean;
    availableAgents?: string[];
    defaultAgent?: string;
    accentColor?: string;
  };
  enableAdvancedRendering?: boolean;
}

type CopilotMode = "chat" | "avatar";
type QuickPrompt =
  | string
  | {
      id?: string;
      label: string;
      prompt?: string;
      icon?: React.ReactNode;
      iconOnly?: boolean;
      skipInference?: boolean;
      /**
       * Phase 2 Slice 7 — dual-dispatch chip strip.
       *
       * The chip strip is generic (knows nothing about layouts). Tabs
       * that want right-pane dispatch from a chip click pass `onSelect`
       * alongside the chip; we invoke it after submitting the copilot
       * prompt. Tab implementations typically call
       * `setActiveLayoutId(layoutId)` here so the workbench is ready by
       * the time the copilot's response lands.
       *
       * Fires for every chip-click regardless of skipInference, so a
       * pure-layout chip (skipInference: true, prompt: "") still
       * triggers the right pane action.
       */
      onSelect?: () => void;
    };

export function SmartTriadCopilotLayer({
  isOpen,
  onClose,
  onOpen,
  variant = "floating",
  className,
  hideAvatarToggle = false,
  contextOptions = [],
  contextId,
  onContextChange,
  inputPanelClassName,
  inputPanelInputClassName,
  quickPrompts = [],
  onPrompt,
  initialMessage,
  seedMessages = [],
  messages: externalMessages,
  onMessagesChange,
  promptPlaceholder = "Ask me anything about the Codex...",
  footerContent,
  panelClassName,
  floatingInput = false,
  disablePromptInput = false,
  disableActivationButton = false,
  showQuickPromptsToggle = true,
  showTrustIndicators = true,
  trustProvider = "openai",
  showNavMenu = true,
  showWalletMenu = true,
  walletBalance = 0,
  nftCount = 0,
  isFirstVisit = false,
  visitCount = 1,
  panelBorder = true,
  agent,
  agentSubtitle,
  personaId,
  tenantConfig,
  enableAdvancedRendering = true,
}: SmartTriadCopilotLayerProps) {
  
  // Core state
  const [mode, setMode] = useState<CopilotMode>("chat");
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>("anthropic");
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);
  const [selectedContext, setSelectedContext] = useState(contextId || contextOptions[0]?.id);
  // "panel" inherits the XW-sized copilot container so the MetaAvatar renders
  // at the same dimensions/position protocol as the embedded copilot (415x320
  // at left=16, top=96). "floating" keeps the smaller codexCopilot footprint.
  const avatarContainer = variant === "floating" ? "codexCopilot" : "copilot";
  
  // Avatar state
  const { requestAvatar, releaseAvatar, activeContainer } = useMetaAvatar();
  const toggleAvatar = useCallback(() => {
    setMode((prev) => (prev === "avatar" ? "chat" : "avatar"));
  }, []);
  const isAvatarActive = mode === "avatar" && activeContainer === avatarContainer;
  const isMobile = useIsMobile();
  
  // Messages state
  const [internalMessages, setInternalMessages] = useState<SmartTriadMessage[]>(() => {
    const initialMsgs: SmartTriadMessage[] = [];
    
    // Add welcome message for first visit
    if (isFirstVisit && !initialMessage) {
      initialMsgs.push({
        id: 'welcome',
        role: 'assistant',
        content: `Welcome to the SmartTriad Copilot! I'm here to help you explore the Codex with advanced inference rendering. Try asking me about the scrolls, characters, or any lore you're curious about.`,
        timestamp: new Date(),
        metadata: {
          model: 'smarttriad-assistant',
          provider: 'system',
          trustScore: 8,
          reliabilityScore: 9,
          riskScore: 2,
          theme: 'connect'
        }
      });
    }
    
    // Add initial message if provided
    if (initialMessage) {
      initialMsgs.push({
        id: 'initial',
        role: 'assistant',
        content: initialMessage,
        timestamp: new Date(),
        metadata: {
          model: 'smarttriad-assistant',
          provider: 'system',
          theme: 'default'
        }
      });
    }
    
    return [...seedMessages, ...initialMsgs];
  });
  
  // Use external messages if provided, otherwise use internal state
  const messages = externalMessages || internalMessages;
  const updateMessages = useCallback(
    (updater: (prev: SmartTriadMessage[]) => SmartTriadMessage[]) => {
      const next = updater([...messages]);
      if (onMessagesChange) {
        onMessagesChange(next);
        return;
      }
      setInternalMessages(next);
    },
    [messages, onMessagesChange]
  );
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  // Focus input when copilot opens
  useEffect(() => {
    if (isOpen && !disablePromptInput && !isMobile) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, disablePromptInput, isMobile]);
  
  // Handle context change
  useEffect(() => {
    if (contextId && contextId !== selectedContext) {
      setSelectedContext(contextId);
    }
  }, [contextId, selectedContext]);

  useEffect(() => {
    if (mode === "avatar" && isOpen) {
      requestAvatar(avatarContainer, agent?.id || "aigent-z");
      return () => releaseAvatar(avatarContainer);
    }
    releaseAvatar(avatarContainer);
  }, [mode, isOpen, requestAvatar, releaseAvatar, avatarContainer, agent?.id]);
  
  // Handle sending messages — calls the real /api/codex/chat inference endpoint
  const handleSend = useCallback(async () => {
    if (!input.trim() || isProcessing) return;

    const sentInput = input.trim();

    const userMessage: SmartTriadMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: sentInput,
      timestamp: new Date(),
    };

    updateMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsProcessing(true);

    try {
      const chatHistory = messages
        .filter((m) => m.role !== 'system')
        .slice(-10)
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: typeof m.content === 'string' ? m.content : '',
        }));

      // Map persona to the correct KB search domain:
      // KNYT agents search the metaKnyts codex; MoneyPenny searches Qriptopian;
      // platform agents (Aigent Z/C) pass 'agentiq' — the route treats unknown domains
      // as platform-only and skips KNYT codex injection.
      const resolvedPersona = personaId ?? 'aigent-kn0w1';
      const domainForPersona = (() => {
        if (resolvedPersona === 'aigent-kn0w1' || resolvedPersona === 'aigent-marketa') return 'metaKnyts';
        if (resolvedPersona === 'aigent-moneypenny') return 'qriptopian';
        return 'agentiq'; // aigent-z, aigent-c, metaMe, etc.
      })();

      const res = await fetch('/api/codex/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: sentInput,
          chatHistory,
          persona: resolvedPersona,
          aigentId: resolvedPersona,
          domain: domainForPersona,
          provider_id: selectedProvider,
        }),
      });

      const data = await res.json();

      const assistantMessage: SmartTriadMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response || 'No response received.',
        timestamp: new Date(),
        metadata: {
          model: data.model_used ?? selectedProvider,
          provider: data.provider_used ?? selectedProvider,
          theme: 'aigent',
        },
      };

      updateMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Failed to get response:', error);

      const errorMessage: SmartTriadMessage = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: 'Sorry, I encountered an error while processing your request. Please try again.',
        timestamp: new Date(),
        metadata: {
          theme: 'aigent',
        },
      };

      updateMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  }, [input, isProcessing, updateMessages, messages, personaId, selectedProvider]);
  
  // Handle quick prompt selection
  const handleQuickPrompt = useCallback((prompt: QuickPrompt) => {
    const promptText = typeof prompt === 'string' ? prompt : prompt.prompt || prompt.label;
    setInput(promptText);
    onPrompt?.(promptText);

    // Phase 2 Slice 7: dual-dispatch. Whatever the chip's onSelect
    // wants to do on the right pane (most commonly setActiveLayoutId
    // + a data fetch) runs in parallel with the copilot prompt above.
    // Fires for every chip click regardless of skipInference — pure
    // layout chips skip the auto-send below but still trigger this.
    if (typeof prompt !== 'string' && prompt.onSelect) {
      prompt.onSelect();
    }

    // Auto-send if skipInference is not set
    if (typeof prompt !== 'string' && !prompt.skipInference) {
      setTimeout(() => handleSend(), 100);
    }
  }, [onPrompt, handleSend]);
  
  // Provider change is handled via selectedProvider state lifted to this component
  // and forwarded to FloatingCopilot which updates it via setSelectedProvider
  const handleModelChange = useCallback((provider: string) => {
    setSelectedProvider(provider);
  }, []);
  
  // If not open, render nothing
  if (!isOpen) return null;

  return (
    <div
      ref={(node) => {
        if (variant !== "panel" || !node || typeof window === "undefined") return;
        const apply = () => {
          const body = node.querySelector<HTMLElement>("[data-copilot-body]");
          const target = body ?? node;
          const rect = target.getBoundingClientRect();
          const root = document.documentElement.style;
          root.setProperty("--metaavatar-copilot-x", `${Math.round(rect.left)}px`);
          root.setProperty("--metaavatar-copilot-y", `${Math.round(rect.top)}px`);
          root.setProperty("--metaavatar-copilot-w", `${Math.round(rect.width)}px`);
          root.setProperty("--metaavatar-copilot-h", `${Math.round(rect.height)}px`);
        };
        apply();
        const ro = new ResizeObserver(apply);
        ro.observe(node);
        const body = node.querySelector("[data-copilot-body]");
        if (body) ro.observe(body);
        window.addEventListener("resize", apply);
        // re-measure shortly after mount in case layout settles
        const t = window.setTimeout(apply, 50);
        (node as any).__metaavatarCleanup?.();
        (node as any).__metaavatarCleanup = () => {
          ro.disconnect();
          window.removeEventListener("resize", apply);
          window.clearTimeout(t);
        };
      }}
      className={`smarttriad-copilot-layer ${variant === "panel" ? "h-full" : ""} ${className}`}
    >
      {variant === "floating" || variant === "panel" ? (
        <FloatingCopilot
          inlineMode={variant === "panel"}
          messages={messages}
          input={input}
          setInput={setInput}
          isProcessing={isProcessing}
          onSend={handleSend}
          quickPrompts={quickPrompts}
          showQuickPrompts={showQuickPrompts}
          setShowQuickPrompts={setShowQuickPrompts}
          onQuickPrompt={handleQuickPrompt}
          onClose={onClose}
          mode={mode}
          setMode={setMode}
          isAvatarActive={isAvatarActive}
          toggleAvatar={toggleAvatar}
          hideAvatarToggle={hideAvatarToggle}
          promptPlaceholder={promptPlaceholder}
          disablePromptInput={disablePromptInput}
          inputRef={inputRef}
          messagesEndRef={messagesEndRef}
          footerContent={footerContent}
          panelBorder={panelBorder}
          enableAdvancedRendering={enableAdvancedRendering}
          tenantConfig={tenantConfig}
          onModelChange={handleModelChange}
          personaId={personaId}
          agentName={agent?.name}
          agentId={agent?.id}
          agentSubtitle={agentSubtitle}
          selectedProvider={selectedProvider}
          setSelectedProvider={setSelectedProvider}
        />
      ) : (
        <EmbeddedCopilot
          messages={messages}
          input={input}
          setInput={setInput}
          isProcessing={isProcessing}
          onSend={handleSend}
          quickPrompts={quickPrompts}
          showQuickPrompts={showQuickPrompts}
          setShowQuickPrompts={setShowQuickPrompts}
          onQuickPrompt={handleQuickPrompt}
          mode={mode}
          setMode={setMode}
          isAvatarActive={isAvatarActive}
          toggleAvatar={toggleAvatar}
          hideAvatarToggle={hideAvatarToggle}
          promptPlaceholder={promptPlaceholder}
          disablePromptInput={disablePromptInput}
          inputRef={inputRef}
          messagesEndRef={messagesEndRef}
          footerContent={footerContent}
          panelClassName={panelClassName}
          inputPanelClassName={inputPanelClassName}
          inputPanelInputClassName={inputPanelInputClassName}
          enableAdvancedRendering={enableAdvancedRendering}
          tenantConfig={tenantConfig}
          onModelChange={handleModelChange}
          personaId={personaId}
        />
      )}
    </div>
  );
}

// ========================================
// Floating Copilot Component
// ========================================

const PROVIDER_ICON_URL: Record<string, string> = {
  anthropic: "/llm_model_logos/anthropic.png",
  openai: "/llm_model_logos/openai.png",
  venice: "/llm_model_logos/venice.png",
  chaingpt: "/llm_model_logos/chaingpt.png",
};

function FloatingCopilot({
  messages,
  input,
  setInput,
  isProcessing,
  onSend,
  quickPrompts,
  showQuickPrompts,
  setShowQuickPrompts,
  onQuickPrompt,
  onClose,
  mode,
  setMode,
  isAvatarActive,
  toggleAvatar,
  hideAvatarToggle,
  promptPlaceholder,
  disablePromptInput,
  inputRef,
  messagesEndRef,
  footerContent,
  panelBorder,
  enableAdvancedRendering,
  tenantConfig,
  onModelChange,
  personaId,
  agentName,
  agentId,
  agentSubtitle,
  selectedProvider,
  setSelectedProvider,
  inlineMode = false,
}: {
  messages: SmartTriadMessage[];
  input: string;
  setInput: (value: string) => void;
  isProcessing: boolean;
  onSend: () => void;
  quickPrompts: any[];
  showQuickPrompts: boolean;
  setShowQuickPrompts: (show: boolean) => void;
  onQuickPrompt: (prompt: any) => void;
  onClose: () => void;
  mode: CopilotMode;
  setMode: (mode: CopilotMode) => void;
  isAvatarActive: boolean;
  toggleAvatar: () => void;
  hideAvatarToggle: boolean;
  promptPlaceholder: string;
  disablePromptInput: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  footerContent?: React.ReactNode;
  panelBorder: boolean;
  enableAdvancedRendering: boolean;
  tenantConfig?: any;
  onModelChange: (provider: string) => void;
  personaId?: string;
  agentName?: string;
  agentId?: string;
  agentSubtitle?: string;
  inlineMode?: boolean;
  selectedProvider: string;
  setSelectedProvider: (p: string) => void;
}) {
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const visibleQuickPrompts = showQuickPrompts && quickPrompts.length > 0;

  // Dark-mode CSS variable overrides so SmartTriad CSS renders on dark background
  const darkCssOverrides: React.CSSProperties = {
    "--smarttriad-foreground": "hsl(220, 14%, 90%)",
    "--smarttriad-foreground-muted": "hsl(220, 9%, 65%)",
    "--smarttriad-foreground-muted-foreground": "hsl(220, 9%, 55%)",
    "--smarttriad-agent-bg": "hsla(220, 14%, 96%, 0.06)",
    "--smarttriad-agent-border": "hsla(220, 14%, 71%, 0.15)",
    "--smarttriad-user-bg": "hsla(188, 94%, 43%, 0.12)",
    "--smarttriad-user-border": "hsla(188, 94%, 43%, 0.25)",
    "--smarttriad-border": "hsla(220, 13%, 91%, 0.12)",
    "--smarttriad-muted": "hsla(220, 14%, 96%, 0.05)",
    "--smarttriad-card": "hsla(220, 20%, 14%, 0.8)",
  } as React.CSSProperties;

  // Render R/T score dots
  const renderDots = (value: number, type: "trust" | "reliability") => {
    const dotCount = Math.ceil(value / 2);
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => {
          let colorClass = "bg-slate-600";
          if (i < dotCount) {
            colorClass = type === "trust"
              ? (value <= 3 ? "bg-red-500" : value <= 6 ? "bg-yellow-500" : "bg-green-500")
              : (value <= 3 ? "bg-red-500" : value <= 6 ? "bg-yellow-500" : "bg-purple-500");
          }
          return (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${colorClass} ${isProcessing ? "animate-pulse" : "transition-all duration-300"}`}
              style={isProcessing ? { animationDelay: `${i * 0.15}s` } : undefined}
            />
          );
        })}
      </div>
    );
  };

  const innerPanel = (
        <div
          className={`relative h-full w-full bg-black/30 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden ${inlineMode ? "rounded-xl" : "ml-auto max-w-md"} ${panelBorder ? "ring-1 ring-white/10" : ""}`}
          style={darkCssOverrides}
        >
          {/* Header: agent name + trust/reliability dots + close */}
          <div className={`flex items-center justify-between px-3 pr-6 py-2 bg-slate-950 border-b border-white/10 flex-shrink-0 ${inlineMode ? "rounded-t-xl" : ""}`}>
            <div className="flex items-center gap-2 min-w-0">
              <Bot className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <span className="text-sm font-semibold text-white/90 leading-none truncate">
                {agentName ?? "Aigent Copilot"}
              </span>
              {agentSubtitle && (
                <span className="text-[10px] uppercase tracking-wider text-white/50 leading-none truncate">
                  {agentSubtitle}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/70">
                <span className="text-[10px] text-white/60">R</span>
                {renderDots(7.8, "reliability")}
              </div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/70">
                <span className="text-[10px] text-white/60">T</span>
                {renderDots(8.3, "trust")}
              </div>
              {!inlineMode && (
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Close"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div data-copilot-body className="flex-1 relative overflow-hidden">
            <div
              className="absolute inset-0 overflow-y-auto px-4 py-3 space-y-1 overscroll-contain"
            >
              {messages.map((message) => (
                <SmartTriadInferenceRenderer
                  key={message.id}
                  message={message}
                  showMetadata={enableAdvancedRendering}
                  showScores={false}
                  enableModelSelector={false}
                  tenantConfig={tenantConfig}
                />
              ))}
              {isProcessing && (
                <div className="flex justify-start">
                  <div className="bg-white/5 px-3 py-2 rounded-xl rounded-bl-sm ring-1 ring-white/10">
                    <Loader2 className="w-4 h-4 animate-spin text-white/60" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Quick prompts strip — above input, below messages */}
          {visibleQuickPrompts && (
            <div className="px-3 pt-2 pb-1 flex gap-1.5 flex-wrap flex-shrink-0">
              {quickPrompts.slice(0, 4).map((qp, i) => {
                const label = typeof qp === "string" ? qp : qp.label;
                return (
                  <button
                    key={i}
                    onClick={() => onQuickPrompt(qp)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Input row */}
          {!disablePromptInput && (
            <div className="px-3 pt-2 pb-1 border-t border-white/10 flex-shrink-0">
              <div className="flex gap-2 items-center">
                <input
                  ref={inputRef}
                  type="text"
                  name="copilot-prompt"
                  autoComplete="off"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSend();
                    }
                  }}
                  placeholder={promptPlaceholder}
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/60 focus:border-cyan-500/40 transition-colors"
                  disabled={isProcessing}
                />
                <button
                  onClick={onSend}
                  disabled={!input.trim() || isProcessing}
                  className="p-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors flex-shrink-0"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Bottom nav row: mode toggle + model selector + mic */}
          <div className="px-3 pb-3 pt-1 flex items-center justify-between flex-shrink-0">
            {/* Left: chat/avatar mode toggle */}
            {!hideAvatarToggle ? (
              <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5 ring-1 ring-white/10">
                <button
                  onClick={() => setMode("avatar")}
                  className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-xs transition-all ${
                    mode === "avatar" ? "bg-purple-500/20 text-purple-400" : "text-white/50 hover:text-white/80"
                  }`}
                >
                  <User className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setMode("chat")}
                  className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-xs transition-all ${
                    mode === "chat" ? "bg-cyan-500/20 text-cyan-400" : "text-white/50 hover:text-white/80"
                  }`}
                >
                  <MessageSquare className="w-3 h-3" />
                </button>
              </div>
            ) : <div />}

            {/* Right: model selector + mic */}
            <div className="relative flex items-center gap-2">
              {/* LLM provider icon dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setModelMenuOpen((prev) => !prev)}
                  className="flex items-center gap-1 rounded-sm border border-cyan-400/40 bg-cyan-500/20 px-2 py-1 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-500/30 transition"
                >
                  <img
                    src={PROVIDER_ICON_URL[selectedProvider]}
                    alt={selectedProvider}
                    className={`h-3.5 w-3.5 rounded-[2px] object-contain ${
                      selectedProvider === "openai" || selectedProvider === "anthropic"
                        ? "invert brightness-200"
                        : ""
                    }`}
                    loading="lazy"
                  />
                  <ChevronDown className={`w-3 h-3 transition-transform ${modelMenuOpen ? "rotate-180" : ""}`} />
                </button>
                {modelMenuOpen && (
                  <div className="absolute right-0 bottom-9 min-w-[160px] rounded-xl border border-white/10 bg-slate-950/90 p-2 shadow-xl backdrop-blur z-50">
                    {Object.entries(PROVIDER_ICON_URL).map(([id]) => (
                      <button
                        key={id}
                        onClick={() => { setSelectedProvider(id); onModelChange(id); setModelMenuOpen(false); }}
                        className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition ${
                          id === selectedProvider ? "bg-cyan-500/15 text-cyan-200" : "text-white/70 hover:bg-white/5"
                        }`}
                      >
                        <img
                          src={PROVIDER_ICON_URL[id]}
                          alt={id}
                          className={`h-3.5 w-3.5 rounded-[2px] object-contain ${
                            id === "openai" || id === "anthropic" ? "invert brightness-200" : ""
                          }`}
                          loading="lazy"
                        />
                        <span className="capitalize">{id}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Mic toggle */}
              <button
                type="button"
                onClick={() => setMicActive((prev) => !prev)}
                title={micActive ? "Stop microphone" : "Start microphone"}
                className={`p-1.5 rounded-lg transition-colors ${
                  micActive ? "text-cyan-300 bg-cyan-500/10" : "text-slate-400 hover:text-fuchsia-300 hover:bg-fuchsia-500/10"
                }`}
              >
                {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Footer (optional custom content) */}
          {footerContent && (
            <div className="px-4 pb-3 border-t border-white/10 flex-shrink-0">
              {footerContent}
            </div>
          )}
        </div>
  );

  if (inlineMode) return innerPanel;

  return (
    <>
      <div className="fixed inset-0 z-[200] flex">
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
        {innerPanel}
      </div>
    </>
  );
}

// ========================================
// Embedded Copilot Component
// ========================================

function EmbeddedCopilot({
  messages,
  input,
  setInput,
  isProcessing,
  onSend,
  quickPrompts,
  showQuickPrompts,
  setShowQuickPrompts,
  onQuickPrompt,
  mode,
  setMode,
  isAvatarActive,
  toggleAvatar,
  hideAvatarToggle,
  promptPlaceholder,
  disablePromptInput,
  inputRef,
  messagesEndRef,
  footerContent,
  panelClassName,
  inputPanelClassName,
  inputPanelInputClassName,
  enableAdvancedRendering,
  tenantConfig,
  onModelChange,
  personaId,
}: {
  messages: SmartTriadMessage[];
  input: string;
  setInput: (value: string) => void;
  isProcessing: boolean;
  onSend: () => void;
  quickPrompts: any[];
  showQuickPrompts: boolean;
  setShowQuickPrompts: (show: boolean) => void;
  onQuickPrompt: (prompt: any) => void;
  mode: CopilotMode;
  setMode: (mode: CopilotMode) => void;
  isAvatarActive: boolean;
  toggleAvatar: () => void;
  hideAvatarToggle: boolean;
  promptPlaceholder: string;
  disablePromptInput: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  footerContent?: React.ReactNode;
  panelClassName?: string;
  inputPanelClassName?: string;
  inputPanelInputClassName?: string;
  enableAdvancedRendering: boolean;
  tenantConfig?: any;
  onModelChange: (model: string, provider: string) => void;
  personaId?: string;
}) {
  
  return (
    <div className={`h-full flex flex-col ${panelClassName}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-cyan-600" />
          <h3 className="font-medium text-sm text-foreground">SmartTriad Copilot</h3>
        </div>
        {enableAdvancedRendering && (
          <span className="text-xs text-cyan-600">Advanced</span>
        )}
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((message) => (
          <SmartTriadInferenceRenderer
            key={message.id}
            message={message}
            showMetadata={enableAdvancedRendering}
            showScores={false} // Disable scores in embedded mode for cleaner UI
            enableModelSelector={false} // Disable model selector in embedded mode
            tenantConfig={tenantConfig}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      {!disablePromptInput && (
        <div className={`p-3 border-t ${inputPanelClassName}`}>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              name="copilot-prompt"
              autoComplete="off"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              placeholder={promptPlaceholder}
              className={`flex-1 px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm ${inputPanelInputClassName}`}
              disabled={isProcessing}
            />
            <button
              onClick={onSend}
              disabled={!input.trim() || isProcessing}
              className="px-3 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Send className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>
      )}
      
      {/* Footer */}
      {footerContent && (
        <div className="p-3 border-t bg-muted/50">
          {footerContent}
        </div>
      )}
    </div>
  );
}
