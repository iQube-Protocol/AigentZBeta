/**
 * CodexCopilotLayer - Enhanced floating copilot drawer for the Codex
 * 
 * Ported from Netlify app with AgentiQ backend integration
 * 
 * Features:
 * - Chat interface with Codex content knowledge base
 * - MetaAvatar integration (fully functional)
 * - Context switching between KNYT and Qriptopian
 * - Smart Wallet integration
 * - Codex content-aware responses
 */

import { useState, useEffect, useRef } from 'react';
import { useMetaAvatar } from '@/app/contexts/MetaAvatarContext';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { SmartWalletNode } from '@/types/smartWallet';
import SmartWalletDrawer from '../content/SmartWalletDrawer';
import { useIsMobile } from '@/app/hooks/use-mobile';
import {
  Bot,
  User,
  MessageSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
  PanelBottomOpen,
  X
} from 'lucide-react';

interface CodexCopilotLayerProps {
  isOpen: boolean;
  onClose: () => void;
  // Optional user context for personalization
  walletBalance?: number;
  nftCount?: number;
  isFirstVisit?: boolean;
  visitCount?: number;
  agent?: {
    id: string;
    name: string;
    evmSepolia?: `0x${string}`;
    evmArb?: `0x${string}`;
    btcAddress?: string;
    fioHandle?: string;
    walletAddress?: string;
  };
}

export function CodexCopilotLayer({ 
  isOpen,
  onClose,
  walletBalance,
  nftCount,
  isFirstVisit,
  visitCount,
  agent
}: CodexCopilotLayerProps) {
  const isMobile = useIsMobile();
  const { activeAgent, requestAvatar, releaseAvatar } = useMetaAvatar();
  
  type CopilotMode = 'chat' | 'avatar';
type ContextMode = 'knyt' | 'qriptopian';

  // UI State
  const [showActivationButton, setShowActivationButton] = useState(true); // Show immediately for debugging
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [walletPanelOpen, setWalletPanelOpen] = useState(false);
  const [walletPanelCollapsed, setWalletPanelCollapsed] = useState(false);
  const [copilotMode, setCopilotMode] = useState<CopilotMode>('chat');
  const [contextMode, setContextMode] = useState<ContextMode>('knyt');
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>>([]);
  
  // Refs
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lastAssistantMessageRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Codex width management (narrow vs wide)
  const [copilotWidth, setCopilotWidth] = useState<'narrow' | 'wide'>('narrow');
  const topDividerOffsetPx = 14;

  // Effects
  useEffect(() => {
    console.log('🤖 CodexCopilotLayer: isOpen changed:', isOpen);
    
    if (isOpen) {
      console.log('🤖 CodexCopilotLayer: Mounting and requesting avatar');
      // Request avatar for codex copilot container
      requestAvatar('codexCopilot', agent?.id || 'aigent-z');
      
      return () => {
        console.log('🤖 CodexCopilotLayer: Unmounting and releasing avatar');
        // Release avatar when copilot closes
        releaseAvatar('codexCopilot');
      };
    }
  }, [isOpen, requestAvatar, releaseAvatar, agent?.id]);

  useEffect(() => {
    // Scroll to bottom when new messages are added
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Load Codex knowledge base
  const loadCodexKnowledge = async (): Promise<string> => {
    try {
      const supabase = getSupabaseServer();
      if (!supabase) return '';
      
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('title, content')
        .in('doc_type', ['codex', 'metaKnyts', 'character', 'lore'])
        .order('updated_at', { ascending: false })
        .limit(10);
      
      if (error || !data?.length) return '';
      
      return data.map((doc) => `### ${doc.title}\n${doc.content}`).join('\n\n');
    } catch (err) {
      console.error('Failed to load Codex knowledge:', err);
      return '';
    }
  };

  // Send message to copilot
  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    const userMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: inputValue.trim(),
      timestamp: new Date(),
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    
    try {
      // Load Codex knowledge for context
      const codexKnowledge = await loadCodexKnowledge();
      
      // Call copilot API with Codex context
      const response = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          context: {
            mode: contextMode,
            codexKnowledge,
            walletBalance,
            nftCount,
            agentName: agent?.name,
            metaAvatar: activeAgent,
          },
        }),
      });
      
      if (!response.ok) throw new Error('Failed to get response');
      
      const data = await response.json();
      
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: data.response,
        timestamp: new Date(),
      };
      
      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Failed to send message:', err);
      
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Render chat message
  const renderMessage = (message: typeof chatMessages[0]) => (
    <div
      key={message.id}
      className={`flex gap-3 p-4 ${
        message.role === 'user' ? 'bg-slate-800/30' : 'bg-slate-700/30'
      }`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        message.role === 'user' 
          ? 'bg-cyan-500/20 text-cyan-400' 
          : 'bg-purple-500/20 text-purple-400'
      }`}>
        {message.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className="flex-1">
        <div className="text-white text-sm leading-relaxed">{message.content}</div>
        <div className="text-xs text-slate-500 mt-1">
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );

  if (!isOpen) {
    console.log('🤖 CodexCopilotLayer: isOpen is false, returning null');
    return null;
  }

  console.log('🤖 CodexCopilotLayer: Rendering copilot, isOpen:', isOpen);

  // Width classes for copilot
  const widthClass = copilotWidth === 'wide' ? 'w-[28rem]' : 'w-[21.6rem]';

  return (
    <>
      {/* Copilot Button (bottom-right activation) */}
      {showActivationButton && (
        <button
          onClick={() => setCopilotWidth(copilotWidth === 'narrow' ? 'wide' : 'narrow')}
          className="fixed bottom-6 right-6 z-[110] p-3 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
        >
          <Bot className="w-6 h-6 text-white" />
        </button>
      )}
      
      {/* Copilot + Docked Wallet (inside Codex experience) */}
      <div
        className={`codex-copilot-container fixed z-[120] flex flex-col md:flex-row gap-2 transition-all duration-300 ease-out ${
          isMobile ? 'inset-0 min-h-[100svh]' : ''
        }`}
        style={
          isMobile
            ? undefined
            : { bottom: '10px', right: '10px', top: 'auto', left: 'auto' }
        }
      >
        <div
          className={`${widthClass} h-full md:h-[calc(100vh-100px)] md:max-h-[600px] transition-all duration-300 ease-out`}
        >
          <div
            className="h-full bg-black/30 backdrop-blur-xl ring-1 ring-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Main Content Area - Chat or MetaAvatar on top */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {(copilotMode as string) === 'chat' ? (
                /* Chat Interface */
                <>
                  {/* Chat Messages - scrollable area */}
                  <div className="flex-1 relative">
                    {/* Top divider overlay */}
                    <div
                      className="pointer-events-none absolute left-0 right-0 z-30"
                      style={{ top: topDividerOffsetPx }}
                    >
                      <div className="h-[2px] bg-white/10" />
                    </div>
                    <div 
                      ref={chatContainerRef}
                      className="absolute inset-0 overflow-y-auto px-4 pb-4 pt-0 space-y-3"
                      style={{ paddingTop: topDividerOffsetPx + 2 }}
                    >
                      {chatMessages.map((msg, idx) => (
                        <div
                          key={msg.id}
                          ref={
                            msg.role === 'assistant' && idx === chatMessages.length - 1
                              ? lastAssistantMessageRef
                              : undefined
                          }
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[90%] px-3 py-2 rounded-xl ring-1 ${
                              msg.role === 'user'
                                ? 'bg-cyan-500/20 text-cyan-100 rounded-br-sm ring-cyan-500/30 text-sm'
                                : 'bg-white/5 text-white/90 rounded-bl-sm ring-white/10'
                            }`}
                          >
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      {isLoading && (
                        <div className="flex justify-start">
                          <div className="bg-white/5 px-3 py-2 rounded-xl rounded-bl-sm ring-1 ring-white/10">
                            <Loader2 className="w-4 h-4 animate-spin text-white/60" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Chat Input with Navigation */}
                  <div className="p-3 border-t border-white/10 bg-white/5">
                    {/* Navigation Bar */}
                    <div className="flex items-center justify-between mb-3">
                      {/* Left: Codex Selection */}
                      <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5 ring-1 ring-white/10 flex-shrink-0">
                        <button
                          onClick={() => setContextMode('knyt')}
                          className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-xs transition-all ${
                            contextMode === 'knyt' 
                              ? 'bg-cyan-500/20 text-cyan-400' 
                              : 'text-white/50 hover:text-white/80'
                          }`}
                        >
                          <BookOpen className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setContextMode('qriptopian')}
                          className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-xs transition-all ${
                            contextMode === 'qriptopian' 
                              ? 'bg-purple-500/20 text-purple-400' 
                              : 'text-white/50 hover:text-white/80'
                          }`}
                        >
                          <Sparkles className="w-3 h-3" />
                        </button>
                      </div>
                      
                      {/* Center: Wallet Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setWalletPanelOpen(!walletPanelOpen)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                            walletPanelOpen 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : 'bg-slate-700/50 text-slate-400 hover:text-slate-300'
                          }`}
                        >
                          <Wallet className="w-3 h-3 inline mr-1" />
                          Wallet
                        </button>
                      </div>
                      
                      {/* Right: Mode Toggle & Close */}
                      <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5 ring-1 ring-white/10 flex-shrink-0">
                        <button
                          onClick={() => setCopilotMode('avatar')}
                          className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-xs transition-all ${
                            (copilotMode as string) === 'avatar' 
                              ? 'bg-purple-500/20 text-purple-400' 
                              : 'text-white/50 hover:text-white/80'
                          }`}
                        >
                          <User className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setCopilotMode('chat')}
                          className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-xs transition-all ${
                            (copilotMode as string) === 'chat' 
                              ? 'bg-cyan-500/20 text-cyan-400' 
                              : 'text-white/50 hover:text-white/80'
                          }`}
                        >
                          <MessageSquare className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setCopilotWidth('narrow')}
                          className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 ring-1 ring-white/10 transition-colors"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Chat Input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder={`Ask about ${contextMode === 'knyt' ? 'KNYT' : 'Qriptopian'} content...`}
                        className="flex-1 px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 text-sm"
                        disabled={isLoading}
                      />
                      <button
                        onClick={sendMessage}
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
                  </div>
                </>
              ) : (
                /* MetaAvatar Interface - Global avatar positioned via CSS */
                <div className="flex-1 flex flex-col">
                  {/* Avatar Placeholder - Global MetaAvatar is positioned over this area */}
                  <div className="flex-1 relative min-h-[300px] bg-black/50 rounded-lg overflow-hidden">
                    {/* Status indicator when avatar is loading or not yet positioned */}
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-500/5 to-cyan-500/5">
                      <div className="text-center">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 ring-1 ring-white/10 flex items-center justify-center">
                          <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
                        </div>
                        <p className="text-white/60 text-sm">
                          Loading {agent?.name || 'MetaAvatar'}...
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Navigation Bar for MetaAvatar */}
                  <div className="p-3 border-t border-white/10 bg-white/5">
                    <div className="flex items-center justify-between">
                      {/* Left: Codex Selection */}
                      <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5 ring-1 ring-white/10 flex-shrink-0">
                        <button
                          onClick={() => setContextMode('knyt')}
                          className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-xs transition-all ${
                            contextMode === 'knyt' 
                              ? 'bg-cyan-500/20 text-cyan-400' 
                              : 'text-white/50 hover:text-white/80'
                          }`}
                        >
                          <BookOpen className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setContextMode('qriptopian')}
                          className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-xs transition-all ${
                            contextMode === 'qriptopian' 
                              ? 'bg-purple-500/20 text-purple-400' 
                              : 'text-white/50 hover:text-white/80'
                          }`}
                        >
                          <Sparkles className="w-3 h-3" />
                        </button>
                      </div>
                      
                      {/* Center: Wallet Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setWalletPanelOpen(!walletPanelOpen)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                            walletPanelOpen 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : 'bg-slate-700/50 text-slate-400 hover:text-slate-300'
                          }`}
                        >
                          <Wallet className="w-3 h-3 inline mr-1" />
                          Wallet
                        </button>
                      </div>
                      
                      {/* Right: Mode Toggle & Close */}
                      <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5 ring-1 ring-white/10 flex-shrink-0">
                        <button
                          onClick={() => setCopilotMode('chat')}
                          className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-xs transition-all ${
                            (copilotMode as string) === 'chat' 
                              ? 'bg-cyan-500/20 text-cyan-400' 
                              : 'text-white/50 hover:text-white/80'
                          }`}
                        >
                          <MessageSquare className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setCopilotMode('avatar')}
                          className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-xs transition-all ${
                            (copilotMode as string) === 'avatar' 
                              ? 'bg-purple-500/20 text-purple-400' 
                              : 'text-white/50 hover:text-white/80'
                          }`}
                        >
                          <User className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setCopilotWidth('narrow')}
                          className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 ring-1 ring-white/10 transition-colors"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Docked Smart Wallet panel (embedded) */}
        {walletPanelOpen && !walletPanelCollapsed && (
          <div
            className="rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl w-full md:w-auto h-full md:h-[calc(100vh-100px)] md:max-h-[600px]"
          >
            <SmartWalletDrawer
              open={true}
              onClose={() => setWalletPanelOpen(false)}
              variant="embedded"
              embeddedWidth="fixed"
              agent={agent || {
                id: 'default',
                name: 'Demo Agent',
                evmSepolia: '0x' as `0x${string}`,
                evmArb: '0x' as `0x${string}`,
              }}
              codexMode={true}
            />
          </div>
        )}
      </div>
    </>
  );
}
