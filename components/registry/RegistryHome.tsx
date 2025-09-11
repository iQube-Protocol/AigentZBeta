"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IQubeCard } from "./IQubeCard";
import { FilterSection, type FilterState } from "./FilterSection";
import { ViewModeToggle, type ViewMode } from "./ViewModeToggle";
import { DotsInline } from "./scoreUtils";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { useToast } from "../ui/Toaster";

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
}

export function RegistryHome() {
  const [templates, setTemplates] = useState<IQubeTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [filters, setFilters] = useState<FilterState>({ search: "", type: "", instance: "", businessModel: "" });
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [cart, setCart] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Clean legacy query param like ?template=template-003
  useEffect(() => {
    if (!searchParams) return;
    const t = searchParams.get('template');
    if (t && /^template-\d{3}$/i.test(t)) {
      // Remove legacy template param from URL to avoid stale IDs
      const params = new URLSearchParams(searchParams.toString());
      params.delete('template');
      const path = `/registry${params.toString() ? `?${params.toString()}` : ''}`;
      router.replace(path);
    }
  }, [searchParams, router]);

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
    const fetchList = async (f: FilterState) => {
      const params = new URLSearchParams();
      if (f.search) params.set('search', f.search);
      if (f.type) params.set('type', f.type);
      if (f.instance) params.set('instance', f.instance);
      if (f.businessModel) params.set('businessModel', f.businessModel);
      setIsLoading(true);
      try {
        const res = await fetch(`/api/registry/templates?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load templates');
        setTemplates(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load templates');
      } finally {
        setIsLoading(false);
      }
    };
    fetchList(filters);
    return () => { mounted = false; };
  }, [filters]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('registry_cart', JSON.stringify(cart));
  }, [cart]);

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

  // Apply filters
  const filteredTemplates = templates.filter((t) => {
    if (filters.search) {
      const s = filters.search.toLowerCase();
      if (!t.name.toLowerCase().includes(s) && !t.description.toLowerCase().includes(s)) return false;
    }
    if (filters.type && t.iQubeType && t.iQubeType !== filters.type) return false;
    if (filters.instance && t.iQubeInstanceType && t.iQubeInstanceType !== filters.instance) return false;
    if (filters.businessModel && t.businessModel && t.businessModel !== filters.businessModel) return false;
    return true;
  });

  const handleAddToCart = (id: string) => {
    setCart(prev => (prev.includes(id) ? prev : [...prev, id]));
  };

  // Open confirmation dialog for deletion
  const requestDelete = (id: string) => setDeleteId(id);

  const confirmDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    try {
      const res = await fetch(`/api/registry/templates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      // Refetch list
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-medium">iQube Templates</h2>
        <Link href="/registry/add" className="text-indigo-400 hover:text-indigo-300 text-sm">
          + Add New iQube
        </Link>
      </div>

      <div className="flex items-center justify-between gap-3">
        <FilterSection value={filters} onChange={setFilters} />
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </div>
      {/* Cart indicator */}
      <div className="flex items-center justify-end text-sm text-slate-300">
        <span className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-white/5 ring-1 ring-white/10" title="Items in cart">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 12.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
          {cart.length}
        </span>
      </div>

      {viewMode === 'grid' && (
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
                  <div className="text-lg font-medium">{t.name}</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {t.iQubeType && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30" title="Type">{t.iQubeType}</span>}
                    {(t.iQubeInstanceType || 'template') && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/30 capitalize" title="Instance">{t.iQubeInstanceType || 'template'}</span>}
                    {t.businessModel && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30" title="Business Model">{t.businessModel}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {typeof t.price === 'number' && !Number.isNaN(t.price) && (
                    <div className="text-xs text-slate-200/90" title="Quoted using fixed rate: $1 = 1000 sats">
                      <span className="font-medium">{(Math.round((t.price || 0) * 1000)).toLocaleString()} sats</span>
                      <span className="mx-1 text-slate-400">·</span>
                      <span>${(t.price || 0).toFixed(2)}</span>
                    </div>
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

      {viewMode === 'table' && (
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
                  <td className="px-4 py-3 text-slate-200">{t.name}</td>
                  <td className="px-4 py-3 text-slate-300">{t.iQubeType || '—'}</td>
                  <td className="px-4 py-3 text-slate-300">{t.iQubeInstanceType || 'template'}</td>
                  <td className="px-4 py-3 text-slate-300">{t.businessModel || '—'}</td>
                  <td className="px-4 py-3 text-slate-300">{typeof t.provenance === 'number' ? t.provenance : 0}</td>
                  <td className="px-4 py-3 text-slate-200">{typeof t.price === 'number' ? `${(Math.round(t.price*1000)).toLocaleString()} sats · $${t.price.toFixed(2)}` : '—'}</td>
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
  );
}

function RegistryLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="h-6 w-40 bg-white/10 animate-pulse rounded"></div>
        <div className="h-4 w-28 bg-white/10 animate-pulse rounded"></div>
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
              <div className="flex justify-between">
                <div className="h-3 w-16 bg-white/10 animate-pulse rounded"></div>
                <div className="h-3 w-20 bg-white/10 animate-pulse rounded"></div>
              </div>
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

// Sample data for development
function getSampleTemplates(): IQubeTemplate[] {
  return [
    {
      id: "template-001",
      name: "Personal Data iQube",
      description: "Template for storing and managing personal identity information with high security and privacy controls.",
      sensitivityScore: 7,
      riskScore: 8,
      accuracyScore: 9,
      verifiabilityScore: 7,
      createdAt: "2025-08-15T12:00:00Z",
      iQubeType: 'DataQube',
      iQubeInstanceType: 'template',
      businessModel: 'Subscribe'
    },
    {
      id: "template-002",
      name: "Financial Transaction iQube",
      description: "Secure template for recording and verifying financial transactions with audit trails.",
      sensitivityScore: 6,
      riskScore: 6,
      accuracyScore: 10,
      verifiabilityScore: 9,
      createdAt: "2025-08-10T14:30:00Z",
      iQubeType: 'DataQube',
      iQubeInstanceType: 'template',
      businessModel: 'Buy'
    },
    {
      id: "template-003",
      name: "Content Verification iQube",
      description: "Template for verifying the authenticity and provenance of digital content and media.",
      sensitivityScore: 3,
      riskScore: 4,
      accuracyScore: 8,
      verifiabilityScore: 10,
      createdAt: "2025-08-05T09:15:00Z",
      iQubeType: 'ContentQube',
      iQubeInstanceType: 'template',
      businessModel: 'License'
    },
    {
      id: "template-004",
      name: "Credential iQube",
      description: "Template for storing and verifying professional credentials and certifications.",
      sensitivityScore: 5,
      riskScore: 5,
      accuracyScore: 9,
      verifiabilityScore: 8,
      createdAt: "2025-07-28T16:45:00Z",
      iQubeType: 'ToolQube',
      iQubeInstanceType: 'template',
      businessModel: 'Sell'
    },
    {
      id: "template-005",
      name: "Health Data iQube",
      description: "Secure template for managing sensitive health information with privacy controls.",
      sensitivityScore: 9,
      riskScore: 9,
      accuracyScore: 9,
      verifiabilityScore: 6,
      createdAt: "2025-07-20T11:30:00Z",
      iQubeType: 'DataQube',
      iQubeInstanceType: 'template',
      businessModel: 'Donate'
    },
    {
      id: "template-006",
      name: "Research Data iQube",
      description: "Template for storing and sharing scientific research data with verification mechanisms.",
      sensitivityScore: 2,
      riskScore: 3,
      accuracyScore: 8,
      verifiabilityScore: 9,
      createdAt: "2025-07-15T13:20:00Z",
      iQubeType: 'ModelQube',
      iQubeInstanceType: 'template',
      businessModel: 'Rent'
    }
  ];
}

// DotsInline and scoreColor now imported from shared scoreUtils
