'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  Layers, 
  ChevronDown, 
  Check,
  Globe,
  Search
} from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  personaCount?: number;
}

interface Franchise {
  id: string;
  name: string;
  slug: string;
  tenants: Tenant[];
}

interface TenantSwitcherProps {
  currentTenantId?: string;
  onTenantChange?: (tenantId: string, franchiseId: string) => void;
  compact?: boolean;
}

export function TenantSwitcher({ 
  currentTenantId, 
  onTenantChange,
  compact = false 
}: TenantSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [selectedFranchise, setSelectedFranchise] = useState<Franchise | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch real data from API
    const fetchFranchisesAndTenants = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all franchises
        const franchisesRes = await fetch('/api/crm/franchises?activeOnly=false');
        if (!franchisesRes.ok) throw new Error('Failed to fetch franchises');
        const franchisesData = await franchisesRes.json();
        
        // Fetch all tenants
        const tenantsRes = await fetch('/api/crm/tenants?activeOnly=false');
        const tenantsData = tenantsRes.ok ? await tenantsRes.json() : { data: [] };
        const allTenants = tenantsData.data || [];

        // Fetch live tenant counts from personas (covers tenants missing from CRM tables)
        const liveTenantsRes = await fetch('/api/crm/personas?source=live&stats=true&tenantStats=true&tenantId=all');
        const liveTenantsData = liveTenantsRes.ok ? await liveTenantsRes.json() : { data: {} };
        const liveTenantCounts: Record<string, number> = liveTenantsData?.data?.byTenant || {};

        const qriptopianTenant: Tenant = {
          id: 'c1a4e5f8-5326-4fa3-ac11-87c36e0b1848',
          name: 'Qriptopian',
          slug: 'qriptopian',
          personaCount: liveTenantCounts['c1a4e5f8-5326-4fa3-ac11-87c36e0b1848'] || 0,
        };
        const franchiseTenantOverrides: Record<string, Tenant> = {
          theqriptopian: qriptopianTenant,
          qriptopian: qriptopianTenant,
        };

        // Group tenants by franchise
        const franchiseMap = new Map<string, Franchise>();
        
        // Initialize franchises from API
        for (const franchise of (franchisesData.data || [])) {
          franchiseMap.set(franchise.id, {
            id: franchise.id,
            name: franchise.name,
            slug: franchise.slug,
            tenants: [],
          });
        }

        // Add "Unassigned" franchise for tenants without a valid franchiseId
        franchiseMap.set('unassigned', {
          id: 'unassigned',
          name: 'Unassigned Tenants',
          slug: 'unassigned',
          tenants: [],
        });

        // Assign tenants to franchises
        const tenantById = new Map<string, Tenant>();
        const tenantBySlug = new Map<string, Tenant>();

        for (const tenant of allTenants) {
          const mappedTenant = {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            domain: tenant.domain || tenant.customDomain,
            personaCount: liveTenantCounts[tenant.id] || liveTenantCounts[tenant.slug] || 0,
          };
          tenantById.set(mappedTenant.id, mappedTenant);
          if (mappedTenant.slug) tenantBySlug.set(mappedTenant.slug, mappedTenant);
          
          if (tenant.franchiseId && franchiseMap.has(tenant.franchiseId)) {
            franchiseMap.get(tenant.franchiseId)!.tenants.push(mappedTenant);
          } else {
            franchiseMap.get('unassigned')!.tenants.push(mappedTenant);
          }
        }

        // Apply franchise tenant overrides when missing
        for (const franchise of franchiseMap.values()) {
          const franchiseKey = franchise.slug?.toLowerCase() || '';
          const nameKey = franchise.name?.toLowerCase() || '';
          const override =
            franchiseTenantOverrides[franchiseKey] ||
            (nameKey.includes('qriptopian') ? qriptopianTenant : undefined);
          if (!override) continue;
          const hasTenant = franchise.tenants.some((t) => t.id === override.id || t.slug === override.slug);
          if (!hasTenant) {
            franchise.tenants.push(override);
          }
        }

        // Add live-only tenants (present in personas but missing from tenants table)
        const liveOnlyTenants: Tenant[] = [];
        Object.entries(liveTenantCounts).forEach(([tenantId, count]) => {
          if (tenantById.has(tenantId) || tenantBySlug.has(tenantId)) return;
          liveOnlyTenants.push({
            id: tenantId,
            name: `Tenant ${tenantId.slice(0, 8)}…`,
            slug: tenantId,
            personaCount: count,
          });
        });

        if (liveOnlyTenants.length > 0) {
          franchiseMap.set('live-tenants', {
            id: 'live-tenants',
            name: 'Live Tenants',
            slug: 'live-tenants',
            tenants: liveOnlyTenants.sort((a, b) => (b.personaCount || 0) - (a.personaCount || 0)),
          });
        }

        // Filter out franchises with no tenants and convert to array
        const validFranchises = Array.from(franchiseMap.values()).filter(f => f.tenants.length > 0);
        setFranchises(validFranchises);

        // Set initial selection
        if (validFranchises.length > 0) {
          let foundTenant = false;
          
          // Try to find the current tenant if provided
          if (currentTenantId && currentTenantId !== 't1' && currentTenantId !== 'default') {
            for (const franchise of validFranchises) {
              const tenant = franchise.tenants.find(t => t.id === currentTenantId);
              if (tenant) {
                setSelectedTenant(tenant);
                setSelectedFranchise(franchise);
                foundTenant = true;
                break;
              }
            }
          }

          if (!foundTenant && currentTenantId && currentTenantId !== 't1' && currentTenantId !== 'default') {
            for (const franchise of validFranchises) {
              const tenant = franchise.tenants.find(t => t.slug === currentTenantId);
              if (tenant) {
                setSelectedTenant(tenant);
                setSelectedFranchise(franchise);
                foundTenant = true;
                break;
              }
            }
          }
          
          // If no tenant found or currentTenantId is default, select first available
          if (!foundTenant && validFranchises.length > 0) {
            const allTenantsFlat = validFranchises.flatMap((franchise) =>
              franchise.tenants.map((tenant) => ({ franchise, tenant }))
            );
            allTenantsFlat.sort((a, b) => (b.tenant.personaCount || 0) - (a.tenant.personaCount || 0));

            const firstEntry = allTenantsFlat[0];
            if (!firstEntry) return;
            const firstFranchise = firstEntry.franchise;
            const firstTenant = firstEntry.tenant;
            setSelectedFranchise(firstFranchise);
            setSelectedTenant(firstTenant);
            onTenantChange?.(firstTenant.id, firstFranchise.id);
          }
        }
      } catch (err: any) {
        console.error('Failed to fetch franchises/tenants:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFranchisesAndTenants();
  }, [currentTenantId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (tenant: Tenant, franchise: Franchise) => {
    setSelectedTenant(tenant);
    setSelectedFranchise(franchise);
    setIsOpen(false);
    setSearch('');
    onTenantChange?.(tenant.id, franchise.id);
  };

  const filteredFranchises = franchises.map(f => ({
    ...f,
    tenants: f.tenants.filter(t => 
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase()) ||
      f.name.toLowerCase().includes(search.toLowerCase())
    )
  })).filter(f => f.tenants.length > 0);

  if (compact) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition text-sm disabled:opacity-50"
        >
          <Layers size={14} className="text-cyan-400" />
          <span className="max-w-[120px] truncate">
            {loading ? 'Loading...' : (selectedTenant?.name || 'Select Tenant')}
          </span>
          <ChevronDown size={14} className={`text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-2 w-64 bg-slate-900 rounded-xl ring-1 ring-white/10 shadow-xl z-50 overflow-hidden">
            <div className="p-2 border-b border-white/10">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white/5 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              {filteredFranchises.map((franchise) => (
                <div key={franchise.id} className="mb-2 last:mb-0">
                  <p className="text-xs text-slate-500 px-2 py-1 flex items-center gap-1">
                    <Building2 size={10} />
                    {franchise.name}
                  </p>
                  {franchise.tenants.map((tenant) => (
                    <button
                      key={tenant.id}
                      onClick={() => handleSelect(tenant, franchise)}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition ${
                        selectedTenant?.id === tenant.id 
                          ? 'bg-cyan-500/20 text-cyan-400' 
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <span className="truncate">{tenant.name}</span>
                      {selectedTenant?.id === tenant.id && <Check size={14} />}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className="flex items-center gap-3 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl ring-1 ring-white/10 transition min-w-[240px] disabled:opacity-50"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
            <Layers size={16} />
          </div>
          <div className="text-left">
            <p className="text-xs text-slate-400">
              {loading ? 'Loading...' : (selectedFranchise?.name || 'No franchise')}
            </p>
            <p className="text-sm font-medium">
              {loading ? '...' : (selectedTenant?.name || 'Select Tenant')}
            </p>
          </div>
        </div>
        <ChevronDown size={16} className={`text-slate-400 ml-auto transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {error && (
        <p className="text-xs text-red-400 mt-1">{error}</p>
      )}

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-slate-900 rounded-xl ring-1 ring-white/10 shadow-xl z-50 overflow-hidden">
          <div className="p-3 border-b border-white/10">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search franchises and tenants..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/5 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {filteredFranchises.map((franchise) => (
              <div key={franchise.id} className="mb-3 last:mb-0">
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400">
                  <Building2 size={12} />
                  <span className="font-medium uppercase tracking-wider">{franchise.name}</span>
                </div>
                <div className="space-y-1">
                  {franchise.tenants.map((tenant) => (
                    <button
                      key={tenant.id}
                      onClick={() => handleSelect(tenant, franchise)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                        selectedTenant?.id === tenant.id 
                          ? 'bg-cyan-500/20 text-cyan-400' 
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Layers size={14} className="text-slate-400" />
                        <div className="text-left">
                          <p className="font-medium">{tenant.name}</p>
                          {tenant.domain && (
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <Globe size={10} />
                              {tenant.domain}
                            </p>
                          )}
                        </div>
                      </div>
                      {selectedTenant?.id === tenant.id && (
                        <Check size={16} className="text-cyan-400" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {filteredFranchises.length === 0 && (
              <p className="text-center text-slate-400 py-4 text-sm">No results found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
