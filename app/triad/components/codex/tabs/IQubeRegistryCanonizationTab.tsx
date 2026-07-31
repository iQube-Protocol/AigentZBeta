'use client';

/**
 * IQubeRegistryCanonizationTab — operator approval queue.
 *
 * Stage 3 C17. PRD v1.1 §A.7. Lists pending canonization requests and
 * provides Approve / Reject actions per row. Approval triggers the
 * published → canonized lifecycle transition via PATCH
 * /api/registry/canonization/<id> (services/registry/lifecycle.ts
 * enforces the transition rule + descriptor side effects).
 *
 * Stage 5 mint saga subscribes to the approval receipt and executes
 * the chain side; until then, approval marks the request approved +
 * advances the source row's lifecycle column but does NOT mint on chain.
 *
 * Admin-only. Underlying routes are spine-gated.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, AlertCircle, RefreshCw, Inbox, Coins } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

interface CanonRequest {
  request_id: string;
  iqube_id: string;
  requested_at: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  decided_at?: string;
  decision_notes?: string | null;
  payment_authority_proposed?: Record<string, unknown> | null;
  receipt_id?: string | null;
}

interface DecideResult {
  request_id: string;
  iqube_id: string;
  decision: 'approved' | 'rejected';
  decided_at: string;
  chain_interaction_pending?: boolean;
  payment_authority_approved?: boolean;
}

const STATUS_TABS: Array<{ key: CanonRequest['status']; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'withdrawn', label: 'Withdrawn' },
];

function cls(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export function IQubeRegistryCanonizationTab() {
  const [status, setStatus] = useState<CanonRequest['status']>('pending');
  const [requests, setRequests] = useState<CanonRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setActionMessage(null);
    try {
      const res = await personaFetch(`/api/registry/canonization?status=${status}`, { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(`Load failed: HTTP ${res.status}${body?.error ? ` — ${body.error}` : ''}`);
        setRequests([]);
        return;
      }
      const body = await res.json();
      setRequests(Array.isArray(body?.requests) ? body.requests : []);
    } catch (e) {
      setError((e as Error).message || 'Network error');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = useCallback(
    async (req: CanonRequest, decision: 'approve' | 'reject') => {
      setActionBusy(req.request_id);
      setActionMessage(null);
      try {
        const res = await personaFetch(`/api/registry/canonization/${encodeURIComponent(req.request_id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision, notes: notesDraft[req.request_id] || undefined }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setActionMessage(`Decision failed: ${body?.error || `HTTP ${res.status}`}${body?.reason ? ` — ${body.reason}` : ''}`);
          return;
        }
        const result = (await res.json()) as DecideResult;
        setActionMessage(
          decision === 'approve'
            ? `Approved ${result.iqube_id.slice(0, 8)}… — chain action ${result.chain_interaction_pending ? 'pending (Stage 5 saga)' : 'not required'}.`
            : `Rejected ${result.iqube_id.slice(0, 8)}…`,
        );
        await load();
      } catch (e) {
        setActionMessage(`Network error: ${(e as Error).message}`);
      } finally {
        setActionBusy(null);
      }
    },
    [load, notesDraft],
  );

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Inbox className="w-5 h-5 text-violet-400" />
            Canonization Queue
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Approve or reject canonization requests. Approval transitions the iQube{' '}
            <code className="text-slate-300">published → canonized</code> per{' '}
            <code className="text-slate-300">services/registry/lifecycle.ts</code>; Stage 5 saga handles the chain side
            when it lands.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-slate-700/50 hover:bg-slate-700 text-slate-200 border border-slate-600 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </header>

      {/* Status tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key)}
            className={cls(
              'text-xs px-2.5 py-1 rounded-full border',
              status === t.key
                ? 'bg-violet-500/20 text-violet-200 border-violet-500/50'
                : 'bg-slate-800/40 text-slate-400 border-slate-700 hover:border-slate-600',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {actionMessage && (
        <div className="text-xs px-3 py-2 rounded-md bg-slate-800/50 border border-slate-700 text-slate-300">
          {actionMessage}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-rose-900/30 border border-rose-700/50 text-rose-200 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {!loading && !error && requests.length === 0 && (
        <div className="text-sm text-slate-500 py-8 text-center">
          No <span className="text-slate-400">{status}</span> requests.
        </div>
      )}

      {!loading && !error && requests.length > 0 && (
        <div className="space-y-3">
          {requests.map((req) => {
            const isBusy = actionBusy === req.request_id;
            const isPending = req.status === 'pending';
            const hasPaymentAuth = req.payment_authority_proposed && Object.keys(req.payment_authority_proposed).length > 0;
            return (
              <div
                key={req.request_id}
                className="border border-slate-700/50 rounded-lg p-4 space-y-3 bg-slate-900/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-slate-200">{req.iqube_id}</div>
                    <div className="text-xs text-slate-500">
                      Requested {fmtTime(req.requested_at)}
                      {req.decided_at ? ` · Decided ${fmtTime(req.decided_at)}` : ''}
                    </div>
                    {hasPaymentAuth && (
                      <div className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 mt-1">
                        <Coins className="w-3 h-3" />
                        AigentQube payment authority proposed — operator confirm required
                      </div>
                    )}
                    {req.decision_notes && (
                      <div className="text-xs text-slate-400 italic mt-1">Notes: {req.decision_notes}</div>
                    )}
                  </div>
                  <span
                    className={cls(
                      'inline-block text-xs px-2 py-0.5 rounded',
                      req.status === 'pending' && 'bg-amber-700 text-amber-100',
                      req.status === 'approved' && 'bg-emerald-700 text-emerald-100',
                      req.status === 'rejected' && 'bg-rose-700 text-rose-100',
                      req.status === 'withdrawn' && 'bg-slate-700 text-slate-300',
                    )}
                  >
                    {req.status}
                  </span>
                </div>

                {isPending && (
                  <>
                    <input
                      type="text"
                      placeholder="Decision notes (optional)"
                      value={notesDraft[req.request_id] || ''}
                      onChange={(e) =>
                        setNotesDraft((prev) => ({ ...prev, [req.request_id]: e.target.value }))
                      }
                      className="w-full text-xs px-2.5 py-1.5 bg-slate-800/50 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => decide(req, 'approve')}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-emerald-600/80 hover:bg-emerald-600 text-white disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Approve
                      </button>
                      <button
                        onClick={() => decide(req, 'reject')}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-rose-600/70 hover:bg-rose-600 text-white disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                        Reject
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="text-xs text-slate-500 pt-2 border-t border-slate-800">
        Approval emits a sync DVN receipt (action='canonize') and advances internal_lifecycle to canonized. Chain
        action is queued for Stage 5 mint saga; see <code>services/registry/lifecycle.ts</code> for the full
        transition rule and PRD v1.0 §6.2 for the canonization-as-governance-act framing.
      </div>
    </div>
  );
}

function fmtTime(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
