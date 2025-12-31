'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, 
  Award, 
  CreditCard, 
  Layers, 
  Building2, 
  TrendingUp,
  Shield,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle
} from 'lucide-react';
import { useCrmContext } from './CrmContext';
import { usePersonas, useContributions, useRewards, useSegments, useFranchises, useTopContributors } from './hooks/useCrmApi';

interface DashboardStats {
  totalPersonas: number;
  activePersonas: number;
  totalContributions: number;
  totalPokw: number;
  pendingRewards: number;
  totalSegments: number;
  franchiseCount: number;
  tenantCount: number;
}

interface TopContributor {
  personaId: string;
  displayName: string;
  totalPokw: number;
  contributionCount: number;
}

export default function CRMDashboardPage() {
  const { currentTenantId } = useCrmContext();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topContributors, setTopContributors] = useState<TopContributor[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  
  const personasApi = usePersonas(currentTenantId);
  const contributionsApi = useContributions(currentTenantId);
  const rewardsApi = useRewards(currentTenantId);
  const segmentsApi = useSegments(currentTenantId);
  const franchisesApi = useFranchises();
  const topContributorsApi = useTopContributors(currentTenantId);

  const loading = personasApi.loading || contributionsApi.loading || rewardsApi.loading || 
                  segmentsApi.loading || franchisesApi.loading || topContributorsApi.loading;

  useEffect(() => {
    async function fetchDashboardData() {
      setApiError(null);
      
      try {
        // Fetch all data in parallel
        const [personasRes, contributionsRes, rewardsRes, segmentsRes, franchisesRes, topRes] = await Promise.all([
          personasApi.fetch({ limit: 1000 }),
          contributionsApi.fetch({ limit: 1000 }),
          rewardsApi.fetch(),
          segmentsApi.fetch(),
          franchisesApi.fetch({ includeTenants: true }),
          topContributorsApi.fetch({ limit: 5 }),
        ]);

        // Calculate stats from API responses
        const personas = personasRes?.data || [];
        const contributions = contributionsRes?.data || [];
        const rewards = rewardsRes?.data || [];
        const segments = segmentsRes?.data || [];
        const franchises = franchisesRes?.data || [];
        const topContrib = topRes?.data || [];

        const totalPokw = contributions.reduce((sum: number, c: any) => sum + (c.pokwScore || 0), 0);
        const pendingRewards = rewards.filter((r: any) => r.status === 'proposed').length;
        const tenantCount = franchises.reduce((sum: number, f: any) => sum + (f.tenants?.length || 0), 0);

        setStats({
          totalPersonas: personas.length,
          activePersonas: personas.filter((p: any) => p.personaState === 'active').length,
          totalContributions: contributions.length,
          totalPokw,
          pendingRewards,
          totalSegments: segments.length,
          franchiseCount: franchises.length,
          tenantCount,
        });

        setTopContributors(topContrib.map((c: any) => ({
          personaId: c.personaId,
          displayName: c.displayName || c.personaId?.slice(0, 12) + '...',
          totalPokw: c.totalPokw || 0,
          contributionCount: c.contributionCount || 0,
        })));
      } catch (err: any) {
        console.error('Dashboard fetch error:', err);
        setApiError(err.message || 'Failed to load dashboard data');
        
        // Fallback to mock data if API fails
        setStats({
          totalPersonas: 0,
          activePersonas: 0,
          totalContributions: 0,
          totalPokw: 0,
          pendingRewards: 0,
          totalSegments: 0,
          franchiseCount: 0,
          tenantCount: 0,
        });
      }
    }

    fetchDashboardData();
  }, [currentTenantId]);

  const statCards = [
    {
      title: 'Total Personas',
      value: stats?.totalPersonas.toLocaleString() || '—',
      change: '+12%',
      positive: true,
      icon: Users,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-400/10',
      href: '/crm/personas',
    },
    {
      title: 'Total PoKW',
      value: stats?.totalPokw.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '—',
      change: '+8.5%',
      positive: true,
      icon: TrendingUp,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-400/10',
      href: '/crm/contributions',
    },
    {
      title: 'Contributions',
      value: stats?.totalContributions.toLocaleString() || '—',
      change: '+24%',
      positive: true,
      icon: Award,
      color: 'text-amber-400',
      bgColor: 'bg-amber-400/10',
      href: '/crm/contributions',
    },
    {
      title: 'Pending Rewards',
      value: stats?.pendingRewards.toString() || '—',
      change: '-5',
      positive: false,
      icon: CreditCard,
      color: 'text-purple-400',
      bgColor: 'bg-purple-400/10',
      href: '/crm/rewards',
    },
    {
      title: 'Segments',
      value: stats?.totalSegments.toString() || '—',
      change: '+2',
      positive: true,
      icon: Layers,
      color: 'text-pink-400',
      bgColor: 'bg-pink-400/10',
      href: '/crm/segments',
    },
    {
      title: 'Franchises',
      value: stats?.franchiseCount.toString() || '—',
      change: '—',
      positive: true,
      icon: Building2,
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10',
      href: '/crm/franchises',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">AgentiQ CRM</h1>
          <p className="text-slate-400 mt-1">
            Manage personas, contributions, rewards, and segments across your tenants
          </p>
        </div>
        {loading && (
          <div className="text-sm text-slate-400">Loading...</div>
        )}
      </div>

      {/* API Error Banner */}
      {apiError && (
        <div className="rounded-xl p-4 bg-amber-500/10 ring-1 ring-amber-500/20 flex items-center gap-3">
          <AlertCircle size={20} className="text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-400">Database not connected</p>
            <p className="text-xs text-slate-400">Run migrations to enable live data. Showing empty state.</p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition group"
          >
            <div className="flex items-start justify-between">
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <card.icon size={20} className={card.color} />
              </div>
              <div className="flex items-center gap-1 text-sm">
                {card.positive ? (
                  <ArrowUpRight size={14} className="text-emerald-400" />
                ) : (
                  <ArrowDownRight size={14} className="text-red-400" />
                )}
                <span className={card.positive ? 'text-emerald-400' : 'text-red-400'}>
                  {card.change}
                </span>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-slate-400 text-sm">{card.title}</p>
              <p className="text-2xl font-semibold mt-1">{card.value}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="rounded-2xl p-6 bg-white/5 ring-1 ring-white/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Recent Activity</h2>
            <Activity size={18} className="text-slate-400" />
          </div>
          <div className="space-y-3">
            {[
              { action: 'New persona created', persona: 'alice.eth', time: '2 min ago', type: 'persona' },
              { action: 'Contribution recorded', persona: 'bob.fio', time: '5 min ago', type: 'contribution' },
              { action: 'Reward approved', persona: 'charlie.eth', time: '12 min ago', type: 'reward' },
              { action: 'Segment updated', persona: 'Power Users', time: '1 hour ago', type: 'segment' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    item.type === 'persona' ? 'bg-cyan-400' :
                    item.type === 'contribution' ? 'bg-amber-400' :
                    item.type === 'reward' ? 'bg-purple-400' : 'bg-pink-400'
                  }`} />
                  <div>
                    <p className="text-sm">{item.action}</p>
                    <p className="text-xs text-slate-400">{item.persona}</p>
                  </div>
                </div>
                <span className="text-xs text-slate-500">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Contributors */}
        <div className="rounded-2xl p-6 bg-white/5 ring-1 ring-white/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Top Contributors (This Month)</h2>
            <TrendingUp size={18} className="text-emerald-400" />
          </div>
          <div className="space-y-3">
            {topContributors.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No contributors yet</p>
            ) : (
              topContributors.map((contributor, index) => (
                <div key={contributor.personaId} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      index === 0 ? 'bg-amber-400/20 text-amber-400' :
                      index === 1 ? 'bg-slate-400/20 text-slate-300' :
                      index === 2 ? 'bg-orange-400/20 text-orange-400' :
                      'bg-white/5 text-slate-400'
                    }`}>
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{contributor.displayName}</p>
                      <p className="text-xs text-slate-400">{contributor.contributionCount} contributions</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-emerald-400">
                    {contributor.totalPokw.toLocaleString()} PoKW
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Admin Section */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-red-500/10 to-purple-500/10 ring-1 ring-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield size={24} className="text-red-400" />
            <div>
              <h2 className="text-lg font-medium">Admin Controls</h2>
              <p className="text-sm text-slate-400">Manage admin roles, franchises, and platform settings</p>
            </div>
          </div>
          <Link
            href="/crm/admin"
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition"
          >
            Manage Admins
          </Link>
        </div>
      </div>
    </div>
  );
}
