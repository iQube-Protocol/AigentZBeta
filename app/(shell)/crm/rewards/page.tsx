'use client';

import { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Search, 
  Filter, 
  Plus,
  CheckCircle,
  Clock,
  XCircle,
  Send,
  MoreVertical,
  Coins,
  AlertCircle
} from 'lucide-react';
import { useCrmContext } from '../CrmContext';
import { useRewards, usePersonas } from '../hooks/useCrmApi';
import RewardApprovalWorkflow from '@/components/crm/RewardApprovalWorkflow';
import type { CrmReward } from '@/types/crm';

interface RewardRow {
  id: string;
  personaId: string;
  personaName: string;
  tokenType: string;
  amount: number;
  pokwBasis: number;
  status: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  txHash?: string;
}

export default function RewardsPage() {
  const { currentTenantId } = useCrmContext();
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState<'crm' | 'grants'>('grants');
  const [apiError, setApiError] = useState<string | null>(null);
  const [showApprovalWorkflow, setShowApprovalWorkflow] = useState(false);
  
  const rewardsApi = useRewards(currentTenantId);
  const personasApi = usePersonas(currentTenantId);
  const loading = rewardsApi.loading;
  const [personaMap, setPersonaMap] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchPersonas() {
      if (!currentTenantId) return;
      try {
        const result = await personasApi.fetch({ limit: 1000, source: 'live' });
        const map: Record<string, string> = {};
        (result?.data || []).forEach((persona: any) => {
          if (persona?.id) {
            map[persona.id] = persona.displayName || persona.name || persona.fioHandle || persona.id.slice(0, 12);
          }
        });
        setPersonaMap(map);
      } catch {
        setPersonaMap({});
      }
    }
    fetchPersonas();
  }, [currentTenantId]);

  useEffect(() => {
    async function fetchRewards() {
      setApiError(null);
      try {
        const result = await rewardsApi.fetch({ 
          status: statusFilter !== 'all' ? statusFilter : undefined,
          limit: 100,
          source: sourceFilter,
        });
        if (result?.data) {
          const mapped = (result.data as CrmReward[]).map((r) => ({
            id: r.id,
            personaId: r.personaId,
            personaName: personaMap[r.personaId] || r.personaId.slice(0, 12) + '...',
            tokenType: r.tokenType,
            amount: r.amount || 0,
            pokwBasis: r.pokwScoreUsed || 0,
            status: r.status,
            periodStart: r.periodStart,
            periodEnd: r.periodEnd,
            createdAt: r.createdAt,
            txHash: r.txHash || undefined,
          }));
          setRewards(mapped);
        }
      } catch (err: any) {
        setApiError(err.message || 'Failed to load rewards');
        setRewards([]);
      }
    }
    fetchRewards();
  }, [currentTenantId, statusFilter, personaMap, sourceFilter]);

  const filteredRewards = rewards.filter(r => {
    const matchesSearch = r.personaName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Clock size={14} className="text-amber-400" />;
      case 'approved': return <CheckCircle size={14} className="text-blue-400" />;
      case 'paid': return <Send size={14} className="text-emerald-400" />;
      case 'cancelled': return <XCircle size={14} className="text-red-400" />;
      default: return <Clock size={14} className="text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-amber-400/20 text-amber-400';
      case 'approved': return 'bg-blue-400/20 text-blue-400';
      case 'paid': return 'bg-emerald-400/20 text-emerald-400';
      case 'cancelled': return 'bg-red-400/20 text-red-400';
      default: return 'bg-slate-400/20 text-slate-400';
    }
  };

  const getTokenColor = (token: string) => {
    switch (token) {
      case 'QCT': return 'text-purple-400';
      case 'QOYN': return 'text-cyan-400';
      case 'USDC': return 'text-blue-400';
      case 'KNYT': return 'text-amber-400';
      default: return 'text-slate-400';
    }
  };

  const totalProposed = rewards.filter(r => r.status === 'draft').reduce((sum, r) => sum + r.amount, 0);
  const totalApproved = rewards.filter(r => r.status === 'approved').reduce((sum, r) => sum + r.amount, 0);
  const totalPaid = rewards.filter(r => r.status === 'paid').reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-3">
            <CreditCard className="text-purple-400" />
            Rewards
          </h1>
          <p className="text-slate-400 mt-1">
            Manage token rewards for top contributors
          </p>
        </div>
        <div className="flex items-center gap-3">
          {loading && <span className="text-sm text-slate-400">Loading...</span>}
          <button 
            onClick={() => setShowApprovalWorkflow(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg text-sm font-medium transition"
          >
            <Plus size={16} />
            Propose Rewards
          </button>
        </div>
      </div>

      {/* API Error Banner */}
      {apiError && (
        <div className="rounded-xl p-4 bg-amber-500/10 ring-1 ring-amber-500/20 flex items-center gap-3">
          <AlertCircle size={20} className="text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-400">Could not load rewards</p>
            <p className="text-xs text-slate-400">Run migrations to enable live data.</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
          <p className="text-sm text-slate-400">Total Rewards</p>
          <p className="text-2xl font-semibold mt-1">{rewards.length}</p>
        </div>
        <div className="rounded-xl p-4 bg-amber-400/10 ring-1 ring-amber-400/20">
          <p className="text-sm text-amber-400">Pending Approval</p>
          <p className="text-2xl font-semibold mt-1">{totalProposed.toFixed(1)} tokens</p>
        </div>
        <div className="rounded-xl p-4 bg-blue-400/10 ring-1 ring-blue-400/20">
          <p className="text-sm text-blue-400">Approved</p>
          <p className="text-2xl font-semibold mt-1">{totalApproved.toFixed(1)} tokens</p>
        </div>
        <div className="rounded-xl p-4 bg-emerald-400/10 ring-1 ring-emerald-400/20">
          <p className="text-sm text-emerald-400">Paid Out</p>
          <p className="text-2xl font-semibold mt-1">{totalPaid.toFixed(1)} tokens</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search rewards..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          title="Filter by status"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as 'crm' | 'grants')}
          className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          title="Reward source"
        >
          <option value="crm">CRM Proposed</option>
          <option value="grants">Live Reward Grants</option>
        </select>
        <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition">
          <Filter size={16} />
          More Filters
        </button>
      </div>

      {/* Rewards Table */}
      <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Recipient</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Token</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Amount</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">PoKW</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Status</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Period</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                  Loading rewards...
                </td>
              </tr>
            ) : filteredRewards.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                  No rewards found
                </td>
              </tr>
            ) : (
              filteredRewards.map((reward) => (
                <tr key={reward.id} className="border-b border-white/5 hover:bg-white/5 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-xs font-medium">
                        {reward.personaName.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium">{reward.personaName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Coins size={14} className={getTokenColor(reward.tokenType)} />
                      <span className={`font-medium ${getTokenColor(reward.tokenType)}`}>
                        {reward.tokenType}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-medium">{reward.amount.toFixed(1)}</span>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-400">
                    {reward.pokwBasis.toFixed(1)} PoKW
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(reward.status)}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(reward.status)}`}>
                        {reward.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-400 text-sm">
                    {new Date(reward.periodStart).toLocaleDateString()} - {new Date(reward.periodEnd).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <button className="p-2 hover:bg-white/10 rounded-lg transition" aria-label="More options">
                      <MoreVertical size={16} className="text-slate-400" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Showing {filteredRewards.length} of {rewards.length} rewards
        </p>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded text-sm transition disabled:opacity-50" disabled>
            Previous
          </button>
          <button className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded text-sm transition">
            Next
          </button>
        </div>
      </div>

      {/* Reward Approval Workflow Modal */}
      {showApprovalWorkflow && (
        <RewardApprovalWorkflow
          tenantId={currentTenantId}
          onClose={() => setShowApprovalWorkflow(false)}
          onSuccess={() => rewardsApi.fetch({ status: statusFilter !== 'all' ? statusFilter : undefined, limit: 100 })}
        />
      )}
    </div>
  );
}
