'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft,
  User,
  Star,
  TrendingUp,
  Calendar,
  Mail,
  Wallet,
  Shield,
  Activity,
  Gift,
  FileText,
  Edit,
  MoreVertical,
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink
} from 'lucide-react';
import { useCrmContext } from '../../CrmContext';

interface PersonaDetail {
  id: string;
  tenantId: string;
  kybeDid?: string;
  displayName: string;
  email?: string;
  personaState: string;
  reputationBucket?: string;
  primaryWalletAddress?: string;
  totalPokw: number;
  contributionCount: number;
  rewardCount: number;
  segmentCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Contribution {
  id: string;
  contributionType: string;
  units: number;
  pokwScore: number;
  source: string;
  createdAt: string;
}

interface Reward {
  id: string;
  tokenType: string;
  amount: number;
  status: string;
  createdAt: string;
}

export default function PersonaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentTenantId } = useCrmContext();
  const personaId = params.id as string;

  const [persona, setPersona] = useState<PersonaDetail | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'contributions' | 'rewards' | 'activity'>('overview');

  useEffect(() => {
    async function fetchPersonaDetails() {
      if (!currentTenantId || !personaId) return;
      
      setLoading(true);
      setError(null);

      try {
        // Fetch persona details
        const personaRes = await fetch(`/api/crm/personas?tenantId=${currentTenantId}&personaId=${personaId}&source=live`);
        if (!personaRes.ok) throw new Error('Failed to fetch persona');
        const personaData = await personaRes.json();
        setPersona(personaData.data || personaData);

        // Fetch contributions
        const contribRes = await fetch(`/api/crm/contributions?tenantId=${currentTenantId}&personaId=${personaId}&limit=10`);
        if (contribRes.ok) {
          const contribData = await contribRes.json();
          setContributions(contribData.data || contribData.contributions || []);
        }

        // Fetch rewards
        const rewardsRes = await fetch(`/api/crm/rewards?tenantId=${currentTenantId}&personaId=${personaId}&limit=10`);
        if (rewardsRes.ok) {
          const rewardsData = await rewardsRes.json();
          setRewards(rewardsData.data || rewardsData.rewards || []);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load persona details');
      } finally {
        setLoading(false);
      }
    }

    fetchPersonaDetails();
  }, [currentTenantId, personaId]);

  const getStateColor = (state: string) => {
    switch (state) {
      case 'active': return 'bg-emerald-400/20 text-emerald-400 ring-emerald-400/30';
      case 'pending': return 'bg-amber-400/20 text-amber-400 ring-amber-400/30';
      case 'suspended': return 'bg-red-400/20 text-red-400 ring-red-400/30';
      default: return 'bg-slate-400/20 text-slate-400 ring-slate-400/30';
    }
  };

  const getReputationColor = (bucket?: string) => {
    switch (bucket) {
      case 'trusted': return 'text-emerald-400';
      case 'verified': return 'text-cyan-400';
      case 'new': return 'text-slate-400';
      case 'flagged': return 'text-red-400';
      default: return 'text-slate-500';
    }
  };

  const getRewardStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle size={14} className="text-emerald-400" />;
      case 'pending': return <Clock size={14} className="text-amber-400" />;
      case 'proposed': return <Clock size={14} className="text-cyan-400" />;
      default: return <AlertCircle size={14} className="text-slate-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading persona details...</p>
        </div>
      </div>
    );
  }

  if (error || !persona) {
    return (
      <div className="space-y-6">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition"
        >
          <ArrowLeft size={20} />
          Back to Personas
        </button>
        <div className="rounded-xl p-6 bg-red-500/10 ring-1 ring-red-500/20">
          <div className="flex items-center gap-3">
            <AlertCircle size={24} className="text-red-400" />
            <div>
              <p className="font-medium text-red-400">Error loading persona</p>
              <p className="text-sm text-slate-400">{error || 'Persona not found'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button 
        onClick={() => router.back()}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition"
      >
        <ArrowLeft size={20} />
        Back to Personas
      </button>

      {/* Header */}
      <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-2xl font-medium">
              {persona.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-semibold">{persona.displayName}</h1>
              {persona.email && (
                <p className="text-slate-400 flex items-center gap-2 mt-1">
                  <Mail size={14} />
                  {persona.email}
                </p>
              )}
              {persona.kybeDid && (
                <p className="text-xs text-slate-500 font-mono mt-1">
                  {persona.kybeDid}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ring-1 ${getStateColor(persona.personaState)}`}>
              {persona.personaState}
            </span>
            <button className="p-2 hover:bg-white/10 rounded-lg transition">
              <Edit size={18} className="text-slate-400" />
            </button>
            <button className="p-2 hover:bg-white/10 rounded-lg transition">
              <MoreVertical size={18} className="text-slate-400" />
            </button>
          </div>
        </div>
        {persona.personaState === 'pending' && (
          <div className="mt-4 rounded-lg bg-amber-400/10 ring-1 ring-amber-400/20 px-4 py-3 text-sm text-amber-300">
            Pending invite awaiting account activation.
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="rounded-xl bg-white/5 p-4">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <TrendingUp size={14} />
              Total PoKW
            </div>
            <p className="text-2xl font-semibold text-emerald-400">
              {persona.totalPokw.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <FileText size={14} />
              Contributions
            </div>
            <p className="text-2xl font-semibold">
              {persona.contributionCount}
            </p>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Gift size={14} />
              Rewards
            </div>
            <p className="text-2xl font-semibold">
              {persona.rewardCount || rewards.length}
            </p>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Star size={14} className={getReputationColor(persona.reputationBucket)} />
              Reputation
            </div>
            <p className={`text-2xl font-semibold capitalize ${getReputationColor(persona.reputationBucket)}`}>
              {persona.reputationBucket || 'Unrated'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg w-fit">
        {(['overview', 'contributions', 'rewards', 'activity'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition capitalize ${
              activeTab === tab 
                ? 'bg-cyan-500 text-white' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-6">
          {/* Details Card */}
          <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6">
            <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
              <User size={18} className="text-cyan-400" />
              Details
            </h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-slate-400">Persona ID</dt>
                <dd className="font-mono text-sm">{persona.id.slice(0, 8)}...</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Tenant</dt>
                <dd>{persona.tenantId}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Created</dt>
                <dd>{new Date(persona.createdAt).toLocaleDateString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Last Updated</dt>
                <dd>{new Date(persona.updatedAt).toLocaleDateString()}</dd>
              </div>
              {persona.primaryWalletAddress && (
                <div className="flex justify-between">
                  <dt className="text-slate-400">Wallet</dt>
                  <dd className="font-mono text-sm flex items-center gap-1">
                    {persona.primaryWalletAddress.slice(0, 8)}...
                    <ExternalLink size={12} className="text-slate-500" />
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Recent Activity Card */}
          <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6">
            <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Activity size={18} className="text-cyan-400" />
              Recent Activity
            </h3>
            {contributions.length === 0 ? (
              <p className="text-slate-400 text-sm">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {contributions.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div>
                      <p className="text-sm font-medium capitalize">
                        {c.contributionType.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-emerald-400 text-sm font-medium">
                      +{c.pokwScore} PoKW
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'contributions' && (
        <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Type</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Units</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">PoKW</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Source</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Date</th>
              </tr>
            </thead>
            <tbody>
              {contributions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    No contributions recorded
                  </td>
                </tr>
              ) : (
                contributions.map((c) => (
                  <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-6 py-4 capitalize">
                      {c.contributionType.replace(/_/g, ' ')}
                    </td>
                    <td className="px-6 py-4 text-right">{c.units}</td>
                    <td className="px-6 py-4 text-right text-emerald-400 font-medium">
                      +{c.pokwScore}
                    </td>
                    <td className="px-6 py-4 text-slate-400">{c.source}</td>
                    <td className="px-6 py-4 text-right text-slate-400 text-sm">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'rewards' && (
        <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Token</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Amount</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Status</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Date</th>
              </tr>
            </thead>
            <tbody>
              {rewards.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                    No rewards issued
                  </td>
                </tr>
              ) : (
                rewards.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-6 py-4 font-medium">{r.tokenType}</td>
                    <td className="px-6 py-4 text-right font-medium">
                      {r.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-2 capitalize">
                        {getRewardStatusIcon(r.status)}
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-400 text-sm">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6">
          <p className="text-slate-400 text-center py-8">
            Activity timeline coming soon...
          </p>
        </div>
      )}
    </div>
  );
}
