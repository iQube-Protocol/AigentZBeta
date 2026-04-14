"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IQubeCard } from "./IQubeCard";
import { ViewModeToggle, type ViewMode } from "./ViewModeToggle";
import { Pagination } from "./Pagination";
import { DotsInline } from "./scoreUtils";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { useToast } from "../ui/toaster";
import { ComponentRegistryPanel } from "./ComponentRegistryPanel";
import { IngestionFactoryPanel } from "./IngestionFactoryPanel";

interface IQubeTemplate {
  id: string;
  name: string;
  description: string;
  price?: number;
  provenance?: number;
  sensitivityScore?: number;
  riskScore: number;
  accuracyScore: number;
  verifiabilityScore: number;
  createdAt: string;
  iQubeType?: 'DataQube' | 'ContentQube' | 'ToolQube' | 'ModelQube' | 'AigentQube';
  iQubeInstanceType?: 'template' | 'instance';
  businessModel?: 'Buy' | 'Sell' | 'Rent' | 'Lease' | 'Subscribe' | 'Stake' | 'License' | 'Donate';
  visibility?: 'public' | 'private';
}

interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextPage: number | null;
  prevPage: number | null;
}

interface Persona {
  id: string;
  fio_handle: string | null;
  default_identity_state: string | null;
}

interface FilterState {
  search: string;
  type: string;
  instance: string;
  businessModel: string;
  sort: 'newest' | 'oldest';
}

const filterInputCls =
  "w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/50";
const filterLabelCls = "text-[11px] text-slate-500 mb-1 block truncate";

const formatQCents = (usd: number): string => {
  const qc = Math.round(usd * 100);
  if (qc >= 1000) {
    const kqc = qc / 1000;
    return `${kqc % 1 === 0 ? kqc.toFixed(0) : kqc.toFixed(1)}KQ¢`;
  }
  return `Q¢${qc}`;
};

export function RegistryHome() {
  const [activeRegistryTab, setActiveRegistryTab] = useState<"templates" | "factory">("templates");
  const [templates, setTemplates] = useState<IQubeTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const router = useRouter();
  const [filters, setFilters] = useState<FilterState>({ search: "", type: "", instance: "", businessModel: "", sort: 'newest' });
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [cart, setCart] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Identity filter state (inlined from IdentityFilterSection)
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [personasLoading, setPersonasLoading] = useState(true);
  const [selectedPersona, setSelectedPersona] = useState<string>("");
  const [minReputationBucket, setMinReputationBucket] = useState<number>(0);

  // Pagination state
  const [pagination, setPagination] = useState<PaginationMeta>({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 12,
    hasNextPage: false,
    hasPrevPage: false,
    nextPage: null,
    prevPage: null,
  });

  // Honour ?tab=factory deep-link
  useEffect(() => {
    if (!searchParams) return;
    if (searchParams.get('tab') === 'factory') setActiveRegistryTab('factory');
  }, [searchParams]);

  // Clean legacy query param like ?template=template-003
  useEffect(() => {
    if (!searchParams) return;
    const t = searchParams.get('template');
    if (t && /^template-\d{3}$/i.test(t)) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('template');
      const path = `/registry${params.toString() ? `?${params.toString()}` : ''}`;
      router.replace(path);
    }
  }, [searchParams, router]);

  // Fetch personas (inlined from IdentityFilterSection)
  useEffect(() => {
    fetch('/api/identity/persona')
      .then(r => r.json())
      .then(data => {
        if (data.ok) setPersonas(data.data || []);
        setPersonasLoading(false);
      })
      .catch(() => setPersonasLoading(false));
  }, []);

  // Listen for updates from the modal and refetch via HTTP
  useEffect(() => {
    const handler = async (e: any) => {
      const updated = e.detail;
      if (!updated?.id) return;
      try {
        const params = new URLSearchParams();
        if (filters.search) params.set('search', filters.search);
        if (filters.type) params.set('type', filters.type);
        if (filters.instance) params.set('instance', filters.instance);
        if (filters.businessModel) params.set('businessModel', filters.businessModel);
        if (filters.sort) params.set('sort', filters.sort);
        const res = await fetch(`/api/registry/templates?${params.toString()}`);
        const data = await res.json();
        if (res.ok && Array.isArray(data)) setTemplates(data);
        try { toast('Template updated', 'success'); } catch {}
      } catch (err) {
        console.error('Failed to refresh templates after update', err);
        try { toast('Failed to refresh after update', 'error'); } catch {}
      }
    };
    window.addEventListener('registryTemplateUpdated', handler as any);
    return () => window.removeEventListener('registryTemplateUpdated', handler as any);
  }, [filters]);

  // Hydrate list from service and refetch on filter changes
  useEffect(() => {
    let mounted = true;
    const fetchList = async (f: FilterState, page: number = pagination.currentPage, limit: number = pagination.limit) => {
      const params = new URLSearchParams();
      if (f.search) params.set('search', f.search);
      if (f.type) params.set('type', f.type);
      if (f.instance) params.set('instance', f.instance);
      if (f.businessModel) params.set('businessModel', f.businessModel);
      if (f.sort) params.set('sort', f.sort);
      params.set('page', page.toString());
      params.set('limit', limit.toString());
      setIsLoading(true);
      try {
        const res = await fetch(`/api/registry/templates?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load templates');
        if (data.data && data.pagination) {
          setTemplates(Array.isArray(data.data) ? data.data : []);
          setPagination(data.pagination);
          setWarning(data.error || null);
        } else {
          setTemplates(Array.isArray(data) ? data : []);
          setPagination(prev => ({
            ...prev,
            totalCount: Array.isArray(data) ? data.length : 0,
            totalPages: 1,
          }));
          setWarning(null);
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load templates');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    fetchList(filters);
    return () => { mounted = false; };
  }, [filters, pagination.currentPage, pagination.limit]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('registry_cart', JSON.stringify(cart));
  }, [cart]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  }, [filters.search, filters.type, filters.instance, filters.businessModel, filters.sort]);

  if (isLoading) {
    return <RegistryLoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200">
        {error}
      </div>
    );
  }

  const filteredTemplates = templates.filter((t) => {
    if (filters.search) {
      const s = filters.search.toLowerCase();
      if (!t.name.toLowerCase().includes(s) && !t.description.toLowerCase().includes(s)) return false;
    }
    if (filters.type && t.iQubeType && t.iQubeType !== filters.type) return false;
    if (filters.instance && t.iQubeInstanceType && t.iQubeInstanceType !== filters.instance) return false;
    if (filters.businessModel && t.businessModel && t.businessModel !== filters.businessModel) return false;
    return true;
  }).sort((a, b) => {
    const da = new Date(a.createdAt).getTime();
    const db = new Date(b.createdAt).getTime();
    return (filters.sort === 'oldest' ? da - db : db - da);
  });

  const handleAddToCart = (id: string) => {
    setCart(prev => (prev.includes(id) ? prev : [...prev, id]));
  };

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, currentPage: page }));
  };

  const handleLimitChange = (limit: number) => {
    setPagination(prev => ({ ...prev, limit, currentPage: 1 }));
  };

  const requestDelete = (id: string) => setDeleteId(id);

  const confirmDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    try {
      const res = await fetch(`/api/registry/templates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.type) params.set('type', filters.type);
      if (filters.instance) params.set('instance', filters.instance);
      if (filters.businessModel) params.set('businessModel', filters.businessModel);
      const listRes = await fetch(`/api/registry/templates?${params.toString()}`);
      const data = await listRes.json();
      if (listRes.ok && Array.isArray(data)) setTemplates(data);
      setCart(prev => prev.filter(cid => cid !== id));
      setDeleteId(null);
      try { toast('Template deleted', 'success'); } catch {}
    } catch (err) {
      console.error('Delete failed:', err);
      try { toast('Delete failed', 'error'); } catch {}
    }
  };

  const tabBtnCls = (active: boolean, variant: 'default' | 'amber' | 'emerald' = 'default') => {
    if (active) {
      if (variant === 'amber') return "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30";
      if (variant === 'emerald') return "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25";
      return "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors bg-slate-500/20 text-slate-200 ring-1 ring-slate-500/30";
    }
    return "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors text-slate-400 hover:text-slate-200 hover:bg-white/5";
  };

  const sortBtnCls = (active: boolean) =>
    `px-2.5 py-1.5 text-sm rounded-lg border transition-colors ${active ? 'border-indigo-500/40 text-indigo-300 bg-indigo-500/10' : 'border-white/10 text-slate-300 hover:border-white/20'}`;

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Header */}
      <div className="sticky top-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 z-10 pb-4 space-y-3">

        {/* Row 1: 6 filters — snap-carousel on mobile, 6-col grid on lg+ */}
        <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-0.5 scrollbar-hide lg:grid lg:grid-cols-6 lg:overflow-visible">
          {/* Search */}
          <div className="snap-start shrink-0 min-w-[155px] lg:min-w-0">
            <label className={filterLabelCls}>Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              placeholder="Search iQubes"
              className={filterInputCls}
            />
          </div>

          {/* Type */}
          <div className="snap-start shrink-0 min-w-[140px] lg:min-w-0">
            <label className={filterLabelCls}>Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))}
              className={filterInputCls}
              aria-label="Type"
            >
              <option value="">All Types</option>
              <option>DataQube</option>
              <option>ContentQube</option>
              <option>ToolQube</option>
              <option>ModelQube</option>
              <option>AigentQube</option>
            </select>
          </div>

          {/* Instance */}
          <div className="snap-start shrink-0 min-w-[140px] lg:min-w-0">
            <label className={filterLabelCls}>Instance</label>
            <select
              value={filters.instance}
              onChange={(e) => setFilters(f => ({ ...f, instance: e.target.value }))}
              className={filterInputCls}
              aria-label="Instance"
            >
              <option value="">Templates & Instances</option>
              <option value="template">Templates</option>
              <option value="instance">Instances</option>
            </select>
          </div>

          {/* Business Model */}
          <div className="snap-start shrink-0 min-w-[145px] lg:min-w-0">
            <label className={filterLabelCls}>Biz Model</label>
            <select
              value={filters.businessModel}
              onChange={(e) => setFilters(f => ({ ...f, businessModel: e.target.value }))}
              className={filterInputCls}
              aria-label="Business Model"
            >
              <option value="">All Models</option>
              <option>Buy</option>
              <option>Sell</option>
              <option>Rent</option>
              <option>Lease</option>
              <option>Subscribe</option>
              <option>Stake</option>
              <option>License</option>
              <option>Donate</option>
            </select>
          </div>

          {/* Persona */}
          <div className="snap-start shrink-0 min-w-[145px] lg:min-w-0">
            <label className={filterLabelCls}>Persona</label>
            <select
              value={selectedPersona}
              onChange={(e) => setSelectedPersona(e.target.value)}
              className={filterInputCls}
              disabled={personasLoading}
              aria-label="Persona"
            >
              <option value="">Any Persona</option>
              {personas.map(p => (
                <option key={p.id} value={p.id}>
                  {p.fio_handle || p.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>

          {/* Reputation */}
          <div className="snap-start shrink-0 min-w-[145px] lg:min-w-0">
            <label className={filterLabelCls}>Reputation</label>
            <select
              value={minReputationBucket}
              onChange={(e) => setMinReputationBucket(Number(e.target.value))}
              className={filterInputCls}
              aria-label="Min Reputation"
            >
              <option value="0">Any Reputation</option>
              <option value="1">Bucket 1+ (Moderate)</option>
              <option value="2">Bucket 2+ (Good)</option>
              <option value="3">Bucket 3+ (Excellent)</option>
              <option value="4">Bucket 4+ (Outstanding)</option>
            </select>
          </div>
        </div>

        {/* Row 2: Tab-buttons LEFT + Controls RIGHT */}
        <div className="flex items-center justify-between gap-3">
          {/* LEFT: iQube Catalog | Ingestion Factory | + New iQube */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => setActiveRegistryTab("templates")}
              className={tabBtnCls(activeRegistryTab === "templates")}
            >
              iQube Catalog
            </button>
            <button
              type="button"
              onClick={() => setActiveRegistryTab("factory")}
              className={tabBtnCls(activeRegistryTab === "factory", "amber")}
            >
              Ingestion Factory
            </button>
            <Link
              href="/registry/add"
              className={tabBtnCls(false, "emerald") + " inline-flex items-center gap-1"}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              New iQube
            </Link>
          </div>

          {/* RIGHT: Q¢ badge + Sort + View mode + Cart */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Q¢ currency badge */}
            <span
              className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20 cursor-default"
              title="Prices shown in Q¢ (QuCents). 1 Q¢ = $0.01 USD. 1 KQ¢ = 1,000 Q¢ = $10 USD."
            >
              Q¢
            </span>
            {/* Sort */}
            <button
              type="button"
              className={sortBtnCls(filters.sort !== 'oldest')}
              title="Newest first"
              onClick={() => setFilters(f => ({ ...f, sort: 'newest' }))}
            >
              ↓
            </button>
            <button
              type="button"
              className={sortBtnCls(filters.sort === 'oldest')}
              title="Oldest first"
              onClick={() => setFilters(f => ({ ...f, sort: 'oldest' }))}
            >
              ↑
            </button>
            {/* View mode toggles */}
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
            {/* Cart */}
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 ring-1 ring-white/10 text-sm font-medium text-slate-300"
              title="Items in cart"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/>
                <circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 12.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              <span className="tabular-nums">{cart.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto space-y-6">
        {activeRegistryTab === "factory" && <IngestionFactoryPanel />}
        {activeRegistryTab === "templates" && <ComponentRegistryPanel />}
        {activeRegistryTab === "templates" && warning && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Registry data is unavailable right now: {warning}
          </div>
        )}

        {activeRegistryTab === "templates" && viewMode === 'grid' && (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <IQubeCard
                key={template.id}
                id={template.id}
                name={template.name}
                description={template.description}
                price={template.price}
                provenance={template.provenance}
                sensitivityScore={template.sensitivityScore}
                riskScore={template.riskScore}
                accuracyScore={template.accuracyScore}
                verifiabilityScore={template.verifiabilityScore}
                iQubeType={template.iQubeType}
                iQubeInstanceType={template.iQubeInstanceType}
                businessModel={template.businessModel}
                visibility={template.visibility}
                onClick={(id) => router.push(`/registry?template=${id}`)}
                onEdit={(id) => router.push(`/registry?template=${id}&edit=1`)}
                onAddToCart={handleAddToCart}
                onDelete={requestDelete}
              />
            ))}
          </div>
        )}

        {viewMode === 'list' && (
          <div className="space-y-3">
            {filteredTemplates.map((t) => (
              <div key={t.id} className="rounded-2xl p-4 bg-white/5 ring-1 ring-white/10">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-slate-400">Template</div>
                    <div className="text-lg font-medium truncate" title={t.name}>{t.name}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {t.iQubeType && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30" title="Type">{t.iQubeType}</span>}
                      {(t.iQubeInstanceType || 'template') && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/30 capitalize" title="Instance">{t.iQubeInstanceType || 'template'}</span>}
                      {t.businessModel && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30" title="Business Model">{t.businessModel}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {typeof t.price === 'number' && !Number.isNaN(t.price) && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30" title="Price (Q¢)">
                        {formatQCents(t.price)}
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      <button className="p-2 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white" title="View" onClick={() => router.push(`/registry?template=${t.id}`)}>View</button>
                      <button className="p-2 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white" title="Edit" onClick={() => router.push(`/registry?template=${t.id}&edit=1`)}>Edit</button>
                      <button className="p-2 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white" title="Add to cart" onClick={() => handleAddToCart(t.id)}>Cart</button>
                      <button className="p-2 rounded-lg hover:bg-white/10 text-red-300 hover:text-red-400" title="Delete" onClick={() => setDeleteId(t.id)}>Delete</button>
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-slate-400 text-sm">
                  <div className="grid grid-cols-4 gap-2">
                    <div className="flex flex-col items-center"><div className="text-[11px]" title="Sensitivity: Low 1–4, Medium 5–7, High 8–10">Sensitivity</div><DotsInline value={t.sensitivityScore ?? 0} kind='sensitivity' title="Sensitivity" /></div>
                    <div className="flex flex-col items-center"><div className="text-[11px]" title="Accuracy: Poor 1–3, Moderate 4–6, High 7–10">Accuracy</div><DotsInline value={t.accuracyScore} kind='accuracy' title="Accuracy" /></div>
                    <div className="flex flex-col items-center"><div className="text-[11px]" title="Verifiability: Low 1–3, Moderate 4–6, High 7–10">Verifiability</div><DotsInline value={t.verifiabilityScore} kind='verifiability' title="Verifiability" /></div>
                    <div className="flex flex-col items-center"><div className="text-[11px]" title="Risk: Low 1–4, Medium 5–7, High 8–10">Risk</div><DotsInline value={t.riskScore} kind='risk' title="Risk" /></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeRegistryTab === "templates" && viewMode === 'table' && (
          <div className="overflow-x-auto rounded-2xl ring-1 ring-white/10">
            <table className="min-w-full text-sm">
              <thead className="bg-white/5 text-slate-400">
                <tr>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Instance</th>
                  <th className="text-left px-4 py-3">Business</th>
                  <th className="text-left px-4 py-3">Prov</th>
                  <th className="text-left px-4 py-3">Price</th>
                  <th className="text-left px-4 py-3">Sensitivity</th>
                  <th className="text-left px-4 py-3">Accuracy</th>
                  <th className="text-left px-4 py-3">Verifiability</th>
                  <th className="text-left px-4 py-3">Risk</th>
                  <th className="text-left px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTemplates.map((t) => (
                  <tr key={t.id} className="border-t border-white/10 hover:bg-white/5">
                    <td className="px-4 py-3 text-slate-200 truncate max-w-xs" title={t.name}>{t.name}</td>
                    <td className="px-4 py-3 text-slate-300">{t.iQubeType || '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{t.iQubeInstanceType || 'template'}</td>
                    <td className="px-4 py-3 text-slate-300">{t.businessModel || '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{typeof t.provenance === 'number' ? t.provenance : 0}</td>
                    <td className="px-4 py-3 text-amber-300">{typeof t.price === 'number' ? formatQCents(t.price) : '—'}</td>
                    <td className="px-4 py-3"><DotsInline value={t.sensitivityScore ?? 0} kind='sensitivity' title="Sensitivity" /></td>
                    <td className="px-4 py-3"><DotsInline value={t.accuracyScore} kind='accuracy' title="Accuracy" /></td>
                    <td className="px-4 py-3"><DotsInline value={t.verifiabilityScore} kind='verifiability' title="Verifiability" /></td>
                    <td className="px-4 py-3"><DotsInline value={t.riskScore} kind='risk' title="Risk" /></td>
                    <td className="px-4 py-3 flex items-center gap-2">
                      <button className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-slate-300 hover:text-white hover:bg-white/10" onClick={() => router.push(`/registry?template=${t.id}`)}>Open</button>
                      <button className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-slate-300 hover:text-white hover:bg-white/10" onClick={() => handleAddToCart(t.id)}>Cart</button>
                      <button className="px-3 py-1.5 text-xs rounded-lg border border-red-500/30 text-red-300 hover:text-red-400 hover:bg-red-500/10" onClick={() => setDeleteId(t.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {activeRegistryTab === "templates" && pagination.totalPages > 1 && (
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalCount={pagination.totalCount}
            limit={pagination.limit}
            hasNextPage={pagination.hasNextPage}
            hasPrevPage={pagination.hasPrevPage}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
          />
        )}

        <ConfirmDialog
          open={!!deleteId}
          title="Delete Template"
          description="Are you sure you want to delete this iQube template? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
        />
      </div>
    </div>
  );
}

function RegistryLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-6 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 bg-white/10 animate-pulse rounded-lg"></div>
        ))}
      </div>
      <div className="flex justify-between">
        <div className="flex gap-1.5">
          <div className="h-7 w-24 bg-white/10 animate-pulse rounded-lg"></div>
          <div className="h-7 w-28 bg-white/10 animate-pulse rounded-lg"></div>
          <div className="h-7 w-20 bg-white/10 animate-pulse rounded-lg"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-7 w-7 bg-white/10 animate-pulse rounded-lg"></div>
          <div className="h-7 w-7 bg-white/10 animate-pulse rounded-lg"></div>
          <div className="h-7 w-20 bg-white/10 animate-pulse rounded-lg"></div>
          <div className="h-7 w-14 bg-white/10 animate-pulse rounded-lg"></div>
        </div>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10">
            <div className="h-4 w-20 bg-white/10 animate-pulse rounded mb-2"></div>
            <div className="h-6 w-40 bg-white/10 animate-pulse rounded mb-4"></div>
            <div className="h-4 w-full bg-white/10 animate-pulse rounded"></div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between">
                <div className="h-3 w-16 bg-white/10 animate-pulse rounded"></div>
                <div className="h-3 w-20 bg-white/10 animate-pulse rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
