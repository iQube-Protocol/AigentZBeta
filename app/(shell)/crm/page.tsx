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
  AlertCircle
} from 'lucide-react';
import { useCrmContext } from './CrmContext';
import { usePersonas, useContributions, useRewards, useSegments, useFranchises, useTopContributors } from './hooks/useCrmApi';

interface DashboardStats {
  totalPersonas: number;
  activePersonas: number;
  pendingPersonas: number;
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

interface ActivityItem {
  type: 'persona' | 'contribution' | 'reward';
  action: string;
  label: string;
  createdAt: string;
}

function formatTimeAgo(isoTime?: string) {
  if (!isoTime) return '—';
  const time = new Date(isoTime).getTime();
  if (Number.isNaN(time)) return '—';
  const diffMs = Date.now() - time;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function CRMDashboardPage() {
  const { currentTenantId } = useCrmContext();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topContributors, setTopContributors] = useState<TopContributor[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
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
        const [personasRes, personaStatsRes, contributionsRes, rewardsRes, segmentsRes, franchisesRes, topRes] = await Promise.all([
          personasApi.fetch({ limit: 10, source: 'live' }),
          personasApi.fetch({ stats: true, source: 'live' }),
          contributionsApi.fetch({ limit: 1000 }),
          rewardsApi.fetch(),
          segmentsApi.fetch({ limit: 1000 }),
          franchisesApi.fetch({ includeTenants: true, activeOnly: false }),
          topContributorsApi.fetch({ limit: 5 }),
        ]);

        // Calculate stats from API responses
        const personas = personasRes?.data || [];
        const personaStats = personaStatsRes?.data as any;
        const contributions = contributionsRes?.data || [];
        const rewards = rewardsRes?.data || [];
        const segments = segmentsRes?.data || [];
        const franchises = franchisesRes?.data || [];
        const topContrib = topRes?.data || [];

        const totalPokw = contributions.reduce((sum: number, c: any) => sum + (c.pokwScore || 0), 0);
        const pendingRewards = rewards.filter((r: any) => r.status === 'draft').length;
        const tenantCount = franchises.reduce((sum: number, f: any) => sum + (f.tenants?.length || 0), 0);

        setStats({
          totalPersonas: personaStats?.total ?? personas.length,
          activePersonas: personaStats?.byStatus?.active ?? personas.filter((p: any) => p.personaState === 'active').length,
          pendingPersonas: personaStats?.byStatus?.pending ?? personas.filter((p: any) => p.personaState === 'pending').length,
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

        const personaMap = new Map<string, string>();
        personas.forEach((persona: any) => {
          personaMap.set(persona.id, persona.displayName || persona.email || persona.id?.slice(0, 12) + '...');
        });

        const activity: ActivityItem[] = [
          ...personas.slice(0, 3).map((p: any) => ({
            type: 'persona' as const,
            action: 'Persona created',
            label: personaMap.get(p.id) || p.id?.slice(0, 12) + '...',
            createdAt: p.createdAt,
          })),
          ...contributions.slice(0, 3).map((c: any) => ({
            type: 'contribution' as const,
            action: 'Contribution recorded',
            label: personaMap.get(c.personaId) || c.personaId?.slice(0, 12) + '...',
            createdAt: c.createdAt,
          })),
          ...rewards.slice(0, 3).map((r: any) => ({
            type: 'reward' as const,
            action: 'Reward updated',
            label: personaMap.get(r.personaId) || r.personaId?.slice(0, 12) + '...',
            createdAt: r.createdAt,
          })),
        ]
          .filter((item) => item.createdAt)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);

        setRecentActivity(activity);
      } catch (err: any) {
        console.error('Dashboard fetch error:', err);
        setApiError(err.message || 'Failed to load dashboard data');
        
        // Fallback to mock data if API fails
        setStats({
          totalPersonas: 0,
          activePersonas: 0,
          pendingPersonas: 0,
          totalContributions: 0,
          totalPokw: 0,
          pendingRewards: 0,
          totalSegments: 0,
          franchiseCount: 0,
          tenantCount: 0,
        });
        setRecentActivity([]);
      }
    }

    fetchDashboardData();
  }, [currentTenantId]);

  const statCards = [
    {
      title: 'Total Personas',
      value: stats?.totalPersonas.toLocaleString() || '—',
      icon: Users,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-400/10',
      href: '/crm/personas',
    },
    {
      title: 'Pending Invites',
      value: stats?.pendingPersonas.toString() || '—',
      icon: Shield,
      color: 'text-amber-400',
      bgColor: 'bg-amber-400/10',
      href: '/crm/personas',
    },
    {
      title: 'Total PoKW',
      value: stats?.totalPokw.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '—',
      icon: TrendingUp,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-400/10',
      href: '/crm/contributions',
    },
    {
      title: 'Contributions',
      value: stats?.totalContributions.toLocaleString() || '—',
      icon: Award,
      color: 'text-amber-400',
      bgColor: 'bg-amber-400/10',
      href: '/crm/contributions',
    },
    {
      title: 'Pending Rewards',
      value: stats?.pendingRewards.toString() || '—',
      icon: CreditCard,
      color: 'text-purple-400',
      bgColor: 'bg-purple-400/10',
      href: '/crm/rewards',
    },
    {
      title: 'Segments',
      value: stats?.totalSegments.toString() || '—',
      icon: Layers,
      color: 'text-pink-400',
      bgColor: 'bg-pink-400/10',
      href: '/crm/segments',
    },
    {
      title: 'Franchises',
      value: stats?.franchiseCount.toString() || '—',
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
              <div className="flex items-center gap-1 text-sm text-slate-500">
                <span>—</span>
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
            {recentActivity.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No recent activity</p>
            ) : (
              recentActivity.map((item, i) => (
                <div key={`${item.type}-${i}`} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      item.type === 'persona' ? 'bg-cyan-400' :
                      item.type === 'contribution' ? 'bg-amber-400' :
                      'bg-purple-400'
                    }`} />
                    <div>
                      <p className="text-sm">{item.action}</p>
                      <p className="text-xs text-slate-400">{item.label}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500">{formatTimeAgo(item.createdAt)}</span>
                </div>
              ))
            )}
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
