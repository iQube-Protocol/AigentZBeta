'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Award, FileText, Target, ChevronDown } from 'lucide-react';

interface ReputationData {
  id: string;
  bucket: number;
  score: number;
  skill_category: string;
  evidence_count: number;
  last_updated: number;
  partition_id: string;
}

interface AggregateReputation {
  totalScore: number;
  totalEvidence: number;
  averageBucket: number;
  domains: ReputationData[];
}

interface ReputationBadgeProps {
  partitionId: string;
  refreshKey?: number;
}

export function ReputationBadge({ partitionId, refreshKey = 0 }: ReputationBadgeProps) {
  const [aggregate, setAggregate] = useState<AggregateReputation | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string>('aggregate');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!partitionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    
    // Fetch all reputation buckets for this partition
    fetch(`/api/identity/persona/${partitionId}/reputation/all`)
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`API error: ${r.status}`);
        }
        const text = await r.text();
        try {
          return JSON.parse(text);
        } catch (e) {
          console.error('JSON parse error:', text);
          throw new Error('Invalid JSON response from server');
        }
      })
      .then(data => {
        if (data.ok && data.data && data.data.length > 0) {
          const domains = data.data;
          const totalScore = domains.reduce((sum: number, d: ReputationData) => sum + d.score, 0);
          const totalEvidence = domains.reduce((sum: number, d: ReputationData) => sum + d.evidence_count, 0);
          const averageBucket = Math.round(domains.reduce((sum: number, d: ReputationData) => sum + d.bucket, 0) / domains.length);
          
          setAggregate({
            totalScore,
            totalEvidence,
            averageBucket,
            domains
          });
        } else {
          setError(data.error || 'No reputation found');
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Reputation fetch error:', err);
        // Provide user-friendly message for 404 (no reputation initialized)
        if (err.message?.includes('404')) {
          setError('Reputation not yet initialized');
        } else {
          setError(err.message || 'Failed to load reputation');
        }
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

  if (error || !aggregate) {
    return (
      <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-md">
        <p className="text-sm text-slate-400">{error || 'No reputation data available'}</p>
      </div>
    );
  }

  const currentReputation = selectedDomain === 'aggregate' 
    ? {
        bucket: aggregate.averageBucket,
        score: aggregate.totalScore,
        skill_category: 'All Domains',
        evidence_count: aggregate.totalEvidence,
        last_updated: Math.max(...aggregate.domains.map(d => d.last_updated))
      }
    : aggregate.domains.find(d => d.id === selectedDomain) || aggregate.domains[0];

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
          <Award size={18} className={getBucketColor(currentReputation.bucket)} />
          <span className="text-xs text-slate-400 font-medium">Reputation Bucket</span>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-bold ${getBucketColor(currentReputation.bucket)}`}>
            {currentReputation.bucket}
          </div>
          <div className={`text-xs font-medium ${getBucketColor(currentReputation.bucket)}`}>
            {getBucketLabel(currentReputation.bucket)}
          </div>
        </div>
      </div>

      {/* Score */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
        <div className="flex items-center gap-2">
          <Target size={16} className={getScoreColor(currentReputation.score)} />
          <span className="text-xs text-slate-400">Reputation Score</span>
        </div>
        <span className={`text-xl font-bold ${getScoreColor(currentReputation.score)}`}>
          {Math.round(currentReputation.score)} / 100
        </span>
      </div>

      {/* Evidence Count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-indigo-400" />
          <span className="text-xs text-slate-400">Evidence Submitted</span>
        </div>
        <span className="text-lg font-semibold text-indigo-400">
          {currentReputation.evidence_count}
        </span>
      </div>

      {/* Skill Category / Domain Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-emerald-400" />
          <span className="text-xs text-slate-400">Skill Category</span>
        </div>
        <div className="relative">
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="appearance-none bg-slate-800 border border-slate-700 rounded px-3 py-1 pr-8 text-sm font-medium text-emerald-400 capitalize cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Select skill category domain"
          >
            <option value="aggregate">All Domains ({aggregate.domains.length})</option>
            {aggregate.domains.map(domain => (
              <option key={domain.id} value={domain.id}>
                {domain.skill_category.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none" />
        </div>
      </div>

      {/* Last Updated */}
      <div className="pt-3 border-t border-slate-700/50">
        <p className="text-xs text-slate-500">
          Last updated: {new Date(currentReputation.last_updated / 1000000).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
