import { useState } from "react";
import { X, Send, Search, Mic } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AIOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AIOverlay({ isOpen, onClose }: AIOverlayProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string }>>([
    {
      role: 'assistant',
      content: 'Welcome to The Qriptopian AI! I can help you discover insights, analyze markets, and explore content. Try asking me about specific topics or strategies.',
      timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    }
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const timestamp = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    setMessages(prev => [...prev, { role: 'user', content: input, timestamp }]);
    setInput("");

    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `I received your message: "${input}"`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      }]);
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* AI Drawer - matches other drawer positioning */}
      <div 
        className={`fixed right-[80px] top-[88px] h-[calc(100vh-88px)] w-[600px] bg-background/80 backdrop-blur-xl border-l border-border/30 shadow-[0_0_60px_rgba(0,0,0,0.5)] z-50 flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header Section */}
        <div className="flex-shrink-0 border-b border-border/30 bg-background/60 backdrop-blur-sm">
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-[0_0_20px_rgba(94,234,212,0.5)]">
                <span className="text-lg font-bold text-background">AI</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Qriptopian AI</h3>
                <p className="text-xs text-muted-foreground">Ask me anything</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground hover:bg-accent/50 relative z-10"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className="space-y-1">
              <div
                className={`inline-block max-w-[85%] px-4 py-3 rounded-xl ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-primary/30 to-primary/20 text-foreground ml-auto float-right clear-both border border-primary/30'
                    : 'bg-card/90 text-foreground border border-border/50'
                }`}
              >
                <p className="text-sm leading-relaxed">{msg.content}</p>
              </div>
              {msg.timestamp && (
                <div className={`text-xs text-muted-foreground ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  {msg.timestamp}
                </div>
              )}
              <div className="clear-both" />
            </div>
          ))}
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-border/30 bg-background/60 backdrop-blur-sm">
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-2 bg-card/50 border border-border/30 rounded-lg px-4 py-2.5">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Search className="h-4 w-4" />
              </button>
              
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about The Qriptopian..."
                className="flex-1 border-0 bg-transparent text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Mic className="h-4 w-4" />
                </button>
                <Button
                  type="submit"
                  size="icon"
                  className="h-8 w-8 bg-gradient-to-br from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-background shadow-[0_0_15px_rgba(94,234,212,0.4)]"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
