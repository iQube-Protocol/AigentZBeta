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
  ExternalLink,
  Coins,
  Globe,
  MapPin,
  Phone,
  Briefcase,
  Twitter,
  Linkedin,
  MessageCircle,
  Youtube,
  Hash,
  ChevronDown,
  ChevronUp,
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

interface NakamotoInteraction {
  id: string;
  query: string;
  response: string;
  interaction_type: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface NakamotoData {
  knytPersona: Record<string, unknown> | null;
  blakQube: Record<string, unknown> | null;
  interactions: NakamotoInteraction[];
  rewardRecord: {
    linkedin_connected: boolean;
    metamask_connected: boolean;
    data_completed: boolean;
    reward_claimed: boolean;
    reward_amount: number;
    created_at: string;
  } | null;
}

function str(val: unknown): string {
  if (typeof val === 'string') return val;
  return '';
}

function arr(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v): v is string => typeof v === 'string');
  return [];
}

export default function PersonaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentTenantId } = useCrmContext();
  const personaId = params?.id as string | undefined;

  const [persona, setPersona] = useState<PersonaDetail | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [nakamoto, setNakamoto] = useState<NakamotoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'investment' | 'contributions' | 'rewards' | 'activity'>('overview');
  const [expandedInteraction, setExpandedInteraction] = useState<string | null>(null);

  useEffect(() => {
    if (!personaId) {
      setLoading(false);
      setError("Missing persona id parameter.");
      return;
    }

    async function fetchAll() {
      if (!currentTenantId || !personaId) return;
      setLoading(true);
      setError(null);

      try {
        const [personaRes, contribRes, rewardsRes, nakamotoRes] = await Promise.all([
          fetch(`/api/crm/personas?tenantId=${currentTenantId}&personaId=${personaId}&source=live`),
          fetch(`/api/crm/contributions?tenantId=${currentTenantId}&personaId=${personaId}&limit=10`),
          fetch(`/api/crm/rewards?tenantId=${currentTenantId}&personaId=${personaId}&limit=10`),
          fetch(`/api/crm/personas/${personaId}/nakamoto`),
        ]);

        if (!personaRes.ok) throw new Error('Failed to fetch persona');
        const personaData = await personaRes.json();
        setPersona(personaData.data || personaData);

        if (contribRes.ok) {
          const d = await contribRes.json();
          setContributions(d.data || d.contributions || []);
        }
        if (rewardsRes.ok) {
          const d = await rewardsRes.json();
          setRewards(d.data || d.rewards || []);
        }
        if (nakamotoRes.ok) {
          const d = await nakamotoRes.json();
          if (d.success && d.data) setNakamoto(d.data);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load persona details');
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
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
        <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-400 hover:text-white transition">
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

  const kp = nakamoto?.knytPersona;
  const bq = nakamoto?.blakQube;

  // Resolve fields preferring knytPersona, falling back to blakQube
  const profession = str(kp?.['Profession']) || str(bq?.['Profession']);
  const city = str(kp?.['Local-City']) || str(bq?.['Local-City']);
  const phone = str(kp?.['Phone-Number']) || str(bq?.['Phone-Number']);
  const evmKey = str(kp?.['EVM-Public-Key']) || str(bq?.['EVM-Public-Key']);
  const btcKey = str(kp?.['BTC-Public-Key']) || str(bq?.['BTC-Public-Key']);
  const metakeepKey = str(kp?.['MetaKeep-Public-Key']);
  const thirdwebKey = str(kp?.['ThirdWeb-Public-Key']) || str(bq?.['ThirdWeb-Public-Key']);
  const chainIds = arr(kp?.['Chain-IDs']) .length ? arr(kp?.['Chain-IDs']) : arr(bq?.['Chain-IDs']);
  const web3Interests = arr(kp?.['Web3-Interests']).length ? arr(kp?.['Web3-Interests']) : arr(bq?.['Web3-Interests']);
  const tokensOfInterest = arr(kp?.['Tokens-of-Interest']).length ? arr(kp?.['Tokens-of-Interest']) : arr(bq?.['Tokens-of-Interest']);
  const walletsOfInterest = arr(kp?.['Wallets-of-Interest']).length ? arr(kp?.['Wallets-of-Interest']) : arr(bq?.['Wallets-of-Interest']);
  const twitter = str(kp?.['Twitter-Handle']) || str(bq?.['Twitter-Handle']);
  const linkedin = str(kp?.['LinkedIn-ID']) || str(bq?.['LinkedIn-ID']);
  const linkedinUrl = str(kp?.['LinkedIn-Profile-URL']) || str(bq?.['LinkedIn-Profile-URL']);
  const telegram = str(kp?.['Telegram-Handle']) || str(bq?.['Telegram-Handle']);
  const discord = str(kp?.['Discord-Handle']) || str(bq?.['Discord-Handle']);
  const instagram = str(kp?.['Instagram-Handle']) || str(bq?.['Instagram-Handle']);
  const github = str(bq?.['GitHub-Handle']);
  const youtube = str(kp?.['YouTube-ID']) || str(bq?.['YouTube-ID']);
  const tiktok = str(kp?.['TikTok-Handle']) || str(bq?.['TikTok-Handle']);
  const omSince = str(kp?.['OM-Member-Since']);
  const omTier = str(kp?.['OM-Tier-Status']);
  const totalInvested = str(kp?.['Total-Invested']);
  const metaiyeShares = str(kp?.['Metaiye-Shares-Owned']);
  const knytCoyn = str(kp?.['KNYT-COYN-Owned']);
  const motionComics = str(kp?.['Motion-Comics-Owned']);
  const paperComics = str(kp?.['Paper-Comics-Owned']);
  const digitalComics = str(kp?.['Digital-Comics-Owned']);
  const knytPosters = str(kp?.['KNYT-Posters-Owned']);
  const knytCards = str(kp?.['KNYT-Cards-Owned']);
  const characters = str(kp?.['Characters-Owned']);
  const profileImage = str(kp?.['profile_image_url']) || str(bq?.['profile_image_url']);
  const knytId = str(kp?.['KNYT-ID']) || str(bq?.['KNYT-ID']);

  const hasInvestmentData = !!(totalInvested || omTier || metaiyeShares || knytCoyn || motionComics || paperComics || digitalComics || knytPosters || knytCards || characters);
  const hasSocialData = !!(twitter || linkedin || telegram || discord || instagram || github || youtube || tiktok);
  const hasWeb3Data = !!(evmKey || btcKey || web3Interests.length || tokensOfInterest.length || chainIds.length);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    ...(hasInvestmentData ? [{ id: 'investment', label: 'Investment & Assets' }] : []),
    { id: 'contributions', label: 'Contributions' },
    { id: 'rewards', label: 'Rewards' },
    { id: 'activity', label: 'Activity' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-400 hover:text-white transition">
        <ArrowLeft size={20} />
        Back to Personas
      </button>

      {/* Header */}
      <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {profileImage ? (
              <img src={profileImage} alt={persona.displayName} className="w-16 h-16 rounded-full object-cover ring-2 ring-cyan-400/30" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-2xl font-medium">
                {persona.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-semibold">{persona.displayName}</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {persona.email && (
                  <p className="text-slate-400 flex items-center gap-1 text-sm">
                    <Mail size={13} />
                    {persona.email}
                  </p>
                )}
                {profession && (
                  <p className="text-slate-400 flex items-center gap-1 text-sm">
                    <Briefcase size={13} />
                    {profession}
                  </p>
                )}
                {city && (
                  <p className="text-slate-400 flex items-center gap-1 text-sm">
                    <MapPin size={13} />
                    {city}
                  </p>
                )}
                {knytId && (
                  <span className="text-xs font-mono text-cyan-400/70 bg-cyan-400/10 px-2 py-0.5 rounded">
                    KNYT-ID: {knytId}
                  </span>
                )}
              </div>
              {persona.kybeDid && (
                <p className="text-xs text-slate-500 font-mono mt-1">{persona.kybeDid}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {omTier && (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-amber-400/10 text-amber-400 ring-1 ring-amber-400/30">
                {omTier}
              </span>
            )}
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
            <p className="text-2xl font-semibold text-emerald-400">{persona.totalPokw.toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <FileText size={14} />
              Contributions
            </div>
            <p className="text-2xl font-semibold">{persona.contributionCount}</p>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Coins size={14} />
              Total Invested
            </div>
            <p className="text-2xl font-semibold text-amber-400">
              {totalInvested || '—'}
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
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              activeTab === tab.id
                ? 'bg-cyan-500 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Core Details */}
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
                {phone && (
                  <div className="flex justify-between">
                    <dt className="text-slate-400 flex items-center gap-1"><Phone size={12} /> Phone</dt>
                    <dd className="text-sm">{phone}</dd>
                  </div>
                )}
                {omSince && (
                  <div className="flex justify-between">
                    <dt className="text-slate-400">OM Member Since</dt>
                    <dd className="text-sm">{omSince}</dd>
                  </div>
                )}
                {nakamoto?.rewardRecord && (
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Onboarding Reward</dt>
                    <dd className="text-sm">
                      {nakamoto.rewardRecord.reward_claimed
                        ? <span className="text-emerald-400">{nakamoto.rewardRecord.reward_amount.toLocaleString()} KNYT claimed</span>
                        : <span className="text-amber-400">{nakamoto.rewardRecord.reward_amount.toLocaleString()} KNYT pending</span>}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Social Handles */}
            {hasSocialData && (
              <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6">
                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                  <Globe size={18} className="text-cyan-400" />
                  Social Profiles
                </h3>
                <div className="space-y-3">
                  {twitter && (
                    <div className="flex items-center gap-3">
                      <Twitter size={15} className="text-sky-400 shrink-0" />
                      <span className="text-sm text-slate-300">@{twitter}</span>
                    </div>
                  )}
                  {linkedin && (
                    <div className="flex items-center gap-3">
                      <Linkedin size={15} className="text-blue-400 shrink-0" />
                      {linkedinUrl ? (
                        <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:underline flex items-center gap-1">
                          {linkedin} <ExternalLink size={11} />
                        </a>
                      ) : (
                        <span className="text-sm text-slate-300">{linkedin}</span>
                      )}
                    </div>
                  )}
                  {telegram && (
                    <div className="flex items-center gap-3">
                      <MessageCircle size={15} className="text-sky-400 shrink-0" />
                      <span className="text-sm text-slate-300">@{telegram}</span>
                    </div>
                  )}
                  {discord && (
                    <div className="flex items-center gap-3">
                      <Hash size={15} className="text-indigo-400 shrink-0" />
                      <span className="text-sm text-slate-300">{discord}</span>
                    </div>
                  )}
                  {instagram && (
                    <div className="flex items-center gap-3">
                      <Globe size={15} className="text-pink-400 shrink-0" />
                      <span className="text-sm text-slate-300">@{instagram}</span>
                    </div>
                  )}
                  {github && (
                    <div className="flex items-center gap-3">
                      <Hash size={15} className="text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-300">github: {github}</span>
                    </div>
                  )}
                  {youtube && (
                    <div className="flex items-center gap-3">
                      <Youtube size={15} className="text-red-400 shrink-0" />
                      <span className="text-sm text-slate-300">{youtube}</span>
                    </div>
                  )}
                  {tiktok && (
                    <div className="flex items-center gap-3">
                      <Globe size={15} className="text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-300">TikTok: @{tiktok}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Web3 Profile */}
            {hasWeb3Data && (
              <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6 col-span-2">
                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                  <Wallet size={18} className="text-cyan-400" />
                  Web3 Profile
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  <dl className="space-y-3">
                    {evmKey && (
                      <div>
                        <dt className="text-xs text-slate-500 mb-0.5">EVM Address</dt>
                        <dd className="font-mono text-sm text-slate-300 break-all">{evmKey}</dd>
                      </div>
                    )}
                    {btcKey && (
                      <div>
                        <dt className="text-xs text-slate-500 mb-0.5">BTC Address</dt>
                        <dd className="font-mono text-sm text-slate-300 break-all">{btcKey}</dd>
                      </div>
                    )}
                    {metakeepKey && (
                      <div>
                        <dt className="text-xs text-slate-500 mb-0.5">MetaKeep Key</dt>
                        <dd className="font-mono text-sm text-slate-300 break-all">{metakeepKey}</dd>
                      </div>
                    )}
                    {thirdwebKey && (
                      <div>
                        <dt className="text-xs text-slate-500 mb-0.5">ThirdWeb Key</dt>
                        <dd className="font-mono text-sm text-slate-300 break-all">{thirdwebKey}</dd>
                      </div>
                    )}
                  </dl>
                  <div className="space-y-4">
                    {chainIds.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Chain IDs</p>
                        <div className="flex flex-wrap gap-1">
                          {chainIds.map((c) => (
                            <span key={c} className="px-2 py-0.5 text-xs bg-blue-500/10 text-blue-400 rounded-full ring-1 ring-blue-500/20">{c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {web3Interests.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Web3 Interests</p>
                        <div className="flex flex-wrap gap-1">
                          {web3Interests.map((i) => (
                            <span key={i} className="px-2 py-0.5 text-xs bg-cyan-500/10 text-cyan-400 rounded-full ring-1 ring-cyan-500/20">{i}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {tokensOfInterest.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Tokens of Interest</p>
                        <div className="flex flex-wrap gap-1">
                          {tokensOfInterest.map((t) => (
                            <span key={t} className="px-2 py-0.5 text-xs bg-amber-500/10 text-amber-400 rounded-full ring-1 ring-amber-500/20">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {walletsOfInterest.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Wallets of Interest</p>
                        <div className="flex flex-wrap gap-1">
                          {walletsOfInterest.map((w) => (
                            <span key={w} className="px-2 py-0.5 text-xs bg-purple-500/10 text-purple-400 rounded-full ring-1 ring-purple-500/20">{w}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Recent Activity preview */}
            <div className={`rounded-2xl bg-white/5 ring-1 ring-white/10 p-6 ${hasSocialData || hasWeb3Data ? '' : 'col-span-2'}`}>
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
                        <p className="text-sm font-medium capitalize">{c.contributionType.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</p>
                      </div>
                      <span className="text-emerald-400 text-sm font-medium">+{c.pokwScore} PoKW</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Investment & Assets Tab */}
      {activeTab === 'investment' && hasInvestmentData && (
        <div className="space-y-6">
          {/* Investment summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6 col-span-3">
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Coins size={18} className="text-amber-400" />
                Investment Summary
              </h3>
              <div className="grid grid-cols-4 gap-4">
                {totalInvested && (
                  <div className="rounded-xl bg-amber-400/10 ring-1 ring-amber-400/20 p-4">
                    <p className="text-xs text-slate-400 mb-1">Total Invested</p>
                    <p className="text-2xl font-semibold text-amber-400">{totalInvested}</p>
                  </div>
                )}
                {omTier && (
                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-xs text-slate-400 mb-1">OM Tier</p>
                    <p className="text-xl font-semibold text-amber-300">{omTier}</p>
                    {omSince && <p className="text-xs text-slate-500 mt-1">Since {omSince}</p>}
                  </div>
                )}
                {metaiyeShares && (
                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-xs text-slate-400 mb-1">Metaiye Shares</p>
                    <p className="text-2xl font-semibold">{metaiyeShares}</p>
                  </div>
                )}
                {knytCoyn && (
                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-xs text-slate-400 mb-1">KNYT COYN</p>
                    <p className="text-2xl font-semibold text-cyan-400">{knytCoyn}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Asset Inventory */}
          {(motionComics || paperComics || digitalComics || knytPosters || knytCards || characters) && (
            <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6">
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Shield size={18} className="text-cyan-400" />
                Asset Inventory
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {motionComics && (
                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-xs text-slate-400 mb-1">Motion Comics</p>
                    <p className="text-2xl font-semibold">{motionComics}</p>
                  </div>
                )}
                {paperComics && (
                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-xs text-slate-400 mb-1">Paper Comics</p>
                    <p className="text-2xl font-semibold">{paperComics}</p>
                  </div>
                )}
                {digitalComics && (
                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-xs text-slate-400 mb-1">Digital Comics</p>
                    <p className="text-2xl font-semibold">{digitalComics}</p>
                  </div>
                )}
                {knytPosters && (
                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-xs text-slate-400 mb-1">KNYT Posters</p>
                    <p className="text-2xl font-semibold">{knytPosters}</p>
                  </div>
                )}
                {knytCards && (
                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-xs text-slate-400 mb-1">KNYT Cards</p>
                    <p className="text-2xl font-semibold">{knytCards}</p>
                  </div>
                )}
                {characters && (
                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-xs text-slate-400 mb-1">Characters Owned</p>
                    <p className="text-2xl font-semibold">{characters}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Onboarding reward status */}
          {nakamoto?.rewardRecord && (
            <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6">
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Gift size={18} className="text-cyan-400" />
                Onboarding Reward Status
              </h3>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'LinkedIn Connected', value: nakamoto.rewardRecord.linkedin_connected },
                  { label: 'MetaMask Connected', value: nakamoto.rewardRecord.metamask_connected },
                  { label: 'Data Completed', value: nakamoto.rewardRecord.data_completed },
                  { label: 'Reward Claimed', value: nakamoto.rewardRecord.reward_claimed },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl bg-white/5 p-4 flex items-center gap-3">
                    {value
                      ? <CheckCircle size={18} className="text-emerald-400 shrink-0" />
                      : <Clock size={18} className="text-slate-500 shrink-0" />}
                    <div>
                      <p className="text-xs text-slate-400">{label}</p>
                      <p className={`text-sm font-medium ${value ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {value ? 'Done' : 'Pending'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
                <Coins size={14} className="text-amber-400" />
                Reward amount: <span className="font-semibold text-amber-400 ml-1">{nakamoto.rewardRecord.reward_amount.toLocaleString()} KNYT</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Contributions Tab */}
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
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">No contributions recorded</td>
                </tr>
              ) : (
                contributions.map((c) => (
                  <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-6 py-4 capitalize">{c.contributionType.replace(/_/g, ' ')}</td>
                    <td className="px-6 py-4 text-right">{c.units}</td>
                    <td className="px-6 py-4 text-right text-emerald-400 font-medium">+{c.pokwScore}</td>
                    <td className="px-6 py-4 text-slate-400">{c.source}</td>
                    <td className="px-6 py-4 text-right text-slate-400 text-sm">{new Date(c.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Rewards Tab */}
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
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400">No rewards issued</td>
                </tr>
              ) : (
                rewards.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-6 py-4 font-medium">{r.tokenType}</td>
                    <td className="px-6 py-4 text-right font-medium">{r.amount.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-2 capitalize">
                        {getRewardStatusIcon(r.status)}
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-400 text-sm">{new Date(r.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Activity Tab — Nakamoto interaction history */}
      {activeTab === 'activity' && (
        <div className="space-y-3">
          {nakamoto?.interactions.length === 0 || !nakamoto ? (
            <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-12 text-center">
              <Activity size={32} className="text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No interaction history found</p>
            </div>
          ) : (
            nakamoto.interactions.map((interaction) => (
              <div key={interaction.id} className="rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
                <button
                  className="w-full flex items-start justify-between px-6 py-4 text-left hover:bg-white/5 transition"
                  onClick={() => setExpandedInteraction(expandedInteraction === interaction.id ? null : interaction.id)}
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20 capitalize">
                        {interaction.interaction_type}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(interaction.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 truncate">{interaction.query}</p>
                  </div>
                  {expandedInteraction === interaction.id
                    ? <ChevronUp size={16} className="text-slate-400 shrink-0 mt-1" />
                    : <ChevronDown size={16} className="text-slate-400 shrink-0 mt-1" />}
                </button>
                {expandedInteraction === interaction.id && (
                  <div className="border-t border-white/10 px-6 py-4 space-y-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Query</p>
                      <p className="text-sm text-slate-300">{interaction.query}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Response</p>
                      <p className="text-sm text-slate-400 whitespace-pre-wrap">{interaction.response}</p>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
