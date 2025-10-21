'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Award, FileText, Target } from 'lucide-react';

interface ReputationData {
  bucket: number;
  score: number;
  skill_category: string;
  evidence_count: number;
  last_updated: number;
}

interface ReputationBadgeProps {
  partitionId: string;
  refreshKey?: number;
}

export function ReputationBadge({ partitionId, refreshKey = 0 }: ReputationBadgeProps) {
  const [reputation, setReputation] = useState<ReputationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!partitionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/identity/reputation/bucket?partitionId=${partitionId}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.data) {
          setReputation(data.data);
        } else {
          setError(data.error || 'No reputation found');
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load reputation');
        setLoading(false);
      });
  }, [partitionId, refreshKey]);

  if (loading) {
    return (
      <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-md">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-slate-700 rounded w-1/3"></div>
          <div className="h-8 bg-slate-700 rounded w-1/2"></div>
          <div className="h-4 bg-slate-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error || !reputation) {
    return (
      <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-md">
        <p className="text-sm text-slate-400">{error || 'No reputation data available'}</p>
      </div>
    );
  }

  const getBucketColor = (bucket: number) => {
    if (bucket >= 4) return 'text-purple-400';
    if (bucket >= 3) return 'text-green-400';
    if (bucket >= 2) return 'text-blue-400';
    if (bucket >= 1) return 'text-yellow-400';
    return 'text-slate-400';
  };

  const getBucketLabel = (bucket: number) => {
    if (bucket >= 4) return 'Excellent';
    if (bucket >= 3) return 'Good Standing';
    if (bucket >= 2) return 'Fair';
    if (bucket >= 1) return 'Developing';
    return 'New / Building';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-purple-400';
    if (score >= 60) return 'text-green-400';
    if (score >= 40) return 'text-blue-400';
    if (score >= 20) return 'text-yellow-400';
    return 'text-slate-400';
  };

  return (
    <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-md space-y-4">
      {/* Bucket Level */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award size={18} className={getBucketColor(reputation.bucket)} />
          <span className="text-xs text-slate-400 font-medium">Reputation Bucket</span>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-bold ${getBucketColor(reputation.bucket)}`}>
            {reputation.bucket}
          </div>
          <div className={`text-xs font-medium ${getBucketColor(reputation.bucket)}`}>
            {getBucketLabel(reputation.bucket)}
          </div>
        </div>
      </div>

      {/* Score */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
        <div className="flex items-center gap-2">
          <Target size={16} className={getScoreColor(reputation.score)} />
          <span className="text-xs text-slate-400">Reputation Score</span>
        </div>
        <span className={`text-xl font-bold ${getScoreColor(reputation.score)}`}>
          {reputation.score} / 100
        </span>
      </div>

      {/* Evidence Count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-indigo-400" />
          <span className="text-xs text-slate-400">Evidence Submitted</span>
        </div>
        <span className="text-lg font-semibold text-indigo-400">
          {reputation.evidence_count}
        </span>
      </div>

      {/* Skill Category */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-emerald-400" />
          <span className="text-xs text-slate-400">Skill Category</span>
        </div>
        <span className="text-sm font-medium text-emerald-400 capitalize">
          {reputation.skill_category.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Last Updated */}
      <div className="pt-3 border-t border-slate-700/50">
        <p className="text-xs text-slate-500">
          Last updated: {new Date(reputation.last_updated / 1000000).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
