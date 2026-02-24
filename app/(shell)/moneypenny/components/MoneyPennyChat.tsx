/**
 * MoneyPenny Chat Component
 * 
 * AI-powered trading assistant interface
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, Brain, BarChart3, Target, Zap, UserCircle, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function MoneyPennyChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const quickActions = [
    { id: 'portfolio', label: 'Show Portfolio', icon: BarChart3, prompt: 'Show me my current portfolio performance and P&L' },
    { id: 'quotes', label: 'Get Quotes', icon: Search, prompt: 'What are the current best quotes across all chains?' },
    { id: 'strategy', label: 'Analyze Strategy', icon: Target, prompt: 'Analyze my current trading strategy and suggest optimizations' },
    { id: 'risk', label: 'Risk Assessment', icon: Brain, prompt: 'What are my current risk exposures and how can I mitigate them?' },
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const streamChat = async (userMessage: string) => {
    const CHAT_URL = `${process.env.NEXT_PUBLIC_AIGENT_API_URL}/api/moneypenny/chat`;
    
    const chatMessages = [
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: userMessage }
    ];

    try {
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: chatMessages,
          agent_class: 'moneypenny',
          tenant_id: 'qripto-hft',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.response || 'I apologize, but I encountered an error processing your request.';
    } catch (error) {
      console.error('Chat API error:', error);
      return 'I apologize, but I\'m having trouble connecting to my trading analysis systems right now. Please try again in a moment.';
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const assistantResponse = await streamChat(userMessage.content);
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: assistantResponse,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      toast({
        title: "Chat Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (action: typeof quickActions[0]) => {
    setInput(action.prompt);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0 h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-emerald-400" />
          MoneyPenny AI Assistant
        </CardTitle>
        <CardDescription className="text-white/60">
          Your AI-powered trading assistant for strategy analysis and market insights
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col space-y-4">
        {/* Quick Actions */}
        {messages.length === 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction(action)}
                  className="flex items-center gap-2 h-auto p-3 bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/30 transition-all"
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-xs">{action.label}</span>
                </Button>
              );
            })}
          </div>
        )}

        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 pr-4 overflow-y-auto max-h-96"
        >
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <Brain className="h-12 w-12 mx-auto text-white/40 mb-4" />
                <p className="text-white/60">
                  Hello! I'm MoneyPenny, your AI trading assistant. I can help you with:
                </p>
                <ul className="text-sm text-white/60 mt-2 space-y-1">
                  <li>• Portfolio analysis and performance tracking</li>
                  <li>• Real-time market quotes and opportunities</li>
                  <li>• Trading strategy optimization</li>
                  <li>• Risk assessment and mitigation</li>
                </ul>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-white/5 border border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {message.role === 'assistant' && <Brain className="h-4 w-4 text-emerald-400" />}
                      <span className="text-xs font-medium">
                        {message.role === 'user' ? 'You' : 'MoneyPenny'}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap text-white/90">{message.content}</p>
                    <div className="text-xs opacity-70 mt-1 text-white/60">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                    <span className="text-sm text-white/80">MoneyPenny is thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about your portfolio, strategies, or market conditions..."
            disabled={isLoading}
            className="flex-1 bg-white/5 border-white/10 text-white/90 placeholder:text-white/40 focus:border-emerald-500/30 focus:bg-white/10"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
