"use client";
import { useState } from "react";
import { Button } from "./ui/Button";
import { Textarea } from "./ui/Textarea";

interface Persona {
  key: string;
  title: string;
  systemPrompt: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ContextPanel({ persona }: { persona: Persona }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
            Context Transformation ready — persona: <b>{persona.title}</b>
            <p className="mt-2 text-sm">System prompt: {persona.systemPrompt}</p>
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
