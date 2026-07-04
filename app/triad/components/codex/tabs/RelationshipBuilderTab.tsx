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

import React, { useCallback, useEffect, useRef, useState } from "react";
import { personaFetch } from "@/utils/personaSpine";
import { CodexCopilotLayer, type CopilotMessage } from "@/app/components/codex/CodexCopilotLayer";
import {
  Bot,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
  Loader2,
  MessageSquare,
  PenLine,
  RefreshCw,
  Search,
  Send,
  Shield,
  Star,
  UserCheck,
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
  /** Derived from notes "[scope:X]" prefix — not a DB column. */
  ventureScope?: string;
}

interface PartnerSummary {
  total: number;
  wave1: number;
  wave2: number;
  tier1: number;
  uncontacted: number;
  responded: number;
}

interface Customer {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  knytId: string;
  omTier: string;
  totalInvested: string;
  metaiyeShares: string;
  knytCoyn: string;
  isActivated: boolean;
  campaign_cohort: string | null;
  campaign_state: string | null;
  investment_amount_band: string | null;
  city: string;
  profession: string;
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
  "aigent-me":      "bg-cyan-900/40 text-cyan-300 border-cyan-800/50",
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

const BD_STAGE_ORDER = [
  "uncontacted", "first_contact", "responded", "active",
  "co_activation_agreed", "integration_scoped", "integration_active",
  "live_partner", "low_signal",
];

const TIER_STYLES: Record<string, string> = {
  KETA:  "border-amber-500/50 bg-amber-500/10 text-amber-300",
  KEJI:  "border-violet-500/50 bg-violet-500/10 text-violet-300",
  FIRST: "border-cyan-500/50 bg-cyan-500/10 text-cyan-300",
  ZERO:  "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
  SAT:   "border-slate-600/50 bg-slate-700/30 text-slate-400",
};

const COHORT_STYLES: Record<string, string> = {
  top_shelf:    "border-amber-700/40 text-amber-400",
  zero_knyt:    "border-emerald-700/40 text-emerald-400",
  reactivation: "border-sky-700/40 text-sky-400",
  ks_backers:   "border-violet-700/40 text-violet-400",
};

// ─── Venture scope helpers for partner cards ──────────────────────────────────
// Venture scope is encoded as a "[scope:X]" prefix in the partner's notes field.
// X is one of: "all" | "portfolio" | any venture name slug.

const SCOPE_PREFIX_RE = /^\[scope:([^\]]+)\]\s*/;

function parseScope(notes: string | null): string {
  if (!notes) return "all";
  const m = notes.match(SCOPE_PREFIX_RE);
  return m ? m[1] : "all";
}

function stripScope(notes: string | null): string {
  return (notes ?? "").replace(SCOPE_PREFIX_RE, "");
}

function encodeScope(scope: string, notes: string | null): string {
  const clean = stripScope(notes);
  return scope === "all" ? clean : `[scope:${scope}] ${clean}`;
}

const SCOPE_STYLE: Record<string, string> = {
  all:       "border-slate-600/40 text-slate-400",
  portfolio: "border-cyan-600/40 text-cyan-400",
};

function scopeLabel(scope: string): string {
  if (scope === "all") return "All ventures";
  if (scope === "portfolio") return "Portfolio";
  return scope;
}

// ─────────────────────────────────────────────────────────────────────────────

function normalizeTierKey(raw: string): string {
  const c = raw.toUpperCase().replace(/[^A-Z]/g, "");
  if (c.includes("KETA"))  return "KETA";
  if (c.includes("KEJI"))  return "KEJI";
  if (c.includes("FIRST")) return "FIRST";
  if (c.includes("ZERO"))  return "ZERO";
  if (c.includes("SAT"))   return "SAT";
  return raw.toUpperCase().trim();
}

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

function StageDropdown({
  current,
  onSelect,
  onClose,
}: {
  current: string;
  onSelect: (stage: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-white/10 bg-slate-900/95 backdrop-blur-md shadow-xl py-1">
      {BD_STAGE_ORDER.map((stage) => {
        const style = BD_STAGE_STYLES[stage] ?? "";
        const label = BD_STAGE_LABEL[stage] ?? stage;
        const isCurrent = stage === current;
        return (
          <button
            key={stage}
            type="button"
            onClick={(e) => { e.stopPropagation(); onSelect(stage); }}
            className={`w-full text-left px-3 py-1.5 text-[10px] flex items-center gap-2 transition-colors ${
              isCurrent ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full border ${style}`} />
            <span className={isCurrent ? "text-slate-100 font-medium" : "text-slate-400"}>{label}</span>
            {isCurrent && <Check className="h-2.5 w-2.5 text-emerald-400 ml-auto" />}
          </button>
        );
      })}
    </div>
  );
}

function InlineField({
  label, value, placeholder, onSave,
}: { label: string; value: string | null; placeholder: string; onSave: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value ?? "");
  const save = () => {
    setEditing(false);
    const t = draft.trim() || null;
    if (t !== value) onSave(t);
  };
  return (
    <div className="flex gap-2 items-center">
      <span className="text-slate-600 w-20 shrink-0">{label}</span>
      {editing ? (
        <div className="flex-1 flex gap-1">
          <input
            type="text"
            className="flex-1 bg-white/[0.04] border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-slate-200 outline-none focus:border-sky-600/60"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            autoFocus
          />
          <button type="button" onClick={save} className="text-emerald-400 hover:text-emerald-300">
            <Check className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <span
          className={`${value ? "text-slate-300" : "text-slate-700"} cursor-pointer hover:text-slate-100`}
          onClick={() => { setDraft(value ?? ""); setEditing(true); }}
        >
          {value || placeholder}
        </span>
      )}
    </div>
  );
}

function PartnerCard({ partner, ventureNames, onRefresh }: { partner: Partner; ventureNames: string[]; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const stageStyle = BD_STAGE_STYLES[partner.bd_stage] ?? BD_STAGE_STYLES.uncontacted;
  const stageLabel = BD_STAGE_LABEL[partner.bd_stage] ?? partner.bd_stage;
  const scope = partner.ventureScope ?? "all";

  const patchPartner = useCallback(async (fields: Record<string, unknown>) => {
    setSaving(true);
    try {
      await fetch("/api/mvl/partners", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: partner.id, ...fields }),
      });
      onRefresh();
    } finally {
      setSaving(false);
    }
  }, [partner.id, onRefresh]);

  const handleStageSelect = useCallback((stage: string) => {
    setStageOpen(false);
    if (stage === partner.bd_stage) return;
    void patchPartner({ bd_stage: stage });
  }, [partner.bd_stage, patchPartner]);

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
            {scope !== "all" && (
              <Badge variant="outline" className={`text-[9px] py-0 px-1.5 ${SCOPE_STYLE[scope] ?? "border-violet-700/40 text-violet-400"}`}>
                {scopeLabel(scope)}
              </Badge>
            )}
          </div>
          {partner.audience_overlap_notes && (
            <p className="text-[10px] text-slate-500 mt-0.5 leading-snug line-clamp-1">{partner.audience_overlap_notes}</p>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1 relative">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setStageOpen((o) => !o); }}
            disabled={saving}
            className={`rounded-full border px-2 py-0.5 text-[9px] font-medium transition-all hover:ring-1 hover:ring-white/20 ${stageStyle}`}
          >
            {saving ? <Loader2 className="h-2.5 w-2.5 animate-spin inline" /> : stageLabel}
          </button>
          {stageOpen && (
            <StageDropdown current={partner.bd_stage} onSelect={handleStageSelect} onClose={() => setStageOpen(false)} />
          )}
          <ChevronRight className={`h-3 w-3 text-slate-700 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/[0.05] pt-2 space-y-1.5 text-[10px]" onClick={(e) => e.stopPropagation()}>
          <InlineField label="Contact" value={partner.contact_name} placeholder="Add contact name…" onSave={(v) => void patchPartner({ contact_name: v })} />
          <InlineField label="Email"   value={partner.contact_email} placeholder="Add email…"       onSave={(v) => void patchPartner({ contact_email: v })} />
          {partner.response_signal && (
            <div className="flex gap-2">
              <span className="text-slate-600 w-20 shrink-0">Signal</span>
              <span className="text-amber-300">{partner.response_signal}</span>
            </div>
          )}
          <InlineField label="Next" value={partner.next_action} placeholder="Set next action…" onSave={(v) => void patchPartner({ next_action: v })} />
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
          {/* Venture scope selector */}
          <div className="flex gap-2 items-start pt-1 border-t border-white/[0.04] mt-1">
            <span className="text-slate-600 w-20 shrink-0 pt-0.5">Venture</span>
            <div className="flex items-center gap-1 flex-wrap">
              {["all", "portfolio", ...ventureNames].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    const newNotes = encodeScope(opt, partner.notes);
                    void patchPartner({ notes: newNotes });
                  }}
                  className={`text-[9px] rounded-full border px-2 py-0.5 transition-colors ${
                    scope === opt
                      ? (SCOPE_STYLE[opt] ?? "border-violet-600/60 text-violet-300 bg-violet-500/10")
                      : "border-white/10 text-slate-600 hover:text-slate-300"
                  }`}
                >
                  {scopeLabel(opt)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddPartnerForm({ onSaved }: { onSaved: () => void }) {
  const [name,    setName]    = useState("");
  const [org,     setOrg]     = useState("");
  const [contact, setContact] = useState("");
  const [email,   setEmail]   = useState("");
  const [wave,    setWave]    = useState<1 | 2>(1);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState("");

  const handleSave = async () => {
    if (!name.trim()) { setErr("Name required"); return; }
    setSaving(true); setErr("");
    try {
      const res = await fetch("/api/mvl/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), org: org.trim() || name.trim(), wave, contact_name: contact.trim() || null, contact_email: email.trim() || null }),
      });
      const j = await res.json() as { ok: boolean; error?: string };
      if (j.ok) { setName(""); setOrg(""); setContact(""); setEmail(""); onSaved(); }
      else setErr(j.error ?? "Failed");
    } finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 space-y-2">
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Add Partner</div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Org name *", val: name,    set: setName },
          { label: "Org (display)", val: org,  set: setOrg },
          { label: "Contact name", val: contact, set: setContact },
          { label: "Contact email", val: email,  set: setEmail },
        ].map(({ label, val, set }) => (
          <div key={label}>
            <div className="text-[9px] text-slate-600 mb-0.5">{label}</div>
            <input
              type="text"
              className="w-full bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-[10px] text-slate-200 outline-none focus:border-amber-600/50"
              value={val}
              onChange={(e) => set(e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="text-[9px] text-slate-600">Wave</div>
        {([1, 2] as const).map((w) => (
          <button key={w} type="button" onClick={() => setWave(w)}
            className={`text-[10px] rounded-full border px-2 py-0.5 transition-colors ${wave === w ? "border-amber-600/60 bg-amber-500/10 text-amber-300" : "border-white/10 text-slate-500"}`}>
            W{w}
          </button>
        ))}
        <Button size="sm" className="ml-auto h-6 text-[10px] bg-amber-600 hover:bg-amber-500 text-white" disabled={saving || !name.trim()} onClick={handleSave}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
          Save
        </Button>
      </div>
      {err && <div className="text-[10px] text-red-400">{err}</div>}
    </div>
  );
}

function PartnersPanel({ personaId, ventureNames }: { personaId?: string; ventureNames: string[] }) {
  const [partners,     setPartners]     = useState<Partner[]>([]);
  const [summary,      setSummary]      = useState<PartnerSummary | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [waveFilter,   setWaveFilter]   = useState<"" | "1" | "2">("");
  const [scopeFilter,  setScopeFilter]  = useState<string>("all");
  const [addingNew,    setAddingNew]    = useState(false);

  const load = useCallback(async (wave: "" | "1" | "2") => {
    setLoading(true);
    try {
      const url = wave ? `/api/mvl/partners?wave=${wave}` : "/api/mvl/partners";
      const res = await fetch(url);
      const json = await res.json() as { ok: boolean; data?: { partners: Partner[]; summary: PartnerSummary } };
      if (json.ok && json.data) {
        const enriched = json.data.partners.map((p) => ({ ...p, ventureScope: parseScope(p.notes) }));
        setPartners(enriched);
        setSummary(json.data.summary);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(waveFilter); }, [load, waveFilter]);

  const visiblePartners = scopeFilter === "all"
    ? partners
    : partners.filter((p) => (p.ventureScope ?? "all") === scopeFilter);

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

      {/* Wave filter + venture scope filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
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
        <div className="w-px h-3 bg-white/10 mx-0.5" />
        {(["all", "portfolio", ...ventureNames] as string[]).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setScopeFilter(opt)}
            className={`text-[10px] rounded-full px-2.5 py-0.5 border transition-colors ${
              scopeFilter === opt
                ? (opt === "all" ? "border-slate-600/60 bg-slate-700/30 text-slate-300" : "border-violet-600/60 bg-violet-500/10 text-violet-300")
                : "border-white/10 text-slate-500 hover:text-slate-300"
            }`}
          >
            {scopeLabel(opt)}
          </button>
        ))}
        <Button
          size="sm" variant="ghost" className="h-6 w-6 p-0 ml-auto"
          onClick={() => void load(waveFilter)}
          disabled={loading}
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </Button>
        <Button
          size="sm" variant="ghost"
          className={`h-6 px-2 text-[10px] transition-colors ${addingNew ? "text-amber-300" : "text-slate-500 hover:text-slate-300"}`}
          onClick={() => setAddingNew((a) => !a)}
        >
          <PenLine className="h-3 w-3 mr-1" />
          {addingNew ? "Cancel" : "Add"}
        </Button>
      </div>

      {addingNew && <AddPartnerForm onSaved={() => { setAddingNew(false); void load(waveFilter); }} />}

      {/* Partner list */}
      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Loading partners…</span>
        </div>
      ) : visiblePartners.length === 0 ? (
        <div className="text-center py-8 text-slate-600 text-sm">
          {scopeFilter !== "all" ? `No partners assigned to "${scopeLabel(scopeFilter)}" yet. Assign venture scope on each partner card.` : "No partners found."}
        </div>
      ) : (
        <div className="space-y-2">
          {visiblePartners.map((p) => <PartnerCard key={p.id} partner={p} ventureNames={ventureNames} onRefresh={() => void load(waveFilter)} />)}
        </div>
      )}
    </div>
  );
}

function CustomerCard({ customer }: { customer: Customer }) {
  const [expanded, setExpanded] = useState(false);
  const tierKey = customer.omTier ? normalizeTierKey(customer.omTier) : "";
  const tierStyle = TIER_STYLES[tierKey] ?? "border-slate-700/50 bg-slate-800/30 text-slate-500";
  const cohortStyle = customer.campaign_cohort
    ? COHORT_STYLES[customer.campaign_cohort] ?? "border-slate-700/40 text-slate-400"
    : "";

  return (
    <div
      className="rounded-xl border border-white/[0.07] bg-white/[0.02] hover:border-white/10 transition-colors p-3 space-y-2 cursor-pointer"
      onClick={() => setExpanded((e) => !e)}
    >
      <div className="flex items-start gap-2">
        <div className={`h-8 w-8 shrink-0 rounded-full border flex items-center justify-center text-[10px] font-bold ${
          customer.isActivated
            ? "border-emerald-600/40 bg-emerald-900/30 text-emerald-300"
            : "border-slate-700/40 bg-slate-800/30 text-slate-500"
        }`}>
          {customer.firstName?.[0]?.toUpperCase() || customer.email?.[0]?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-100">{customer.name}</span>
            {customer.isActivated && (
              <UserCheck className="h-3 w-3 text-emerald-400" />
            )}
            {tierKey && (
              <span className={`rounded-full border px-1.5 py-0 text-[8px] font-medium ${tierStyle}`}>{tierKey}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {customer.email && <span className="text-[10px] text-slate-500 truncate">{customer.email}</span>}
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          {customer.campaign_cohort && (
            <Badge variant="outline" className={`text-[8px] py-0 px-1.5 ${cohortStyle}`}>
              {customer.campaign_cohort.replace(/_/g, " ")}
            </Badge>
          )}
          <ChevronDown className={`h-3 w-3 text-slate-700 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/[0.05] pt-2 space-y-1.5 text-[10px]">
          {customer.knytId && (
            <div className="flex gap-2">
              <span className="text-slate-600 w-20 shrink-0">KNYT ID</span>
              <span className="text-slate-300">{customer.knytId}</span>
            </div>
          )}
          {customer.totalInvested && (
            <div className="flex gap-2">
              <span className="text-slate-600 w-20 shrink-0">Invested</span>
              <span className="text-amber-300">{customer.totalInvested}</span>
            </div>
          )}
          {customer.metaiyeShares && (
            <div className="flex gap-2">
              <span className="text-slate-600 w-20 shrink-0">Shares</span>
              <span className="text-slate-300">{customer.metaiyeShares}</span>
            </div>
          )}
          {customer.knytCoyn && (
            <div className="flex gap-2">
              <span className="text-slate-600 w-20 shrink-0">KNYT COYN</span>
              <span className="text-emerald-300">{customer.knytCoyn}</span>
            </div>
          )}
          {customer.investment_amount_band && (
            <div className="flex gap-2">
              <span className="text-slate-600 w-20 shrink-0">Band</span>
              <span className="text-sky-300">{customer.investment_amount_band.replace(/_/g, " ")}</span>
            </div>
          )}
          {customer.campaign_state && (
            <div className="flex gap-2">
              <span className="text-slate-600 w-20 shrink-0">Campaign</span>
              <span className="text-violet-300">{customer.campaign_state}</span>
            </div>
          )}
          {customer.profession && (
            <div className="flex gap-2">
              <span className="text-slate-600 w-20 shrink-0">Role</span>
              <span className="text-slate-400">{customer.profession}</span>
            </div>
          )}
          {customer.city && (
            <div className="flex gap-2">
              <span className="text-slate-600 w-20 shrink-0">City</span>
              <span className="text-slate-400">{customer.city}</span>
            </div>
          )}
          <div className="flex gap-2">
            <span className="text-slate-600 w-20 shrink-0">Status</span>
            <span className={customer.isActivated ? "text-emerald-300" : "text-slate-500"}>
              {customer.isActivated ? "Activated" : "Inactive"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomersPanel({ ventureNames }: { ventureNames: string[] }) {
  const [customers,      setCustomers]      = useState<Customer[]>([]);
  const [total,          setTotal]          = useState(0);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState("");
  const [cohort,         setCohort]         = useState("");
  const [sort,           setSort]           = useState("tier");
  const [page,           setPage]           = useState(0);
  const [ventureFilter,  setVentureFilter]  = useState<string>("all");
  const PAGE_SIZE = 50;

  const load = useCallback(async (opts: { search: string; cohort: string; sort: string; offset: number }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(opts.offset), sort: opts.sort });
      if (opts.search) params.set("search", opts.search);
      if (opts.cohort) params.set("cohort", opts.cohort);
      const res = await fetch(`/api/crm/investors?${params}`);
      const json = await res.json() as { data: Customer[]; total: number };
      setCustomers(json.data ?? []);
      setTotal(json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load({ search, cohort, sort, offset: page * PAGE_SIZE }); }, [load, search, cohort, sort, page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-2.5 text-center">
          <div className="text-base font-bold leading-none text-slate-200">{total}</div>
          <div className="text-[10px] text-slate-600 mt-0.5">Total</div>
        </div>
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-2.5 text-center">
          <div className="text-base font-bold leading-none text-emerald-300">
            {customers.filter((c) => c.isActivated).length > 0 ? `${customers.filter((c) => c.isActivated).length}+` : "—"}
          </div>
          <div className="text-[10px] text-slate-600 mt-0.5">Activated</div>
        </div>
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-2.5 text-center">
          <div className="text-base font-bold leading-none text-amber-300">
            {customers.filter((c) => c.omTier).length > 0 ? `${customers.filter((c) => c.omTier).length}` : "—"}
          </div>
          <div className="text-[10px] text-slate-600 mt-0.5">Tiered</div>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-600" />
        <input
          type="text"
          placeholder="Search by name, email, KNYT ID…"
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg pl-7 pr-3 py-1.5 text-[11px] text-slate-200 placeholder:text-slate-600 outline-none focus:border-white/15"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        />
      </div>

      {/* Filters: cohort + sort */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {([
          ["", "All"],
          ["top_shelf", "Top Shelf"],
          ["zero_knyt", "Zero KNYT"],
          ["reactivation", "Reactivation"],
          ["ks_backers", "KS Backers"],
        ] as const).map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => { setCohort(val); setPage(0); }}
            className={`text-[10px] rounded-full px-2.5 py-0.5 border transition-colors ${
              cohort === val
                ? "border-violet-600/60 bg-violet-500/10 text-violet-300"
                : "border-white/10 text-slate-500 hover:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
        <select
          className="ml-auto text-[10px] bg-white/[0.04] border border-white/10 rounded px-1.5 py-0.5 text-slate-400 outline-none"
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(0); }}
        >
          <option value="tier">By Tier</option>
          <option value="name">By Name</option>
          <option value="invested">By Invested</option>
          <option value="activated">By Status</option>
        </select>
      </div>

      {/* Venture filter */}
      {ventureNames.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="h-3 w-3 text-slate-600" />
          <span className="text-[10px] text-slate-600">Venture:</span>
          {(["all", ...ventureNames] as string[]).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setVentureFilter(opt)}
              className={`text-[10px] rounded-full px-2.5 py-0.5 border transition-colors ${
                ventureFilter === opt
                  ? "border-amber-600/60 bg-amber-500/10 text-amber-300"
                  : "border-white/10 text-slate-500 hover:text-slate-300"
              }`}
            >
              {opt === "all" ? "All" : opt}
            </button>
          ))}
        </div>
      )}

      {/* Venture filter info banner */}
      {ventureFilter !== "all" && (
        <div className="px-3 py-2 rounded-lg bg-amber-900/10 border border-amber-500/20 text-[10px] text-amber-300/70">
          Customer → venture assignment is coming in the next release. Showing all contacts — filter by "{ventureFilter}" will narrow results once linkage is added.
        </div>
      )}

      {/* Customer list */}
      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Loading customers…</span>
        </div>
      ) : customers.length === 0 ? (
        <div className="text-center py-8 text-slate-600 text-sm">No customers found.</div>
      ) : (
        <div className="space-y-2">
          {customers.map((c) => <CustomerCard key={c.id} customer={c} />)}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span>Page {page + 1} of {totalPages} · {total} total</span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded px-2 py-0.5 border border-white/10 disabled:opacity-30 hover:text-slate-300"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="rounded px-2 py-0.5 border border-white/10 disabled:opacity-30 hover:text-slate-300"
            >
              Next
            </button>
          </div>
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

// ─── Composer panel ───────────────────────────────────────────────────────────

interface CommsPack {
  slug: string;
  title: string;
  template_markdown: string;
  subject_lines: string[];
}

function ComposerPanel() {
  const [packs,         setPacks]         = useState<CommsPack[]>([]);
  const [partners,      setPartners]      = useState<Partner[]>([]);
  const [selectedPack,  setSelectedPack]  = useState("");
  const [subjectIndex,  setSubjectIndex]  = useState(0);
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set());
  const [loadingInit,   setLoadingInit]   = useState(true);
  const [preview,       setPreview]       = useState<Array<{ partner: string; to: string; subject: string; body: string }>>([]);
  const [previewing,    setPreviewing]    = useState(false);
  const [sending,       setSending]       = useState(false);
  const [result,        setResult]        = useState<{ sent: number; skipped: number; failed: number; errors: string[] } | null>(null);

  // Load packs + partners on mount
  useEffect(() => {
    void (async () => {
      setLoadingInit(true);
      const [packsRes, partnersRes] = await Promise.all([
        fetch("/api/mvl/comms-packs").catch(() => null),
        fetch("/api/mvl/partners").catch(() => null),
      ]);
      if (packsRes?.ok) {
        const j = await packsRes.json() as { ok: boolean; data?: CommsPack[] };
        if (j.ok && j.data) { setPacks(j.data); setSelectedPack(j.data[0]?.slug ?? ""); }
      }
      if (partnersRes?.ok) {
        const j = await partnersRes.json() as { ok: boolean; data?: { partners: Partner[] } };
        if (j.ok && j.data) setPartners(j.data.partners.filter((p) => p.contact_email));
      }
      setLoadingInit(false);
    })();
  }, []);

  const togglePartner = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === partners.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(partners.map((p) => p.id)));
  };

  const handlePreview = useCallback(async () => {
    if (!selectedPack || selectedIds.size === 0) return;
    setPreviewing(true);
    setPreview([]);
    setResult(null);
    try {
      const res = await fetch("/api/mvl/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dry_run:       true,
          pack_slug:     selectedPack,
          partner_ids:   Array.from(selectedIds),
          subject_index: subjectIndex,
        }),
      });
      const j = await res.json() as { ok: boolean; preview?: typeof preview };
      if (j.ok && j.preview) setPreview(j.preview);
    } finally {
      setPreviewing(false);
    }
  }, [selectedPack, selectedIds, subjectIndex]);

  const handleSend = useCallback(async () => {
    if (!selectedPack || selectedIds.size === 0) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/mvl/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dry_run:       false,
          pack_slug:     selectedPack,
          partner_ids:   Array.from(selectedIds),
          subject_index: subjectIndex,
        }),
      });
      const j = await res.json() as { ok: boolean; sent?: number; skipped?: number; failed?: number; errors?: string[] };
      if (j.ok) {
        setResult({ sent: j.sent ?? 0, skipped: j.skipped ?? 0, failed: j.failed ?? 0, errors: j.errors ?? [] });
        setPreview([]);
        setSelectedIds(new Set());
      }
    } finally {
      setSending(false);
    }
  }, [selectedPack, selectedIds, subjectIndex]);

  const currentPack = packs.find((p) => p.slug === selectedPack);
  const subjects    = currentPack?.subject_lines ?? [];
  const readyToSend = selectedPack && selectedIds.size > 0;

  if (loadingInit) {
    return (
      <div className="flex items-center justify-center py-10 gap-2 text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">Loading…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pack selector */}
      <div className="space-y-1.5">
        <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Comms Pack</div>
        <div className="flex gap-1.5 flex-wrap">
          {packs.map((p) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => setSelectedPack(p.slug)}
              className={`text-[10px] rounded-lg border px-2.5 py-1 transition-colors ${
                selectedPack === p.slug
                  ? "border-amber-600/60 bg-amber-500/10 text-amber-300"
                  : "border-white/10 text-slate-500 hover:text-slate-300"
              }`}
            >
              {p.title}
            </button>
          ))}
          {packs.length === 0 && (
            <span className="text-[10px] text-slate-600">No packs found — run the comms packs SQL migration first.</span>
          )}
        </div>
      </div>

      {/* Subject line variant */}
      {subjects.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Subject line</div>
          <div className="space-y-1">
            {subjects.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSubjectIndex(i)}
                className={`w-full text-left rounded-lg border px-2.5 py-1.5 text-[10px] transition-colors flex items-center gap-2 ${
                  subjectIndex === i
                    ? "border-sky-600/50 bg-sky-900/20 text-sky-300"
                    : "border-white/[0.07] text-slate-500 hover:text-slate-300"
                }`}
              >
                <span className={`h-2 w-2 rounded-full border shrink-0 ${subjectIndex === i ? "bg-sky-400 border-sky-400" : "border-slate-600"}`} />
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Partner selector */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wide flex-1">
            Partners with email ({partners.length})
          </div>
          <button type="button" onClick={toggleAll} className="text-[10px] text-slate-600 hover:text-slate-400">
            {selectedIds.size === partners.length ? "Deselect all" : "Select all"}
          </button>
        </div>
        <div className="space-y-1 max-h-52 overflow-y-auto">
          {partners.map((p) => {
            const checked = selectedIds.has(p.id);
            const stageStyle = BD_STAGE_STYLES[p.bd_stage] ?? "";
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePartner(p.id)}
                className={`w-full text-left rounded-lg border px-2.5 py-1.5 flex items-center gap-2 transition-colors ${
                  checked
                    ? "border-amber-600/40 bg-amber-500/[0.06]"
                    : "border-white/[0.07] hover:border-white/10"
                }`}
              >
                <div className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${
                  checked ? "border-amber-500 bg-amber-500/20" : "border-slate-700"
                }`}>
                  {checked && <Check className="h-2.5 w-2.5 text-amber-400" />}
                </div>
                <span className="text-[10px] text-slate-200 flex-1">{p.name}</span>
                <span className={`text-[9px] rounded-full border px-1.5 py-0 ${stageStyle}`}>
                  {BD_STAGE_LABEL[p.bd_stage] ?? p.bd_stage}
                </span>
              </button>
            );
          })}
          {partners.length === 0 && (
            <div className="text-[10px] text-slate-600 py-3 text-center">No partners with email addresses yet.</div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2">
        <Button
          size="sm" variant="outline"
          className="h-7 px-3 text-[11px] border-sky-800/50 text-sky-300 hover:bg-sky-500/10"
          disabled={!readyToSend || previewing}
          onClick={handlePreview}
        >
          {previewing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <PenLine className="h-3 w-3 mr-1" />}
          Preview
        </Button>
        <Button
          size="sm"
          className="h-7 px-3 text-[11px] bg-amber-600 hover:bg-amber-500 text-white"
          disabled={!readyToSend || sending || preview.length === 0}
          onClick={handleSend}
        >
          {sending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
          Send to {selectedIds.size} partner{selectedIds.size !== 1 ? "s" : ""}
        </Button>
        {selectedIds.size > 0 && (
          <span className="text-[10px] text-slate-600">{selectedIds.size} selected</span>
        )}
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Preview ({preview.length})</div>
          {preview.map((p, i) => (
            <div key={i} className="rounded-xl border border-sky-900/40 bg-sky-950/10 p-3 space-y-1.5">
              <div className="flex gap-2 text-[10px]">
                <span className="text-slate-600 w-14 shrink-0">To</span>
                <span className="text-slate-300">{p.partner} &lt;{p.to}&gt;</span>
              </div>
              <div className="flex gap-2 text-[10px]">
                <span className="text-slate-600 w-14 shrink-0">Subject</span>
                <span className="text-sky-300">{p.subject}</span>
              </div>
              <div className="border-t border-white/[0.05] pt-1.5 text-[10px] text-slate-400 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                {p.body}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Send result */}
      {result && (
        <div className={`rounded-xl border p-3 text-[10px] space-y-1 ${
          result.failed > 0 ? "border-red-800/50 bg-red-950/10" : "border-emerald-800/50 bg-emerald-950/10"
        }`}>
          <div className="font-semibold text-emerald-300">Send complete</div>
          <div className="text-slate-400">Sent: {result.sent} · Skipped: {result.skipped} · Failed: {result.failed}</div>
          {result.errors.map((e, i) => <div key={i} className="text-red-400">{e}</div>)}
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
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([]);
  const [ventureNames, setVentureNames] = useState<string[]>([]);

  const [activeNav, setActiveNav]  = useState<"partners" | "customers" | "compose" | "qubetalk">("partners");
  const [feed,      setFeed]       = useState<FeedMessage[]>([]);
  const [loading,   setLoading]    = useState(true);
  const [sources,   setSources]    = useState<{ bridge: number; live: number }>({ bridge: 0, live: 0 });
  const [thread,    setThread]     = useState("");
  const [composing,  setComposing]  = useState(false);
  const [draft,      setDraft]      = useState("");
  const [sending,    setSending]    = useState(false);
  const [recipient,  setRecipient]  = useState("aigent-z");

  useEffect(() => {
    if (!personaId) return;
    personaFetch("/api/venture/qubes", { personaIdHint: personaId, cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        const all = Array.isArray(data?.ventures) ? [...data.ventures] : [];
        const sorted = all.sort((a: { createdAt?: string }, b: { createdAt?: string }) =>
          (a.createdAt ?? '').localeCompare(b.createdAt ?? ''),
        );
        setVentureNames(sorted.map((v: { name?: string }) => v.name ?? "Unnamed").filter(Boolean));
      })
      .catch(() => {/* best-effort */});
  }, [personaId]);

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
          recipient_agent: recipient,
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

      {/* Nav tabs: Partners | Customers | Compose | QubeTalk */}
      <div className="flex gap-1 border-b border-white/[0.06] pb-0">
        {([
          { key: "partners",  label: "Partners",  icon: Building2 },
          { key: "customers", label: "Customers", icon: Users },
          { key: "compose",   label: "Compose",   icon: PenLine },
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
      {activeNav === "partners" && <PartnersPanel personaId={personaId} ventureNames={ventureNames} />}

      {/* Customers panel */}
      {activeNav === "customers" && <CustomersPanel ventureNames={ventureNames} />}

      {/* Compose panel */}
      {activeNav === "compose" && <ComposerPanel />}

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
              {/* Recipient selector */}
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span>To:</span>
                {[
                  { id: "aigent-z",       label: "Aigent Z" },
                  { id: "aigent-me",      label: "aigentMe" },
                  { id: "aigent-marketa", label: "Marketa" },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setRecipient(id)}
                    className={`rounded-full border px-2 py-0.5 transition-colors ${
                      recipient === id
                        ? agentStyle(id)
                        : "border-white/10 text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <textarea
                className="w-full bg-transparent text-xs text-slate-200 placeholder:text-slate-600 resize-none outline-none border-b border-white/[0.06] pb-2"
                placeholder={`Message ${recipient === "aigent-me" ? "aigentMe" : recipient === "aigent-marketa" ? "Marketa" : "Aigent Z"} on the venture-lab channel…`}
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
              { id: "aigent-me",      label: "aigentMe" },
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

      <CodexCopilotLayer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        onOpen={() => setCopilotOpen(true)}
        variant="floating"
        enableInferenceRendering
        personaId={personaId}
        contextId="knyt-outreach"
        messages={copilotMessages}
        onMessagesChange={setCopilotMessages}
      />
    </div>
  );
}
