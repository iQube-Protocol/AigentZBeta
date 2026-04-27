"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Shield, ShieldCheck, ShieldX, Clock, Activity, AlertTriangle, CheckCircle2, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface DelegationState {
  active: boolean;
  suspended?: boolean;
  expired?: boolean;
  handoff_id?: string;
  trust_band?: string;
  allowed_actions?: string[];
  expires_at?: string;
  actions_taken?: number;
  max_actions?: number;
  created_at?: string;
  agent_root_did?: string;
}

interface BoundedDelegationTabProps {
  personaId?: string;
}

const TRUST_BAND_ACTIONS: Record<string, string[]> = {
  L1_EXPERIMENTAL: ["knowledge_retrieval"],
  L2_VERIFIED_COMMUNITY: ["knowledge_retrieval", "draft_document"],
  L3_PRODUCTION_CANDIDATE: ["knowledge_retrieval", "draft_document", "registry_submission_proposal"],
  L4_PRODUCTION_APPROVED: ["knowledge_retrieval", "draft_document", "registry_submission_proposal", "registry_publish"],
};

const TTL_OPTIONS = [
  { label: "1 hour", value: 1 },
  { label: "4 hours", value: 4 },
  { label: "8 hours", value: 8 },
];

const TRUST_BANDS = ["L1_EXPERIMENTAL", "L2_VERIFIED_COMMUNITY", "L3_PRODUCTION_CANDIDATE", "L4_PRODUCTION_APPROVED"];

function formatExpiry(isoString: string): string {
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function BoundedDelegationTab({ personaId }: BoundedDelegationTabProps) {
  const [delegation, setDelegation] = useState<DelegationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [granting, setGranting] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [showConcept, setShowConcept] = useState(false);

  // Grant form state
  const [selectedTrustBand, setSelectedTrustBand] = useState("L2_VERIFIED_COMMUNITY");
  const [selectedTtl, setSelectedTtl] = useState(4);
  const [selectedActions, setSelectedActions] = useState<string[]>(["knowledge_retrieval", "draft_document"]);

  const pid = personaId ?? "anonymous";

  const loadDelegation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/codex/chat/agentiq-os/delegation?persona_id=${encodeURIComponent(pid)}`);
      const data = await res.json();
      setDelegation(data);
    } catch {
      setError("Failed to load delegation state.");
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => {
    loadDelegation();
  }, [loadDelegation]);

  async function handleGrant() {
    setGranting(true);
    setError(null);
    try {
      const res = await fetch("/api/codex/chat/agentiq-os/delegation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona_id: pid,
          trust_band: selectedTrustBand,
          selected_actions: selectedActions,
          ttl_hours: selectedTtl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Grant failed.");
      } else {
        setShowGrantForm(false);
        await loadDelegation();
      }
    } catch {
      setError("Grant request failed.");
    } finally {
      setGranting(false);
    }
  }

  async function handleRevoke() {
    setRevoking(true);
    setError(null);
    try {
      await fetch(`/api/codex/chat/agentiq-os/delegation?persona_id=${encodeURIComponent(pid)}`, {
        method: "DELETE",
      });
      await loadDelegation();
    } catch {
      setError("Revoke request failed.");
    } finally {
      setRevoking(false);
    }
  }

  const bandActions = TRUST_BAND_ACTIONS[selectedTrustBand] ?? [];

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-violet-500/20 border border-violet-500/30">
          <Shield className="h-6 w-6 text-violet-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Bounded Delegation</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Grant Aigent C-OS sealed, time-limited authority — audited via DVN receipts.
          </p>
        </div>
      </div>

      {/* Agent identity card */}
      <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aigent C-OS Identity</p>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Root DiD</span>
          <code className="text-xs text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded">
            did:iqube:aigent-c-os-root
          </code>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Bounded persona</span>
          <code className="text-xs text-slate-300 bg-slate-800 px-2 py-0.5 rounded">aigent-c-os</code>
        </div>
        <p className="text-[11px] text-slate-500 italic">
          Personas may vary. Accountability does not.
        </p>
      </div>

      {/* Concept toggle */}
      <div className="rounded-xl border border-slate-700/40 bg-slate-900/20">
        <button
          type="button"
          onClick={() => setShowConcept((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm text-slate-300"
        >
          <span className="font-medium">What is bounded delegation?</span>
          {showConcept ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showConcept && (
          <div className="px-4 pb-4 text-xs text-slate-400 space-y-2 border-t border-slate-700/40 pt-3">
            <p>Bounded delegation grants Aigent C-OS explicit, time-limited authority via a sealed <strong className="text-slate-300">PolicyEnvelope</strong>.</p>
            <p>The envelope is immutable after creation — no conversation can expand it. Injection attempts and forbidden actions are blocked at the API boundary before reaching the LLM.</p>
            <p>Every delegation event emits a receipt-eligible <strong className="text-slate-300">OrchestrationEvent</strong> anchored to the agent&apos;s Root DiD. See the <code className="bg-slate-800 px-1 rounded">bounded-delegation.md</code> KB doc for the full model.</p>
          </div>
        )}
      </div>

      {/* Delegation state */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading delegation state…
        </div>
      ) : delegation?.active ? (
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-400" />
              <span className="text-sm font-semibold text-green-300">Active Delegation</span>
            </div>
            <button
              type="button"
              onClick={handleRevoke}
              disabled={revoking}
              className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-red-300 hover:bg-red-500/20 disabled:opacity-50"
            >
              {revoking ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldX className="h-3 w-3" />}
              Revoke
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Clock className="h-3.5 w-3.5" />
              Expires in {delegation.expires_at ? formatExpiry(delegation.expires_at) : "—"}
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Activity className="h-3.5 w-3.5" />
              {delegation.actions_taken ?? 0} / {delegation.max_actions ?? 20} actions
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1.5">Allowed actions</p>
            <div className="flex flex-wrap gap-1.5">
              {(delegation.allowed_actions ?? []).map((a) => (
                <span key={a} className="inline-flex items-center gap-1 rounded-full bg-green-500/10 border border-green-500/20 px-2 py-0.5 text-[11px] text-green-300">
                  <CheckCircle2 className="h-3 w-3" />
                  {a}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : delegation?.suspended ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <span className="text-sm font-semibold text-amber-300">Delegation Suspended</span>
          </div>
          <p className="text-xs text-slate-400">Action limit reached. Revoke and re-grant to continue.</p>
          <button
            type="button"
            onClick={handleRevoke}
            disabled={revoking}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50"
          >
            {revoking ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Clear & Re-grant
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-slate-500" />
            <span className="text-sm text-slate-400">No active delegation</span>
          </div>
          <p className="text-xs text-slate-500">Grant authority to enable delegated actions in Aigent C-OS.</p>
          <button
            type="button"
            onClick={() => setShowGrantForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-200 hover:bg-violet-500/20 transition-colors"
          >
            <Shield className="h-4 w-4" />
            {showGrantForm ? "Cancel" : "Grant Authority"}
          </button>
        </div>
      )}

      {/* Grant form */}
      {showGrantForm && !delegation?.active && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/30 p-4 space-y-4">
          <p className="text-sm font-semibold text-slate-200">Configure Delegation</p>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Trust Band</label>
            <div className="grid grid-cols-2 gap-2">
              {TRUST_BANDS.map((band) => (
                <button
                  key={band}
                  type="button"
                  onClick={() => {
                    setSelectedTrustBand(band);
                    setSelectedActions(TRUST_BAND_ACTIONS[band] ?? []);
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs text-left transition ${
                    selectedTrustBand === band
                      ? "border-violet-500/60 bg-violet-500/20 text-violet-200"
                      : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {band.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Duration</label>
            <div className="flex gap-2">
              {TTL_OPTIONS.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedTtl(value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                    selectedTtl === value
                      ? "border-violet-500/60 bg-violet-500/20 text-violet-200"
                      : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Allowed Actions (from trust band)</label>
            <div className="flex flex-wrap gap-1.5">
              {bandActions.map((action) => (
                <label key={action} className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedActions.includes(action)}
                    onChange={(e) => {
                      setSelectedActions((prev) =>
                        e.target.checked ? [...prev, action] : prev.filter((a) => a !== action),
                      );
                    }}
                    className="h-3 w-3 rounded"
                  />
                  <span className="text-xs text-slate-300">{action}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-700/40 bg-slate-800/30 px-3 py-2 text-xs text-slate-400 space-y-1">
            <p className="font-medium text-slate-300">Always forbidden (all trust bands):</p>
            <p>write_to_aigency_pack, access_supabase_service_role, push_to_registry_live, read_wallet_credentials, modify_other_persona, read_sovereign_iqube</p>
          </div>

          <button
            type="button"
            onClick={handleGrant}
            disabled={granting || selectedActions.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/10 px-5 py-2 text-sm font-semibold text-violet-200 hover:bg-violet-500/20 disabled:opacity-50 transition-colors"
          >
            {granting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {granting ? "Granting…" : "Confirm Grant"}
          </button>
        </div>
      )}

      <div className="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-800">
        <p>Phase 2: Audit log from Supabase <code className="bg-slate-800 px-1 rounded">orchestration_events</code> will appear here.</p>
        <p>Phase 2: SmartWallet balance confirmation required before grant.</p>
      </div>
    </div>
  );
}
