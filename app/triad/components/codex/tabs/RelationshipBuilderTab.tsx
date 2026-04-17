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
  Building2,
  ChevronRight,
  Clock,
  Filter,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Shield,
  Star,
  Users,
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

interface Partner {
  id: string;
  name: string;
  org: string;
  wave: number;
  contact_email: string | null;
  contact_name: string | null;
  outreach_status: string;
  bd_stage: string;
  response_signal: string | null;
  strategic_value_tier: number | null;
  audience_overlap_notes: string | null;
  next_action: string | null;
  assigned_agent: string;
  notes: string | null;
}

interface PartnerSummary {
  total: number;
  wave1: number;
  wave2: number;
  tier1: number;
  uncontacted: number;
  responded: number;
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

const BD_STAGE_STYLES: Record<string, string> = {
  uncontacted:           "border-slate-700/60 bg-slate-800/40 text-slate-400",
  first_contact:         "border-sky-700/50 bg-sky-900/30 text-sky-300",
  responded:             "border-amber-700/50 bg-amber-900/30 text-amber-300",
  active:                "border-emerald-700/50 bg-emerald-900/30 text-emerald-300",
  co_activation_agreed:  "border-violet-700/50 bg-violet-900/30 text-violet-300",
  integration_scoped:    "border-indigo-700/50 bg-indigo-900/30 text-indigo-300",
  integration_active:    "border-teal-700/50 bg-teal-900/30 text-teal-300",
  live_partner:          "border-cyan-700/50 bg-cyan-900/30 text-cyan-300",
  low_signal:            "border-rose-900/50 bg-rose-950/30 text-rose-500",
};

const BD_STAGE_LABEL: Record<string, string> = {
  uncontacted:          "Uncontacted",
  first_contact:        "First Contact",
  responded:            "Responded",
  active:               "Active",
  co_activation_agreed: "Co-Activation",
  integration_scoped:   "Integr. Scoped",
  integration_active:   "Integr. Active",
  live_partner:         "Live Partner",
  low_signal:           "Low Signal",
};

function TierStars({ tier }: { tier: number | null }) {
  if (!tier) return null;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3].map((n) => (
        <Star
          key={n}
          className={`h-2.5 w-2.5 ${n <= (4 - tier) ? "text-amber-400 fill-amber-400" : "text-slate-700"}`}
        />
      ))}
    </div>
  );
}

function PartnerCard({ partner }: { partner: Partner }) {
  const [expanded, setExpanded] = useState(false);
  const stageStyle = BD_STAGE_STYLES[partner.bd_stage] ?? BD_STAGE_STYLES.uncontacted;
  const stageLabel = BD_STAGE_LABEL[partner.bd_stage] ?? partner.bd_stage;

  return (
    <div
      className="rounded-xl border border-white/[0.07] bg-white/[0.02] hover:border-white/10 transition-colors p-3 space-y-2 cursor-pointer"
      onClick={() => setExpanded((e) => !e)}
    >
      <div className="flex items-start gap-2">
        <div className="h-8 w-8 shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.04] flex items-center justify-center">
          <Building2 className="h-3.5 w-3.5 text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-100">{partner.name}</span>
            <Badge variant="outline" className={`text-[9px] py-0 px-1.5 ${partner.wave === 1 ? "border-amber-700/40 text-amber-400" : "border-violet-700/40 text-violet-400"}`}>
              W{partner.wave}
            </Badge>
            <TierStars tier={partner.strategic_value_tier} />
          </div>
          {partner.audience_overlap_notes && (
            <p className="text-[10px] text-slate-500 mt-0.5 leading-snug line-clamp-1">{partner.audience_overlap_notes}</p>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-medium ${stageStyle}`}>{stageLabel}</span>
          <ChevronRight className={`h-3 w-3 text-slate-700 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/[0.05] pt-2 space-y-1.5 text-[10px]">
          {partner.contact_name && (
            <div className="flex gap-2">
              <span className="text-slate-600 w-20 shrink-0">Contact</span>
              <span className="text-slate-300">{partner.contact_name}</span>
            </div>
          )}
          {partner.contact_email && (
            <div className="flex gap-2">
              <span className="text-slate-600 w-20 shrink-0">Email</span>
              <span className="text-slate-300">{partner.contact_email}</span>
            </div>
          )}
          {partner.response_signal && (
            <div className="flex gap-2">
              <span className="text-slate-600 w-20 shrink-0">Signal</span>
              <span className="text-amber-300">{partner.response_signal}</span>
            </div>
          )}
          {partner.next_action && (
            <div className="flex gap-2">
              <span className="text-slate-600 w-20 shrink-0">Next</span>
              <span className="text-sky-300">{partner.next_action}</span>
            </div>
          )}
          {partner.audience_overlap_notes && (
            <div className="flex gap-2">
              <span className="text-slate-600 w-20 shrink-0">Notes</span>
              <span className="text-slate-400 leading-snug">{partner.audience_overlap_notes}</span>
            </div>
          )}
          <div className="flex gap-2">
            <span className="text-slate-600 w-20 shrink-0">Agent</span>
            <span className="text-slate-400">{partner.assigned_agent}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function PartnersPanel() {
  const [partners,  setPartners]  = useState<Partner[]>([]);
  const [summary,   setSummary]   = useState<PartnerSummary | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [waveFilter, setWaveFilter] = useState<"" | "1" | "2">("");

  const load = useCallback(async (wave: "" | "1" | "2") => {
    setLoading(true);
    try {
      const url = wave ? `/api/avl/partners?wave=${wave}` : "/api/avl/partners";
      const res = await fetch(url);
      const json = await res.json() as { ok: boolean; data?: { partners: Partner[]; summary: PartnerSummary } };
      if (json.ok && json.data) {
        setPartners(json.data.partners);
        setSummary(json.data.summary);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(waveFilter); }, [load, waveFilter]);

  return (
    <div className="space-y-3">
      {/* Summary tiles */}
      {summary && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Total",       value: summary.total,       accent: "text-slate-200" },
            { label: "Tier 1",      value: summary.tier1,       accent: "text-amber-300" },
            { label: "Uncontacted", value: summary.uncontacted, accent: "text-sky-300" },
          ].map(({ label, value, accent }) => (
            <div key={label} className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-2.5 text-center">
              <div className={`text-base font-bold leading-none ${accent}`}>{value}</div>
              <div className="text-[10px] text-slate-600 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Wave filter */}
      <div className="flex items-center gap-1.5">
        {([["", "All"], ["1", "Wave 1"], ["2", "Wave 2"]] as const).map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => setWaveFilter(val)}
            className={`text-[10px] rounded-full px-2.5 py-0.5 border transition-colors ${
              waveFilter === val
                ? "border-amber-600/60 bg-amber-500/10 text-amber-300"
                : "border-white/10 text-slate-500 hover:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
        <Button
          size="sm" variant="ghost" className="h-6 w-6 p-0 ml-auto"
          onClick={() => void load(waveFilter)}
          disabled={loading}
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Partner list */}
      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Loading partners…</span>
        </div>
      ) : partners.length === 0 ? (
        <div className="text-center py-8 text-slate-600 text-sm">No partners found.</div>
      ) : (
        <div className="space-y-2">
          {partners.map((p) => <PartnerCard key={p.id} partner={p} />)}
        </div>
      )}
    </div>
  );
}

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
  const [activeNav, setActiveNav]  = useState<"qubetalk" | "partners">("partners");
  const [feed,      setFeed]       = useState<FeedMessage[]>([]);
  const [loading,   setLoading]    = useState(true);
  const [sources,   setSources]    = useState<{ bridge: number; live: number }>({ bridge: 0, live: 0 });
  const [thread,    setThread]     = useState("");
  const [composing, setComposing]  = useState(false);
  const [draft,     setDraft]      = useState("");
  const [sending,   setSending]    = useState(false);

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
            <Users className="h-4 w-4 text-amber-400" />
            Relationship Builder α
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">7,000+ persona CRM · 18 partner pipeline</p>
        </div>
        {activeNav === "qubetalk" && personaId && (
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
      </div>

      {/* Nav tabs: Partners | QubeTalk */}
      <div className="flex gap-1 border-b border-white/[0.06] pb-0">
        {([
          { key: "partners",  label: "Partners",  icon: Building2 },
          { key: "qubetalk",  label: "QubeTalk",  icon: MessageSquare },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveNav(key)}
            className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 border-b-2 -mb-px transition-colors ${
              activeNav === key
                ? "border-amber-500 text-amber-300"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Partners panel */}
      {activeNav === "partners" && <PartnersPanel />}

      {/* QubeTalk panel */}
      {activeNav === "qubetalk" && (
        <>
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
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 ml-auto" onClick={() => void load(thread)} disabled={loading}>
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            </Button>
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
                <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setComposing(false)}>Cancel</Button>
                <Button size="sm" className="h-6 text-[11px] bg-violet-600 hover:bg-violet-500" disabled={!draft.trim() || sending} onClick={handleSend}>
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
              <span key={id} className={`rounded-full border px-2 py-0.5 ${agentStyle(id)}`}>{label}</span>
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
              {feed.map((msg) => <MessageCard key={msg.id} msg={msg} />)}
            </div>
          )}

          {/* Footer */}
          <div className="rounded-lg border border-slate-800/60 bg-slate-900/30 p-3 flex items-start gap-2.5">
            <Shield className="h-3.5 w-3.5 text-slate-600 mt-0.5 shrink-0" />
            <div className="text-[10px] text-slate-600 space-y-0.5">
              <p>Bridge packets are committed agent coordination messages — Claude Code → Codex/Lovable handoffs.</p>
              <p>Live messages are from the QubeTalk real-time channel. Compose requires a CRM persona.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
