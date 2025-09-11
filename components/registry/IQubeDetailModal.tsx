"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Pencil } from "lucide-react";
import { useToast } from "../ui/Toaster";
import { ConfirmDialog } from "../ui/ConfirmDialog";

interface IQubeDetailModalProps {
  templateId: string;
  edit?: boolean;
  onClose: () => void;
}

export const IQubeDetailModal: React.FC<IQubeDetailModalProps> = ({ templateId, edit, onClose }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<any | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  // Local helper flags until user accounts/backends are wired
  const isMinted = (tid: string) => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`minted_${tid}`) === '1';
  };
  const isOwner = (tid: string) => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`owner_minted_${tid}`) === '1';
  };
  const setOwner = (tid: string, v: boolean) => {
    if (typeof window === 'undefined') return;
    if (v) localStorage.setItem(`owner_minted_${tid}`, '1');
    else localStorage.removeItem(`owner_minted_${tid}`);
  };
  const setMinted = (tid: string, v: boolean) => {
    if (typeof window === 'undefined') return;
    if (v) localStorage.setItem(`minted_${tid}`, '1');
    else localStorage.removeItem(`minted_${tid}`);
  };
  const activate = (tid: string, scope: 'private' | 'registry') => {
    if (typeof window === 'undefined') return;
    const key = scope === 'registry' ? `active_registry_${tid}` : `active_private_${tid}`;
    localStorage.setItem(key, '1');
  };

  // ----- BlakQube mock schema helpers -----
  type BQField = { key: string; label: string; source: string; icon: string };
  function getBlakQubeMockSchema(name?: string): BQField[] {
    const n = (name || '').toLowerCase();
    if (n.includes('personal')) {
      return [
        { key: 'firstName', label: 'First Name', source: 'LinkedIn', icon: 'in' },
        { key: 'lastName', label: 'Last Name', source: 'LinkedIn', icon: 'in' },
        { key: 'email', label: 'Email', source: 'Google', icon: 'G' },
        { key: 'phone', label: 'Phone', source: 'iCloud', icon: '' },
        { key: 'address', label: 'Address', source: 'USPS', icon: '🏤' },
      ];
    }
    if (n.includes('financial')) {
      return [
        { key: 'bank', label: 'Bank', source: 'Plaid', icon: '≋' },
        { key: 'account', label: 'Account #', source: 'Plaid', icon: '≋' },
        { key: 'transactions', label: 'Transactions', source: 'Visa', icon: 'V' },
        { key: 'kyc', label: 'KYC Status', source: 'CIP', icon: 'ID' },
      ];
    }
    if (n.includes('content')) {
      return [
        { key: 'url', label: 'Content URL', source: 'Web', icon: '🌐' },
        { key: 'hash', label: 'SHA-256 Hash', source: 'Hasher', icon: '🔗' },
        { key: 'signature', label: 'Signature', source: 'Wallet', icon: '⛓' },
        { key: 'license', label: 'License', source: 'Rights DB', icon: '©' },
      ];
    }
    if (n.includes('health') || n.includes('medical')) {
      return [
        { key: 'dob', label: 'Date of Birth', source: 'EHR', icon: '🩺' },
        { key: 'conditions', label: 'Conditions', source: 'EHR', icon: '🩺' },
        { key: 'meds', label: 'Medications', source: 'EHR', icon: '💊' },
      ];
    }
    // default generic schema
    return [
      { key: 'title', label: 'Title', source: 'User', icon: '👤' },
      { key: 'summary', label: 'Summary', source: 'User', icon: '📝' },
      { key: 'tags', label: 'Tags', source: 'System', icon: '🏷' },
    ];
  }
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [bqEditFields, setBqEditFields] = useState<BQField[]>([]);
  function canDecrypt(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('has_decrypt_token') === '1';
  }

  // Safely parse fetch responses that may return text/HTML on errors
  async function parseResponse(res: Response): Promise<{ json: any | null; text: string }> {
    const text = await res.text();
    try {
      return { json: JSON.parse(text), text };
    } catch {
      return { json: null, text };
    }
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        // Try to load single template by id first (Supabase-backed)
        const single = await fetch(`/api/registry/templates/${templateId}`);
        if (single.ok) {
          const item = await single.json();
          if (mounted) setTemplate(item);
          // Initialize BlakQube editor fields from template or mock
          if (mounted) setBqEditFields(Array.isArray(item?.blakqubeLabels) && item.blakqubeLabels.length ? item.blakqubeLabels : getBlakQubeMockSchema(item?.name));
          return;
        }
        // If not found and looks like legacy id, show clear guidance
        if (single.status === 404 && /^template-\d{3}$/i.test(templateId)) {
          if (mounted) setError('Legacy template ID detected. Please re-open a template from the list so it uses the new ID.');
          if (mounted) setTemplate(null);
          return;
        }
        // As a last resort, attempt list + find (dev fallback only)
        const res = await fetch('/api/registry/templates');
        if (res.ok) {
          const data: any[] = await res.json();
          const item = Array.isArray(data) ? data.find(d => d.id === templateId) || null : null;
          if (mounted) setTemplate(item);
          if (mounted && item) setBqEditFields(Array.isArray(item?.blakqubeLabels) && item.blakqubeLabels.length ? item.blakqubeLabels : getBlakQubeMockSchema(item?.name));
          if (!item) setError('Template not found');
        } else {
          setError('Failed to load template details');
        }
      } catch (e) {
        console.error(e);
        if (mounted) setError('Failed to load template details');
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [templateId]);

  const Dots: React.FC<{ value: number; color: string; title: string }> = ({ value, color, title }) => {
    const v = Math.max(0, Math.min(10, Number(value) || 0));
    const filled = Math.round(v / 2);
    return (
      <div className="flex items-center gap-1" title={`${title}: ${v.toFixed(1)}`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={`text-xs ${i < filled ? color : "text-slate-600"}`}>●</span>
        ))}
      </div>
    );
  };

  // Dynamic color logic per iQube Protocol
  function scoreColor(kind: 'sensitivity' | 'risk' | 'accuracy' | 'verifiability', value: number) {
    const v = Math.max(0, Math.min(10, value || 0));
    if (kind === 'sensitivity' || kind === 'risk') {
      if (v <= 4) return 'text-green-400';
      if (v <= 7) return 'text-amber-400';
      return 'text-red-400';
    } else {
      if (v <= 3) return 'text-red-400';
      if (v <= 6) return 'text-amber-400';
      return 'text-green-400';
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div ref={containerRef} className="relative w-full max-w-3xl rounded-2xl bg-[#0b0b0f] ring-1 ring-white/10 p-6 mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {template?.name || (edit ? 'Edit iQube Template' : 'iQube Template Details')}
            </h2>
            <div className="text-sm text-slate-400">Template ID: {templateId}</div>
          </div>
          <button
            className="p-2 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="mt-6 space-y-4 overflow-y-auto pr-2 flex-1">
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-5 w-40 bg-white/10 animate-pulse rounded" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-16 bg-white/10 animate-pulse rounded-xl" />
                <div className="h-16 bg-white/10 animate-pulse rounded-xl" />
              </div>
              <div className="h-24 bg-white/10 animate-pulse rounded-xl" />
            </div>
          ) : !template ? (
            <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200">Template not found.</div>
          ) : !edit ? (
            <>
              {/* Badge Row */}
              <div className="flex flex-wrap gap-2">
                {template.iQubeType && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30">{template.iQubeType}</span>
                )}
                {template.iQubeInstanceType && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/30 capitalize">{template.iQubeInstanceType}</span>
                )}
                {template.businessModel && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30">{template.businessModel}</span>
                )}
              </div>
              {/* Identity, Business & Price */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
                  <div className="text-sm text-slate-400">iQube Type</div>
                  <div className="text-slate-200">{template.iQubeType || '—'}</div>
                </div>
                <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
                  <div className="text-sm text-slate-400">Business Model</div>
                  <div className="text-slate-200">{template.businessModel || '—'}</div>
                </div>
                <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
                  <div className="text-sm text-slate-400">Price</div>
                  <div className="text-slate-200">{typeof template.price === 'number' ? `$${template.price.toFixed(2)}` : '—'}</div>
                </div>
              </div>
              {/* Lineage */}
              {template.parentTemplateId && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-400">Parent Template</div>
                      <div className="text-slate-200 text-xs break-all">{template.parentTemplateId}</div>
                    </div>
                    <button
                      className="px-2 py-1 text-xs rounded-lg border border-white/10 text-slate-300 hover:text-white hover:bg-white/10"
                      onClick={() => router.push(`/registry?template=${template.parentTemplateId}`)}
                      title="Open parent template"
                    >
                      View Parent
                    </button>
                  </div>
                </div>
              )}
              {/* MetaQube Identity */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
                  <div className="text-sm text-slate-400">Creator</div>
                  <div className="text-slate-200">{template.iQubeCreator || '—'}</div>
                </div>
                <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
                  <div className="text-sm text-slate-400">Subject Type</div>
                  <div className="text-slate-200">{template.subjectType || '—'}</div>
                </div>
                <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
                  <div className="text-sm text-slate-400">Subject Identifiability</div>
                  <div className="text-slate-200">{template.subjectIdentifiability || '—'}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
                  <div className="text-sm text-slate-400">Owner Type</div>
                  <div className="text-slate-200">{template.ownerType || '—'}</div>
                </div>
                <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
                  <div className="text-sm text-slate-400">Owner Identifiability</div>
                  <div className="text-slate-200">{template.ownerIdentifiability || '—'}</div>
                </div>
                <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
                  <div className="text-sm text-slate-400">Date Created</div>
                  <div className="text-slate-200">{template.createdAt ? new Date(template.createdAt).toLocaleDateString() : '—'}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
                  <div className="text-sm text-slate-400">Version</div>
                  <div className="text-slate-200">{template.version || '1.0'}</div>
                </div>
                <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
                  <div className="text-sm text-slate-400">Provenance</div>
                  <div className="text-slate-200">{typeof template.provenance === 'number' ? template.provenance : 0}</div>
                </div>
                <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
                  <div className="text-sm text-slate-400">Instances</div>
                  <div className="text-slate-200">{typeof (template as any).instanceCount === 'number' ? (template as any).instanceCount : 0}</div>
                </div>
              </div>
              {/* Description */}
              <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
                <div className="text-sm text-slate-400 mb-1">Description</div>
                <div className="text-slate-300 text-sm">{template.description || '—'}</div>
              </div>

              {/* BlakQube Data (mock) */}
              <div className="rounded-2xl p-4 bg-gradient-to-b from-violet-900/10 to-violet-900/5 ring-1 ring-violet-500/20">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-slate-200 font-medium">BlakQube Data</h4>
                  {template.iQubeInstanceType === 'instance' && (
                    <button
                      className="px-2.5 py-1 text-xs rounded-lg border border-violet-500/40 text-violet-200 hover:text-white hover:bg-violet-600/70"
                      onClick={() => {
                        if (!canDecrypt()) {
                          try { toast('Decrypt token required to view data', 'error'); } catch {}
                          return;
                        }
                        setIsDecrypted(v => !v);
                      }}
                    >
                      {isDecrypted ? 'Hide' : 'Decrypt'}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {getBlakQubeMockSchema(template.name).map(f => (
                    <div key={f.key} className="flex items-center justify-between rounded-xl px-3 py-2 bg-white/5 ring-1 ring-white/10">
                      <div className="flex items-center gap-2">
                        <span className="text-xs inline-flex items-center justify-center w-5 h-5 rounded bg-white/10 ring-1 ring-white/20" title={f.source}>{f.icon}</span>
                        <div className="text-sm text-slate-200">{f.label}</div>
                        <div className="text-[11px] text-slate-400">({f.source})</div>
                      </div>
                      <div className="text-sm text-slate-300">
                        {template.iQubeInstanceType === 'template' && <span className="text-slate-500">—</span>}
                        {template.iQubeInstanceType !== 'template' && !isDecrypted && (
                          <span className="text-violet-300">Encrypted</span>
                        )}
                        {template.iQubeInstanceType !== 'template' && isDecrypted && (
                          <span className="text-slate-200">Sample Value</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Core Scores with dots */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-slate-300 text-sm">
                <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10 flex flex-col items-center gap-2">
                  <span className="text-[12px]" title="Sensitivity: Low 1–4, Medium 5–7, High 8–10">Sensitivity</span>
                  <Dots value={template.sensitivityScore ?? 0} color={scoreColor('sensitivity', template.sensitivityScore ?? 0)} title="Sensitivity" />
                </div>
                <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10 flex flex-col items-center gap-2">
                  <span className="text-[12px]" title="Accuracy: Poor 1–3, Moderate 4–6, High 7–10">Accuracy</span>
                  <Dots value={template.accuracyScore} color={scoreColor('accuracy', template.accuracyScore)} title="Accuracy" />
                </div>
                <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10 flex flex-col items-center gap-2">
                  <span className="text-[12px]" title="Verifiability: Low 1–3, Moderate 4–6, High 7–10">Verifiability</span>
                  <Dots value={template.verifiabilityScore} color={scoreColor('verifiability', template.verifiabilityScore)} title="Verifiability" />
                </div>
                <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10 flex flex-col items-center gap-2">
                  <span className="text-[12px]" title="Risk: Low 1–4, Medium 5–7, High 8–10">Risk</span>
                  <Dots value={template.riskScore} color={scoreColor('risk', template.riskScore)} title="Risk" />
                </div>
              </div>
            </>
          ) : (
            <>
              {template.parentTemplateId && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[12px] text-slate-400 mb-1">Parent Template</label>
                    <div className="flex items-center gap-2">
                      <input className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200" readOnly value={template.parentTemplateId} />
                      <button
                        className="px-2 py-1 text-xs rounded-lg border border-white/10 text-slate-300 hover:text-white hover:bg-white/10"
                        onClick={() => router.push(`/registry?template=${template.parentTemplateId}`)}
                        title="Open parent template"
                      >
                        View Parent
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {/* Editable MetaQube Basics */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[12px] text-slate-400 mb-1">iQube Name</label>
                  <input className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200" placeholder="Enter name" defaultValue={template?.name} />
                </div>
                <div>
                  <label className="block text-[12px] text-slate-400 mb-1">Business Model</label>
                  <select className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200" aria-label="Business Model" defaultValue={template?.businessModel || 'Buy'}>
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
                <div>
                  <label className="block text-[12px] text-slate-400 mb-1">Price (USD)</label>
                  <input className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200" placeholder="0.00" type="number" step="0.01" min={0} defaultValue={typeof template?.price === 'number' ? String(template.price) : ''} aria-label="Price" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] text-slate-400 mb-1">iQube Type</label>
                  <select className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200" aria-label="iQube Type" defaultValue={template?.iQubeType || 'DataQube'}>
                    <option>DataQube</option>
                    <option>ContentQube</option>
                    <option>ToolQube</option>
                    <option>ModelQube</option>
                    <option>AigentQube</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] text-slate-400 mb-1">Instance Type</label>
                  <select className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200" aria-label="Instance Type" defaultValue={template?.iQubeInstanceType || 'template'}>
                    <option value="template">Template</option>
                    <option value="instance">Instance</option>
                  </select>
                </div>
              </div>
              {/* Editable Identity */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[12px] text-slate-400 mb-1">Creator</label>
                  <input className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200" placeholder="Creator ID" defaultValue={template?.iQubeCreator || ''} />
                </div>
                <div>
                  <label className="block text-[12px] text-slate-400 mb-1">Subject Type</label>
                  <select className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200" aria-label="Subject Type" defaultValue={template?.subjectType || 'Person'}>
                    <option>Person</option>
                    <option>Organization</option>
                    <option>Agent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] text-slate-400 mb-1">Subject Identifiability</label>
                  <select className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200" aria-label="Subject Identifiability" defaultValue={template?.subjectIdentifiability || 'Identifiable'}>
                    <option>Identifiable</option>
                    <option>Semi-Identifiable</option>
                    <option>Anonymous</option>
                    <option>Semi-Anonymous</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[12px] text-slate-400 mb-1">Owner Type</label>
                  <select className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200" aria-label="Owner Type" defaultValue={template?.ownerType || 'Individual'}>
                    <option>Individual</option>
                    <option>Organisation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] text-slate-400 mb-1">Owner Identifiability</label>
                  <select className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200" aria-label="Owner Identifiability" defaultValue={template?.ownerIdentifiability || 'Identifiable'}>
                    <option>Identifiable</option>
                    <option>Semi-Identifiable</option>
                    <option>Anonymous</option>
                    <option>Semi-Anonymous</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] text-slate-400 mb-1">Date Created</label>
                  <input aria-label="Date Created" type="date" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200" defaultValue={template?.createdAt ? new Date(template.createdAt).toISOString().slice(0,10) : ''} />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[12px] text-slate-400 mb-1">Version</label>
                  <input className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200" placeholder="1.0" defaultValue={template?.version || '1.0'} />
                </div>
                <div>
                  <label className="block text-[12px] text-slate-400 mb-1">Provenance</label>
                  <input className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200" value={typeof template?.provenance === 'number' ? template.provenance : 0} readOnly />
                </div>
              </div>
              <div>
                <label className="block text-[12px] text-slate-400 mb-1">Description</label>
                <textarea className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 min-h-[100px]" placeholder="Enter description" defaultValue={template?.description} />
              </div>
              {/* Editable Scores (scaffold) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[12px] text-slate-400 mb-2" title="Sensitivity: Low 1–4, Medium 5–7, High 8–10">Sensitivity (0-10)</label>
                  <input aria-label="Sensitivity Score" name="sensitivityScore" type="number" min={0} max={10} step={1} defaultValue={template?.sensitivityScore ?? 5} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200" />
                </div>
                <div>
                  <label className="block text-[12px] text-slate-400 mb-2" title="Accuracy: Poor 1–3, Moderate 4–6, High 7–10">Accuracy (0-10)</label>
                  <input aria-label="Accuracy Score" name="accuracyScore" type="number" min={0} max={10} step={1} defaultValue={template?.accuracyScore ?? 5} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200" />
                </div>
                <div>
                  <label className="block text-[12px] text-slate-400 mb-2" title="Verifiability: Low 1–3, Moderate 4–6, High 7–10">Verifiability (0-10)</label>
                  <input aria-label="Verifiability Score" name="verifiabilityScore" type="number" min={0} max={10} step={1} defaultValue={template?.verifiabilityScore ?? 5} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200" />
                </div>
                <div>
                  <label className="block text-[12px] text-slate-400 mb-2" title="Risk: Low 1–4, Medium 5–7, High 8–10">Risk (0-10)</label>
                  <input aria-label="Risk Score" name="riskScore" type="number" min={0} max={10} step={1} defaultValue={template?.riskScore ?? 5} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200" />
                </div>
              </div>
              {/* EDIT MODE: BlakQube Fields Editor */}
              <div className="rounded-2xl p-4 bg-gradient-to-b from-violet-900/10 to-violet-900/5 ring-1 ring-violet-500/20">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-slate-200 font-medium">BlakQube Fields</h4>
                  <button
                    className="px-2.5 py-1 text-xs rounded-lg border border-violet-500/40 text-violet-200 hover:text-white hover:bg-violet-600/70"
                    onClick={() => setBqEditFields(prev => [...prev, { key: `field_${prev.length+1}`, label: 'New Field', source: 'User', icon: '📝' }])}
                  >
                    + Add Field
                  </button>
                </div>
                <div className="space-y-2">
                  {bqEditFields.map((f, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <input aria-label="BQ Key" className="col-span-3 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm text-slate-200" value={f.key}
                        onChange={e => setBqEditFields(prev => prev.map((x,i)=> i===idx?{...x,key:e.target.value}:x))} placeholder="key" />
                      <input aria-label="BQ Label" className="col-span-3 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm text-slate-200" value={f.label}
                        onChange={e => setBqEditFields(prev => prev.map((x,i)=> i===idx?{...x,label:e.target.value}:x))} placeholder="label" />
                      <input aria-label="BQ Source" className="col-span-3 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm text-slate-200" value={f.source}
                        onChange={e => setBqEditFields(prev => prev.map((x,i)=> i===idx?{...x,source:e.target.value}:x))} placeholder="source" />
                      <input aria-label="BQ Icon" className="col-span-2 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm text-slate-200" value={f.icon}
                        onChange={e => setBqEditFields(prev => prev.map((x,i)=> i===idx?{...x,icon:e.target.value}:x))} placeholder="icon" />
                      <button className="col-span-1 px-2 py-1 text-xs rounded-lg border border-red-500/40 text-red-300 hover:text-white hover:bg-red-600/50"
                        onClick={() => setBqEditFields(prev => prev.filter((_,i)=>i!==idx))}>Del</button>
                    </div>
                  ))}
                  {bqEditFields.length === 0 && (
                    <div className="text-xs text-slate-400">No fields. Click "+ Add Field" to start.</div>
                  )}
                </div>
              </div>

            </>
          )}
        </div>

        {/* Footer (sticky at bottom of modal) */}
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm rounded-lg border border-white/10 text-slate-300 hover:text-white hover:bg-white/10"
            onClick={onClose}
          >
            Close
          </button>
          <button
            className="px-3 py-1.5 text-sm rounded-lg border border-indigo-500/40 text-indigo-300 hover:text-white hover:bg-indigo-600/70"
            onClick={async () => {
              if (!template) return onClose();
              try {
                const baseName = (template.name || 'Untitled').replace(/(\s*\(fork\)\s*)+$/i, '');
                const payload: any = {
                  name: `${baseName} (fork)`,
                  description: template.description || '',
                  iQubeType: template.iQubeType,
                  iQubeInstanceType: 'template' as const,
                  businessModel: template.businessModel,
                  price: typeof template.price === 'number' ? template.price : undefined,
                  version: template.version || '1.0',
                  parentTemplateId: templateId,
                  blakqubeLabels: template.blakqubeLabels || undefined,
                  sensitivityScore: Number(template.sensitivityScore ?? 0),
                  accuracyScore: Number(template.accuracyScore ?? 0),
                  verifiabilityScore: Number(template.verifiabilityScore ?? 0),
                  riskScore: Number(template.riskScore ?? 0),
                };
                const res = await fetch('/api/registry/templates', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                });
                const { json: created, text } = await parseResponse(res);
                if (!res.ok) throw new Error(created?.error || text || 'Fork failed');
                // broadcast
                window.dispatchEvent(new CustomEvent('registryTemplateUpdated', { detail: created }));
                try { toast('Fork created', 'success'); } catch {}
                // open new fork in edit mode
                router.push(`/registry?template=${created.id}&edit=1`);
                return;
              } catch (e) {
                console.error('Fork failed', e);
                try { toast(e instanceof Error ? e.message : 'Fork failed', 'error'); } catch {}
              }
            }}
            title="Create a new template derived from this one; provenance will increment automatically"
          >
            Fork Template
          </button>
          {edit && (
            <button
              className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-500"
              onClick={async () => {
                const root = containerRef.current;
                if (!root) return onClose();
                const get = (sel: string) => (root.querySelector(sel) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null);
                const payload: any = {
                  name: get('input[placeholder="Enter name"]')?.value || template?.name,
                  businessModel: (get('select[aria-label="Business Model"]') as HTMLSelectElement)?.value || template?.businessModel,
                  iQubeType: (get('select[aria-label="iQube Type"]') as HTMLSelectElement)?.value || template?.iQubeType,
                  iQubeInstanceType: (get('select[aria-label="Instance Type"]') as HTMLSelectElement)?.value || template?.iQubeInstanceType,
                  description: (get('textarea[placeholder="Enter description"]') as HTMLTextAreaElement)?.value || template?.description,
                  iQubeCreator: get('input[placeholder="Creator ID"]')?.value || template?.iQubeCreator,
                  subjectType: (get('select[aria-label="Subject Type"]') as HTMLSelectElement)?.value || template?.subjectType,
                  subjectIdentifiability: (get('select[aria-label="Subject Identifiability"]') as HTMLSelectElement)?.value || template?.subjectIdentifiability,
                  ownerType: (get('select[aria-label="Owner Type"]') as HTMLSelectElement)?.value || template?.ownerType,
                  ownerIdentifiability: (get('select[aria-label="Owner Identifiability"]') as HTMLSelectElement)?.value || template?.ownerIdentifiability,
                  createdAt: (get('input[type="date"]') as HTMLInputElement)?.value || template?.createdAt,
                  version: get('input[placeholder="1.0"]')?.value || template?.version,
                  price: (() => { const v = get('input[aria-label="Price"]') as HTMLInputElement | null; return v && v.value !== '' ? Number(v.value) : undefined; })(),
                  sensitivityScore: Number((get('input[name="sensitivityScore"]') as HTMLInputElement)?.value ?? template?.sensitivityScore ?? 0),
                  riskScore: Number((get('input[name="riskScore"]') as HTMLInputElement)?.value ?? template?.riskScore ?? 0),
                  accuracyScore: Number((get('input[name="accuracyScore"]') as HTMLInputElement)?.value ?? template?.accuracyScore ?? 0),
                  verifiabilityScore: Number((get('input[name="verifiabilityScore"]') as HTMLInputElement)?.value ?? template?.verifiabilityScore ?? 0),
                  blakqubeLabels: bqEditFields,
                };
                try {
                  const res = await fetch(`/api/registry/templates/${templateId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                  });
                  const { json: updated, text } = await parseResponse(res);
                  if (!res.ok) throw new Error(updated?.error || text || 'Failed to save');
                  window.dispatchEvent(new CustomEvent('registryTemplateUpdated', { detail: updated }));
                  onClose();
                  try { toast('Template saved', 'success'); } catch {}
                } catch (e) {
                  console.error('Save failed', e);
                  try { toast(e instanceof Error ? e.message : 'Save failed', 'error'); } catch {}
                }
              }}
            >
              Save
            </button>
          )}
          {edit && (
            <button
              className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
              onClick={async () => {
                try {
                  // Placeholder mint flow: mark as minted locally
                  setMinted(templateId, true);
                  setOwner(templateId, true);
                  try { toast('Minted: will be published to registry in the full flow', 'success'); } catch {}
                } catch (e) {
                  console.error('Mint failed', e);
                  try { toast(e instanceof Error ? e.message : 'Mint failed', 'error'); } catch {}
                }
              }}
              title="Mint this iQube (will publish to the public registry)"
            >
              Mint
            </button>
          )}
          <button
            className="px-3 py-1.5 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-500"
            onClick={() => {
              try {
                const minted = isMinted(templateId);
                const owner = isOwner(templateId);
                const price = typeof template?.price === 'number' ? template.price : 0;
                if (minted && owner) {
                  activate(templateId, 'registry');
                  try { toast('Activated in Registry', 'success'); } catch {}
                } else if (!owner && price > 0) {
                  // Payment required: open placeholder payment modal
                  setShowPayment(true);
                } else {
                  activate(templateId, 'private');
                  try { toast('Activated privately (your instance)', 'success'); } catch {}
                }
              } catch (e) {
                console.error('Activate failed', e);
                try { toast(e instanceof Error ? e.message : 'Activate failed', 'error'); } catch {}
              }
            }}
            title="Activate this iQube (private if not minted; registry if minted)"
          >
            Activate
          </button>
        </div>

        <ConfirmDialog
          open={showPayment}
          title="Payment Required"
          description={`This iQube requires payment to activate. Proceed to pay ${(typeof template?.price === 'number' ? `$${template?.price.toFixed(2)}` : 'the fee')} and activate in your registry?`}
          confirmText="Confirm Payment"
          cancelText="Cancel"
          onConfirm={() => {
            setShowPayment(false);
            // Mark ownership and activate in registry
            setOwner(templateId, true);
            activate(templateId, 'registry');
            try { toast('Payment successful. Activated in Registry', 'success'); } catch {}
          }}
          onCancel={() => setShowPayment(false)}
        />
      </div>
    </div>
  );
};
