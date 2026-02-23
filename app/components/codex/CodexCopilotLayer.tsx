/**
 * CodexCopilotLayer - Enhanced floating copilot drawer for the Codex
 */

import { useEffect, useRef, useState } from "react";
import { useMetaAvatar } from "@/app/contexts/MetaAvatarContext";
import { useIsMobile } from "@/app/hooks/use-mobile";
import SmartWalletDrawer from "../content/SmartWalletDrawer";
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
  PanelRightClose,
  PanelRightOpen,
  PanelBottomClose,
} from "lucide-react";

interface CodexCopilotLayerProps {
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
  quickPrompts?: Array<
    | string
    | {
        id?: string;
        label: string;
        prompt?: string;
        icon?: React.ReactNode;
        iconOnly?: boolean;
        skipInference?: boolean;
      }
  >;
  onPrompt?: (prompt: string) => void;
  initialMessage?: string;
  seedMessages?: CopilotMessage[];
  messages?: CopilotMessage[];
  onMessagesChange?: (messages: CopilotMessage[]) => void;
  promptPlaceholder?: string;
  footerContent?: React.ReactNode;
  panelClassName?: string;
  floatingInput?: boolean;
  disableActivationButton?: boolean;
  showQuickPromptsToggle?: boolean;
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
}

type CopilotMode = "chat" | "avatar";

type WalletTab = "wallet" | "library" | "tasks" | "reputation" | "rewards";

export type CopilotMessage = {
  id: string;
  role: "user" | "assistant";
  content: React.ReactNode;
  timestamp: Date;
  variant?: "bubble" | "panel";
};

export function CodexCopilotLayer({
  isOpen,
  onClose,
  onOpen,
  variant = "floating",
  className,
  hideAvatarToggle = false,
  contextOptions,
  contextId,
  onContextChange,
  inputPanelClassName,
  inputPanelInputClassName,
  quickPrompts,
  onPrompt,
  initialMessage,
  seedMessages,
  messages,
  onMessagesChange,
  promptPlaceholder = "Ask about KNYT content...",
  footerContent,
  panelClassName,
  floatingInput = false,
  disableActivationButton = false,
  showQuickPromptsToggle = false,
  trustProvider,
  showNavMenu = true,
  showWalletMenu = true,
  panelBorder = true,
  agent,
  personaId,
}: CodexCopilotLayerProps) {
  const isMobile = useIsMobile();
  const { requestAvatar, releaseAvatar } = useMetaAvatar();

  const [copilotMode, setCopilotMode] = useState<CopilotMode>("chat");
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<CopilotMessage[]>([]);
  const displayMessages = messages ?? chatMessages;
  const [showActivationButton, setShowActivationButton] = useState(false);
  const [walletPanelOpen, setWalletPanelOpen] = useState(false);
  const [walletPanelCollapsed, setWalletPanelCollapsed] = useState(false);
  const [walletActionsCollapsed, setWalletActionsCollapsed] = useState(false);
  const [walletPanelTab, setWalletPanelTab] = useState<WalletTab>("wallet");
  const [walletMenuVisible, setWalletMenuVisible] = useState(true);
  const [walletMenuHover, setWalletMenuHover] = useState(false);
  const [inputPanelVisible, setInputPanelVisible] = useState(false);
  const [quickPromptsCollapsed, setQuickPromptsCollapsed] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);

  useEffect(() => {
    if (hideAvatarToggle && copilotMode !== "chat") {
      setCopilotMode("chat");
    }
  }, [hideAvatarToggle, copilotMode]);
  const [inputPanelHover, setInputPanelHover] = useState(false);
  const headerHeight = 44;
  const footerHeight = 88;
  const seededRef = useRef(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const copilotPanelRef = useRef<HTMLDivElement>(null);
  const metaAvatarFrameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages) return;
    if (seededRef.current) return;
    if (seedMessages && seedMessages.length > 0) {
      setChatMessages(seedMessages);
      seededRef.current = true;
      return;
    }
    if (!initialMessage) return;
    setChatMessages([
      {
        id: "welcome-message",
        role: "assistant",
        content: initialMessage,
        timestamp: new Date(0),
      },
    ]);
    seededRef.current = true;
  }, [initialMessage, seedMessages, messages]);

  const showActivationButtonWithTimeout = (timeoutMs: number = 4000) => {
    if (activationTimeoutRef.current) clearTimeout(activationTimeoutRef.current);
    setShowActivationButton(true);
    activationTimeoutRef.current = setTimeout(() => setShowActivationButton(false), timeoutMs);
  };

  useEffect(() => {
    if (isOpen) {
      if (activationTimeoutRef.current) clearTimeout(activationTimeoutRef.current);
      setShowActivationButton(false);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (activationTimeoutRef.current) clearTimeout(activationTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setWalletMenuVisible(true);
    const timeoutId = setTimeout(() => setWalletMenuVisible(false), 4000);
    return () => clearTimeout(timeoutId);
  }, [isOpen]);

  useEffect(() => {
    if (copilotMode === "avatar" && isOpen) {
      requestAvatar("codexCopilot", agent?.id || "aigent-z");
      return () => releaseAvatar("codexCopilot");
    }
    releaseAvatar("codexCopilot");
  }, [copilotMode, isOpen, requestAvatar, releaseAvatar, agent?.id]);

  useEffect(() => {
    if (!copilotPanelRef.current) return;

    const updateAnchor = () => {
      const node = copilotPanelRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const root = document.documentElement;
      root.style.setProperty("--metaavatar-codex-x", `${Math.round(rect.left)}px`);
      root.style.setProperty("--metaavatar-codex-y", `${Math.round(rect.top)}px`);
      const frame = metaAvatarFrameRef.current?.getBoundingClientRect();
      const width = frame?.width ?? 320;
      const height = frame?.height ?? 240;
      root.style.setProperty("--metaavatar-codex-w", `${Math.round(width)}px`);
      root.style.setProperty("--metaavatar-codex-h", `${Math.round(height)}px`);
    };

    updateAnchor();
    const id = requestAnimationFrame(function tick() {
      updateAnchor();
      requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, [copilotMode]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [displayMessages]);

  const updateMessages = (updater: (prev: CopilotMessage[]) => CopilotMessage[]) => {
    if (messages) {
      const next = updater([...messages]);
      onMessagesChange?.(next);
    } else {
      setChatMessages(updater);
    }
  };

  const showWalletMenuWithTimeout = (timeoutMs: number = 4000) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setWalletMenuVisible(true);
    hoverTimeoutRef.current = setTimeout(() => setWalletMenuVisible(false), timeoutMs);
  };

  const showInputPanelWithTimeout = (timeoutMs: number = 4000) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setInputPanelVisible(true);
    hoverTimeoutRef.current = setTimeout(() => setInputPanelVisible(false), timeoutMs);
  };

  const resolveProvider = (): "openai" | "venice" | "chaingpt" | "thirdweb" | "anthropic" => {
    if (trustProvider) return trustProvider;
    const name = agent?.name?.toLowerCase() || "";
    if (name.includes("anthropic") || name.includes("claude")) return "anthropic";
    if (name.includes("venice")) return "venice";
    if (name.includes("chaingpt") || name.includes("chain")) return "chaingpt";
    if (name.includes("thirdweb") || name.includes("web3")) return "thirdweb";
    return "openai";
  };

  const clampScore = (value: number) => Math.max(1, Math.min(10, value));

  const getBaseScore = () => {
    const provider = resolveProvider();
    if (provider === "anthropic") return 8.3;
    if (provider === "venice") return 7.8;
    if (provider === "chaingpt") return 8.0;
    if (provider === "thirdweb") return 7.6;
    return 5.0;
  };

  const getReliabilityScore = () => {
    const provider = resolveProvider();
    let score = getBaseScore();
    if (provider === "anthropic" || provider === "venice" || provider === "chaingpt" || provider === "thirdweb") score += 0.8;
    if (isLoading) score -= 0.3;
    return clampScore(score);
  };

  const getTrustScore = () => {
    let score = getBaseScore();
    if (isLoading) score -= 0.3;
    return clampScore(score);
  };

  const renderDots = (
    value: number,
    type: "trust" | "reliability" | "risk",
    isProcessing: boolean
  ) => {
    const dotCount = Math.ceil(value / 2);
    const dots = Array.from({ length: 5 }, (_, index) => {
      let colorClass = "bg-gray-400";
      if (index < dotCount) {
        if (type === "trust") {
          colorClass = value <= 3 ? "bg-red-500" : value <= 6 ? "bg-yellow-500" : "bg-green-500";
        } else if (type === "reliability") {
          colorClass = value <= 3 ? "bg-red-500" : value <= 6 ? "bg-yellow-500" : "bg-purple-500";
        } else {
          colorClass = value <= 4 ? "bg-green-500" : value <= 7 ? "bg-yellow-500" : "bg-red-500";
        }
      }
      return (
        <span
          key={`${type}-${index}`}
          className={`h-1.5 w-1.5 rounded-full ${colorClass} ${
            isProcessing ? "animate-pulse transition-all duration-700" : "transition-all duration-300"
          }`}
          style={isProcessing ? { animationDelay: `${index * 0.15}s` } : undefined}
        />
      );
    });
    return <div className="flex items-center gap-0.5">{dots}</div>;
  };

  const handleWalletMenuEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setWalletMenuHover(true);
    setWalletMenuVisible(true);
  };

  const handleWalletMenuLeave = () => {
    setWalletMenuHover(false);
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setWalletMenuVisible(false), 4000);
  };

  const shouldBypassInference = (message: string, skipInference?: boolean) => {
    if (skipInference) return true;
    const normalized = message.trim().toLowerCase();
    return (
      normalized.startsWith("__runtime_") ||
      normalized === "reset runtime" ||
      normalized === "refresh runtime"
    );
  };

  const sendMessage = async (override?: string, options?: { skipInference?: boolean }) => {
    const message = (override ?? inputValue).trim();
    if (!message || isLoading) return;

    updateMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "user", content: message, timestamp: new Date() },
    ]);
    setInputValue("");
    onPrompt?.(message);
    if (shouldBypassInference(message, options?.skipInference)) {
      return;
    }
    setIsLoading(true);

    try {
      const response = await fetch("/api/codex/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          persona: personaId || "kn0w1",
          personaId: personaId || null,
          contextId: contextId || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      updateMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data?.response || "I can help with that.",
          timestamp: new Date(),
        },
      ]);
    } catch {
      updateMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen && variant !== "floating") return null;

  const widthClass = panelClassName ?? (variant === "embedded" ? "w-96" : "w-96");

  return (
    <>
      {variant === "floating" && !isOpen && !disableActivationButton && (
        <div
          className="fixed bottom-0 left-0 z-[109] h-24 w-24 md:h-32 md:w-32"
          onMouseEnter={() => showActivationButtonWithTimeout(4000)}
        />
      )}

      {variant === "floating" && !isOpen && showActivationButton && !disableActivationButton && (
        <button
          onClick={onOpen || (() => {})}
          className="fixed bottom-6 left-6 z-[110] p-3 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
        >
          <Bot className="w-6 h-6 text-white" />
        </button>
      )}

      {isOpen && (
        <div
          className={
            variant === "embedded"
              ? `relative h-full w-full overflow-hidden ${className || ""}`
              : `codex-copilot-container fixed z-[120] flex flex-col md:flex-row gap-2 transition-all duration-300 ease-out ${
                  isMobile ? "inset-0 min-h-[100svh]" : ""
                }`
          }
          style={
            variant === "embedded"
              ? undefined
              : isMobile
                ? undefined
                : { bottom: "10px", right: "10px", top: "auto", left: "auto" }
          }
        >
          <div
            ref={copilotPanelRef}
            className={`${widthClass} ${
              variant === "embedded" ? "h-full" : "h-full md:h-[calc(100vh-100px)] md:max-h-[600px]"
            } transition-all duration-300 ease-out`}
          >
            <div className={`h-full bg-black/30 backdrop-blur-xl rounded-2xl shadow-2xl flex flex-col overflow-hidden ${panelBorder ? "ring-1 ring-white/10" : ""}`}>
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                {copilotMode === "chat" ? (
                  <>
                    <div className="flex-1 relative overflow-hidden">
                      <div
                        className="absolute top-0 left-0 right-0 z-20 bg-slate-950 px-3 pr-6 py-2 flex items-center gap-4 border-b border-white/10 justify-end"
                        style={{ height: `${headerHeight}px` }}
                      >
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/70">
                          <span className="text-[10px] text-white/60">R</span>
                          {renderDots(getReliabilityScore(), "reliability", isLoading)}
                        </div>
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/70">
                          <span className="text-[10px] text-white/60">T</span>
                          {renderDots(getTrustScore(), "trust", isLoading)}
                        </div>
                      </div>
                      <div
                        ref={chatContainerRef}
                        className="absolute left-0 right-0 overflow-y-auto px-4 space-y-3 overscroll-contain"
                        style={{ top: `${headerHeight}px`, bottom: `${footerHeight}px`, paddingTop: "12px", paddingBottom: "12px" }}
                      >
                        {displayMessages.map((msg) => {
                          const isPanel = msg.variant === "panel";
                          if (isPanel) {
                            return (
                              <div key={msg.id} className="w-full">
                                {msg.content}
                              </div>
                            );
                          }
                          return (
                            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                              <div
                                className={`max-w-[90%] px-3 py-2 rounded-xl ring-1 ${
                                  msg.role === "user"
                                    ? "bg-cyan-500/20 text-cyan-100 rounded-br-sm ring-cyan-500/30 text-sm"
                                    : "bg-white/5 text-white/90 rounded-bl-sm ring-white/10"
                                }`}
                              >
                                {msg.content}
                              </div>
                            </div>
                          );
                        })}
                        {isLoading && (
                          <div className="flex justify-start">
                            <div className="bg-white/5 px-3 py-2 rounded-xl rounded-bl-sm ring-1 ring-white/10">
                              <Loader2 className="w-4 h-4 animate-spin text-white/60" />
                            </div>
                          </div>
                        )}
                      </div>

                      {showWalletMenu && (
                        <div
                          className={`absolute bottom-3 left-3 right-3 transition-opacity duration-200 ${
                            walletMenuVisible || walletMenuHover
                              ? "opacity-100 pointer-events-auto"
                              : "opacity-0 pointer-events-none"
                          }`}
                          onMouseEnter={handleWalletMenuEnter}
                          onMouseLeave={handleWalletMenuLeave}
                        >
                          <div className="pointer-events-auto mx-auto flex w-full items-center justify-between rounded-2xl border border-white/10 bg-transparent px-3 py-2">
                            {!walletActionsCollapsed ? (
                              <div className="flex flex-1 items-center justify-between gap-2">
                                {["wallet", "library", "tasks", "reputation", "rewards"].map((tab) => (
                                  <button
                                    key={tab}
                                    onClick={() => {
                                      setWalletPanelTab(tab as WalletTab);
                                      setWalletPanelOpen(true);
                                      setWalletPanelCollapsed(false);
                                    }}
                                    className={`p-2 rounded-lg ring-1 transition-colors ${
                                      walletPanelOpen && walletPanelTab === tab && !walletPanelCollapsed
                                        ? "bg-cyan-500/20 ring-cyan-500/30 text-cyan-200"
                                        : "bg-white/5 ring-white/10 text-white/70 hover:text-white hover:bg-white/10"
                                    }`}
                                  >
                                    {tab === "wallet" && <Wallet className="w-4 h-4" />}
                                    {tab === "library" && <BookOpen className="w-4 h-4" />}
                                    {tab === "tasks" && <CheckSquare className="w-4 h-4" />}
                                    {tab === "reputation" && <Trophy className="w-4 h-4" />}
                                    {tab === "rewards" && <Gift className="w-4 h-4" />}
                                  </button>
                                ))}
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
                            <div className="flex items-center gap-2">
                              {!walletActionsCollapsed && (
                                <button
                                  onClick={() => setWalletActionsCollapsed(true)}
                                  className="p-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-white/70 hover:text-white hover:bg-white/10"
                                >
                                  <PanelBottomClose className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (!walletPanelOpen) {
                                    setWalletPanelOpen(true);
                                    setWalletPanelCollapsed(false);
                                  } else {
                                    setWalletPanelCollapsed((prev) => !prev);
                                  }
                                }}
                                className="p-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-white/70 hover:text-white hover:bg-white/10"
                              >
                                {walletPanelOpen && !walletPanelCollapsed ? (
                                  <PanelRightClose className="w-4 h-4" />
                                ) : (
                                  <PanelRightOpen className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div
                      className={`absolute inset-x-0 bottom-0 px-3 pb-3 pt-0 z-20 ${
                        floatingInput ? "bg-transparent" : "bg-white/5"
                      }`}
                    >
                      {floatingInput && (
                        <>
                          <div
                            className="absolute left-0 right-0 bottom-0 h-28"
                            onMouseEnter={() => showInputPanelWithTimeout()}
                          />
                          <div
                            className={`absolute left-3 right-3 bottom-16 transition-opacity duration-200 ${
                              inputPanelVisible || inputPanelHover
                                ? "opacity-100 pointer-events-auto"
                                : "opacity-0 pointer-events-none"
                            }`}
                            onMouseEnter={() => {
                              setInputPanelHover(true);
                              setInputPanelVisible(true);
                            }}
                            onMouseLeave={() => {
                              setInputPanelHover(false);
                              showInputPanelWithTimeout();
                            }}
                          >
                            <div className={inputPanelClassName ?? "rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-xl px-3 py-3 shadow-lg"}>
                              {quickPrompts && quickPrompts.length > 0 && !quickPromptsCollapsed && (
                                <div className="mb-3 overflow-x-auto no-scrollbar md:overflow-visible">
                                  <div className="flex w-max min-w-full snap-x snap-mandatory gap-2 md:w-full md:min-w-0 md:snap-none">
                                  {quickPrompts.map((promptItem, index) => {
                                    if (typeof promptItem === "string") {
                                      return (
                                        <button
                                          key={`${promptItem}-${index}`}
                                          onClick={() => sendMessage(promptItem)}
                                          className="snap-start shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:text-white hover:border-white/30 flex items-center justify-center md:min-w-0 md:flex-1"
                                        >
                                          {promptItem}
                                        </button>
                                      );
                                    }
                                    const label = promptItem.label;
                                    const promptValue = promptItem.prompt || promptItem.label;
                                    return (
                                      <button
                                        key={promptItem.id || `${label}-${index}`}
                                        onClick={() => sendMessage(promptValue, { skipInference: promptItem.skipInference })}
                                        title={label}
                                        className="snap-start shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:text-white hover:border-white/30 flex items-center justify-center gap-2 min-w-[42px] md:min-w-0 md:flex-1"
                                      >
                                        {promptItem.icon ? promptItem.icon : label}
                                        {promptItem.iconOnly ? <span className="sr-only">{label}</span> : label}
                                      </button>
                                    );
                                  })}
                                  </div>
                                </div>
                              )}
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={inputValue}
                                  onChange={(e) => setInputValue(e.target.value)}
                                  onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                                  onFocus={() => showInputPanelWithTimeout()}
                                  placeholder={promptPlaceholder}
                                  className={inputPanelInputClassName ?? "flex-1 px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 text-sm"}
                                  disabled={isLoading}
                                />
                                <button
                                  onClick={() => sendMessage()}
                                  disabled={!inputValue.trim() || isLoading}
                                  className="p-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
                                >
                                  {isLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Send className="w-4 h-4" />
                                  )}
                                </button>
                                {showQuickPromptsToggle && quickPrompts && quickPrompts.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setQuickPromptsCollapsed((prev) => !prev)}
                                    className="p-2 rounded-lg border border-slate-700 bg-slate-800/50 text-white/80 hover:bg-slate-700 transition-colors"
                                    title={quickPromptsCollapsed ? "Show quick links" : "Hide quick links"}
                                    aria-label={quickPromptsCollapsed ? "Show quick links" : "Hide quick links"}
                                  >
                                    <ChevronDown
                                      className={`w-4 h-4 transition-transform ${quickPromptsCollapsed ? "-rotate-90" : "rotate-0"}`}
                                    />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                      {!floatingInput && (
                        <>
                          <div className="h-px bg-white/10 mb-3" />
                          {quickPrompts && quickPrompts.length > 0 && (
                            <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar">
                              {quickPrompts.map((promptItem, index) => {
                                if (typeof promptItem === "string") {
                                  return (
                                    <button
                                      key={`${promptItem}-${index}`}
                                      onClick={() => sendMessage(promptItem)}
                                      className="flex-shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:text-white hover:border-white/30"
                                    >
                                      {promptItem}
                                    </button>
                                  );
                                }
                                const label = promptItem.label;
                                const promptValue = promptItem.prompt || promptItem.label;
                                return (
                                  <button
                                    key={promptItem.id || `${label}-${index}`}
                                    onClick={() => sendMessage(promptValue, { skipInference: promptItem.skipInference })}
                                    title={label}
                                    className="flex-shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:text-white hover:border-white/30 flex items-center gap-2"
                                  >
                                    {promptItem.icon ? promptItem.icon : label}
                                    {promptItem.iconOnly ? <span className="sr-only">{label}</span> : label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={inputValue}
                              onChange={(e) => setInputValue(e.target.value)}
                              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                              onFocus={() => showWalletMenuWithTimeout()}
                              placeholder={promptPlaceholder}
                              className="flex-1 px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 text-sm"
                              disabled={isLoading}
                            />
                            <button
                              onClick={() => sendMessage()}
                              disabled={!inputValue.trim() || isLoading}
                              className="p-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
                            >
                              {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </>
                      )}
                      {footerContent ? (
                        <div className={floatingInput ? "pt-3" : "mt-3"}>{footerContent}</div>
                      ) : showNavMenu ? (
                        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                          {hideAvatarToggle ? (
                            <div className="flex items-center gap-2">
                              <span className="rounded-sm border border-cyan-400/40 bg-cyan-500/20 px-3 py-1 text-[11px] font-semibold text-cyan-100 backdrop-blur-md shadow-sm">
                                {contextOptions?.find((opt) => opt.id === contextId)?.label || "Qriptopian Codex"}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5 ring-1 ring-white/10 flex-shrink-0">
                              <button
                                onClick={() => setCopilotMode("avatar")}
                                className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-xs transition-all ${
                                  (copilotMode as CopilotMode) === "avatar"
                                    ? "bg-purple-500/20 text-purple-400"
                                    : "text-white/50 hover:text-white/80"
                                }`}
                              >
                                <User className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setCopilotMode("chat")}
                                className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-xs transition-all ${
                                  (copilotMode as CopilotMode) === "chat"
                                    ? "bg-cyan-500/20 text-cyan-400"
                                    : "text-white/50 hover:text-white/80"
                                }`}
                              >
                                <MessageSquare className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          {contextOptions && contextOptions.length > 0 ? (
                            <div className="relative">
                              <button
                                onClick={() => setContextMenuOpen((prev) => !prev)}
                                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 ring-1 ring-white/10 transition-colors"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                              {contextMenuOpen && (
                                <div className="absolute right-0 bottom-10 min-w-[180px] rounded-xl border border-white/10 bg-slate-950/90 p-2 shadow-xl backdrop-blur">
                                  {contextOptions.map((opt) => (
                                    <button
                                      key={opt.id}
                                      onClick={() => {
                                        onContextChange?.(opt.id);
                                        setContextMenuOpen(false);
                                      }}
                                      className={`w-full rounded-lg px-3 py-2 text-left text-xs transition ${
                                        opt.id === contextId
                                          ? "bg-cyan-500/15 text-cyan-200"
                                          : "text-white/70 hover:bg-white/5"
                                      }`}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={onClose}
                              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 ring-1 ring-white/10 transition-colors"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col">
                    <div
                      ref={metaAvatarFrameRef}
                      className="flex-1 relative min-h-[300px] bg-black/50 rounded-lg overflow-hidden"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {walletPanelOpen && !walletPanelCollapsed && (
            <div className="rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl w-full md:w-auto h-full md:h-[calc(100vh-100px)] md:max-h-[600px]">
              <SmartWalletDrawer
                open={true}
                onClose={() => setWalletPanelOpen(false)}
                variant="embedded"
                embeddedWidth="fixed"
                initialTab={walletPanelTab}
                onTabChange={setWalletPanelTab}
                agent={agent || {
                  id: "default",
                  name: "Demo Agent",
                  evmSepolia: "0x" as `0x${string}`,
                  evmArb: "0x" as `0x${string}`,
                }}
                codexMode={true}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
