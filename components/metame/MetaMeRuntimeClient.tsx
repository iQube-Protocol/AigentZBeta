"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, Sparkles, Play, Headphones, BookOpen, Gamepad2, Gift, RefreshCw, ChevronDown, Cpu } from "lucide-react";

// LLM Provider Types
type LLMProvider = {
  id: string;
  name: string;
  model: string;
  icon: React.ReactNode;
};

// Content Types
type ContentType = 'video' | 'podcast' | 'article' | 'reward' | 'experience';

type ContentQube = {
  id: string;
  type: ContentType;
  title: string;
  description: string;
  thumbnail?: string;
  reward?: string;
};

// Mock LLM Providers
const LLM_PROVIDERS: LLMProvider[] = [
  {
    id: 'openai-gpt4',
    name: 'OpenAI',
    model: 'GPT-4',
    icon: <Cpu className="h-4 w-4" />
  },
  {
    id: 'anthropic-claude',
    name: 'Anthropic',
    model: 'Claude-3',
    icon: <Cpu className="h-4 w-4" />
  },
  {
    id: 'google-gemini',
    name: 'Google',
    model: 'Gemini',
    icon: <Cpu className="h-4 w-4" />
  }
];

// Mock Content Qubes
const MOCK_CONTENT_QUBES: ContentQube[] = [
  {
    id: '1',
    type: 'video',
    title: 'Introduction to AI',
    description: 'Learn the fundamentals of artificial intelligence',
    reward: '5 KNYT'
  },
  {
    id: '2',
    type: 'podcast',
    title: 'Tech Talks Daily',
    description: 'Latest insights from technology leaders',
    reward: '3 KNYT'
  },
  {
    id: '3',
    type: 'article',
    title: 'Web3 Explained',
    description: 'Understanding decentralized web technologies',
    reward: '2 KNYT'
  }
];

// Quick Actions
const QUICK_ACTIONS = [
  { id: 'watch', icon: <Play className="h-4 w-4" />, prompt: "I'd like to watch...", color: "bg-red-500/20 text-red-300 border-red-500/30" },
  { id: 'listen', icon: <Headphones className="h-4 w-4" />, prompt: "I want to listen to...", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  { id: 'read', icon: <BookOpen className="h-4 w-4" />, prompt: "I'd like to read...", color: "bg-green-500/20 text-green-300 border-green-500/30" },
  { id: 'play', icon: <Gamepad2 className="h-4 w-4" />, prompt: "I want to play...", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  { id: 'find', icon: <Search className="h-4 w-4" />, prompt: "Help me find...", color: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  { id: 'earn', icon: <Gift className="h-4 w-4" />, prompt: "How can I earn...", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" }
];

export default function MetaMeRuntimeClient() {
  const [mounted, setMounted] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [selectedProvider, setSelectedProvider] = useState(LLM_PROVIDERS[0]);
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [currentQubeIndex, setCurrentQubeIndex] = useState(0);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [lastInteractionTime, setLastInteractionTime] = useState(Date.now());
  const [contextCopy, setContextCopy] = useState('');
  
  const autoScrollRef = useRef<NodeJS.Timeout | null>(null);
  const dormancyRef = useRef<NodeJS.Timeout | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-scroll logic
  useEffect(() => {
    if (showContent && MOCK_CONTENT_QUBES.length > 1) {
      const startAutoScroll = () => {
        setIsAutoScrolling(true);
        autoScrollRef.current = setInterval(() => {
          setCurrentQubeIndex((prev) => (prev + 1) % MOCK_CONTENT_QUBES.length);
        }, 5000); // Auto-scroll every 5 seconds
      };

      const pauseAutoScroll = () => {
        setIsAutoScrolling(false);
        if (autoScrollRef.current) {
          clearInterval(autoScrollRef.current);
          autoScrollRef.current = null;
        }
        if (dormancyRef.current) {
          clearTimeout(dormancyRef.current);
          dormancyRef.current = null;
        }
      };

      const setupDormancyTimer = () => {
        if (dormancyRef.current) {
          clearTimeout(dormancyRef.current);
        }
        dormancyRef.current = setTimeout(() => {
          startAutoScroll();
        }, 4000); // Resume after 4 seconds of inactivity
      };

      if (isAutoScrolling) {
        startAutoScroll();
      }

      // Set up dormancy timer whenever interaction time updates
      if (!isAutoScrolling && showContent) {
        setupDormancyTimer();
      }

      return () => {
        pauseAutoScroll();
      };
    }
  }, [showContent, isAutoScrolling, lastInteractionTime]);

  const handlePromptSubmit = () => {
    if (prompt.trim()) {
      generateContent(prompt);
    }
  };

  const handleQuickAction = (actionPrompt: string) => {
    setPrompt(actionPrompt);
    generateContent(actionPrompt);
  };

  const generateContent = (userPrompt: string) => {
    // Generate contextual copy based on prompt
    let context = '';
    if (userPrompt.includes('watch')) {
      context = 'Here are some videos you can watch';
    } else if (userPrompt.includes('listen')) {
      context = 'Here are some podcasts you can listen to';
    } else if (userPrompt.includes('read')) {
      context = 'Here are some articles you can read';
    } else if (userPrompt.includes('play')) {
      context = 'Here are some games you can play';
    } else if (userPrompt.includes('find')) {
      context = 'Here are some things we found for you';
    } else if (userPrompt.includes('earn')) {
      context = 'Here are some rewards you can earn';
    } else {
      context = 'Here are some experiences you can try';
    }
    
    setContextCopy(context);
    setShowContent(true);
    setIsAutoScrolling(true);
  };

  const handleRefresh = () => {
    setShowContent(false);
    setPrompt('');
    setContextCopy('');
    setCurrentQubeIndex(0);
    setIsAutoScrolling(false);
  };

  const handleCarouselInteraction = useCallback(() => {
    setLastInteractionTime(Date.now());
    setIsAutoScrolling(false);
  }, []);

  const handleProviderSelect = (provider: LLMProvider) => {
    setSelectedProvider(provider);
    setShowProviderDropdown(false);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-sm text-slate-400">Loading metaMe Runtime…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-xl border-b border-slate-800/50 px-6 py-4">
        <div className="flex items-center justify-between">
          {/* LLM Provider Badge */}
          <div className="relative">
            <button
              onClick={() => setShowProviderDropdown(!showProviderDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-800/70 border border-slate-700/50 rounded-lg transition-all duration-200"
            >
              {selectedProvider.icon}
              <span className="text-sm font-medium">{selectedProvider.name} {selectedProvider.model}</span>
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showProviderDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {showProviderDropdown && (
              <div className="absolute top-full mt-2 left-0 bg-slate-800/95 backdrop-blur-xl border border-slate-700/50 rounded-lg shadow-xl z-50 min-w-[200px]">
                {LLM_PROVIDERS.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => handleProviderSelect(provider)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/50 transition-colors duration-200 first:rounded-t-lg last:rounded-b-lg"
                  >
                    {provider.icon}
                    <div className="text-left">
                      <div className="text-sm font-medium">{provider.name}</div>
                      <div className="text-xs text-slate-400">{provider.model}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Trust Indicators */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Sparkles className="h-3 w-3 text-green-400" />
              <span>Connected</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span>Secure</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden">
        {/* Welcome Screen */}
        <div className={`absolute inset-0 flex flex-col items-center justify-center px-6 transition-all duration-400 ${showContent ? 'opacity-0 -translate-y-full' : 'opacity-100 translate-y-0'}`}>
          <div className="max-w-2xl w-full space-y-8">
            {/* Welcome Copy */}
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Welcome to metaMe
              </h1>
              <p className="text-xl text-slate-300">
                What would you like to build today?
              </p>
            </div>

            {/* Prompt Input */}
            <div className="relative">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handlePromptSubmit()}
                placeholder="Describe what you'd like to do"
                className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
              />
              <button
                onClick={handlePromptSubmit}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200"
              >
                <Search className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Screen */}
        <div className={`absolute inset-0 transition-all duration-400 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'}`}>
          {showContent && (
            <div className="h-full flex flex-col">
              {/* Context Copy */}
              <div className="px-6 py-4">
                <h2 className="text-2xl font-semibold text-center">{contextCopy}</h2>
              </div>

              {/* Content Carousel */}
              <div className="flex-1 relative">
                <div 
                  ref={carouselRef}
                  className="h-full overflow-hidden"
                  onMouseDown={handleCarouselInteraction}
                  onTouchStart={handleCarouselInteraction}
                  onWheel={handleCarouselInteraction}
                >
                  <div 
                    className="flex h-full transition-transform duration-400 ease-in-out"
                    style={{ transform: `translateX(-${currentQubeIndex * 100}%)` }}
                  >
                    {MOCK_CONTENT_QUBES.map((qube, index) => (
                      <div key={qube.id} className="w-full flex-shrink-0 flex items-center justify-center px-6">
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 max-w-md w-full">
                          <div className="flex items-center gap-3 mb-4">
                            <div className={`p-2 rounded-lg ${QUICK_ACTIONS.find(a => a.id === qube.type)?.color || 'bg-slate-700/50'}`}>
                              {QUICK_ACTIONS.find(a => a.id === qube.type)?.icon}
                            </div>
                            <span className="text-sm text-slate-400 capitalize">{qube.type}</span>
                          </div>
                          <h3 className="text-xl font-semibold mb-2">{qube.title}</h3>
                          <p className="text-slate-300 mb-4">{qube.description}</p>
                          {qube.reward && (
                            <div className="flex items-center gap-2 text-sm text-yellow-400">
                              <Gift className="h-4 w-4" />
                              <span>{qube.reward}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Carousel Indicators */}
                {MOCK_CONTENT_QUBES.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {MOCK_CONTENT_QUBES.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setCurrentQubeIndex(index);
                          handleCarouselInteraction();
                        }}
                        className={`w-2 h-2 rounded-full transition-all duration-200 ${
                          index === currentQubeIndex 
                            ? 'bg-blue-400 w-8' 
                            : 'bg-slate-600 hover:bg-slate-500'
                        }`}
                      />
                    ))}
                  </div>
                )}

                {/* Auto-scroll Indicator */}
                {isAutoScrolling && (
                  <div className="absolute top-4 right-4 flex items-center gap-2 text-xs text-slate-400">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                    <span>Auto-scrolling</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Floating Quick Actions */}
        {!showContent && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-wrap gap-3 justify-center max-w-2xl px-6">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action.prompt)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 hover:scale-105 ${action.color}`}
              >
                {action.icon}
                <span className="text-sm font-medium">{action.prompt}</span>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Bottom Menu */}
      <footer className="bg-slate-900/50 backdrop-blur-xl border-t border-slate-800/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-xs text-slate-400">
              Runtime v1.0
            </div>
            {showContent && (
              <button
                onClick={handleRefresh}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-800/70 border border-slate-700/50 rounded-lg transition-all duration-200"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="text-sm">Clear</span>
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-xs text-slate-400">
              Powered by {selectedProvider.name}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
