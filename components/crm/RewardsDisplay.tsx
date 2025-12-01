'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Coins, Clock, CheckCircle2, ExternalLink, Gift } from 'lucide-react';
import { CrmReward, TokenType } from '@/types/crm';

interface RewardsDisplayProps {
  tenantId: string;
  personaId?: string;
  compact?: boolean;
}

const tokenConfig: Record<TokenType, { label: string; color: string; icon: string }> = {
  QCT: { label: 'QCT', color: 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30', icon: '🔷' },
  QOYN: { label: 'QOYN', color: 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30', icon: '💎' },
  KNYT: { label: 'KNYT', color: 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30', icon: '🪙' },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/30' },
  approved: { label: 'Approved', color: 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30' },
  paid: { label: 'Paid', color: 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30' },
  cancelled: { label: 'Cancelled', color: 'bg-slate-500/20 text-slate-400 ring-1 ring-slate-500/30' },
};

export function RewardsDisplay({ tenantId, personaId, compact = false }: RewardsDisplayProps) {
  const [rewards, setRewards] = useState<CrmReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const showToast = (msg: string, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const fetchRewards = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tenantId });
      if (personaId) params.append('personaId', personaId);
      const response = await fetch(`/api/crm/rewards?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed');
      setRewards(data.data || []);
    } catch (error) {
      showToast('Failed to load rewards', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRewards(); }, [tenantId, personaId]);

  const totals = rewards.reduce((acc, reward) => {
    const type = reward.tokenType as TokenType;
    if (!acc[type]) acc[type] = { pending: 0, paid: 0, total: 0 };
    acc[type].total += reward.amount;
    if (reward.status === 'paid') acc[type].paid += reward.amount;
    else if (reward.status !== 'cancelled') acc[type].pending += reward.amount;
    return acc;
  }, {} as Record<TokenType, { pending: number; paid: number; total: number }>);

  const filteredRewards = activeTab === 'all' ? rewards : rewards.filter(r => r.tokenType === activeTab);

  if (loading) return <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin" /></div>;

  if (compact) {
    return (
      <div className="rounded-xl bg-slate-900/60 backdrop-blur-sm ring-1 ring-white/10 p-4">
        {toast && <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm ${toast.type === 'error' ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/30' : 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'}`}>{toast.msg}</div>}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-white flex items-center gap-1.5"><Gift className="h-4 w-4" />Rewards</span>
          <button onClick={fetchRewards} className="p-1 rounded hover:bg-white/10 text-slate-400"><RefreshCw className="h-3 w-3" /></button>
        </div>
        <div className="space-y-2">
          {Object.entries(totals).map(([type, amounts]) => {
            const config = tokenConfig[type as TokenType];
            return (
              <div key={type} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-slate-400"><span>{config.icon}</span>{config.label}</span>
                <div className="text-right"><p className="text-sm font-bold text-white">{amounts.total.toLocaleString()}</p>{amounts.pending > 0 && <p className="text-[10px] text-slate-500">{amounts.pending.toLocaleString()} pending</p>}</div>
              </div>
            );
          })}
          {Object.keys(totals).length === 0 && <p className="text-xs text-slate-500 text-center py-2">No rewards yet</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {toast && <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm ${toast.type === 'error' ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/30' : 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'}`}>{toast.msg}</div>}
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(['QCT', 'QOYN', 'KNYT'] as TokenType[]).map(type => {
          const config = tokenConfig[type];
          const amounts = totals[type] || { pending: 0, paid: 0, total: 0 };
          return (
            <div key={type} className="rounded-xl bg-slate-900/60 backdrop-blur-sm ring-1 ring-white/10 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><span className="text-xl">{config.icon}</span><div><p className="text-xs text-slate-400">{config.label}</p><p className="text-xl font-bold text-white">{amounts.total.toLocaleString()}</p></div></div>
                <div className="text-right text-xs">
                  <div className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="h-3 w-3" />{amounts.paid.toLocaleString()}</div>
                  {amounts.pending > 0 && <div className="flex items-center gap-1 text-yellow-400"><Clock className="h-3 w-3" />{amounts.pending.toLocaleString()}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rewards History */}
      <div className="rounded-xl bg-slate-900/60 backdrop-blur-sm ring-1 ring-white/10">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div><h3 className="text-sm font-medium text-white">Reward History</h3><p className="text-xs text-slate-400">{rewards.length} reward{rewards.length !== 1 ? 's' : ''}</p></div>
          <button onClick={fetchRewards} className="px-3 py-1.5 rounded-lg bg-white/5 ring-1 ring-white/10 text-slate-300 text-xs hover:bg-white/10 flex items-center gap-1"><RefreshCw className="h-3 w-3" /></button>
        </div>
        <div className="p-4">
          <div className="flex gap-1 p-1 rounded-xl bg-white/5 ring-1 ring-white/10 mb-4">
            {['all', 'QCT', 'QOYN', 'KNYT'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === tab ? 'bg-fuchsia-500/20 text-fuchsia-300 ring-1 ring-fuchsia-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                {tab === 'all' ? 'All' : tab}
              </button>
            ))}
          </div>
          {filteredRewards.length === 0 ? (
            <div className="text-center py-8 text-slate-400"><Coins className="h-10 w-10 mx-auto mb-3 opacity-50" /><p className="text-sm">No rewards found</p></div>
          ) : (
            <div className="space-y-2">
              {filteredRewards.map(reward => {
                const tokenCfg = tokenConfig[reward.tokenType as TokenType];
                const statusCfg = statusConfig[reward.status] || statusConfig.draft;
                return (
                  <div key={reward.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 ring-1 ring-white/10">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{tokenCfg.icon}</span>
                      <div>
                        <div className="flex items-center gap-2"><span className="text-sm font-medium text-white">+{reward.amount.toLocaleString()} {tokenCfg.label}</span><span className={`text-[10px] px-2 py-0.5 rounded-full ${statusCfg.color}`}>{statusCfg.label}</span></div>
                        <p className="text-xs text-slate-400">{reward.notes || 'Reward earned'}</p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <p>{new Date(reward.createdAt).toLocaleDateString()}</p>
                      {reward.txHash && <a href={`https://etherscan.io/tx/${reward.txHash}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-fuchsia-400 hover:text-fuchsia-300"><ExternalLink className="h-3 w-3" />tx</a>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RewardsDisplay;
