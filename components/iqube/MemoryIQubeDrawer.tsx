"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Bot, ChevronDown, ChevronUp, Loader2, X } from "lucide-react";

// ─── Auth helper (same pattern as PersonaIQubeDrawer / IdentityIQubeDrawer) ──

function getAccessTokenFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.includes("auth-token")) {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const token =
          parsed.access_token ??
          (parsed as Record<string, { access_token?: unknown }>).currentSession?.access_token;
        if (typeof token === "string" && token) return token;
      }
    }
  } catch { /* ignore */ }
  return null;
}

function authHeaders(): Record<string, string> {
  const token = getAccessTokenFromStorage();
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

// ─── Types ────────────────────────────────────────────────────────────────────

type InteractionType = "aigent" | "earn" | "learn" | "connect";

interface Interaction {
  id: string;
  query: string;
  response: string;
  interaction_type: InteractionType;
  metadata: {
    activePersona?: string | null;
    conversationId?: string;
    agentType?: string;
    modelUsed?: string;
    aiProvider?: string;
    intent?: string;
    [key: string]: unknown;
  } | null;
  created_at: string;
}

interface Summary {
  id: string;
  conversation_type: string;
  summary_text: string;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHANNEL_TABS: { id: "all" | InteractionType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "aigent", label: "Aigent" },
  { id: "earn", label: "Earn" },
  { id: "learn", label: "Learn" },
  { id: "connect", label: "Connect" },
];

const AGENT_LABELS: Record<string, string> = {
  "aigent-z": "Aigent Z",
  "aigent-kn0w1": "Kn0w1",
  "aigent-moneypenny": "MoneyPenny",
  "aigent-nakamoto": "Nakamoto",
  "aigent-marketa": "Marketa",
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PersonaPill({ persona }: { persona: string | null | undefined }) {
  if (!persona) return null;
  const colors: Record<string, string> = {
    KNYT: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    Qripto: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    Anon: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  };
  const colorClass = colors[persona] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${colorClass}`}>
      {persona}
    </span>
  );
}

function InteractionCard({ item }: { item: Interaction }) {
  const [expanded, setExpanded] = useState(false);
  const TRUNCATE = 200;
  const isLong = item.response.length > TRUNCATE;
  const agentLabel = item.metadata?.agentType
    ? (AGENT_LABELS[item.metadata.agentType] ?? item.metadata.agentType)
    : "Aigent";

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/8 bg-slate-900/60 p-3">
      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <PersonaPill persona={item.metadata?.activePersona} />
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 border border-indigo-500/25 px-2 py-0.5 text-[10px] text-indigo-300">
          <Bot className="h-2.5 w-2.5" />{agentLabel}
        </span>
        {item.metadata?.modelUsed && (
          <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-slate-400">
            {item.metadata.modelUsed}
          </span>
        )}
        <span className="ml-auto text-[10px] text-slate-500">{formatRelative(item.created_at)}</span>
      </div>

      {/* User query */}
      <div className="rounded-lg bg-indigo-600/20 border border-indigo-500/20 px-3 py-2">
        <p className="text-xs text-slate-200 leading-relaxed">{item.query}</p>
      </div>

      {/* Agent response */}
      <div className="rounded-lg bg-slate-800/60 border border-white/6 px-3 py-2">
        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
          {isLong && !expanded ? `${item.response.slice(0, TRUNCATE)}…` : item.response}
        </p>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition"
          >
            {expanded ? <><ChevronUp className="h-3 w-3" />Show less</> : <><ChevronDown className="h-3 w-3" />Show more</>}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

export function MemoryIQubeDrawer({ open, onClose }: Props) {
  const [activeChannel, setActiveChannel] = useState<"all" | InteractionType>("all");
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 20;
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (channel: "all" | InteractionType, nextOffset: number, replace: boolean) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(nextOffset),
      });
      if (channel !== "all") params.set("type", channel);

      const res = await fetch(`/api/iqube/memory?${params.toString()}`, {
        headers: authHeaders(),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as {
        interactions: Interaction[];
        summaries: Summary[];
        pagination: { returned: number };
      };

      if (replace) {
        setInteractions(data.interactions);
        setSummaries(data.summaries);
      } else {
        setInteractions((prev) => [...prev, ...data.interactions]);
      }
      setHasMore(data.pagination.returned === LIMIT);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Failed to load memory");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Load when drawer opens or channel changes
  useEffect(() => {
    if (!open) return;
    setOffset(0);
    setHasMore(true);
    load(activeChannel, 0, true);
  }, [open, activeChannel, load]);

  const loadMore = () => {
    const next = offset + LIMIT;
    setOffset(next);
    load(activeChannel, next, false);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[69] bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 z-[70] flex w-full max-w-sm flex-col bg-slate-950/95 border-r border-white/10 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/20">
              <BookOpen className="h-4 w-4 text-violet-400" />
            </div>
            <span className="text-sm font-semibold text-white">Memory</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Channel filter tabs */}
        <div className="flex-shrink-0 flex gap-1 overflow-x-auto px-3 py-2 border-b border-white/6 scrollbar-none">
          {CHANNEL_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveChannel(tab.id)}
              className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                activeChannel === tab.id
                  ? "bg-violet-600/40 text-violet-200 border border-violet-500/40"
                  : "text-slate-400 hover:bg-white/8 hover:text-slate-200 border border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
          {/* Summaries */}
          {summaries.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-1">Summaries</p>
              {summaries.map((s) => (
                <div key={s.id} className="rounded-xl border border-violet-500/20 bg-violet-900/15 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-medium text-violet-400 uppercase tracking-wide">
                      {s.conversation_type}
                    </span>
                    <span className="text-[10px] text-slate-500">{formatRelative(s.created_at)}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{s.summary_text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Interactions */}
          {interactions.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-1">Conversations</p>
              {interactions.map((item) => (
                <InteractionCard key={item.id} item={item} />
              ))}
            </div>
          )}

          {/* Load more */}
          {hasMore && !loading && interactions.length > 0 && (
            <button
              type="button"
              onClick={loadMore}
              className="w-full rounded-xl border border-white/10 py-2 text-xs text-slate-400 hover:bg-white/6 hover:text-slate-200 transition"
            >
              Load more
            </button>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="rounded-xl border border-red-500/20 bg-red-900/15 p-3 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && interactions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 border border-violet-500/20">
                <BookOpen className="h-6 w-6 text-violet-400/60" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-300">No memories yet</p>
                <p className="mt-1 text-xs text-slate-500">
                  Start a conversation with any agent and your history will appear here.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
