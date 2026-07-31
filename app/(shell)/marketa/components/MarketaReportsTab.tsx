'use client';

import React from 'react';
import { BarChart3, TrendingUp, Users, Mail } from 'lucide-react';

interface Props {
  theme?: 'light' | 'dark';
  isAdmin?: boolean;
}

export function MarketaReportsTab({ theme = 'dark' }: Props) {
  const d = theme === 'dark';
  const card = d
    ? 'bg-slate-950/60 ring-1 ring-white/10 shadow-xl'
    : 'bg-white border border-slate-200 shadow-sm';
  const inner = d ? 'bg-slate-900/60 border border-white/[0.07]' : 'bg-slate-50 border border-slate-200';
  const textPrimary = d ? 'text-slate-100' : 'text-slate-900';
  const textMuted   = d ? 'text-slate-400' : 'text-slate-600';
  const textSubtle  = d ? 'text-slate-500' : 'text-slate-400';

  const tiles = [
    { label: 'Total Orders', value: '—', icon: TrendingUp, color: 'text-pink-300' },
    { label: 'Partners Active', value: '—', icon: Users,    color: 'text-violet-400' },
    { label: 'Emails Sent', value: '—', icon: Mail,         color: 'text-sky-400' },
    { label: 'Open Rate', value: '—',   icon: BarChart3,    color: 'text-amber-400' },
  ];

  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-5">
      <div className={`rounded-xl ${card} p-4`}>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-pink-300" />
          <span className={`text-sm font-semibold ${textPrimary}`}>Aggregate Reports</span>
          <span className={`text-[10px] ${textSubtle}`}>· all partners + cohorts</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tiles.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className={`rounded-lg ${inner} p-3 text-center`}>
              <Icon className={`w-4 h-4 mx-auto mb-1.5 ${color}`} />
              <p className={`text-lg font-bold ${color}`}>{value}</p>
              <p className={`text-[10px] ${textSubtle} mt-0.5`}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={`rounded-xl ${card} p-6 text-center`}>
        <BarChart3 className={`w-8 h-8 mx-auto mb-3 ${textSubtle}`} />
        <p className={`text-sm font-medium ${textMuted}`}>Reports coming soon</p>
        <p className={`text-xs ${textSubtle} mt-1`}>
          Aggregate commercial + channel stats will appear here once weekly reports are recorded.
        </p>
      </div>
    </div>
  );
}
