'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Send, RefreshCcw, Loader2, Zap, Eye, CheckCircle2, Users, AlertCircle,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CohortData {
  id: string;
  label: string;
  description: string;
  total: number;
  active: number;
  suppressed: number;
  emails_sent: number;
  next_email: number;
  actionable: number;
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
  };
}

interface CohortState {
  loading: boolean;
  result: { sent: number; failed: number } | null;
  preview: Array<{ to: string; subject: string }> | null;
  error: string | null;
}

const COHORT_COLORS: Record<string, { accent: string; bg: string; actionDark: string; actionLight: string }> = {
  ks_prospects: {
    accent:      'text-sky-400',
    bg:          'dark:border-sky-500/20 dark:bg-sky-500/[0.05] border-sky-200 bg-sky-50',
    actionDark:  'border-sky-500/30 bg-sky-500/[0.08] text-sky-300 hover:bg-sky-500/[0.15] hover:border-sky-500/40',
    actionLight: 'border-sky-500/40 bg-sky-50 text-sky-700 hover:bg-sky-100',
  },
  knyt_codex: {
    accent:      'text-violet-400',
    bg:          'dark:border-violet-500/20 dark:bg-violet-500/[0.05] border-violet-200 bg-violet-50',
    actionDark:  'border-violet-500/30 bg-violet-500/[0.08] text-violet-300 hover:bg-violet-500/[0.15] hover:border-violet-500/40',
    actionLight: 'border-violet-500/40 bg-violet-50 text-violet-700 hover:bg-violet-100',
  },
  knyt_partners: {
    accent:      'text-rose-400',
    bg:          'dark:border-rose-500/20 dark:bg-rose-500/[0.05] border-rose-200 bg-rose-50',
    actionDark:  'border-rose-500/30 bg-rose-500/[0.08] text-rose-300 hover:bg-rose-500/[0.15] hover:border-rose-500/40',
    actionLight: 'border-rose-500/40 bg-rose-50 text-rose-700 hover:bg-rose-100',
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function MarketaCampaignOpsTab({ theme = 'dark' }: Props) {
  const d = theme === 'dark';
  const s = th(d);

  const [cohorts, setCohorts]   = useState<CohortData[]>([]);
  const [loading, setLoading]   = useState(true);
  const [states, setStates]     = useState<Record<string, CohortState>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/marketa/campaigns');
      if (res.ok) {
        const data = await res.json();
        if (data.ok) setCohorts(data.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateState = (id: string, update: Partial<CohortState>) =>
    setStates((prev) => ({ ...prev, [id]: { loading: false, result: null, preview: null, error: null, ...prev[id], ...update } }));

  const handleDryRun = async (cohortId: string) => {
    updateState(cohortId, { loading: true, result: null, preview: null, error: null });
    try {
      const res = await fetch('/api/marketa/campaigns/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohort: cohortId, dry_run: true }),
      });
      const data = await res.json();
      if (data.ok) {
        updateState(cohortId, { loading: false, preview: data.preview ?? [] });
      } else {
        updateState(cohortId, { loading: false, error: data.error ?? 'Dry-run failed' });
      }
    } catch {
      updateState(cohortId, { loading: false, error: 'Network error' });
    }
  };

  const handleFire = async (cohortId: string) => {
    updateState(cohortId, { loading: true, result: null, preview: null, error: null });
    try {
      const res = await fetch('/api/marketa/campaigns/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohort: cohortId, dry_run: false }),
      });
      const data = await res.json();
      if (data.ok) {
        updateState(cohortId, { loading: false, result: { sent: data.sent ?? 0, failed: data.failed ?? 0 } });
        load();
      } else {
        updateState(cohortId, { loading: false, error: data.error ?? 'Fire failed' });
      }
    } catch {
      updateState(cohortId, { loading: false, error: 'Network error' });
    }
  };

  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-5">

      {/* Header */}
      <div className={`rounded-xl ${s.card} p-3 sm:p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-rose-400" />
            <span className={`text-sm font-semibold ${s.textPrimary}`}>Campaign Command Centre</span>
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
        <p className={`text-xs ${s.textMuted} mt-1`}>
          Trigger email sends, dry-run previews, and wave actions across all three live cohorts.
        </p>
      </div>

      {/* Cohort cards */}
      {loading ? (
        <div className="flex items-center justify-center p-16">
          <Loader2 className="w-6 h-6 animate-spin text-rose-400" />
        </div>
      ) : (
        <div className="space-y-3">
          {cohorts.map((cohort) => {
            const cs     = states[cohort.id];
            const colors = COHORT_COLORS[cohort.id] ?? COHORT_COLORS.ks_prospects;

            return (
              <div key={cohort.id} className={`rounded-xl ${s.card} overflow-hidden`}>
                {/* Cohort header */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-sm font-semibold ${colors.accent}`}>{cohort.label}</p>
                      <p className={`text-xs ${s.textMuted} mt-0.5`}>{cohort.description}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge className={d ? 'bg-slate-700/50 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-700 border-slate-300'}>
                        <Users className="w-2.5 h-2.5 mr-0.5 inline" />{cohort.total.toLocaleString()}
                      </Badge>
                      {cohort.next_email > 0 && (
                        <Badge className={d ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200'}>
                          E{cohort.next_email} ready
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-3">
                    {[
                      { label: 'Active',      value: cohort.active },
                      { label: 'Actionable',  value: cohort.actionable },
                      { label: 'Sent',        value: cohort.emails_sent },
                      { label: 'Suppressed',  value: cohort.suppressed },
                      { label: 'Next Email',  value: cohort.next_email > 0 ? `#${cohort.next_email}` : '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className={`rounded ${s.innerCard} p-2 text-center`}>
                        <p className={`text-sm font-bold ${colors.accent}`}>{value}</p>
                        <p className={`text-[10px] ${s.textSubtle}`}>{label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className={`border-t ${s.divider} p-4`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className={`h-7 text-xs bg-transparent ${d ? 'border-white/10 text-slate-400 hover:text-slate-200' : 'border-slate-300 text-slate-600'}`}
                      onClick={() => handleDryRun(cohort.id)}
                      disabled={cs?.loading || cohort.actionable === 0}
                    >
                      {cs?.loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Eye className="w-3 h-3 mr-1" />}
                      Dry-run ({cohort.actionable})
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`h-7 text-xs bg-transparent ${d ? colors.actionDark : colors.actionLight}`}
                      onClick={() => handleFire(cohort.id)}
                      disabled={cs?.loading || cohort.actionable === 0}
                    >
                      {cs?.loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                      Fire Email {cohort.next_email}
                    </Button>

                    {cs?.result && (
                      <span className={`text-xs flex items-center gap-1 ${d ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {cs.result.sent} sent{cs.result.failed > 0 ? `, ${cs.result.failed} failed` : ''}
                      </span>
                    )}
                    {cs?.error && (
                      <span className="text-xs text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />{cs.error}
                      </span>
                    )}
                  </div>

                  {/* Dry-run preview */}
                  {cs?.preview && cs.preview.length > 0 && (
                    <div className={`mt-3 rounded-lg ${s.innerCard} p-3`}>
                      <p className={`text-[10px] uppercase tracking-wide font-semibold ${s.textSubtle} mb-2`}>
                        Dry-run preview · {cs.preview.length} recipients
                      </p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {cs.preview.slice(0, 5).map((p, i) => (
                          <div key={i} className={`text-[11px] ${s.textSecondary}`}>
                            <span className={s.textSubtle}>{p.to}</span>
                            {' — '}<span className={s.textMuted}>{p.subject}</span>
                          </div>
                        ))}
                        {cs.preview.length > 5 && (
                          <p className={`text-[10px] ${s.textSubtle}`}>+{cs.preview.length - 5} more…</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
