/**
 * SmartTriad Copilot Layer
 * 
 * Enhanced copilot layer using the SmartTriad Inference Rendering System.
 * Replaces the standard CodexCopilotLayer with cyan-based theming and
 * advanced inference rendering capabilities.
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
  BookOpen,
  Sparkles,
  Wallet,
  CheckSquare,
  Trophy,
  Gift,
  CreditCard,
  Mic,
  MicOff,
  PanelRightClose,
  PanelRightOpen,
  PanelBottomClose,
} from "lucide-react";
import SmartWalletDrawer from "@/app/components/content/SmartWalletDrawer";

// Import CSS
import "./styles/smarttriad-copilot.css";

interface SmartTriadCopilotLayerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  variant?: "floating" | "embedded";
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
type WalletTab = "wallet" | "library" | "tasks" | "reputation" | "rewards" | "payments";
type QuickPrompt =
  | string
  | {
      id?: string;
      label: string;
      prompt?: string;
      icon?: React.ReactNode;
      iconOnly?: boolean;
      skipInference?: boolean;
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
  personaId,
  tenantConfig,
  enableAdvancedRendering = true,
}: SmartTriadCopilotLayerProps) {
  
  // Core state
  const [mode, setMode] = useState<CopilotMode>("chat");
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeWalletTab, setActiveWalletTab] = useState<WalletTab>("wallet");
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);
  const [selectedContext, setSelectedContext] = useState(contextId || contextOptions[0]?.id);
  const avatarContainer = variant === "embedded" ? "copilot" : "codexCopilot";
  
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
  
  // Handle sending messages
  const handleSend = useCallback(async () => {
    if (!input.trim() || isProcessing) return;
    
    const userMessage: SmartTriadMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };
    
    updateMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsProcessing(true);
    
    try {
      // Simulate AI response (replace with actual API call)
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
      
      const assistantMessage: SmartTriadMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: generateMockResponse(input.trim()),
        timestamp: new Date(),
        metadata: {
          model: 'gpt-4',
          provider: trustProvider,
          trustScore: 7 + Math.random() * 3,
          reliabilityScore: 6 + Math.random() * 4,
          riskScore: Math.random() * 5,
          processingTime: 500 + Math.random() * 1500,
          mcpVersion: '1.0',
          theme: selectedContext as any
        }
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
          theme: 'aigent'
        }
      };
      
      updateMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  }, [input, isProcessing, updateMessages, trustProvider, selectedContext]);
  
  // Handle quick prompt selection
  const handleQuickPrompt = useCallback((prompt: QuickPrompt) => {
    const promptText = typeof prompt === 'string' ? prompt : prompt.prompt || prompt.label;
    setInput(promptText);
    onPrompt?.(promptText);
    
    // Auto-send if skipInference is not set
    if (typeof prompt !== 'string' && !prompt.skipInference) {
      setTimeout(() => handleSend(), 100);
    }
  }, [onPrompt, handleSend]);
  
  // Handle model change (for future integration with metaMe runtime)
  const handleModelChange = useCallback((model: string, provider: string) => {
    console.log('Model changed:', { model, provider });
    // This will be integrated with metaMe runtime AgentModelSelector
  }, []);
  
  // Generate mock responses (replace with actual AI integration)
  const generateMockResponse = (userInput: string): string => {
    const responses = [
      `Based on the SmartTriad inference system, I can help you understand that "${userInput}" relates to the broader Qriptopian narrative structure. The key aspects involve the interplay between different realms and character archetypes.`,
      
      `Let me explain this concept in the context of the Codex. The SmartTriad system processes this through multiple layers of analysis, considering both the literal and metaphorical dimensions of your query about "${userInput}".`,
      
      `Here's what you need to know about this topic: The inference rendering system identifies key patterns and relationships that might not be immediately apparent. This involves analyzing the semantic connections between "${userInput}" and related concepts in the knowledge base.`,
      
      `The key thing about "${userInput}" is its relationship to the broader metaMe runtime architecture. When viewed through the lens of the SmartTriad system, we can see how this connects to various other elements in the ecosystem.`,
      
      `Important: The SmartTriad copilot uses advanced inference rendering to provide contextual responses. Your query about "${userInput}" triggers multiple processing pipelines that ensure comprehensive and accurate information delivery.`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  };
  
  // If not open, render nothing
  if (!isOpen) return null;
  
  return (
    <div className={`smarttriad-copilot-layer ${className}`}>
      {variant === "floating" ? (
        <FloatingCopilot
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
  onModelChange: (model: string, provider: string) => void;
  personaId?: string;
  agentName?: string;
  agentId?: string;
}) {
  const [walletPanelOpen, setWalletPanelOpen] = useState(false);
  const [walletPanelTab, setWalletPanelTab] = useState<WalletTab>("wallet");
  const [walletActionsCollapsed, setWalletActionsCollapsed] = useState(false);
  const [walletMenuVisible, setWalletMenuVisible] = useState(true);
  const [walletMenuHover, setWalletMenuHover] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>("anthropic");
  const [micActive, setMicActive] = useState(false);
  const walletTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const handleWalletMenuEnter = () => {
    if (walletTimerRef.current) clearTimeout(walletTimerRef.current);
    setWalletMenuHover(true);
    setWalletMenuVisible(true);
  };
  const handleWalletMenuLeave = () => {
    setWalletMenuHover(false);
    if (walletTimerRef.current) clearTimeout(walletTimerRef.current);
    walletTimerRef.current = setTimeout(() => setWalletMenuVisible(false), 4000);
  };

  return (
    <>
      <div className="fixed inset-0 z-[200] flex">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Copilot Panel */}
        <div
          className={`relative ml-auto h-full w-full max-w-md bg-black/30 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden ${panelBorder ? "ring-1 ring-white/10" : ""}`}
          style={darkCssOverrides}
        >
          {/* Header: agent name + trust/reliability dots + close */}
          <div className="flex items-center justify-between px-3 pr-6 py-2 bg-slate-950 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <span className="text-sm font-semibold text-white/90 leading-none truncate">
                {agentName ?? "Aigent Copilot"}
              </span>
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
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages + floating wallet bar */}
          <div className="flex-1 relative overflow-hidden">
            {/* Scrollable messages — padded at bottom so content doesn't hide under wallet bar */}
            <div
              className="absolute inset-0 overflow-y-auto px-4 py-3 space-y-1 overscroll-contain"
              style={{ paddingBottom: "84px" }}
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

            {/* Hover trigger strip at bottom to reveal wallet bar */}
            <div
              className="absolute left-0 right-0 bottom-0 h-20 z-10"
              onMouseEnter={() => { if (walletTimerRef.current) clearTimeout(walletTimerRef.current); setWalletMenuVisible(true); }}
            />

            {/* Floating wallet quick-actions bar */}
            <div
              className={`absolute left-3 right-3 bottom-2 z-20 transition-opacity duration-200 ${walletMenuVisible || walletMenuHover ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
              onMouseEnter={handleWalletMenuEnter}
              onMouseLeave={handleWalletMenuLeave}
            >
              <div className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm px-3 py-2">
                {!walletActionsCollapsed ? (
                  <div className="min-w-0 flex-1 overflow-x-auto no-scrollbar">
                    <div className="grid min-w-full grid-flow-col auto-cols-[minmax(2.5rem,1fr)] items-center gap-2">
                      {(["wallet", "library", "tasks", "reputation", "rewards", "payments"] as WalletTab[]).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => { setWalletPanelTab(tab); setWalletPanelOpen(true); }}
                          className={`h-10 w-full rounded-lg ring-1 transition-colors ${
                            walletPanelOpen && walletPanelTab === tab
                              ? "bg-cyan-500/20 ring-cyan-500/30 text-cyan-200"
                              : "bg-white/5 ring-white/10 text-white/70 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          <span className="flex h-full w-full items-center justify-center">
                            {tab === "wallet" && <Wallet className="w-4 h-4" />}
                            {tab === "library" && <BookOpen className="w-4 h-4" />}
                            {tab === "tasks" && <CheckSquare className="w-4 h-4" />}
                            {tab === "reputation" && <Trophy className="w-4 h-4" />}
                            {tab === "rewards" && <Gift className="w-4 h-4" />}
                            {tab === "payments" && <CreditCard className="w-4 h-4" />}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center">
                    <button
                      onClick={() => setWalletActionsCollapsed(false)}
                      className="p-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-white/70 hover:text-white hover:bg-white/10"
                    >
                      <Wallet className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  {!walletActionsCollapsed && (
                    <button
                      onClick={() => setWalletActionsCollapsed(true)}
                      className="p-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-white/70 hover:text-white hover:bg-white/10"
                    >
                      <PanelBottomClose className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setWalletPanelOpen((prev) => !prev)}
                    className="p-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-white/70 hover:text-white hover:bg-white/10"
                  >
                    {walletPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                  </button>
                </div>
              </div>
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
                        onClick={() => { setSelectedProvider(id); onModelChange(id, id); setModelMenuOpen(false); }}
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
      </div>

      {/* SmartWallet Drawer */}
      <SmartWalletDrawer
        open={walletPanelOpen}
        onClose={() => setWalletPanelOpen(false)}
        variant="overlay"
        agent={{ id: agentId ?? "aigent-z", name: agentName ?? "Aigent" }}
        personaId={personaId}
        initialTab={walletPanelTab}
      />
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
