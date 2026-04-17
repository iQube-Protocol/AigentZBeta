'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, Loader2, RefreshCcw, Trophy, MousePointerClick, Users, TrendingUp } from 'lucide-react';

interface Props {
  theme?: 'light' | 'dark';
  partnerId?: string;
}

interface PartnerStats {
  packs_total: number;
  packs_approved: number;
  rewards_knyt: number;
  rewards_qc: number;
  reach_estimate: number;
  clicks: number;
  conversions: number;
}

function th(d: boolean) {
  return {
    card:        d ? 'bg-slate-950/60 ring-1 ring-white/10 shadow-xl' : 'bg-white border border-slate-200 shadow-sm',
    innerCard:   d ? 'bg-slate-900/60 border border-white/[0.07]' : 'bg-slate-50 border border-slate-200',
    textPrimary: d ? 'text-slate-100' : 'text-slate-900',
    textMuted:   d ? 'text-slate-400' : 'text-slate-600',
    textSubtle:  d ? 'text-slate-500' : 'text-slate-400',
  };
}

export function MarketaMyReportsTab({ theme = 'dark', partnerId }: Props) {
  const d = theme === 'dark';
  const s = th(d);

  const [stats, setStats]   = useState<PartnerStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!partnerId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/marketa/reports/partner/${partnerId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok) setStats(data.stats);
      }
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="w-6 h-6 animate-spin text-rose-400" />
      </div>
    );
  }

  const tiles = stats ? [
    { label: 'Packs Approved',   value: stats.packs_approved,         total: stats.packs_total, icon: BarChart3,       accent: d ? 'text-violet-400' : 'text-violet-600' },
    { label: 'KNYT Earned',      value: stats.rewards_knyt.toLocaleString(), sub: 'KNYT', icon: Trophy,           accent: d ? 'text-amber-300' : 'text-amber-700' },
    { label: 'Qc Earned',        value: stats.rewards_qc.toLocaleString(),   sub: 'Qc',   icon: Trophy,           accent: d ? 'text-sky-400' : 'text-sky-600' },
    { label: 'Est. Reach',       value: stats.reach_estimate.toLocaleString(), icon: Users,       accent: d ? 'text-emerald-400' : 'text-emerald-600' },
    { label: 'Clicks',           value: stats.clicks.toLocaleString(),        icon: MousePointerClick, accent: d ? 'text-rose-400' : 'text-rose-600' },
    { label: 'Conversions',      value: stats.conversions.toLocaleString(),   icon: TrendingUp,  accent: d ? 'text-indigo-400' : 'text-indigo-600' },
  ] : [];

  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-5">

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-rose-400" />
          <span className={`text-sm font-semibold ${s.textPrimary}`}>My Performance</span>
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

      {!stats ? (
        <div className={`rounded-xl ${s.card} p-10 text-center`}>
          <BarChart3 className={`w-8 h-8 mx-auto mb-3 ${s.textSubtle}`} />
          <p className={`text-sm ${s.textMuted}`}>No data yet — stats will appear after your first pack is published.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {tiles.map(({ label, value, sub, icon: Icon, accent }) => (
            <div key={label} className={`rounded-xl ${s.card} p-4`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className={`w-3.5 h-3.5 ${accent}`} />
                <p className={`text-[10px] uppercase tracking-wide ${s.textSubtle}`}>{label}</p>
              </div>
              <p className={`text-2xl font-bold ${accent}`}>{value}</p>
              {sub && <p className={`text-[10px] ${s.textSubtle}`}>{sub}</p>}
            </div>
          ))}
        </div>
      )}

      {stats && (
        <div className={`rounded-xl ${s.card} p-4`}>
          <p className={`text-xs font-semibold ${s.textMuted} mb-3`}>Progress to next reward tier</p>
          <div className={`w-full h-2 rounded-full ${d ? 'bg-slate-800' : 'bg-slate-200'} overflow-hidden`}>
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-500 to-violet-500 transition-all duration-500"
              style={{ width: `${Math.min(100, (stats.conversions / 10) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <p className={`text-[10px] ${s.textSubtle}`}>{stats.conversions} / 10 conversions</p>
            <Badge className={d ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200'}>
              <Trophy className="w-2.5 h-2.5 mr-0.5 inline" />Silver Tier
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}
