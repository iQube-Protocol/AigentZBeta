'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCcw, Loader2, TrendingUp, Users, Mail, MousePointerClick, Zap } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CohortStats {
  id: string;
  label: string;
  color: string;
  total: number;
  active: number;
  suppressed: number;
  emails_sent: number;
  opens: number;
  clicks: number;
  next_email?: number;
}

interface CampaignPayload {
  campaigns: CohortStats[];
  partners: { total: number; wave1: number; wave2: number; committed: number };
  kpi?: { packsPendingApproval: number; packsApproved: number; rewardsKnyt: number };
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

function StatTile({
  label, value, sub, accent, isDark, Icon,
}: {
  label: string; value: string | number; sub?: string;
  accent: string; isDark: boolean; Icon: React.ComponentType<{ className?: string }>;
}) {
  const s = th(isDark);
  return (
    <div className={`rounded-lg ${s.innerCard} p-3`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 ${accent}`} />
        <p className={`text-[10px] uppercase tracking-wide ${s.textSubtle}`}>{label}</p>
      </div>
      <p className={`text-xl font-bold ${accent}`}>{value}</p>
      {sub && <p className={`text-[10px] ${s.textSubtle} mt-0.5`}>{sub}</p>}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MarketaCampaignDashboardTab({ theme = 'dark' }: Props) {
  const d = theme === 'dark';
  const s = th(d);

  const [data, setData]     = useState<CampaignPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [campRes, kpiRes] = await Promise.all([
        fetch('/api/marketa/campaigns'),
        fetch('/api/marketa/kpi'),
      ]);
      const camp = campRes.ok ? await campRes.json() : null;
      const kpi  = kpiRes.ok ? await kpiRes.json() : null;
      if (camp?.ok) {
        setData({ campaigns: camp.data ?? [], partners: camp.partners ?? { total: 0, wave1: 0, wave2: 0, committed: 0 }, kpi });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="w-6 h-6 animate-spin text-rose-400" />
      </div>
    );
  }

  const campaigns = data?.campaigns ?? [];
  const partners  = data?.partners;
  const kpi       = data?.kpi;

  // Open rate across all cohorts
  const totalSent   = campaigns.reduce((sum, c) => sum + c.emails_sent, 0);
  const totalOpens  = campaigns.reduce((sum, c) => sum + c.opens, 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
  const openRate    = totalSent > 0 ? Math.round((totalOpens / totalSent) * 100) : 0;
  const ctr         = totalSent > 0 ? Math.round((totalClicks / totalSent) * 100) : 0;

  // Cohort color map
  const cohortColors: Record<string, { accent: string; bg: string }> = {
    ks_prospects: {
      accent: d ? 'text-sky-300'  : 'text-sky-700',
      bg:     d ? 'border-sky-500/20 bg-sky-500/[0.06]' : 'border-sky-200 bg-sky-50',
    },
    knyt_codex: {
      accent: d ? 'text-violet-300' : 'text-violet-700',
      bg:     d ? 'border-violet-500/20 bg-violet-500/[0.06]' : 'border-violet-200 bg-violet-50',
    },
    knyt_partners: {
      accent: d ? 'text-rose-300'  : 'text-rose-700',
      bg:     d ? 'border-rose-500/20 bg-rose-500/[0.06]' : 'border-rose-200 bg-rose-50',
    },
  };

  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-5">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-rose-400" />
          <span className={`text-sm font-semibold ${s.textPrimary}`}>Live Campaign Overview</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className={`h-7 text-xs bg-transparent ${d ? 'border-white/10 text-slate-400' : 'border-slate-300 text-slate-600'}`}
          onClick={load}
        >
          <RefreshCcw className="w-3 h-3 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Global KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Emails Sent"   value={totalSent.toLocaleString()}   accent="text-rose-400"    isDark={d} Icon={Mail} />
        <StatTile label="Open Rate"     value={`${openRate}%`}               accent="text-amber-400"   isDark={d} Icon={Zap} />
        <StatTile label="Click Rate"    value={`${ctr}%`}                    accent="text-sky-400"     isDark={d} Icon={MousePointerClick} />
        <StatTile label="Active Partners" value={partners?.committed ?? 0}   accent="text-emerald-400" isDark={d} Icon={Users} />
      </div>

      {/* Pack KPIs */}
      {kpi && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Pending Approval', value: kpi.packsPendingApproval, accent: 'text-amber-400' },
            { label: 'Packs Approved',   value: kpi.packsApproved,        accent: 'text-emerald-400' },
            { label: 'KNYT Rewards',     value: `${(kpi.rewardsKnyt / 1000).toFixed(0)}k`, accent: 'text-violet-400' },
          ].map(({ label, value, accent }) => (
            <div key={label} className={`rounded-lg ${s.innerCard} p-3 text-center`}>
              <p className={`text-lg font-bold ${accent}`}>{value}</p>
              <p className={`text-[10px] ${s.textSubtle} mt-0.5`}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Cohort breakdown */}
      <div className="space-y-3">
        {campaigns.map((cohort) => {
          const colors = cohortColors[cohort.id] ?? { accent: d ? 'text-slate-300' : 'text-slate-700', bg: d ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white' };
          const openR  = cohort.emails_sent > 0 ? Math.round((cohort.opens  / cohort.emails_sent) * 100) : 0;
          const ctrR   = cohort.emails_sent > 0 ? Math.round((cohort.clicks / cohort.emails_sent) * 100) : 0;

          return (
            <div key={cohort.id} className={`rounded-xl border ${colors.bg} p-4`}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className={`text-sm font-semibold ${colors.accent}`}>{cohort.label}</p>
                  <p className={`text-xs ${s.textMuted}`}>{cohort.total.toLocaleString()} total · {cohort.active.toLocaleString()} active</p>
                </div>
                {cohort.next_email && (
                  <Badge className={d ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' : 'bg-rose-50 text-rose-700 border-rose-200'}>
                    Next: Email {cohort.next_email}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {[
                  { label: 'Sent',   value: cohort.emails_sent },
                  { label: 'Opens',  value: cohort.opens },
                  { label: 'Clicks', value: cohort.clicks },
                  { label: 'Open %', value: `${openR}%` },
                  { label: 'CTR',    value: `${ctrR}%` },
                ].map(({ label, value }) => (
                  <div key={label} className={`rounded ${d ? 'bg-slate-900/60' : 'bg-white'} border ${d ? 'border-white/[0.05]' : 'border-slate-100'} p-2 text-center`}>
                    <p className={`text-sm font-bold ${colors.accent}`}>{value}</p>
                    <p className={`text-[10px] ${s.textSubtle}`}>{label}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {campaigns.length === 0 && (
        <div className={`rounded-xl ${s.card} p-10 text-center`}>
          <TrendingUp className={`w-8 h-8 mx-auto mb-3 ${s.textSubtle}`} />
          <p className={`text-sm ${s.textMuted}`}>No campaign data available.</p>
        </div>
      )}
    </div>
  );
}
