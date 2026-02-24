'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Code, Palette, Briefcase, Database, Users, Trophy, TrendingUp, CheckCircle2, CloudUpload, AlertCircle } from 'lucide-react';
import { CrmPersonaReputation } from '@/types/crm';

interface ReputationDisplayProps {
  personaId: string;
  compact?: boolean;
}

const dimensionConfig = [
  { key: 'repTechnical', label: 'Technical', icon: Code, color: 'bg-blue-500' },
  { key: 'repCreative', label: 'Creative', icon: Palette, color: 'bg-purple-500' },
  { key: 'repEntrepreneurial', label: 'Business', icon: Briefcase, color: 'bg-emerald-500' },
  { key: 'repDataArch', label: 'Data', icon: Database, color: 'bg-orange-500' },
  { key: 'repCommunity', label: 'Community', icon: Users, color: 'bg-pink-500' },
];

export function ReputationDisplay({ personaId, compact = false }: ReputationDisplayProps) {
  const [reputation, setReputation] = useState<CrmPersonaReputation | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const showToast = (msg: string, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const fetchReputation = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/crm/reputation?personaId=${personaId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed');
      setReputation(data.reputation);
    } catch (error) {
      showToast('Failed to load reputation', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (personaId) fetchReputation(); }, [personaId]);

  const handleSyncToRQH = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/crm/reputation/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId, direction: 'push' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed');
      showToast('Synced to RQH');
      fetchReputation();
    } catch (error: any) {
      showToast(error.message || 'Sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin" /></div>;
  if (!reputation) return <div className="text-center py-8 text-slate-400"><p>No reputation data</p></div>;

  const maxDim = Math.max(reputation.repTechnical, reputation.repCreative, reputation.repEntrepreneurial, reputation.repDataArch, reputation.repCommunity, 1);

  if (compact) {
    return (
      <div className="rounded-xl bg-slate-900/60 backdrop-blur-sm ring-1 ring-white/10 p-4 space-y-2">
        {toast && <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm ${toast.type === 'error' ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/30' : 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'}`}>{toast.msg}</div>}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white">Reputation</span>
          <span className="text-lg font-bold text-fuchsia-300">{reputation.repOverall.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400"><CheckCircle2 className="h-3 w-3" />{reputation.totalTasksCompleted} tasks</div>
        <div className="flex items-center gap-2 text-xs text-slate-400"><Trophy className="h-3 w-3" />{reputation.lifetimeCvs.toFixed(1)} CVS</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-slate-900/60 backdrop-blur-sm ring-1 ring-white/10">
      {toast && <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm ${toast.type === 'error' ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/30' : 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'}`}>{toast.msg}</div>}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div><h3 className="text-sm font-medium text-white">Reputation</h3><p className="text-xs text-slate-400">Multi-dimensional score</p></div>
        <button onClick={fetchReputation} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400"><RefreshCw className="h-4 w-4" /></button>
      </div>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
          <div><p className="text-xs text-slate-400">Overall</p><p className="text-2xl font-bold text-white">{reputation.repOverall.toFixed(1)}</p></div>
          <div className="text-right flex items-center gap-1 text-xs text-slate-400"><TrendingUp className="h-3 w-3" />12m: {reputation.repRolling12m.toFixed(1)}</div>
        </div>
        <div className="space-y-3">
          {dimensionConfig.map(({ key, label, icon: Icon, color }) => {
            const value = reputation[key as keyof CrmPersonaReputation] as number;
            const pct = maxDim > 0 ? (value / maxDim) * 100 : 0;
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 text-slate-400"><Icon className="h-3 w-3" />{label}</span><span className="text-white">{value.toFixed(1)}</span></div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5">
          <div className="text-center"><p className="text-lg font-bold text-white">{reputation.totalTasksCompleted}</p><p className="text-[10px] text-slate-500">Completed</p></div>
          <div className="text-center"><p className="text-lg font-bold text-white">{reputation.totalTasksClaimed}</p><p className="text-[10px] text-slate-500">Claimed</p></div>
          <div className="text-center"><p className="text-lg font-bold text-white">{reputation.lifetimeCvs.toFixed(1)}</p><p className="text-[10px] text-slate-500">CVS</p></div>
        </div>
        <div className="pt-3 border-t border-white/5 space-y-2">
          {reputation.rqhBucketId ? (
            <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="h-3 w-3" />Synced</span><span className="text-slate-500">{reputation.rqhSyncedAt ? new Date(reputation.rqhSyncedAt).toLocaleDateString() : ''}</span></div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-yellow-400"><AlertCircle className="h-3 w-3" />Not synced</div>
          )}
          <button onClick={handleSyncToRQH} disabled={syncing} className="w-full px-3 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-slate-300 text-xs hover:bg-white/10 disabled:opacity-50 flex items-center justify-center gap-1.5">
            {syncing ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Syncing...</> : <><CloudUpload className="h-3 w-3" />Sync to RQH</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReputationDisplay;
