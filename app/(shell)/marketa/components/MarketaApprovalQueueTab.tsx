'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, XCircle, MessageSquare, RefreshCcw, Loader2, ClipboardList,
  Trophy, Target, ChevronDown, ChevronRight,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProposedPack {
  id: string;
  name: string;
  tagline?: string;
  status: string;
  proposed_by?: string;
  partner_name?: string;
  partner_org?: string;
  objectives?: string[];
  milestones?: Array<{ title: string; metric: string }>;
  copy_variants?: Array<{ channel: string; body: string }>;
  reward_estimate?: { knyt: number; qc: number };
  campaign_fit_score?: number;
  intent?: string;
  admin_notes?: string;
  created_at: string;
}

interface Props {
  theme?: 'light' | 'dark';
}

function th(d: boolean) {
  return {
    card:        d ? 'bg-slate-950/60 ring-1 ring-white/10 shadow-xl' : 'bg-white border border-slate-200 shadow-sm',
    innerCard:   d ? 'bg-slate-900/60 border border-white/[0.07]' : 'bg-slate-50 border border-slate-200',
    textPrimary: d ? 'text-slate-100' : 'text-slate-900',
    textSecondary:d ? 'text-slate-300' : 'text-slate-700',
    textMuted:   d ? 'text-slate-400' : 'text-slate-600',
    textSubtle:  d ? 'text-slate-500' : 'text-slate-400',
    divider:     d ? 'border-white/[0.07]' : 'border-slate-200',
    inputBase:   d
      ? 'bg-slate-900/60 border border-white/10 text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-rose-500/50 rounded-lg px-3 py-2 text-sm w-full'
      : 'bg-white border border-slate-300 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-rose-500 rounded-lg px-3 py-2 text-sm w-full',
    statusBadge: (s: string) => {
      if (s === 'pending_review') return d ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200';
      if (s === 'approved')       return d ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
      if (s === 'declined')       return d ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-50 text-red-600 border-red-200';
      return d ? 'bg-slate-700/50 text-slate-400 border-slate-600' : 'bg-slate-100 text-slate-500 border-slate-300';
    },
  };
}

// ── Pack card ──────────────────────────────────────────────────────────────────

function PackCard({ pack, theme, onAction }: {
  pack: ProposedPack;
  theme: 'light' | 'dark';
  onAction: (id: string, status: 'approved' | 'declined', notes?: string) => Promise<void>;
}) {
  const d = theme === 'dark';
  const s = th(d);
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes]       = useState('');
  const [loading, setLoading]   = useState<'approve' | 'decline' | 'edit' | null>(null);
  const [showNotes, setShowNotes] = useState(false);

  const act = async (status: 'approved' | 'declined') => {
    setLoading(status === 'approved' ? 'approve' : 'decline');
    await onAction(pack.id, status, notes || undefined);
    setLoading(null);
  };

  return (
    <div className={`rounded-xl ${s.card} overflow-hidden`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`font-semibold text-sm ${s.textPrimary}`}>{pack.name}</p>
              <Badge className={`text-[9px] ${s.statusBadge(pack.status)}`}>{pack.status.replace('_', ' ')}</Badge>
            </div>
            {pack.partner_name && (
              <p className={`text-xs mt-0.5 ${s.textMuted}`}>{pack.partner_name} · {pack.partner_org}</p>
            )}
            {pack.tagline && (
              <p className={`text-xs italic ${s.textSubtle} mt-0.5`}>{pack.tagline}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {pack.campaign_fit_score != null && (
              <Badge className={d ? 'bg-violet-500/10 text-violet-300 border-violet-500/20' : 'bg-violet-50 text-violet-700 border-violet-200'}>
                {pack.campaign_fit_score}% fit
              </Badge>
            )}
            {pack.reward_estimate && (
              <span className={`text-[10px] ${d ? 'text-amber-300' : 'text-amber-700'}`}>
                <Trophy className="w-3 h-3 inline mr-0.5" />{pack.reward_estimate.knyt.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {pack.intent && (
          <div className={`mt-3 rounded-lg ${s.innerCard} px-3 py-2`}>
            <p className={`text-[10px] uppercase tracking-wide font-semibold ${s.textSubtle} mb-1`}>Partner Intent</p>
            <p className={`text-xs ${s.textSecondary}`}>{pack.intent}</p>
          </div>
        )}
      </div>

      {/* Expandable details */}
      <div className={`border-t ${s.divider}`}>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-full flex items-center justify-between px-4 py-2.5 text-xs ${s.textMuted} hover:${s.textSecondary} transition-colors`}
        >
          <span>View campaign details</span>
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-3">
            {pack.objectives?.length && (
              <div>
                <p className={`text-[10px] uppercase tracking-wide font-semibold ${s.textSubtle} mb-1.5`}>
                  <Target className="w-3 h-3 inline mr-1" />Objectives
                </p>
                <ul className="space-y-1">
                  {pack.objectives.map((o, i) => (
                    <li key={i} className={`text-xs flex gap-1.5 ${s.textSecondary}`}>
                      <span className={d ? 'text-violet-400' : 'text-violet-600'}>{i + 1}.</span>{o}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {pack.milestones?.length && (
              <div>
                <p className={`text-[10px] uppercase tracking-wide font-semibold ${s.textSubtle} mb-1.5`}>metaProof Milestones</p>
                <div className="space-y-1.5">
                  {pack.milestones.map((m, i) => (
                    <div key={i} className={`rounded ${d ? 'bg-slate-900/60' : 'bg-slate-100'} px-2.5 py-1.5`}>
                      <p className={`text-xs font-medium ${s.textSecondary}`}>{m.title}</p>
                      <p className={`text-[10px] ${d ? 'text-emerald-400' : 'text-emerald-600'}`}>{m.metric}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {pack.copy_variants?.length && (
              <div>
                <p className={`text-[10px] uppercase tracking-wide font-semibold ${s.textSubtle} mb-1.5`}>Copy Preview</p>
                <div className="space-y-1.5">
                  {pack.copy_variants.slice(0, 2).map((cv, i) => (
                    <div key={i} className={`rounded ${d ? 'bg-slate-900/60' : 'bg-slate-100'} px-2.5 py-1.5`}>
                      <p className={`text-[10px] uppercase font-semibold ${d ? 'text-violet-400' : 'text-violet-600'} mb-0.5`}>{cv.channel}</p>
                      <p className={`text-[11px] ${s.textMuted} line-clamp-3`}>{cv.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Admin notes + actions */}
      {pack.status === 'pending_review' && (
        <div className={`border-t ${s.divider} p-4 space-y-3`}>
          {showNotes && (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes for partner…"
              className={s.inputBase}
            />
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className={`h-7 text-xs bg-transparent ${d ? 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 hover:border-emerald-500/40' : 'border-emerald-500/40 text-emerald-700 hover:bg-emerald-50'}`}
              onClick={() => act('approved')}
              disabled={loading !== null}
            >
              {loading === 'approve' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={`h-7 text-xs bg-transparent ${d ? 'border-white/10 text-slate-400 hover:text-slate-200' : 'border-slate-300 text-slate-600'}`}
              onClick={() => setShowNotes(!showNotes)}
            >
              <MessageSquare className="w-3 h-3 mr-1" />
              Request Edits
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs bg-transparent border-red-500/30 text-red-400 hover:bg-red-500/10"
              onClick={() => act('declined')}
              disabled={loading !== null}
            >
              {loading === 'decline' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <XCircle className="w-3 h-3 mr-1" />}
              Decline
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MarketaApprovalQueueTab({ theme = 'dark' }: Props) {
  const d = theme === 'dark';
  const s = th(d);

  const [packs, setPacks]   = useState<ProposedPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<'pending_review' | 'approved' | 'declined' | 'all'>('pending_review');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/marketa/packs/queue');
      if (res.ok) {
        const data = await res.json();
        if (data.ok) setPacks(data.packs ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (id: string, status: 'approved' | 'declined', notes?: string) => {
    const res = await fetch(`/api/marketa/packs/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, admin_notes: notes }),
    });
    if (res.ok) {
      setPacks((prev) => prev.map((p) => p.id === id ? { ...p, status, admin_notes: notes } : p));
    }
  };

  const filtered = filter === 'all' ? packs : packs.filter((p) => p.status === filter);
  const pendingCount = packs.filter((p) => p.status === 'pending_review').length;

  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-5">

      {/* Header + filter */}
      <div className={`rounded-xl ${s.card} p-3 sm:p-4`}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-rose-400" />
            <span className={`text-sm font-semibold ${s.textPrimary}`}>Approval Queue</span>
            {pendingCount > 0 && (
              <Badge className={d ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200'}>
                {pendingCount} pending
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className={`h-7 text-xs bg-transparent ${d ? 'border-white/10 text-slate-400' : 'border-slate-300 text-slate-600'}`}
            onClick={load}
            disabled={loading}
          >
            <RefreshCcw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Filter tabs */}
        <div className={`flex rounded-lg overflow-hidden text-xs border ${d ? 'border-white/10' : 'border-slate-200'}`}>
          {(['pending_review', 'approved', 'declined', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 flex-1 transition-colors capitalize ${
                filter === f
                  ? d ? 'bg-rose-500/10 text-rose-300 font-medium' : 'bg-rose-50 text-rose-700 font-medium'
                  : d ? 'bg-slate-900/60 text-slate-400 hover:text-slate-200' : 'bg-white text-slate-600 hover:text-slate-800'
              }`}
            >
              {f === 'pending_review' ? 'Pending' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Pack list */}
      {loading ? (
        <div className="flex items-center justify-center p-16">
          <Loader2 className="w-6 h-6 animate-spin text-rose-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className={`rounded-xl ${s.card} p-10 text-center`}>
          <ClipboardList className={`w-8 h-8 mx-auto mb-3 ${s.textSubtle}`} />
          <p className={`text-sm ${s.textMuted}`}>
            {filter === 'pending_review' ? 'No content packs awaiting review.' : 'No content packs in this category.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((pack) => (
            <PackCard key={pack.id} pack={pack} theme={theme} onAction={handleAction} />
          ))}
        </div>
      )}
    </div>
  );
}
