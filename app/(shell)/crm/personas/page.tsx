'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Search, 
  Filter, 
  Plus,
  ChevronRight,
  Star,
  TrendingUp,
  MoreVertical,
  AlertCircle
} from 'lucide-react';
import { useCrmContext } from '../CrmContext';
import { usePersonas } from '../hooks/useCrmApi';
import ContributionForm from '@/components/crm/ContributionForm';

interface Persona {
  id: string;
  displayName: string;
  email?: string;
  personaState: string;
  pendingInvite: boolean;
  reputationBucket?: string;
  totalPokw: number;
  contributionCount: number;
  createdAt: string;
}

export default function PersonasPage() {
  const router = useRouter();
  const { currentTenantId } = useCrmContext();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [search, setSearch] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);
  const [showContributionForm, setShowContributionForm] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 100;
  
  const personasApi = usePersonas(currentTenantId);
  const loading = personasApi.loading;

  useEffect(() => {
    setPage(0);
  }, [currentTenantId, search]);

  useEffect(() => {
    async function fetchPersonas() {
      setApiError(null);
      try {
        const result = await personasApi.fetch({ 
          limit: pageSize, 
          offset: page * pageSize, 
          search: search || undefined,
          source: 'live',
          includeCount: true,
        });
        if (result?.data) {
          setPersonas(result.data.map((p: any) => ({
            id: p.id,
            displayName: p.displayName || p.kybeDid?.slice(0, 16) + '...',
            email: p.email,
            personaState: p.personaState || 'active',
            pendingInvite: p.personaState === 'pending',
            reputationBucket: p.reputationBucket,
            totalPokw: p.totalPokw || 0,
            contributionCount: p.contributionCount || 0,
            createdAt: p.createdAt,
          })));
          setTotalCount(result.pagination?.count ?? result.data.length);
        }
      } catch (err: any) {
        setApiError(err.message || 'Failed to load personas');
        setPersonas([]);
      }
    }
    fetchPersonas();
  }, [currentTenantId, page, search]);

  const filteredPersonas = personas;

  const getStateColor = (state: string) => {
    switch (state) {
      case 'active': return 'bg-emerald-400/20 text-emerald-400';
      case 'pending': return 'bg-amber-400/20 text-amber-400';
      case 'suspended': return 'bg-red-400/20 text-red-400';
      default: return 'bg-slate-400/20 text-slate-400';
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-3">
            <Users className="text-cyan-400" />
            Personas
          </h1>
          <p className="text-slate-400 mt-1">
            Manage user personas and their reputation across tenants
          </p>
        </div>
        <div className="flex items-center gap-3">
          {loading && <span className="text-sm text-slate-400">Loading...</span>}
          <button className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-sm font-medium transition">
            <Plus size={16} />
            Add Persona
          </button>
        </div>
      </div>

      {/* API Error Banner */}
      {apiError && (
        <div className="rounded-xl p-4 bg-amber-500/10 ring-1 ring-amber-500/20 flex items-center gap-3">
          <AlertCircle size={20} className="text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-400">Could not load personas</p>
            <p className="text-xs text-slate-400">Run migrations to enable live data.</p>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search personas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition">
          <Filter size={16} />
          Filters
        </button>
      </div>

      {/* Personas Table */}
      <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Persona</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Status</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Reputation</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">PoKW</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Contributions</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Joined</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                  Loading personas...
                </td>
              </tr>
            ) : filteredPersonas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                  No personas found
                </td>
              </tr>
            ) : (
              filteredPersonas.map((persona) => (
                <tr key={persona.id} className="border-b border-white/5 hover:bg-white/5 transition cursor-pointer"
                  onClick={() => router.push(`/crm/personas/${persona.id}`)}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-sm font-medium">
                        {persona.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{persona.displayName}</p>
                        {persona.email && (
                          <p className="text-sm text-slate-400">{persona.email}</p>
                        )}
                        {persona.pendingInvite && (
                          <span className="mt-1 inline-flex items-center rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-medium text-amber-300">
                            Pending invite
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStateColor(persona.personaState)}`}>
                      {persona.personaState}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Star size={14} className={getReputationColor(persona.reputationBucket)} />
                      <span className={`text-sm ${getReputationColor(persona.reputationBucket)}`}>
                        {persona.reputationBucket || 'unrated'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <TrendingUp size={14} className="text-emerald-400" />
                      <span className="font-medium">{persona.totalPokw.toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-300">
                    {persona.contributionCount}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-400 text-sm">
                    {new Date(persona.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      className="p-2 hover:bg-white/10 rounded-lg transition"
                      aria-label="More options"
                      onClick={(e) => { e.stopPropagation(); setSelectedPersonaId(persona.id); setShowContributionForm(true); }}
                    >
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
          Showing {filteredPersonas.length} of {totalCount.toLocaleString()} personas
        </p>
        <div className="flex items-center gap-2">
          <button 
            className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded text-sm transition disabled:opacity-50" 
            disabled={page === 0}
            onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
          >
            Previous
          </button>
          <button 
            className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded text-sm transition disabled:opacity-50"
            disabled={(page + 1) * pageSize >= totalCount}
            onClick={() => setPage((prev) => prev + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {/* Contribution Form Modal */}
      {showContributionForm && (
        <ContributionForm
          tenantId={currentTenantId}
          personaId={selectedPersonaId || undefined}
          onClose={() => { setShowContributionForm(false); setSelectedPersonaId(null); }}
          onSuccess={() => personasApi.fetch({ 
            limit: pageSize, 
            offset: page * pageSize, 
            search: search || undefined,
            source: 'live',
            includeCount: true,
          })}
        />
      )}
    </div>
  );
}
