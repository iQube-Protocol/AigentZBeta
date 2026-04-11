'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  TrendingUp,
  ChevronRight,
  AlertCircle,
  Zap,
  Clock,
  Filter,
  ArrowUpDown,
} from 'lucide-react';

interface Investor {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  knytId: string;
  omTier: string;
  omSince: string;
  totalInvested: string;
  metaiyeShares: string;
  knytCoyn: string;
  motionComics: string;
  paperComics: string;
  digitalComics: string;
  knytPosters: string;
  knytCards: string;
  characters: string;
  profileImageUrl: string;
  profession: string;
  city: string;
  csvInvestmentStatus: string;
  csvTransactionCount: number;
  csvFirstCommittedDate: string;
  isLinked: boolean;
  isActivated: boolean;
  personaId: string | null;
}

const OM_TIER_ORDER: Record<string, number> = {
  KETA: 5,
  KEJI: 4,
  FIRST: 3,
  ZERO: 2,
  SAT: 1,
};

const tierBadge = (tier: string) => {
  switch (tier?.toUpperCase()) {
    case 'KETA': return 'bg-amber-400/20 text-amber-300 ring-amber-400/30';
    case 'KEJI': return 'bg-purple-400/20 text-purple-300 ring-purple-400/30';
    case 'FIRST': return 'bg-cyan-400/20 text-cyan-300 ring-cyan-400/30';
    case 'ZERO': return 'bg-slate-400/20 text-slate-300 ring-slate-400/30';
    case 'SAT': return 'bg-orange-400/20 text-orange-300 ring-orange-400/30';
    default: return 'bg-slate-400/10 text-slate-500 ring-slate-400/20';
  }
};

export default function InvestorsPage() {
  const router = useRouter();
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activatedFilter, setActivatedFilter] = useState<'all' | 'activated' | 'inactive'>('all');
  const [sort, setSort] = useState<'name' | 'invested' | 'activated' | 'tier'>('tier');

  const fetchInvestors = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const params = new URLSearchParams({
        limit: '500',
        sort,
        ...(search ? { search } : {}),
        // No activated filter param when 'all' — server returns all and we display counts
      });
      const res = await fetch(`/api/crm/investors?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load investors');
      setInvestors(json.data ?? []);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Failed to load investors');
      setInvestors([]);
    } finally {
      setLoading(false);
    }
  }, [search, sort]);

  useEffect(() => {
    fetchInvestors();
  }, [fetchInvestors]);

  // Apply activation filter client-side so tab counts always reflect the full set
  const displayedInvestors = activatedFilter === 'activated'
    ? investors.filter((i) => i.isActivated)
    : activatedFilter === 'inactive'
    ? investors.filter((i) => !i.isActivated)
    : investors;

  const activatedCount = investors.filter((i) => i.isActivated).length;
  const inactiveCount = investors.filter((i) => !i.isActivated).length;
  const totalCount = investors.length;

  const handleRowClick = (investor: Investor) => {
    if (investor.personaId) {
      router.push(`/crm/personas/${investor.personaId}`);
    }
  };

  const initials = (inv: Investor) => {
    const f = inv.firstName.charAt(0).toUpperCase();
    const l = inv.lastName.charAt(0).toUpperCase();
    return f || l ? `${f}${l}` : inv.email.charAt(0).toUpperCase();
  };

  const hasAssets = (inv: Investor) =>
    !!(inv.metaiyeShares || inv.knytCoyn || inv.motionComics || inv.paperComics ||
       inv.digitalComics || inv.knytPosters || inv.knytCards || inv.characters);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-3">
            <TrendingUp className="text-amber-400" />
            Investors
          </h1>
          <p className="text-slate-400 mt-1">
            All StartEngine / Metaiye Media investors from the Nakamoto database
          </p>
        </div>
      </div>

      {/* Stat Chips */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setActivatedFilter('all')}
          className={`px-4 py-2 rounded-xl text-sm font-medium ring-1 transition ${
            activatedFilter === 'all'
              ? 'bg-white/10 ring-white/20 text-white'
              : 'bg-white/5 ring-white/10 text-slate-400 hover:text-white'
          }`}
        >
          <Users size={14} className="inline mr-1.5" />
          All &nbsp;<span className="text-slate-500">{totalCount}</span>
        </button>
        <button
          onClick={() => setActivatedFilter('activated')}
          className={`px-4 py-2 rounded-xl text-sm font-medium ring-1 transition ${
            activatedFilter === 'activated'
              ? 'bg-emerald-500/20 ring-emerald-500/30 text-emerald-300'
              : 'bg-white/5 ring-white/10 text-slate-400 hover:text-white'
          }`}
        >
          <Zap size={14} className="inline mr-1.5" />
          Activated &nbsp;<span className="text-slate-500">{activatedCount}</span>
        </button>
        <button
          onClick={() => setActivatedFilter('inactive')}
          className={`px-4 py-2 rounded-xl text-sm font-medium ring-1 transition ${
            activatedFilter === 'inactive'
              ? 'bg-amber-500/20 ring-amber-500/30 text-amber-300'
              : 'bg-white/5 ring-white/10 text-slate-400 hover:text-white'
          }`}
        >
          <Clock size={14} className="inline mr-1.5" />
          Inactive &nbsp;<span className="text-slate-500">{inactiveCount}</span>
        </button>
      </div>

      {/* Error */}
      {apiError && (
        <div className="rounded-xl p-4 bg-amber-500/10 ring-1 ring-amber-500/20 flex items-center gap-3">
          <AlertCircle size={20} className="text-amber-400" />
          <p className="text-sm text-amber-400">{apiError}</p>
        </div>
      )}

      {/* Search + Sort */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, or KNYT-ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as 'name' | 'invested' | 'activated' | 'tier')}
            className="bg-white/5 border border-white/10 rounded-lg text-sm text-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="tier">Sort: OM Tier</option>
            <option value="invested">Sort: Invested (high)</option>
            <option value="name">Sort: Name</option>
            <option value="activated">Sort: Activated first</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Investor</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">OM Tier</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Total Invested</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400 hidden lg:table-cell">Assets</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Status</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  Loading investors…
                </td>
              </tr>
            ) : displayedInvestors.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  No investors found
                </td>
              </tr>
            ) : (
              displayedInvestors.map((investor) => (
                <tr
                  key={investor.id}
                  className={`border-b border-white/5 transition ${
                    investor.personaId ? 'hover:bg-white/5 cursor-pointer' : ''
                  }`}
                  onClick={() => handleRowClick(investor)}
                >
                  {/* Name / Email */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xs font-bold text-black shrink-0">
                        {initials(investor)}
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {investor.name || <span className="text-slate-500 italic">Unknown</span>}
                        </p>
                        {investor.email && (
                          <p className="text-xs text-slate-400">{investor.email}</p>
                        )}
                        {investor.knytId && (
                          <p className="text-xs text-amber-400/70">KNYT-ID: {investor.knytId}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* OM Tier */}
                  <td className="px-6 py-4">
                    {investor.omTier ? (
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ring-1 ${tierBadge(investor.omTier)}`}>
                        {investor.omTier.toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>

                  {/* Total Invested */}
                  <td className="px-6 py-4 text-right">
                    {investor.totalInvested ? (
                      <div>
                        <span className="text-sm font-medium text-emerald-300">${investor.totalInvested}</span>
                        {investor.csvInvestmentStatus && (
                          <div className="text-xs text-slate-500 mt-0.5">{investor.csvInvestmentStatus}</div>
                        )}
                      </div>
                    ) : investor.metaiyeShares ? (
                      <div>
                        <span className="text-xs text-purple-300">{investor.metaiyeShares} shares</span>
                        {investor.csvInvestmentStatus && (
                          <div className="text-xs text-slate-500 mt-0.5">{investor.csvInvestmentStatus}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>

                  {/* Assets summary */}
                  <td className="px-6 py-4 hidden lg:table-cell">
                    {hasAssets(investor) ? (
                      <div className="flex flex-wrap gap-1">
                        {investor.metaiyeShares && (
                          <span className="px-1.5 py-0.5 bg-purple-500/15 text-purple-300 rounded text-xs">
                            {investor.metaiyeShares} shares
                          </span>
                        )}
                        {investor.knytCoyn && (
                          <span className="px-1.5 py-0.5 bg-amber-500/15 text-amber-300 rounded text-xs">
                            {investor.knytCoyn} KNYT
                          </span>
                        )}
                        {(investor.motionComics || investor.paperComics || investor.digitalComics) && (
                          <span className="px-1.5 py-0.5 bg-cyan-500/15 text-cyan-300 rounded text-xs">
                            comics
                          </span>
                        )}
                        {(investor.knytCards || investor.knytPosters || investor.characters) && (
                          <span className="px-1.5 py-0.5 bg-emerald-500/15 text-emerald-300 rounded text-xs">
                            collectibles
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4">
                    {investor.isActivated ? (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                        <Zap size={12} />
                        Activated
                      </span>
                    ) : investor.isLinked ? (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-cyan-400">
                        <Users size={12} />
                        Linked
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <Clock size={12} />
                        Inactive
                      </span>
                    )}
                  </td>

                  {/* Chevron if clickable */}
                  <td className="px-4 py-4">
                    {investor.personaId && (
                      <ChevronRight size={16} className="text-slate-500" />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && (
        <p className="text-xs text-slate-600 text-right">
          {displayedInvestors.length} of {totalCount} investors · {activatedCount} activated · {inactiveCount} inactive
        </p>
      )}
    </div>
  );
}
