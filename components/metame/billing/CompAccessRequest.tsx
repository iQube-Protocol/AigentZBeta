'use client';

/**
 * CompAccessRequest — "request complimentary / admin-granted access" affordance
 * shared by the citizen and Founder Office upgrade modals.
 *
 * A qualified user who shouldn't (or can't) pay can file a reason; the request
 * routes into the SAME admin approval queue (admin_access_requests) used for
 * cartridge access, via POST /api/billing/comp-request. An admin approves it in
 * the metaMe Admin → Access Requests tab, which grants the plan tier.
 *
 * Spine fetch uses personaFetch (Bearer token) per CLAUDE.md.
 */

import { useState } from 'react';
import { Gift, Loader2, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import type { PlanTierKey } from './PlanUpgradeModal';

export interface CompAccessRequestProps {
  personaId?: string;
  /** Tier the comp is requested for (the currently-selected tier). */
  tierKey: PlanTierKey;
  /** Display label for the tier (e.g. "Sovereignty"). */
  tierLabel: string;
}

export function CompAccessRequest({ personaId, tierKey, tierLabel }: CompAccessRequestProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function submit() {
    if (!reason.trim()) {
      setError('Please add a short reason for your request.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await personaFetch('/api/billing/comp-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierKey, reason: reason.trim() }),
        personaIdHint: personaId,
      });
      const data = await res.json();
      if (!data?.ok) {
        setError(data?.error ?? 'Could not submit your request.');
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit your request.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-200">
        <Check className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Request submitted for <strong>{tierLabel}</strong>. An admin will review it in the
          Access Requests queue — you'll be granted access if approved.
        </span>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-slate-300 hover:border-white/20"
      >
        <span className="flex items-center gap-1.5">
          <Gift className="h-3.5 w-3.5 text-amber-300" />
          Request complimentary / admin access
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-slate-500">
            Requesting complimentary <strong className="text-slate-300">{tierLabel}</strong> access.
            Tell us why you qualify — it routes to admin review.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Why should this access be granted? (e.g. community contributor, partner, hardship, pilot user…)"
            className="w-full resize-none rounded-lg border border-white/10 bg-[#0b0b0f] px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-amber-500/50 focus:outline-none"
          />
          {error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </div>
          )}
          <button
            onClick={submit}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-100 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
            Submit request for review
          </button>
        </div>
      )}
    </div>
  );
}
