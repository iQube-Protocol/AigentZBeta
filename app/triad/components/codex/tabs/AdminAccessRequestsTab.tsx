"use client";

/**
 * AdminAccessRequestsTab — review surface for persona-submitted admin
 * access requests. Lists pending requests with inline CRM enrichment
 * so the reviewer doesn't have to leave the tab to decide. Global-
 * admin only (gated server-side by /api/admin/access-requests).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ChevronDown, ChevronRight, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface AccessRequest {
  id: string;
  requesterDisplayLabel: string | null;
  requesterEmail: string | null;
  requestedCartridgeSlug: string | null;
  message: string | null;
  status: 'pending' | 'approved' | 'denied' | 'cancelled';
  requestedAt: string;
  decidedAt: string | null;
  decisionReason: string | null;
  grantedRoleId: string | null;
  enrichment?: {
    existingAdminGrants: Array<{ role_type: string; tenant_id: string | null }>;
    existingAdminGrantCount: number;
    activeActivationIds: string[];
    activeActivationCount: number;
    isInvestor: boolean;
  };
}

type StatusFilter = 'pending' | 'approved' | 'denied' | 'all';

const STATUS_LABEL: Record<AccessRequest['status'], string> = {
  pending: 'Pending',
  approved: 'Approved',
  denied: 'Denied',
  cancelled: 'Cancelled',
};

const STATUS_TONE: Record<AccessRequest['status'], string> = {
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  denied: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
  cancelled: 'bg-slate-500/15 text-slate-300 border-slate-500/40',
};

export function AdminAccessRequestsTab() {
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [decisionReason, setDecisionReason] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);
      const res = await personaFetch(`/api/admin/access-requests?${params.toString()}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || 'Failed to load access requests.');
        setRequests([]);
        return;
      }
      setRequests(json.requests || []);
    } catch (err) {
      setError((err as Error).message);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = useCallback(
    async (id: string, decision: 'approve' | 'deny') => {
      setDecidingId(id);
      try {
        const reason = decisionReason[id]?.trim() || null;
        const res = await personaFetch(`/api/admin/access-requests/${id}/decide`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision, reason }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          alert(json.message || json.error || 'Decision failed.');
          return;
        }
        // Refresh after success so the row's new status lands.
        await load();
      } catch (err) {
        alert((err as Error).message);
      } finally {
        setDecidingId(null);
      }
    },
    [decisionReason, load],
  );

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, denied: 0, cancelled: 0 };
    for (const r of requests) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [requests]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Admin Access Requests
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Personas without any admin grants can request access to a specific cartridge. Review the
            request, check the inline CRM enrichment, and approve — which writes the matching role
            into <code className="text-xs">crm_admin_roles</code> — or deny with a reason.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          className="text-slate-300"
        >
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {(['pending', 'approved', 'denied', 'all'] as StatusFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs border transition ${
              filter === f
                ? 'bg-violet-500/20 border-violet-500/60 text-violet-200'
                : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:border-slate-600'
            }`}
          >
            {f === 'all' ? 'All' : STATUS_LABEL[f as AccessRequest['status']]}
            {f !== 'all' && counts[f as AccessRequest['status']] > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-slate-900/60">
                {counts[f as AccessRequest['status']]}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 text-rose-200 text-sm px-3 py-2">
          {error}
        </div>
      )}

      {loading && requests.length === 0 && (
        <div className="text-sm text-slate-400 py-8 text-center">Loading…</div>
      )}

      {!loading && requests.length === 0 && !error && (
        <div className="text-sm text-slate-400 py-8 text-center">
          {filter === 'pending' ? 'No pending requests.' : 'No requests in this view.'}
        </div>
      )}

      <ul className="space-y-2.5">
        {requests.map((req) => {
          const isOpen = !!expanded[req.id];
          const isDeciding = decidingId === req.id;
          return (
            <li
              key={req.id}
              className="rounded-md border border-slate-700/60 bg-slate-800/30 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setExpanded((prev) => ({ ...prev, [req.id]: !prev[req.id] }))}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-slate-800/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <div className="text-left min-w-0">
                    <div className="text-sm text-slate-100 truncate">
                      {req.requesterDisplayLabel || req.requesterEmail || 'Unknown requester'}
                      <span className="text-slate-500 mx-2">·</span>
                      <span className="text-slate-300">
                        {req.requestedCartridgeSlug || 'platform-wide (global)'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {new Date(req.requestedAt).toLocaleString()}
                      {req.enrichment?.isInvestor && (
                        <span className="ml-2 text-amber-300/80">· investor</span>
                      )}
                      {req.enrichment && req.enrichment.existingAdminGrantCount > 0 && (
                        <span className="ml-2 text-emerald-300/80">
                          · {req.enrichment.existingAdminGrantCount} existing admin grant(s)
                        </span>
                      )}
                      {req.enrichment && req.enrichment.activeActivationCount > 0 && (
                        <span className="ml-2 text-cyan-300/80">
                          · {req.enrichment.activeActivationCount} active activation(s)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_TONE[req.status]}`}>
                  {STATUS_LABEL[req.status]}
                </span>
              </button>

              {isOpen && (
                <div className="px-3 pb-3 pt-1 space-y-3 border-t border-slate-700/40">
                  {req.message && (
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                        Justification
                      </div>
                      <div className="text-sm text-slate-200 bg-slate-900/40 border border-slate-700/40 rounded px-2.5 py-2 whitespace-pre-wrap">
                        {req.message}
                      </div>
                    </div>
                  )}

                  {req.enrichment && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                      <EnrichmentBlock
                        label="Existing admin grants"
                        value={
                          req.enrichment.existingAdminGrantCount === 0
                            ? 'None'
                            : req.enrichment.existingAdminGrants
                                .map((g) => `${g.role_type}${g.tenant_id ? `:${g.tenant_id.slice(0, 6)}` : ''}`)
                                .join(', ')
                        }
                      />
                      <EnrichmentBlock
                        label="Active activations"
                        value={
                          req.enrichment.activeActivationCount === 0
                            ? 'None'
                            : req.enrichment.activeActivationIds.join(', ')
                        }
                      />
                      <EnrichmentBlock
                        label="CRM"
                        value={req.enrichment.isInvestor ? 'Investor record on file' : 'No investor record'}
                      />
                    </div>
                  )}

                  {req.status === 'pending' && (
                    <div className="space-y-2">
                      <textarea
                        placeholder="Optional reason (shown on the decision record)…"
                        value={decisionReason[req.id] ?? ''}
                        onChange={(e) =>
                          setDecisionReason((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        rows={2}
                        className="w-full text-sm bg-slate-900/40 border border-slate-700/60 rounded px-2.5 py-2 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500/60"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => void decide(req.id, 'approve')}
                          disabled={isDeciding}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1.5" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void decide(req.id, 'deny')}
                          disabled={isDeciding}
                          className="border-rose-500/50 text-rose-300 hover:bg-rose-500/10"
                        >
                          <XCircle className="w-4 h-4 mr-1.5" />
                          Deny
                        </Button>
                        {isDeciding && (
                          <span className="text-xs text-slate-400 ml-1">Submitting…</span>
                        )}
                      </div>
                    </div>
                  )}

                  {req.status !== 'pending' && (
                    <div className="text-xs text-slate-400">
                      Decided {req.decidedAt ? new Date(req.decidedAt).toLocaleString() : 'unknown'}
                      {req.decisionReason ? ` · "${req.decisionReason}"` : ''}
                      {req.grantedRoleId ? (
                        <span className="ml-2 text-emerald-300">role: {req.grantedRoleId.slice(0, 8)}…</span>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EnrichmentBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900/40 border border-slate-700/40 rounded px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">{label}</div>
      <div className="text-slate-200">{value}</div>
    </div>
  );
}

export default AdminAccessRequestsTab;
