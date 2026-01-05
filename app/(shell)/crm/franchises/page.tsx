'use client';

import { useState, useEffect } from 'react';
import { 
  Building2, 
  Search, 
  Plus,
  Users,
  Layers,
  Globe,
  MoreVertical,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useFranchises } from '../hooks/useCrmApi';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  personaCount: number;
  isActive: boolean;
}

interface Franchise {
  id: string;
  name: string;
  slug: string;
  description?: string;
  tenantCount: number;
  totalPersonas: number;
  uniquePersonaCount?: number;
  isActive: boolean;
  createdAt: string;
  tenants: Tenant[];
}

export default function FranchisesPage() {
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [search, setSearch] = useState('');
  const [expandedFranchise, setExpandedFranchise] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [uniquePersonaTotal, setUniquePersonaTotal] = useState(0);
  
  const franchisesApi = useFranchises();
  const loading = franchisesApi.loading;

  useEffect(() => {
    async function fetchFranchises() {
      setApiError(null);
      try {
        const result = await franchisesApi.fetch({ includeTenants: true, activeOnly: false });
        if (result?.data) {
          setFranchises(result.data.map((f: any) => ({
            id: f.id,
            name: f.name,
            slug: f.slug,
            description: f.description,
            tenantCount: f.tenants?.length || 0,
            totalPersonas: f.uniquePersonaCount ?? (f.tenants?.reduce((sum: number, t: any) => sum + (t.personaCount || 0), 0) || 0),
            uniquePersonaCount: f.uniquePersonaCount,
            isActive: f.isActive !== false,
            createdAt: f.createdAt,
            tenants: (f.tenants || []).map((t: any) => ({
              id: t.id,
              name: t.name,
              slug: t.slug,
              domain: t.domain,
              personaCount: t.personaCount || 0,
              isActive: t.isActive !== false,
            })),
          })));
          setUniquePersonaTotal(result?.meta?.uniquePersonaCount || 0);
        }
      } catch (err: any) {
        setApiError(err.message || 'Failed to load franchises');
        setFranchises([]);
        setUniquePersonaTotal(0);
      }
    }
    fetchFranchises();
  }, []);

  const filteredFranchises = franchises.filter(f => 
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.slug.toLowerCase().includes(search.toLowerCase()) ||
    f.description?.toLowerCase().includes(search.toLowerCase())
  );

  const totalTenants = franchises.reduce((sum, f) => sum + f.tenantCount, 0);
  const totalPersonas = uniquePersonaTotal > 0
    ? uniquePersonaTotal
    : franchises.reduce((sum, f) => sum + (f.uniquePersonaCount ?? f.totalPersonas), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-3">
            <Building2 className="text-blue-400" />
            Franchises & Tenants
          </h1>
          <p className="text-slate-400 mt-1">
            Manage the franchise and tenant hierarchy
          </p>
        </div>
        <div className="flex items-center gap-3">
          {loading && <span className="text-sm text-slate-400">Loading...</span>}
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium transition">
            <Plus size={16} />
            Add Franchise
          </button>
        </div>
      </div>

      {/* API Error Banner */}
      {apiError && (
        <div className="rounded-xl p-4 bg-amber-500/10 ring-1 ring-amber-500/20 flex items-center gap-3">
          <AlertCircle size={20} className="text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-400">Could not load franchises</p>
            <p className="text-xs text-slate-400">Run migrations to enable live data.</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
          <p className="text-sm text-slate-400">Total Franchises</p>
          <p className="text-2xl font-semibold mt-1">{franchises.length}</p>
        </div>
        <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
          <p className="text-sm text-slate-400">Total Tenants</p>
          <p className="text-2xl font-semibold mt-1">{totalTenants}</p>
        </div>
        <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
          <p className="text-sm text-slate-400">Total Personas</p>
          <p className="text-2xl font-semibold mt-1">{totalPersonas.toLocaleString()}</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search franchises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Franchises List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-slate-400">
            Loading franchises...
          </div>
        ) : filteredFranchises.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            No franchises found
          </div>
        ) : (
          filteredFranchises.map((franchise) => (
            <div
              key={franchise.id}
              className="rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden"
            >
              {/* Franchise Header */}
              <div 
                className="p-5 cursor-pointer hover:bg-white/5 transition"
                onClick={() => setExpandedFranchise(
                  expandedFranchise === franchise.id ? null : franchise.id
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                      <Building2 size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-medium">{franchise.name}</h3>
                        {franchise.isActive ? (
                          <CheckCircle size={14} className="text-emerald-400" />
                        ) : (
                          <XCircle size={14} className="text-red-400" />
                        )}
                      </div>
                      <p className="text-sm text-slate-400">{franchise.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-slate-400">Tenants</p>
                      <p className="font-medium">{franchise.tenantCount}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400">Personas</p>
                      <p className="font-medium">{franchise.totalPersonas.toLocaleString()}</p>
                    </div>
                    <ChevronRight 
                      size={20} 
                      className={`text-slate-400 transition-transform ${
                        expandedFranchise === franchise.id ? 'rotate-90' : ''
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Tenants List */}
              {expandedFranchise === franchise.id && (
                <div className="border-t border-white/10 bg-black/20">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-slate-400">Tenants</h4>
                      <button className="text-xs text-blue-400 hover:text-blue-300 transition">
                        + Add Tenant
                      </button>
                    </div>
                    <div className="space-y-2">
                      {franchise.tenants.map((tenant) => (
                        <div
                          key={tenant.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition"
                        >
                          <div className="flex items-center gap-3">
                            <Layers size={16} className="text-cyan-400" />
                            <div>
                              <p className="font-medium">{tenant.name}</p>
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                <span>{tenant.slug}</span>
                                {tenant.domain && (
                                  <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      <Globe size={10} />
                                      {tenant.domain}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-sm">
                              <Users size={14} className="text-slate-400" />
                              <span>{tenant.personaCount}</span>
                            </div>
                            {tenant.isActive ? (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-400/20 text-emerald-400">
                                Active
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-red-400/20 text-red-400">
                                Inactive
                              </span>
                            )}
                            <button className="p-1 hover:bg-white/10 rounded transition">
                              <MoreVertical size={14} className="text-slate-400" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
