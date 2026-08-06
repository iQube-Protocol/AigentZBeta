/**
 * MoneyPenny Chat Component
 * 
 * AI-powered trading assistant interface
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Brain } from "lucide-react";
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <div className="text-xs uppercase tracking-wider text-white/60 mb-1">MoneyPenny Chat</div>
        <p className="text-[11px] text-white/40">
          Ask questions about your portfolio, trading strategies, and market insights
        </p>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 pr-2 overflow-y-auto"
      >
        <div className="space-y-2">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <Brain className="h-8 w-8 mx-auto text-white/40 mb-3" />
              <p className="text-[11px] text-white/60">
                Ask about portfolio, quotes, strategies, or risk assessment
              </p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-2.5 text-xs ${
                    message.role === 'user'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-black/20 border border-white/10 text-white/90'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-black/20 border border-white/10 rounded-lg p-2.5">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
                  <span className="text-xs text-white/80">Thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask MoneyPenny..."
          disabled={isLoading}
          className="flex-1 rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-white/90 placeholder:text-white/40 outline-none focus:border-emerald-500/30 focus:bg-white/10"
        />
        <button
          onClick={handleSendMessage}
          disabled={!input.trim() || isLoading}
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

export default MoneyPennyChat;
