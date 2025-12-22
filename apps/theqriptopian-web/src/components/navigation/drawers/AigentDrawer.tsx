import { useState, useRef, useEffect } from "react";
import { X, Send, User, MessageSquare, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMetaAvatar } from "@/contexts/MetaAvatarContext";
import { 
  sendChatMessage, 
  getAgentSystemPrompt,
  type ChatMessage,
  type AigentConfig 
} from "@/lib/aigentiq-client";

interface AigentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AigentDrawer({ isOpen, onClose }: AigentDrawerProps) {
  const [activeTab, setActiveTab] = useState<'nakamoto' | 'know1' | 'moneypenny'>('nakamoto');
  const [viewMode, setViewMode] = useState<'metavatar' | 'chat'>('chat');
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: 'Welcome to Qriptopian! I\'m Nakamoto, your crypto and blockchain intelligence specialist. I can help you discover insights, analyze markets, and explore the world of Web3. How can I assist you today?'
    }
  ]);
  
  // MetaAvatar context for persistent iframe
  const { requestAvatar, releaseAvatar, refreshAvatar, setAgent } = useMetaAvatar();

  // Request/release avatar based on drawer state and view mode
  useEffect(() => {
    if (isOpen && viewMode === 'metavatar') {
      requestAvatar('immersive', activeTab);
    } else {
      releaseAvatar('immersive');
    }
    
    // Cleanup on unmount
    return () => releaseAvatar('immersive');
  }, [isOpen, viewMode, activeTab, requestAvatar, releaseAvatar]);

  // Update agent when tab changes in metavatar mode
  useEffect(() => {
    if (viewMode === 'metavatar') {
      setAgent(activeTab);
    }
  }, [activeTab, viewMode, setAgent]);

  const tabs = [
    { id: 'nakamoto', label: 'Nakamoto', description: 'Qripto and blockchain intelligence specialist' },
    { id: 'know1', label: 'KNOW1', description: 'Knowledge and research intelligence specialist' },
    { id: 'moneypenny', label: 'MoneyPenny', description: 'COYN and Q¢ financial specialist' },
  ];

  const activeAgentData = tabs.find(t => t.id === activeTab);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Update welcome message when switching agents
  useEffect(() => {
    const welcomeMessages: Record<string, string> = {
      nakamoto: "Welcome to Qriptopian! I'm Nakamoto, your crypto and blockchain intelligence specialist. I can help you discover insights, analyze markets, and explore the world of Web3. How can I assist you today?",
      know1: "Hello! I'm KNOW1, your knowledge and research intelligence specialist. I can help you discover information, analyze content, and explore ideas. What would you like to learn about?",
      moneypenny: "Hi there! I'm MoneyPenny, your COYN and Q¢ financial specialist. I can help you understand the Qriptopian token economy and how to participate. What can I help you with?",
    };
    
    setMessages([{
      role: 'assistant',
      content: welcomeMessages[activeTab] || welcomeMessages.nakamoto
    }]);
  }, [activeTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Build chat history for context
      const chatHistory: ChatMessage[] = [
        { role: 'system', content: getAgentSystemPrompt(activeTab) },
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage }
      ];

      const config: AigentConfig = {
        agentId: activeTab,
        tenantId: 'qriptopian',
      };

      const response = await sendChatMessage(chatHistory, config);

      if (response.success && response.message) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: response.message!
        }]);
      } else {
        // Fallback response if API fails
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: response.error 
            ? `I'm having trouble connecting right now. Error: ${response.error}` 
            : "I understand your question. Let me help you with that... (Note: Running in offline mode)"
        }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm experiencing some technical difficulties. Please try again in a moment."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className={`fixed right-[80px] top-[88px] h-[calc(100vh-88px)] w-[calc(100vw-160px)] bg-background/80 backdrop-blur-xl border-l border-border/30 shadow-[0_0_60px_rgba(0,0,0,0.5)] z-50 overflow-hidden flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="flex-shrink-0 border-b border-border/30 bg-background/60 backdrop-blur-sm">
          <div className="p-6 flex items-center justify-between gap-4">
            <div className="flex-shrink-0">
              <h2 className="text-2xl font-bold text-foreground mb-1">{activeAgentData?.label}</h2>
              <p className="text-sm text-muted-foreground">{activeAgentData?.description}</p>
            </div>
            
            <div className="flex items-center gap-6">
              {/* Tabs */}
              <div className="flex gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 text-sm font-medium transition-all whitespace-nowrap border-b-2 ${
                      activeTab === tab.id
                        ? 'text-primary border-primary'
                        : 'text-muted-foreground border-transparent hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* View Mode Toggle */}
              <TooltipProvider>
                <div className="flex items-center gap-2 bg-background/20 backdrop-blur-md rounded-lg p-1 border border-border/20">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setViewMode('metavatar')}
                        aria-label="Switch to metaVatar mode"
                        className={`px-2 py-1.5 text-xs font-medium rounded transition-all ${
                          viewMode === 'metavatar'
                            ? 'text-cyan-400'
                            : 'text-muted-foreground hover:text-foreground hover:bg-background/10'
                        }`}
                      >
                        <User className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>metaVatar Mode</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setViewMode('chat')}
                        aria-label="Switch to text chat mode"
                        className={`px-2 py-1.5 text-xs font-medium rounded transition-all ${
                          viewMode === 'chat'
                            ? 'text-cyan-400'
                            : 'text-muted-foreground hover:text-foreground hover:bg-background/10'
                        }`}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Text Mode</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent/50 ml-4"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {viewMode === 'metavatar' ? (
            /* MetaAvatar is rendered globally in Layout.tsx
               This area becomes transparent to show the avatar behind it
               The avatar is positioned via CSS based on 'immersive' container type */
            <div className="flex-1 flex flex-col items-center justify-end p-6 pb-24">
              {/* Refresh button for avatar */}
              <Button
                variant="outline"
                size="sm"
                onClick={refreshAvatar}
                className="bg-background/60 backdrop-blur-sm border-border/30 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Avatar
              </Button>
            </div>
          ) : (
            <>
              {/* Chat Messages */}
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-4 max-w-4xl mx-auto">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-4 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/50 text-foreground'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted/50 text-foreground rounded-lg p-4">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">
                            {activeAgentData?.label} is thinking...
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
              </ScrollArea>

              {/* Chat Input */}
              <div className="flex-shrink-0 border-t border-border/30 bg-background/60 p-6">
                <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
                  <div className="flex gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={`Ask ${tabs.find(t => t.id === activeTab)?.label}...`}
                      className="flex-1 bg-muted/30 border-border/30"
                    />
                    <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
