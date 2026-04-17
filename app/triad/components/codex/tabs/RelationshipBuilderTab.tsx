"use client";

/**
 * RelationshipBuilderTab — Venture Lab α showcase surface
 *
 * Surfaces the QubeTalk agent messaging channel as the primary relationship
 * signal — showing how Aigent Z, Codex, and Claude Code coordinate in real time.
 * Partner connections from the CRM are the secondary panel.
 *
 * This is the foundation for the full Relationship Builder surface; the
 * QubeTalk feed is the headline showcase per VL workstream direction.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  Bot,
  Clock,
  Filter,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Shield,
  Users,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedMessage {
  id: string;
  fromAgent: string;
  fromAgentLabel: string;
  thread: string;
  title: string;
  body: string;
  severity: "info" | "warn" | "blocker";
  source: "bridge" | "live";
  createdAt: string;
  metadata?: Record<string, unknown>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const THREAD_OPTIONS = [
  { value: "", label: "All threads" },
  { value: "dev-exec",   label: "dev-exec" },
  { value: "spec",       label: "spec" },
  { value: "api-wiring", label: "api-wiring" },
  { value: "ui-shell",   label: "ui-shell" },
  { value: "ops",        label: "ops" },
];

const SEVERITY_STYLES: Record<string, string> = {
  info:    "border-sky-800/40 text-sky-300",
  warn:    "border-amber-800/40 text-amber-300",
  blocker: "border-red-800/40 text-red-300",
};

const AGENT_COLOURS: Record<string, string> = {
  "claude-code":    "bg-violet-900/40 text-violet-300 border-violet-800/50",
  "openai-codex":   "bg-blue-900/40 text-blue-300 border-blue-800/50",
  "aigent-z":       "bg-amber-900/40 text-amber-300 border-amber-800/50",
  "aigent-marketa": "bg-emerald-900/40 text-emerald-300 border-emerald-800/50",
};

function agentStyle(agentId: string) {
  return AGENT_COLOURS[agentId] ?? "bg-slate-800/60 text-slate-300 border-slate-700";
}

function agentInitial(label: string) {
  return label.charAt(0).toUpperCase();
}

function relativeTime(iso: string) {
  const delta = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(delta / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Message card ─────────────────────────────────────────────────────────────

function MessageCard({ msg }: { msg: FeedMessage }) {
  const [expanded, setExpanded] = useState(false);
  const hasBody = msg.body.trim().length > 0;
  const bodyPreview = msg.body.slice(0, 140);
  const truncated = msg.body.length > 140;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] hover:border-white/10 transition-colors p-3 space-y-2">
      {/* Header row */}
      <div className="flex items-start gap-2">
        <div className={`h-7 w-7 shrink-0 rounded-full border flex items-center justify-center text-xs font-bold ${agentStyle(msg.fromAgent)}`}>
          {agentInitial(msg.fromAgentLabel)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-200">{msg.fromAgentLabel}</span>
            <Badge variant="outline" className={`text-[9px] py-0 px-1.5 ${SEVERITY_STYLES[msg.severity] ?? SEVERITY_STYLES.info}`}>
              {msg.thread}
            </Badge>
            {msg.source === "live" && (
              <span className="text-[9px] text-emerald-400 font-medium">● live</span>
            )}
          </div>
          <p className="text-xs font-medium text-slate-100 mt-0.5 leading-snug">{msg.title}</p>
        </div>
        <span className="text-[10px] text-slate-600 shrink-0 flex items-center gap-0.5">
          <Clock className="h-2.5 w-2.5" />
          {relativeTime(msg.createdAt)}
        </span>
      </div>

      {/* Body */}
      {hasBody && (
        <div
          className="text-[11px] text-slate-400 leading-relaxed cursor-pointer"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? msg.body : bodyPreview}
          {!expanded && truncated && (
            <span className="text-sky-500 ml-1">…read more</span>
          )}
          {expanded && truncated && (
            <span className="text-sky-500 ml-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); setExpanded(false); }}>
              collapse
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

interface RelationshipBuilderTabProps {
  personaId?: string;
  theme?: "light" | "dark";
}

export function RelationshipBuilderTab({ personaId }: RelationshipBuilderTabProps) {
  const [feed,      setFeed]      = useState<FeedMessage[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [sources,   setSources]   = useState<{ bridge: number; live: number }>({ bridge: 0, live: 0 });
  const [thread,    setThread]    = useState("");
  const [composing, setComposing] = useState(false);
  const [draft,     setDraft]     = useState("");
  const [sending,   setSending]   = useState(false);

  const load = useCallback(async (selectedThread: string) => {
    setLoading(true);
    try {
      const url = selectedThread
        ? `/api/codex/venture-lab/feed?thread=${selectedThread}&limit=30`
        : "/api/codex/venture-lab/feed?limit=30";
      const res = await fetch(url);
      const json = await res.json();
      if (json.ok) {
        setFeed(json.data.feed ?? []);
        setSources(json.data.sources ?? { bridge: 0, live: 0 });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(thread); }, [load, thread]);

  const handleSend = useCallback(async () => {
    if (!draft.trim() || !personaId) return;
    setSending(true);
    try {
      await fetch("/api/marketa/qubetalk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-persona-id": personaId,
        },
        body: JSON.stringify({
          channel_id: "venture-lab",
          tenant_id: "nakamoto",
          message: draft,
          recipient_agent: "aigent-z",
        }),
      });
      setDraft("");
      setComposing(false);
      await load(thread);
    } catch {
      // best-effort
    } finally {
      setSending(false);
    }
  }, [draft, personaId, thread, load]);

  const liveCount = sources.live;

  return (
    <div className="p-4 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-violet-400" />
            Relationship Builder
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Agent coordination channel · {feed.length} messages
            {liveCount > 0 && (
              <span className="text-emerald-400 ml-1.5">· {liveCount} live</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {personaId && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px] border-violet-800/50 text-violet-300 hover:bg-violet-500/10"
              onClick={() => setComposing((c) => !c)}
            >
              <Send className="h-3 w-3 mr-1" />
              Message
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => void load(thread)}
            disabled={loading}
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Thread filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Filter className="h-3 w-3 text-slate-600" />
        {THREAD_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setThread(value)}
            className={`text-[10px] rounded-full px-2.5 py-0.5 border transition-colors ${
              thread === value
                ? "border-violet-600 bg-violet-500/10 text-violet-300"
                : "border-white/10 text-slate-500 hover:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Compose */}
      {composing && (
        <div className="rounded-xl border border-violet-800/40 bg-violet-950/10 p-3 space-y-2">
          <textarea
            className="w-full bg-transparent text-xs text-slate-200 placeholder:text-slate-600 resize-none outline-none border-b border-white/[0.06] pb-2"
            placeholder="Message Aigent Z on the venture-lab channel…"
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setComposing(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-6 text-[11px] bg-violet-600 hover:bg-violet-500"
              disabled={!draft.trim() || sending}
              onClick={handleSend}
            >
              {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
              Send
            </Button>
          </div>
        </div>
      )}

      {/* Agent legend */}
      <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-600">
        <span>Agents:</span>
        {[
          { id: "claude-code",    label: "Claude Code" },
          { id: "aigent-z",       label: "Aigent Z" },
          { id: "aigent-marketa", label: "Marketa" },
        ].map(({ id, label }) => (
          <span key={id} className={`rounded-full border px-2 py-0.5 ${agentStyle(id)}`}>
            {label}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-1">
          <Bot className="h-2.5 w-2.5" />
          {sources.bridge} bridge · {sources.live} live
        </span>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex items-center justify-center py-10 gap-2 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading feed…</span>
        </div>
      ) : feed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-600">
          <MessageSquare className="h-8 w-8 opacity-30" />
          <p className="text-sm">No messages in this thread yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {feed.map((msg) => (
            <MessageCard key={msg.id} msg={msg} />
          ))}
        </div>
      )}

      {/* Info footer */}
      <div className="rounded-lg border border-slate-800/60 bg-slate-900/30 p-3 flex items-start gap-2.5">
        <Shield className="h-3.5 w-3.5 text-slate-600 mt-0.5 shrink-0" />
        <div className="text-[10px] text-slate-600 space-y-0.5">
          <p>Bridge packets are committed agent coordination messages — Claude Code → Codex/Lovable handoffs.</p>
          <p>Live messages are from the QubeTalk real-time channel. Compose requires a CRM persona.</p>
        </div>
      </div>

      {/* Partner connections placeholder — grows into full Relationship Builder */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/20 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-[11px] font-semibold text-slate-400">Partner Connections</span>
          <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-600 ml-auto">
            Coming next
          </Badge>
        </div>
        <p className="text-[10px] text-slate-600">
          CRM partner and collaborator persona graph — visualising the relationship network across the KNYT and AgentiQ ecosystem.
          QubeTalk threads above are the live coordination layer for these relationships.
        </p>
        <div className="flex items-center gap-1.5 mt-2">
          <Zap className="h-3 w-3 text-amber-600" />
          <span className="text-[10px] text-amber-700">Wired to CRM personas · OrgQube governance next</span>
        </div>
      </div>
    </div>
  );
}
