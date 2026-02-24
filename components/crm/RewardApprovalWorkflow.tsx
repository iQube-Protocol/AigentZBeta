'use client';

import { useState, useEffect } from 'react';
import { 
  Gift, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  User,
  TrendingUp,
  Filter,
  X
} from 'lucide-react';

interface Reward {
  id: string;
  personaId: string;
  personaName?: string;
  tokenType: string;
  amount: number;
  pokwBasis: number;
  status: 'proposed' | 'approved' | 'rejected' | 'distributed' | 'cancelled';
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

interface RewardApprovalWorkflowProps {
  tenantId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function RewardApprovalWorkflow({ 
  tenantId, 
  onClose,
  onSuccess 
}: RewardApprovalWorkflowProps) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'proposed' | 'approved' | 'rejected'>('proposed');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedRewards, setSelectedRewards] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchRewards();
  }, [tenantId, filter]);

  const fetchRewards = async () => {
    setLoading(true);
    setError(null);

    try {
      const statusParam = filter === 'all' ? '' : `&status=${filter}`;
      const response = await fetch(
        `/api/crm/rewards?tenantId=${tenantId}${statusParam}&limit=50`
      );
      
      if (!response.ok) throw new Error('Failed to fetch rewards');
      
      const data = await response.json();
      setRewards(data.rewards || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load rewards');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (rewardId: string) => {
    setProcessingId(rewardId);
    
    try {
      const response = await fetch(`/api/crm/rewards/${rewardId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });

      if (!response.ok) throw new Error('Failed to approve reward');

      // Update local state
      setRewards(prev => prev.map(r => 
        r.id === rewardId 
          ? { ...r, status: 'approved', approvedAt: new Date().toISOString() }
          : r
      ));

      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (rewardId: string) => {
    setProcessingId(rewardId);
    
    try {
      const response = await fetch(`/api/crm/rewards/${rewardId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });

      if (!response.ok) throw new Error('Failed to reject reward');

      // Update local state
      setRewards(prev => prev.map(r => 
        r.id === rewardId ? { ...r, status: 'rejected' } : r
      ));

      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedRewards.size === 0) return;

    setProcessingId('bulk');
    
    try {
      await Promise.all(
        Array.from(selectedRewards).map(id => 
          fetch(`/api/crm/rewards/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId }),
          })
        )
      );

      // Update local state
      setRewards(prev => prev.map(r => 
        selectedRewards.has(r.id)
          ? { ...r, status: 'approved', approvedAt: new Date().toISOString() }
          : r
      ));

      setSelectedRewards(new Set());
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedRewards);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRewards(newSelected);
  };

  const selectAllProposed = () => {
    const proposedIds = rewards
      .filter(r => r.status === 'proposed')
      .map(r => r.id);
    setSelectedRewards(new Set(proposedIds));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'proposed':
        return (
          <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-cyan-400/20 text-cyan-400">
            <Clock size={12} />
            Proposed
          </span>
        );
      case 'approved':
        return (
          <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-400/20 text-emerald-400">
            <CheckCircle size={12} />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-400/20 text-red-400">
            <XCircle size={12} />
            Rejected
          </span>
        );
      case 'distributed':
        return (
          <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-400/20 text-purple-400">
            <Gift size={12} />
            Distributed
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-400/20 text-slate-400">
            {status}
          </span>
        );
    }
  };

  const proposedCount = rewards.filter(r => r.status === 'proposed').length;
  const totalProposedAmount = rewards
    .filter(r => r.status === 'proposed')
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden ring-1 ring-white/10 flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Gift className="text-purple-400" size={20} />
              Reward Approval Workflow
            </h2>
            <p className="text-sm text-slate-400 mt-1">Review and approve pending rewards</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition" aria-label="Close">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/20 p-4">
              <p className="text-sm text-slate-400 mb-1">Pending Approval</p>
              <p className="text-2xl font-semibold text-cyan-400">{proposedCount}</p>
            </div>
            <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4">
              <p className="text-sm text-slate-400 mb-1">Total Proposed</p>
              <p className="text-2xl font-semibold">{totalProposedAmount.toLocaleString()}</p>
            </div>
            <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4">
              <p className="text-sm text-slate-400 mb-1">Selected</p>
              <p className="text-2xl font-semibold">{selectedRewards.size}</p>
            </div>
          </div>

          {/* Filters and Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
                {(['all', 'proposed', 'approved', 'rejected'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 rounded text-sm font-medium transition capitalize ${
                      filter === f 
                        ? 'bg-cyan-500 text-white' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {filter === 'proposed' && proposedCount > 0 && (
                <>
                  <button
                    onClick={selectAllProposed}
                    className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition"
                  >
                    Select All
                  </button>
                  <button
                    onClick={handleBulkApprove}
                    disabled={selectedRewards.size === 0 || processingId === 'bulk'}
                    className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition"
                  >
                    {processingId === 'bulk' ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <CheckCircle size={14} />
                    )}
                    Approve Selected ({selectedRewards.size})
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg p-3 bg-red-500/10 ring-1 ring-red-500/20 flex items-center gap-2">
              <AlertCircle size={16} className="text-red-400" />
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          {/* Rewards List */}
          <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-cyan-400" />
              </div>
            ) : rewards.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                No rewards found
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {rewards.map((reward) => (
                  <div key={reward.id} className="hover:bg-white/5 transition">
                    <div className="flex items-center gap-4 p-4">
                      {reward.status === 'proposed' && (
                        <input
                          type="checkbox"
                          checked={selectedRewards.has(reward.id)}
                          onChange={() => toggleSelect(reward.id)}
                          className="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500"
                        />
                      )}
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                          <User size={18} />
                        </div>
                        <div>
                          <p className="font-medium">{reward.personaName || `Persona ${reward.personaId.slice(0, 8)}...`}</p>
                          <p className="text-xs text-slate-400">Based on {reward.pokwBasis.toLocaleString()} PoKW</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-lg">{reward.amount.toLocaleString()}</p>
                        <p className="text-xs text-slate-400">{reward.tokenType}</p>
                      </div>
                      <div className="w-28">{getStatusBadge(reward.status)}</div>
                      <div className="flex items-center gap-2">
                        {reward.status === 'proposed' && (
                          <>
                            <button onClick={() => handleApprove(reward.id)} disabled={processingId === reward.id}
                              className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition disabled:opacity-50" title="Approve">
                              {processingId === reward.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                            </button>
                            <button onClick={() => handleReject(reward.id)} disabled={processingId === reward.id}
                              className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition disabled:opacity-50" title="Reject">
                              <XCircle size={16} />
                            </button>
                          </>
                        )}
                        <button onClick={() => setExpandedId(expandedId === reward.id ? null : reward.id)} className="p-2 hover:bg-white/10 rounded-lg transition">
                          {expandedId === reward.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                        </button>
                      </div>
                    </div>
                    {expandedId === reward.id && (
                      <div className="px-4 pb-4 pt-0">
                        <div className="rounded-lg bg-white/5 p-4 grid grid-cols-3 gap-4 text-sm">
                          <div><p className="text-slate-400 mb-1">Period</p><p>{new Date(reward.periodStart).toLocaleDateString()} - {new Date(reward.periodEnd).toLocaleDateString()}</p></div>
                          <div><p className="text-slate-400 mb-1">Created</p><p>{new Date(reward.createdAt).toLocaleString()}</p></div>
                          {reward.approvedAt && <div><p className="text-slate-400 mb-1">Approved</p><p>{new Date(reward.approvedAt).toLocaleString()}</p></div>}
                          <div><p className="text-slate-400 mb-1">Reward ID</p><p className="font-mono text-xs">{reward.id}</p></div>
                          <div><p className="text-slate-400 mb-1">Persona ID</p><p className="font-mono text-xs">{reward.personaId}</p></div>
                          <div><p className="text-slate-400 mb-1">PoKW Basis</p><p className="flex items-center gap-1"><TrendingUp size={14} className="text-emerald-400" />{reward.pokwBasis.toLocaleString()}</p></div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
