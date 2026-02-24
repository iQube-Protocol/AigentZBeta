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
import SmartWalletDrawer from "../../content/SmartWalletDrawer";
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
type WalletTab = "wallet" | "library" | "tasks" | "reputation" | "rewards";

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
  
  // Avatar state
  const { avatarState, toggleAvatar, isAvatarActive } = useMetaAvatar();
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
  const setMessages = onMessagesChange || setInternalMessages;
  
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
  
  // Handle sending messages
  const handleSend = useCallback(async () => {
    if (!input.trim() || isProcessing) return;
    
    const userMessage: SmartTriadMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };
    
    setMessages([...messages, userMessage]);
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
      
      setMessages(prev => [...prev, assistantMessage]);
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
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  }, [input, isProcessing, messages, setMessages, trustProvider, selectedContext]);
  
  // Handle quick prompt selection
  const handleQuickPrompt = useCallback((prompt: string | { label: string; prompt?: string }) => {
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
}) {
  
  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Copilot Panel */}
      <div className="relative ml-auto h-full w-full max-w-md bg-background shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-cyan-600" />
              <h2 className="font-semibold text-foreground">SmartTriad Copilot</h2>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-cyan-100 text-cyan-800">
                Advanced Rendering
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <SmartTriadInferenceRenderer
              key={message.id}
              message={message}
              showMetadata={enableAdvancedRendering}
              showScores={enableAdvancedRendering}
              enableModelSelector={tenantConfig?.enableModelSelection}
              onModelChange={onModelChange}
              tenantConfig={tenantConfig}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input */}
        {!disablePromptInput && (
          <div className="p-4 border-t">
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
                className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                disabled={isProcessing}
              />
              <button
                onClick={onSend}
                disabled={!input.trim() || isProcessing}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        )}
        
        {/* Footer */}
        {footerContent && (
          <div className="p-4 border-t bg-muted/50">
            {footerContent}
          </div>
        )}
      </div>
    </div>
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
