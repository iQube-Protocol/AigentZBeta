"use client";

import React, { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, AlertTriangle, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface DiDQubeReputationCardProps {
  selectedPersonaId?: string;
}

export function DiDQubeReputationCard({ selectedPersonaId }: DiDQubeReputationCardProps = {}) {
  const [partitionId, setPartitionId] = useState('');
  const [bucket, setBucket] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-populate when persona is selected
  useEffect(() => {
    if (selectedPersonaId) {
      setPartitionId(selectedPersonaId);
      // Auto-check reputation when persona is clicked
      checkReputationForId(selectedPersonaId);
    }
  }, [selectedPersonaId]);

  const checkReputationForId = async (id: string) => {
    if (!id.trim()) {
      setError('Partition ID required');
      return;
    }

    setLoading(true);
    setError(null);
    setBucket(null);

    try {
      const res = await fetch(`/api/identity/reputation/bucket?partitionId=${encodeURIComponent(id)}`);
      const data = await res.json();
      
      if (data.ok) {
        setBucket(data.data.bucket);
      } else {
        setError(data.error || 'Failed to fetch reputation');
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const checkReputation = () => checkReputationForId(partitionId);

  const getBucketColor = (b: number) => {
    if (b >= 3) return 'text-green-400';
    if (b >= 1) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getBucketLabel = (b: number) => {
    if (b >= 3) return 'Good Standing';
    if (b >= 1) return 'Moderate';
    return 'Low Reputation';
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={20} className="text-emerald-400" />
        <h2 className="text-xl font-semibold text-slate-100">ReputationQube (RQH)</h2>
      </div>

      <div className="space-y-4 text-sm text-slate-300">
        <div>
          <label className="block text-xs text-slate-400 mb-2">Partition ID (Persona ID)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={partitionId}
              onChange={(e) => setPartitionId(e.target.value)}
              placeholder="Enter partition ID..."
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={checkReputation}
              disabled={loading || !partitionId.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : 'Check'}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-700/50 rounded-md">
            <AlertTriangle size={16} className="text-red-400" />
            <span className="text-red-400 text-xs">{error}</span>
          </div>
        )}

        {bucket !== null && (
          <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Reputation Bucket</span>
              <span className={`text-2xl font-bold ${getBucketColor(bucket)}`}>{bucket}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Status</span>
              <span className={`text-xs font-medium ${getBucketColor(bucket)}`}>
                {getBucketLabel(bucket)}
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-700/50">
              <p className="text-xs text-slate-500">
                Bucket determines access to identity-gated templates and actions in the Registry.
              </p>
            </div>
          </div>
        )}

        {!bucket && !error && !loading && (
          <div className="text-center py-4 text-slate-500 text-xs">
            Enter a partition ID to check reputation
          </div>
        )}

        <div className="pt-3 border-t border-slate-700/50 space-y-3">
          <p className="text-xs text-slate-500">
            <strong>Note:</strong> RQH canister must be deployed and RQH_CANISTER_ID configured for live data.
          </p>
          <div className="grid grid-cols-1 gap-2">
            <Link 
              href="/admin/reputation"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              <ExternalLink size={14} />
              Manage Reputation
            </Link>
            {selectedPersonaId && (
              <Link 
                href={`/identity/persona/${selectedPersonaId}`}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
              >
                <TrendingUp size={14} />
                View Identity and Reputation Card
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
