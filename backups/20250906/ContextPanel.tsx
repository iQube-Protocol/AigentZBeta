"use client";
import { useState, useEffect } from "react";
import { Button } from "./ui/Button";
import { Textarea } from "./ui/Textarea";
import { Brain, Wrench } from "lucide-react";

interface Persona {
  key: string;
  title: string;
  systemPrompt: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ActiveIQube {
  name: string;
  type: "model" | "tool";
  color: string;
}

export function ContextPanel({ persona }: { persona: Persona }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeIQubes, setActiveIQubes] = useState<ActiveIQube[]>([]);

  // Load active iQubes from localStorage on mount
  useEffect(() => {
    const loadActiveIQubes = () => {
      try {
        const savedToggleStates = localStorage.getItem('toggleStates');
        if (savedToggleStates) {
          const toggleStates = JSON.parse(savedToggleStates);
          const active: ActiveIQube[] = [];
          
          // Check for active iQubes based on toggle states
          if (toggleStates['#openai']) {
            active.push({ name: 'OpenAI', type: 'model', color: 'text-emerald-400' });
          }
          if (toggleStates['#venice']) {
            active.push({ name: 'Venice AI', type: 'model', color: 'text-indigo-400' });
          }
          if (toggleStates['#chaingpt']) {
            active.push({ name: 'ChainGPT', type: 'model', color: 'text-purple-400' });
          }
          if (toggleStates['#google-workspace']) {
            active.push({ name: 'Google Workspace', type: 'tool', color: 'text-blue-500' });
          }
          
          setActiveIQubes(active);
        }
      } catch (error) {
        console.error('Error loading active iQubes:', error);
      }
    };

    loadActiveIQubes();
    
    // Listen for storage changes to update active iQubes in real-time
    const handleStorageChange = () => {
      loadActiveIQubes();
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events when toggles change within the same window
    window.addEventListener('iQubeToggleChanged', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('iQubeToggleChanged', handleStorageChange);
    };
  }, []);

  async function send() {
    if (!input.trim()) return;
    
    const userMessage = { role: "user" as const, content: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    
    try {
      // Call the API endpoint to get a response from the AI
      const res = await fetch("/api/aigent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          persona: persona.key,
          messages: updatedMessages
        }),
      });
      
      if (!res.ok) {
        throw new Error("Failed to get response");
      }
      
      const data = await res.json();
      setMessages([
        ...updatedMessages,
        { role: "assistant", content: data.reply || "(No response received)" }
      ]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages([
        ...updatedMessages,
        { role: "assistant", content: "Sorry, there was an error processing your request. Please try again." }
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="grid grid-rows-[1fr_auto] gap-4 h-[72vh]">
      <div className="rounded-2xl bg-black/30 ring-1 ring-white/10 p-4 overflow-auto space-y-3">
        {messages.length === 0 && (
          <div className="text-slate-400">
            <div className="flex items-center justify-between mb-3">
              <div>
                Context Transformation ready — persona: <b>{persona.title}</b>
              </div>
              {activeIQubes.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider text-slate-500">Active iQubes:</span>
                  <div className="flex gap-1">
                    {activeIQubes.map((iqube, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 ring-1 ring-white/10"
                      >
                        {iqube.type === 'model' ? (
                          <Brain size={12} className={iqube.color} />
                        ) : (
                          <Wrench size={12} className={iqube.color} />
                        )}
                        <span className={`text-xs ${iqube.color}`}>{iqube.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <p className="mt-2 text-sm">System prompt: {persona.systemPrompt}</p>
            {activeIQubes.length > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-white/5 ring-1 ring-white/10">
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Enhanced Capabilities</div>
                <div className="text-sm text-slate-300">
                  This orchestrator is enhanced with {activeIQubes.filter(q => q.type === 'model').length > 0 && 
                    `${activeIQubes.filter(q => q.type === 'model').map(q => q.name).join(', ')} AI models`}
                  {activeIQubes.filter(q => q.type === 'model').length > 0 && activeIQubes.filter(q => q.type === 'tool').length > 0 && ' and '}
                  {activeIQubes.filter(q => q.type === 'tool').length > 0 && 
                    `${activeIQubes.filter(q => q.type === 'tool').map(q => q.name).join(', ')} integration${activeIQubes.filter(q => q.type === 'tool').length > 1 ? 's' : ''}`}
                  .
                </div>
              </div>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`p-3 rounded-xl ${m.role === "user" ? "bg-white/10" : "bg-white/5"}`}>
            <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">{m.role}</div>
            <div className="whitespace-pre-wrap">{m.content}</div>
          </div>
        ))}
        {isLoading && (
          <div className="p-3 rounded-xl bg-white/5">
            <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">assistant</div>
            <div className="flex items-center space-x-2">
              <div className="animate-pulse h-2 w-2 bg-indigo-400 rounded-full"></div>
              <div className="animate-pulse h-2 w-2 bg-indigo-400 rounded-full animation-delay-200"></div>
              <div className="animate-pulse h-2 w-2 bg-indigo-400 rounded-full animation-delay-400"></div>
            </div>
          </div>
        )}
      </div>
      <div className="rounded-2xl bg-black/30 ring-1 ring-white/10 p-3">
        <div className="flex gap-3 items-end">
          <Textarea 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${persona.title}…`} 
            className="min-h-[68px]" 
          />
          <Button 
            onClick={send} 
            disabled={isLoading || !input.trim()}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
