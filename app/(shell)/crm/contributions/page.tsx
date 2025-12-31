'use client';

import { useState, useEffect } from 'react';
import { 
  Award, 
  Search, 
  Filter, 
  Calendar,
  TrendingUp,
  FileText,
  MessageSquare,
  CheckCircle,
  MoreVertical,
  AlertCircle
} from 'lucide-react';
import { useCrmContext } from '../CrmContext';
import { useContributions } from '../hooks/useCrmApi';

interface Contribution {
  id: string;
  personaName: string;
  contributionType: string;
  pokwScore: number;
  units: number;
  source: string;
  createdAt: string;
}

const CONTRIBUTION_ICONS: Record<string, React.ReactNode> = {
  article_created: <FileText size={14} className="text-blue-400" />,
  comment_posted: <MessageSquare size={14} className="text-green-400" />,
  quiz_completed: <CheckCircle size={14} className="text-purple-400" />,
  content_shared: <TrendingUp size={14} className="text-amber-400" />,
};

export default function ContributionsPage() {
  const { currentTenantId } = useCrmContext();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState('30d');
  const [apiError, setApiError] = useState<string | null>(null);
  
  const contributionsApi = useContributions(currentTenantId);
  const loading = contributionsApi.loading;

  useEffect(() => {
    async function fetchContributions() {
      setApiError(null);
      try {
        // Calculate period based on dateRange
        const now = new Date();
        const periodEnd = now.toISOString();
        let periodStart: string;
        
        switch (dateRange) {
          case '7d':
            periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            break;
          case '90d':
            periodStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
            break;
          case 'all':
            periodStart = '2020-01-01T00:00:00Z';
            break;
          default: // 30d
            periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        }

        const result = await contributionsApi.fetch({ periodStart, periodEnd, limit: 100 });
        if (result?.data) {
          setContributions(result.data.map((c: any) => ({
            id: c.id,
            personaName: c.personaDisplayName || c.personaId?.slice(0, 12) + '...',
            contributionType: c.contributionType,
            pokwScore: c.pokwScore || 0,
            units: c.units || 1,
            source: c.source || 'unknown',
            createdAt: c.createdAt,
          })));
        }
      } catch (err: any) {
        setApiError(err.message || 'Failed to load contributions');
        setContributions([]);
      }
    }
    fetchContributions();
  }, [currentTenantId, dateRange]);

  const filteredContributions = contributions.filter(c => 
    c.personaName.toLowerCase().includes(search.toLowerCase()) ||
    c.contributionType.toLowerCase().includes(search.toLowerCase())
  );

  const totalPokw = contributions.reduce((sum, c) => sum + c.pokwScore, 0);

  const getTypeLabel = (type: string) => {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-3">
            <Award className="text-amber-400" />
            Contributions
          </h1>
          <p className="text-slate-400 mt-1">
            Track and manage PoKW (Proof of Knowledge Work) contributions
          </p>
        </div>
        <div className="flex items-center gap-3">
          {loading && <span className="text-sm text-slate-400">Loading...</span>}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      {/* API Error Banner */}
      {apiError && (
        <div className="rounded-xl p-4 bg-amber-500/10 ring-1 ring-amber-500/20 flex items-center gap-3">
          <AlertCircle size={20} className="text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-400">Could not load contributions</p>
            <p className="text-xs text-slate-400">Run migrations to enable live data.</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
          <p className="text-sm text-slate-400">Total Contributions</p>
          <p className="text-2xl font-semibold mt-1">{contributions.length}</p>
        </div>
        <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
          <p className="text-sm text-slate-400">Total PoKW Awarded</p>
          <p className="text-2xl font-semibold mt-1 text-emerald-400">{totalPokw.toFixed(1)}</p>
        </div>
        <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
          <p className="text-sm text-slate-400">Avg PoKW/Contribution</p>
          <p className="text-2xl font-semibold mt-1">{(totalPokw / contributions.length || 0).toFixed(1)}</p>
        </div>
        <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
          <p className="text-sm text-slate-400">Active Contributors</p>
          <p className="text-2xl font-semibold mt-1">{new Set(contributions.map(c => c.personaName)).size}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search contributions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition">
          <Filter size={16} />
          Filters
        </button>
        <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition">
          <Calendar size={16} />
          Date Range
        </button>
      </div>

      {/* Contributions Table */}
      <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Persona</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Type</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">PoKW</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Units</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Source</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Date</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                  Loading contributions...
                </td>
              </tr>
            ) : filteredContributions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                  No contributions found
                </td>
              </tr>
            ) : (
              filteredContributions.map((contribution) => (
                <tr key={contribution.id} className="border-b border-white/5 hover:bg-white/5 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xs font-medium">
                        {contribution.personaName.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium">{contribution.personaName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {CONTRIBUTION_ICONS[contribution.contributionType] || <Award size={14} />}
                      <span className="text-sm">{getTypeLabel(contribution.contributionType)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-medium text-emerald-400">+{contribution.pokwScore.toFixed(1)}</span>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-300">
                    {contribution.units}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-full text-xs bg-white/10 text-slate-300">
                      {contribution.source}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-400 text-sm">
                    {new Date(contribution.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <button className="p-2 hover:bg-white/10 rounded-lg transition">
                      <MoreVertical size={16} className="text-slate-400" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Showing {filteredContributions.length} of {contributions.length} contributions
        </p>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded text-sm transition disabled:opacity-50" disabled>
            Previous
          </button>
          <button className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded text-sm transition">
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
