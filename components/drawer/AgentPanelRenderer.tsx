"use client";

/**
 * AgentPanelRenderer
 * 
 * Renders the agent/copilot panel within a drawer tab.
 * Supports chat interface, quick actions, and context-aware suggestions.
 */

import React, { useState, useRef, useEffect } from "react";
import {
  Bot,
  User,
  Send,
  X,
  Sparkles,
  RefreshCw,
  BookOpen,
  Gift,
  CheckSquare,
  Trophy,
  Loader2,
  ChevronDown,
  Zap,
} from "lucide-react";
import type { AgentPanelConfig } from "@/types/smartDrawer";
import type { SmartWalletQube } from "@/types/smartWalletQube";

// =============================================================================
// TYPES
// =============================================================================

export interface AgentPanelRendererProps {
  /** Agent panel configuration */
  config: AgentPanelConfig;
  
  /** Callback when message is sent */
  onSendMessage?: (message: string) => void;
  
  /** Callback to close panel */
  onClose?: () => void;
  
  /** Wallet data for context */
  wallet?: SmartWalletQube;
  
  /** Current content for context */
  currentContent?: any;
  
  /** Custom class name */
  className?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AgentPanelRenderer({
  config,
  onSendMessage,
  onClose,
  wallet,
  currentContent,
  className = "",
}: AgentPanelRendererProps) {
  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm here to help. What would you like to do?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // EFFECTS
  // ---------------------------------------------------------------------------
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------
  
  const handleSend = async (message?: string) => {
    const text = message ?? inputValue.trim();
    if (!text) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    setShowQuickActions(false);

    // Notify parent
    onSendMessage?.(text);

    try {
      // Call copilot API
      const response = await fetch("/api/wallet-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          context: {
            agentId: config.primaryAgentId,
            walletBalance: wallet?.balances?.reduce(
              (sum, b) => sum + parseFloat(b.amount || '0'),
              0
            ) ?? 0,
            hasContent: !!currentContent,
            contentTitle: currentContent?.title,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.message ?? "I'm here to help! What would you like to know?",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        throw new Error("Failed to get response");
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I couldn't process that request. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ---------------------------------------------------------------------------
  // QUICK ACTIONS
  // ---------------------------------------------------------------------------
  
  const quickActions = [
    "What can I afford?",
    "Show my tasks",
    "Earn more Q¢",
  ];

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  
  return (
    <div className={`flex flex-col h-full bg-slate-950/90 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-purple-400" />
          <span className="text-xs uppercase tracking-wider text-white/70">
            {config.primaryAgentId || "Copilot"}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-white/50 hover:text-white/90 hover:bg-white/10 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}
          >
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Bot className="w-3.5 h-3.5 text-purple-400" />
              </div>
            )}
            <div
              className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                msg.role === "user"
                  ? "bg-white/10 text-white/90 rounded-br-sm"
                  : "bg-white/5 text-white/80"
              }`}
            >
              {msg.content}
            </div>
            {msg.role === "user" && (
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <User className="w-3.5 h-3.5 text-cyan-400" />
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="flex items-center gap-1 px-3 py-2">
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {showQuickActions && quickActions.length > 0 && (
        <div className="px-3 py-2 border-t border-white/10">
          <div className="flex flex-wrap gap-1.5">
            {quickActions.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSend(prompt)}
                disabled={isLoading}
                className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-xs text-white/60 hover:text-white/90 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/90 placeholder:text-white/40 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !inputValue.trim()}
            className="px-3 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Context Info (collapsed by default) */}
      {(wallet || currentContent) && (
        <details className="border-t border-white/10">
          <summary className="px-3 py-2 text-xs text-white/40 cursor-pointer hover:text-white/60 flex items-center gap-1">
            <ChevronDown className="w-3 h-3" />
            Context
          </summary>
          <div className="px-3 pb-2 space-y-1 text-xs text-white/50">
            {wallet && (
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Balance: {wallet.balances?.reduce((sum, b) => sum + parseFloat(b.amount || '0'), 0).toLocaleString() ?? 0} Q¢
              </div>
            )}
            {currentContent && (
              <div className="flex items-center gap-1 truncate">
                <BookOpen className="w-3 h-3" />
                Content: {currentContent.title}
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

export default AgentPanelRenderer;
