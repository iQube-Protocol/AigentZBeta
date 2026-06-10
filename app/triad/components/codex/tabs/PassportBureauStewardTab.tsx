'use client';

/**
 * PassportBureauStewardTab — steward review dashboard (Stage 6 UI).
 *
 * PRD §4.5, §14. Queue of open applications with approve / deny /
 * needs-more-information actions. Mirrors the registry canonization-queue
 * workflow shape. Gate is server-side (spine cartridge-admin); this tab
 * simply surfaces the 403 when the caller is not a steward.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Gavel,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertCircle,
  Bot,
  User,
} from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

interface QueueItem {
  applicationId: string;
  passportClass: string;
  applicationStatus: string;
  passportGrade: string | null;
  personhoodProofType: string | null;
  agentCardUrl: string | null;
  applicationPayload: Record<string, unknown> | null;
  reviewPriority: string;
  hasAssignedSteward: boolean;
  submittedAt: string | null;
}

function cls(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export function PassportBureauStewardTab() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch('/api/passport/review/queue', { cache: 'no-store' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || `Queue load failed (${res.status})`);
      setQueue(json.queue ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Queue load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = useCallback(
    async (applicationId: string, decision: 'approve' | 'deny' | 'needs_more_information') => {
      setBusyId(applicationId);
      setError(null);
      try {
        const res = await personaFetch('/api/passport/review/decide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            applicationId,
            decision,
            notes: notes[applicationId] || undefined,
          }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'Decision failed');
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Decision failed');
      } finally {
        setBusyId(null);
      }
    },
    [notes, load],
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gavel className="h-6 w-6 text-violet-400" />
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Steward Review Queue</h2>
            <p className="text-sm text-slate-400">
              Open passport applications awaiting a decision.
            </p>
          </div>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-700 bg-rose-950/40 p-3 text-sm text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && queue.length === 0 && !error && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-6 text-center text-sm text-slate-400">
          Queue is empty — no open applications.
        </div>
      )}

      {queue.map((item) => {
        const isCitizen = item.passportClass === 'citizen';
        const participant = (item.applicationPayload?.participant ?? null) as
          | { display_name?: string; short_description?: string }
          | null;
        return (
          <div
            key={item.applicationId}
            className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isCitizen ? (
                  <User className="h-5 w-5 text-emerald-400" />
                ) : (
                  <Bot className="h-5 w-5 text-sky-400" />
                )}
                <span className="text-sm font-medium text-slate-200">
                  {isCitizen
                    ? 'Citizen application'
                    : participant?.display_name || 'Participant application'}
                </span>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                  {item.passportClass}
                </span>
                {item.passportGrade && (
                  <span className="rounded-full bg-violet-900/60 px-2 py-0.5 text-xs text-violet-300">
                    {item.passportGrade}
                  </span>
                )}
              </div>
              <span
                className={cls(
                  'rounded-full px-2 py-0.5 text-xs',
                  item.reviewPriority === 'expedited' || item.reviewPriority === 'high'
                    ? 'bg-amber-900 text-amber-300'
                    : 'bg-slate-800 text-slate-400',
                )}
              >
                {item.reviewPriority}
              </span>
            </div>

            <div className="space-y-1 text-xs text-slate-400">
              <p>Status: {item.applicationStatus} · Proof: {item.personhoodProofType ?? 'none'}</p>
              {item.agentCardUrl && (
                <p className="break-all font-mono">Agent card: {item.agentCardUrl}</p>
              )}
              {participant?.short_description && <p>{participant.short_description}</p>}
              {item.submittedAt && (
                <p>Submitted: {new Date(item.submittedAt).toLocaleString()}</p>
              )}
            </div>

            <input
              value={notes[item.applicationId] ?? ''}
              onChange={(e) =>
                setNotes((n) => ({ ...n, [item.applicationId]: e.target.value }))
              }
              placeholder="Decision notes (optional)"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />

            <div className="flex gap-2">
              <button
                onClick={() => void decide(item.applicationId, 'approve')}
                disabled={busyId === item.applicationId}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                {busyId === item.applicationId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Approve + issue
              </button>
              <button
                onClick={() => void decide(item.applicationId, 'needs_more_information')}
                disabled={busyId === item.applicationId}
                className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-600 disabled:opacity-50"
              >
                <HelpCircle className="h-4 w-4" />
                Needs info
              </button>
              <button
                onClick={() => void decide(item.applicationId, 'deny')}
                disabled={busyId === item.applicationId}
                className="flex items-center gap-1.5 rounded-lg bg-rose-800 px-3 py-1.5 text-sm text-rose-100 hover:bg-rose-700 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                Deny
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
