import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, Users, Activity } from 'lucide-react';

interface QCTAnalyticsCardProps {
  title: string;
}

function Card({ title, children, actions, className }: { title: React.ReactNode; children?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6 ${className || ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      <div className="space-y-2 text-sm text-slate-300">
        {children}
      </div>
    </div>
  );
}

function IconRefresh({ onClick, disabled, className }: { onClick?: () => void; disabled?: boolean; className?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-1 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed ${className || ''}`}
      aria-label="Refresh"
    >
      <svg className={`w-4 h-4 ${disabled ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </button>
  );
}

export function QCTAnalyticsCard({ title }: QCTAnalyticsCardProps) {
  const [analytics, setAnalytics] = useState({
    totalSupply: '100000',
    circulatingSupply: '75000',
    totalValueLocked: '2500000',
    tradingVolume24h: '150000',
    activeUsers: '1250',
    stakingParticipants: '340',
    averageStakeDuration: '45 days',
    governanceProposals: '12',
    successfulProposals: '8'
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      // TODO: Replace with real analytics API
      const mockData = {
        totalSupply: '100000',
        circulatingSupply: '75000',
        totalValueLocked: '2500000',
        tradingVolume24h: '150000',
        activeUsers: '1250',
        stakingParticipants: '340',
        averageStakeDuration: '45 days',
        governanceProposals: '12',
        successfulProposals: '8'
      };
      setAnalytics(mockData);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: string) => {
    return parseFloat(num).toLocaleString();
  };

  const formatCurrency = (num: string) => {
    return `$${parseFloat(num).toLocaleString()}`;
  };

  return (
    <Card title={title} actions={
      <IconRefresh
        onClick={loadAnalytics}
        disabled={loading}
        className={loading ? 'animate-spin' : ''}
      />
    }>
      <div className="space-y-4">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-lg p-4 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={16} className="text-blue-400" />
              <span className="text-xs font-medium text-slate-300">Total Value Locked</span>
            </div>
            <div className="text-xl font-bold text-blue-300">
              {formatCurrency(analytics.totalValueLocked)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Across all chains & staking pools
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-lg p-4 border border-green-500/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} className="text-green-400" />
              <span className="text-xs font-medium text-slate-300">24h Volume</span>
            </div>
            <div className="text-xl font-bold text-green-300">
              {formatCurrency(analytics.tradingVolume24h)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Cross-chain trading activity
            </div>
          </div>
        </div>

        {/* Supply Metrics */}
        <div className="bg-slate-800/30 rounded-lg p-4">
          <div className="text-sm font-medium text-slate-300 mb-3">Token Supply</div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-400">Total Supply:</span>
              <span className="ml-2 font-semibold text-slate-200">{formatNumber(analytics.totalSupply)} QCT</span>
            </div>
            <div>
              <span className="text-slate-400">Circulating:</span>
              <span className="ml-2 font-semibold text-slate-200">{formatNumber(analytics.circulatingSupply)} QCT</span>
            </div>
          </div>
        </div>

        {/* Community Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Users size={16} className="text-purple-400" />
              <span className="text-xs text-slate-400">Active Users</span>
            </div>
            <div className="text-lg font-semibold text-purple-300">
              {formatNumber(analytics.activeUsers)}
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={16} className="text-amber-400" />
              <span className="text-xs text-slate-400">Staking Participants</span>
            </div>
            <div className="text-lg font-semibold text-amber-300">
              {formatNumber(analytics.stakingParticipants)}
            </div>
          </div>
        </div>

        {/* Governance Metrics */}
        <div className="bg-slate-800/30 rounded-lg p-4">
          <div className="text-sm font-medium text-slate-300 mb-3">Governance</div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-400">Proposals:</span>
              <span className="ml-2 font-semibold text-slate-200">{analytics.governanceProposals}</span>
            </div>
            <div>
              <span className="text-slate-400">Success Rate:</span>
              <span className="ml-2 font-semibold text-green-400">
                {((parseFloat(analytics.successfulProposals) / parseFloat(analytics.governanceProposals)) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-400">Avg Stake Duration:</span>
              <span className="ml-2 text-slate-300">{analytics.averageStakeDuration}</span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center p-2 bg-slate-800/30 rounded">
            <div className="font-semibold text-blue-300">98.2%</div>
            <div className="text-slate-400">Uptime</div>
          </div>
          <div className="text-center p-2 bg-slate-800/30 rounded">
            <div className="font-semibold text-green-300">6</div>
            <div className="text-slate-400">Active Chains</div>
          </div>
          <div className="text-center p-2 bg-slate-800/30 rounded">
            <div className="font-semibold text-purple-300">$3.25</div>
            <div className="text-slate-400">Avg QCT Price</div>
          </div>
        </div>
      </div>
    </Card>
  );
}
