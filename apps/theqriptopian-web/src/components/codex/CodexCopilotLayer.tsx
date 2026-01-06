/**
 * CodexCopilotLayer - Floating copilot drawer for the Codex
 * 
 * This layer sits above the main content layer and provides:
 * - Chat interface (narrow mode)
 * - MetaAvatar interface (wide mode)
 * - Context switching between KNYT and Qriptopian
 * - Access to Smart Wallet components as needed
 * 
 * The copilot button appears on hover in the bottom-right corner.
 * When activated, the copilot drawer slides up with chat/avatar interface.
 * 
 * Tab bar layout: [KNYT | Qriptopian] ... carousel ... [Chat | MetaVatar] [Collapse]
 */

import { useState, useEffect, useRef } from 'react';
import { useCodexCopilot } from '@/contexts/CodexCopilotContext';
import { useMetaAvatar } from '@/contexts/MetaAvatarContext';
import { getCopilotContextService } from '@/services/copilotContextService';
import type { ContentDomain, UserRole } from '@/types/copilotContext';
import { WalletDrawer } from '@/components/navigation/drawers/WalletDrawer';
import { MarkdownMessage } from './MarkdownMessage';
import { useIsMobile } from '@/hooks/use-mobile';
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
  PanelBottomOpen
} from 'lucide-react';

interface CodexCopilotLayerProps {
  isDrawerOpen: boolean;
  // Optional user context for personalization
  walletBalance?: number;
  nftCount?: number;
  isFirstVisit?: boolean;
  visitCount?: number;
  declaredRoles?: UserRole[];
}

export function CodexCopilotLayer({ 
  isDrawerOpen,
  walletBalance,
  nftCount,
  isFirstVisit,
  visitCount,
  declaredRoles
}: CodexCopilotLayerProps) {
  const {
    activeCodex,
    setActiveCodex,
    copilotOpen,
    setCopilotOpen,
    copilotMode,
    setCopilotMode,
    copilotWidth,
    activePersona,
    chatMessages,
    addChatMessage,
  } = useCodexCopilot();
  const isMobile = useIsMobile();
  
  const [showActivationButton, setShowActivationButton] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [walletPanelOpen, setWalletPanelOpen] = useState(false);
  const [walletPanelCollapsed, setWalletPanelCollapsed] = useState(false);
  const [walletActionsCollapsed, setWalletActionsCollapsed] = useState(false);
  const [walletPanelTab, setWalletPanelTab] = useState<'wallet' | 'library' | 'tasks' | 'reputation' | 'rewards'>('wallet');
  const [walletActionsHovered, setWalletActionsHovered] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lastAssistantMessageRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const topDividerOffsetPx = 14;

  type WalletTab = 'wallet' | 'library' | 'tasks' | 'reputation' | 'rewards';
  type WalletActionCardType =
    | 'unlock'
    | 'send'
    | 'request'
    | 'verify'
    | 'buy'
    | 'library'
    | 'tasks'
    | 'reputation'
    | 'rewards';

  interface WalletActionCard {
    type: WalletActionCardType;
    title: string;
    subtitle?: string;
    tab: WalletTab;
    primaryCtaLabel: string;
  }

  const openWallet = (tab: WalletTab) => {
    setWalletPanelTab(tab);
    setWalletPanelOpen(true);
    setWalletPanelCollapsed(false);
  };

  const detectWalletCards = (message: string): WalletActionCard[] => {
    const lower = message.toLowerCase();
    const cards: WalletActionCard[] = [];

    const wantsUnlock =
      lower.includes('unlock') ||
      lower.includes('connect wallet') ||
      lower.includes('connect my wallet') ||
      lower.includes('sign in') ||
      lower.includes('login');

    if (wantsUnlock) {
      cards.push({
        type: 'unlock',
        title: 'Unlock Wallet',
        subtitle: 'Required to transact and claim rewards',
        tab: 'wallet',
        primaryCtaLabel: 'Open Wallet',
      });
    }

    const isSend = lower.includes('send') || lower.includes('transfer') || lower.includes('pay ');
    const isRequest = lower.includes('request') || lower.includes('invoice') || lower.includes('receive');
    const isVerify = lower.includes('verify') || lower.includes('tx') || lower.includes('transaction hash');
    const isBuy = lower.includes('buy knyt') || lower.includes('top up') || lower.includes('purchase knyt');
    const isLibrary = lower.includes('library') || lower.includes('own') || lower.includes('entitlement') || lower.includes('unlock this');
    const isTasks = lower.includes('task') || lower.includes('quest');
    const isRewards = lower.includes('reward') || lower.includes('earn');
    const isReputation = lower.includes('reputation') || lower.includes('multiplier') || lower.includes('tier');

    if (isSend) {
      cards.push({
        type: 'send',
        title: 'Send Payment',
        subtitle: 'Open wallet to send a transfer',
        tab: 'wallet',
        primaryCtaLabel: 'Open Send',
      });
    } else if (isRequest) {
      cards.push({
        type: 'request',
        title: 'Request Payment',
        subtitle: 'Create a payment request link/QR',
        tab: 'wallet',
        primaryCtaLabel: 'Open Request',
      });
    } else if (isVerify) {
      cards.push({
        type: 'verify',
        title: 'Verify Transaction',
        subtitle: 'Check status and confirmations',
        tab: 'wallet',
        primaryCtaLabel: 'Open Verify',
      });
    } else if (isBuy) {
      cards.push({
        type: 'buy',
        title: 'Buy KNYT',
        subtitle: 'Top up to unlock content and rewards',
        tab: 'wallet',
        primaryCtaLabel: 'Open Buy KNYT',
      });
    } else if (isLibrary) {
      cards.push({
        type: 'library',
        title: 'Your Library',
        subtitle: 'Browse owned + locked items',
        tab: 'library',
        primaryCtaLabel: 'Open Library',
      });
    } else if (isTasks) {
      cards.push({
        type: 'tasks',
        title: 'Tasks',
        subtitle: 'Complete tasks to earn rewards',
        tab: 'tasks',
        primaryCtaLabel: 'Open Tasks',
      });
    } else if (isRewards) {
      cards.push({
        type: 'rewards',
        title: 'Rewards',
        subtitle: 'See earned + pending rewards',
        tab: 'rewards',
        primaryCtaLabel: 'Open Rewards',
      });
    } else if (isReputation) {
      cards.push({
        type: 'reputation',
        title: 'Reputation',
        subtitle: 'Check multiplier and tier progress',
        tab: 'reputation',
        primaryCtaLabel: 'Open Reputation',
      });
    }

    // Keep max 2 cards (Option C).
    return cards.slice(0, 2);
  };
  
  // Use global MetaAvatar system
  const { requestAvatar, releaseAvatar, activeContainer } = useMetaAvatar();
  
  // Handle mouse movement for activation button visibility
  useEffect(() => {
    if (!isDrawerOpen || copilotOpen) {
      setShowActivationButton(false);
      return;
    }
    
    const handleMouseMove = (e: MouseEvent) => {
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      
      // Show button when mouse is in bottom-right quadrant
      const isInBottomRight = e.clientX > windowWidth * 0.7 && e.clientY > windowHeight * 0.7;
      
      if (isInBottomRight) {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
        setShowActivationButton(true);
      } else {
        // Delay hiding to prevent flicker
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
        hoverTimeoutRef.current = setTimeout(() => {
          setShowActivationButton(false);
        }, 500);
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, [isDrawerOpen, copilotOpen]);
  
  // Scroll behavior:
  // - When assistant responds, scroll to the *start* of that message (so user sees the beginning).
  // - When user sends a message (or while loading), keep view near bottom.
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const last = chatMessages[chatMessages.length - 1];
    if (!last) return;

    if (last.role === 'assistant') {
      lastAssistantMessageRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      container.scrollTop = Math.max(0, container.scrollTop - topDividerOffsetPx);
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [chatMessages, isLoading]);
  
  // Request/release global MetaAvatar based on mode
  useEffect(() => {
    if (copilotOpen && copilotMode === 'metavatar') {
      // Request the global avatar for codex copilot container
      console.log('[CodexCopilot] Requesting MetaAvatar for codexCopilot container');
      requestAvatar('codexCopilot', activePersona === 'kn0w1' ? 'kn0w1' : 'moneypenny');
    } else {
      // Release when not in metavatar mode or copilot closed
      releaseAvatar('codexCopilot');
    }
    
    // Cleanup on unmount
    return () => {
      releaseAvatar('codexCopilot');
    };
  }, [copilotOpen, copilotMode, activePersona, requestAvatar, releaseAvatar]);
  
  // Handle sending a message
  const handleSendMessage = async (overrideMessage?: string) => {
    const raw = (overrideMessage ?? inputValue).trim();
    if (!raw || isLoading) return;
    
    const userMessage = raw;
    setInputValue('');
    addChatMessage('user', userMessage);
    setIsLoading(true);
    
    try {
      // Map activeCodex to domain
      const domain: ContentDomain = activeCodex === 'knyt' ? 'metaKnyts' : 'qriptopian';
      
      // Call the codex chat API with user context
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiBase}/api/codex/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          persona: activePersona,
          domain,
          declaredRoles,
          walletBalance,
          nftCount,
          isFirstVisit,
          visitCount,
          chatHistory: chatMessages.slice(-10).map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      addChatMessage('assistant', data.response);
    } catch (error) {
      console.error('[CodexCopilot] Chat error:', error);
      // Fallback response if API fails
      const fallbackResponses = activeCodex === 'knyt' 
        ? [
            "I can help you explore the metaKnyts episodes. Would you like to see the latest releases or browse by character?",
            "The KNYT Codex contains digital scrolls, motion comics, and collectible covers. What interests you most?",
          ]
        : [
            "The Qriptopian universe is vast! I can guide you through the lore, characters, or world-building documents.",
            "MoneyPenny here! The Quantum-Ready Internet has many secrets. What would you like to discover?",
          ];
      addChatMessage('assistant', fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLinkClick = (prompt: string) => {
    handleSendMessage(prompt);
  };

  const renderWalletActionCard = (card: WalletActionCard) => {
    return (
      <div key={card.type} className="mt-2 rounded-xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
        <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-white/60">Wallet Action</div>
            <div className="text-sm font-semibold text-white truncate">{card.title}</div>
            {card.subtitle && <div className="text-xs text-white/50 truncate">{card.subtitle}</div>}
          </div>
          <span className="px-2 py-0.5 rounded-full bg-white/5 ring-1 ring-white/10 text-[10px] text-white/60">
            {card.tab}
          </span>
        </div>
        <div className="px-3 py-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openWallet(card.tab)}
            className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-500/30 hover:bg-cyan-500/30 text-xs font-medium transition-colors"
          >
            {card.primaryCtaLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              openWallet(card.tab);
            }}
            className="px-3 py-1.5 rounded-lg bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 text-xs transition-colors"
          >
            Open Panel
          </button>
        </div>
      </div>
    );
  };

  const renderWalletActionsToolbar = () => {
    if (!walletActionsHovered) return null;

    if (walletActionsCollapsed) {
      return (
        <div className="px-3 pb-2">
          <button
            type="button"
            title="Show wallet actions"
            onClick={() => setWalletActionsCollapsed(false)}
            className="w-full flex items-center justify-center px-3 py-2 rounded-xl bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition-colors"
          >
            <PanelBottomOpen className="w-4 h-4 text-white/70" />
          </button>
        </div>
      );
    }

    const iconBtn = (opts: {
      key: string;
      title: string;
      onClick: () => void;
      children: React.ReactNode;
      active?: boolean;
    }) => (
      <button
        key={opts.key}
        type="button"
        title={opts.title}
        onClick={opts.onClick}
        className={`p-2 rounded-lg ring-1 transition-colors ${
          opts.active
            ? 'bg-cyan-500/20 ring-cyan-500/30 text-cyan-200'
            : 'bg-white/5 ring-white/10 text-white/70 hover:bg-white/10'
        }`}
      >
        {opts.children}
      </button>
    );

    return (
      <div className="px-3 pb-2">
        <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {iconBtn({
                key: 'wallet',
                title: 'Wallet tab',
                onClick: () => openWallet('wallet'),
                active: walletPanelOpen && walletPanelTab === 'wallet' && !walletPanelCollapsed,
                children: <Wallet className="w-4 h-4" />,
              })}
              {iconBtn({
                key: 'library',
                title: 'Library tab',
                onClick: () => openWallet('library'),
                active: walletPanelOpen && walletPanelTab === 'library' && !walletPanelCollapsed,
                children: <BookOpen className="w-4 h-4" />,
              })}
              {iconBtn({
                key: 'tasks',
                title: 'Tasks tab',
                onClick: () => openWallet('tasks'),
                active: walletPanelOpen && walletPanelTab === 'tasks' && !walletPanelCollapsed,
                children: <CheckSquare className="w-4 h-4" />,
              })}
              {iconBtn({
                key: 'reputation',
                title: 'Reputation tab',
                onClick: () => openWallet('reputation'),
                active: walletPanelOpen && walletPanelTab === 'reputation' && !walletPanelCollapsed,
                children: <Trophy className="w-4 h-4" />,
              })}
              {iconBtn({
                key: 'rewards',
                title: 'Rewards tab',
                onClick: () => openWallet('rewards'),
                active: walletPanelOpen && walletPanelTab === 'rewards' && !walletPanelCollapsed,
                children: <Gift className="w-4 h-4" />,
              })}
            </div>

            <div className="flex items-center gap-2">
              {iconBtn({
                key: 'actionsCollapse',
                title: 'Hide wallet actions',
                onClick: () => setWalletActionsCollapsed(true),
                children: <PanelBottomClose className="w-4 h-4" />,
              })}
              {iconBtn({
                key: 'walletPanel',
                title: walletPanelOpen && !walletPanelCollapsed ? 'Collapse wallet panel' : 'Show wallet panel',
                onClick: () => {
                  if (!walletPanelOpen) {
                    setWalletPanelOpen(true);
                    setWalletPanelCollapsed(false);
                    return;
                  }
                  setWalletPanelCollapsed(v => !v);
                },
                children: walletPanelOpen && !walletPanelCollapsed ? (
                  <PanelRightClose className="w-4 h-4" />
                ) : (
                  <PanelRightOpen className="w-4 h-4" />
                ),
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Drawer width classes - positioned at right edge of browser
  const widthClass = copilotWidth === 'wide' ? 'w-full md:w-[480px]' : 'w-full md:w-[320px]';
  
  // Carousel scroll state
  const carouselRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  
  // Check carousel scroll state
  const updateCarouselScroll = () => {
    if (carouselRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };
  
  // Scroll carousel
  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = 100;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };
  
  if (!isDrawerOpen) return null;
  
  return (
    <>
      {/* Activation Button - appears on hover in bottom-right */}
      {!copilotOpen && (
        <button
          onClick={() => setCopilotOpen(true)}
          className={`fixed bottom-4 right-4 z-[120] p-4 rounded-full bg-black/30 backdrop-blur-xl ring-1 ring-white/20 shadow-lg transition-all duration-300 hover:scale-110 hover:ring-cyan-400/50 ${
            showActivationButton ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          <Bot className="w-6 h-6 text-cyan-400" />
        </button>
      )}
      
      {/* Copilot + Docked Wallet (inside Codex experience) */}
      {copilotOpen && (
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
              onMouseEnter={() => setWalletActionsHovered(true)}
              onMouseLeave={() => setWalletActionsHovered(false)}
            >
            {/* Main Content Area - Chat or MetaAvatar on top */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {copilotMode === 'chat' ? (
                /* Chat Interface */
                <>
                  {/* Chat Messages - scrollable area */}
                  <div className="flex-1 relative">
                    {/* Top divider overlay (keeps messages from rendering above it) */}
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
                        key={idx}
                        ref={
                          msg.role === 'assistant' && idx === chatMessages.length - 1
                            ? lastAssistantMessageRef
                            : undefined
                        }
                        className="scroll-mt-6"
                      >
                      <div
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[90%] px-3 py-2 rounded-xl ring-1 ${
                            msg.role === 'user'
                              ? 'bg-cyan-500/20 text-cyan-100 rounded-br-sm ring-cyan-500/30 text-sm'
                              : 'bg-white/5 text-white/90 rounded-bl-sm ring-white/10'
                          }`}
                        >
                          {msg.role === 'assistant' ? (
                            <>
                              <MarkdownMessage content={msg.content} onQuickLinkClick={handleQuickLinkClick} />
                              {/* Option C (narrow chat only): inline wallet action cards on latest assistant message */}
                              {copilotWidth === 'narrow' && idx === chatMessages.length - 1 && (
                                <div>
                                  {(() => {
                                    const lastUser = [...chatMessages]
                                      .slice(0, idx)
                                      .reverse()
                                      .find(m => m.role === 'user')?.content;
                                    const cards = lastUser ? detectWalletCards(lastUser) : [];
                                    return cards.map(renderWalletActionCard);
                                  })()}
                                </div>
                              )}
                            </>
                          ) : (
                            msg.content
                          )}
                        </div>
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

                  {/* Wallet actions toolbar (chat mode) */}
                  {renderWalletActionsToolbar()}
                  
                  {/* Chat Input */}
                  <div className="p-3 border-t border-white/10">
                    <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 ring-1 ring-white/10">
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder={`Ask ${activePersona === 'kn0w1' ? 'Kn0w1' : 'MoneyPenny'}...`}
                        className="flex-1 bg-transparent text-sm text-white placeholder-white/40 outline-none"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || isLoading}
                        aria-label="Send message"
                        title="Send message"
                        className="p-1.5 rounded-lg text-cyan-400 hover:bg-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Send className="w-4 h-4" />
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
                    {activeContainer !== 'codexCopilot' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-500/5 to-cyan-500/5">
                        <div className="text-center">
                          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 ring-1 ring-white/10 flex items-center justify-center">
                            <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
                          </div>
                          <p className="text-white/60 text-sm">
                            Loading {activePersona === 'kn0w1' ? 'Kn0w1' : 'MoneyPenny'}...
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Wallet actions toolbar (metavatar mode) */}
                  {renderWalletActionsToolbar()}
                  
                  {/* Voice/Text Input for Avatar Mode */}
                  <div className="p-3 border-t border-white/10">
                    <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 ring-1 ring-white/10">
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder={`Speak to ${activePersona === 'kn0w1' ? 'Kn0w1' : 'MoneyPenny'}...`}
                        className="flex-1 bg-transparent text-sm text-white placeholder-white/40 outline-none"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || isLoading}
                        aria-label="Send message"
                        title="Send message"
                        className="p-1.5 rounded-lg text-purple-400 hover:bg-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Bottom Tab Bar - Compact Layout for narrow mode */}
            {/* Layout: [KNYT | Qriptopian] [Chat | MetaVatar] [Collapse] */}
            <div className="flex items-center gap-1 px-2 py-2 bg-black/50 border-t border-white/10 flex-shrink-0">
              {/* Left: Codex Context Toggle */}
              <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5 ring-1 ring-white/10 flex-shrink-0">
                <button
                  onClick={() => setActiveCodex('knyt')}
                  className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-xs transition-all ${
                    activeCodex === 'knyt' 
                      ? 'bg-cyan-500/20 text-cyan-400' 
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  <BookOpen className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setActiveCodex('qriptopian')}
                  className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-xs transition-all ${
                    activeCodex === 'qriptopian' 
                      ? 'bg-purple-500/20 text-purple-400' 
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                </button>
              </div>
              
              {/* Spacer */}
              <div className="flex-1" />
              
              {/* Right: Mode Toggle */}
              <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5 ring-1 ring-white/10 flex-shrink-0">
                <button
                  onClick={() => setCopilotMode('metavatar')}
                  className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-xs transition-all ${
                    copilotMode === 'metavatar' 
                      ? 'bg-purple-500/20 text-purple-400' 
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  <User className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setCopilotMode('chat')}
                  className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-xs transition-all ${
                    copilotMode === 'chat' 
                      ? 'bg-cyan-500/20 text-cyan-400' 
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  <MessageSquare className="w-3 h-3" />
                </button>
              </div>
              
              {/* Right-most: Collapse Button */}
              <button
                onClick={() => setCopilotOpen(false)}
                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 ring-1 ring-white/10 transition-colors flex-shrink-0"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
          </div>

          {/* Docked Smart Wallet panel (embedded) */}
          {walletPanelOpen && !walletPanelCollapsed && (
            <div
              className="rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl w-full md:w-auto h-full md:h-[calc(100vh-100px)] md:max-h-[600px]"
            >
              <WalletDrawer
                isOpen={walletPanelOpen}
                onClose={() => setWalletPanelOpen(false)}
                initialTab={walletPanelTab}
                variant="embedded"
                embeddedWidth="fixed"
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
