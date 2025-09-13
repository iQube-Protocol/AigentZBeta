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
  // Mint notice state
  const [mintPromptOpen, setMintPromptOpen] = useState(false);
  const [mintChoice, setMintChoice] = useState<'public' | 'private'>('public');
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

  const isActivePrivate = (tid: string) => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`active_private_${tid}`) === '1';
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

  // Example meta extras for PA Case iQube (view-only placeholders)
  function getMetaExtras() {
    return [
      { k: 'Service Line', v: 'Orthopedics' },
      { k: 'Procedure Category', v: 'TKA / THA' },
      { k: 'CPT/HCPCS Set (hashed)', v: 'sha256(27130), sha256(27447)' },
      { k: 'Payer Type', v: 'Commercial' },
      { k: 'Channel', v: 'PAS' },
      { k: 'Completeness Score', v: '0.94' },
      { k: 'Attachments Summary', v: 'PDF:3, DICOM:2, C-CDA:1' },
      { k: 'Provenance Hash', v: '0x81a…c2d' },
      { k: 'Template Version', v: 'ET-ORTHO-THA-v1.6' },
      { k: 'SLA Target (days)', v: '7' },
    ];
  }
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [canShowMint, setCanShowMint] = useState(false);
  const [bqEditFields, setBqEditFields] = useState<BQField[]>([]);
  const metaExtras = useMemo(() => getMetaExtras(), []);
  // Editable meta extras (Edit mode only; UI state for now)
  const [metaEditRows, setMetaEditRows] = useState<{ k: string; v: string }[]>([]);
  // Example text per BlakQube key for PA Case iQube (template view)
  const exampleByKey: Record<string, string> = useMemo(() => ({
    patientIdentifiers: 'MRN 00981234; 1961-04-12',
    orderingProvider: 'NPI 1457399920 (Dr. Lu)',
    coverage: 'UHC Choice Plus / M12345678',
    diagnosisList: 'M17.11, M16.12',
    proceduresRequested: '27130 (THA)',
    imaging: 'AP pelvis; SR# 934455',
    conservativeTherapy: 'PT x 8 wks; NSAIDs failed',
    objectiveMeasures: 'BMI 33.8; VAS 8/10',
    comorbidities: 'ASA III; T2DM',
    medicalNecessity: 'Radiographic OA grade 4… (signed)',
    crdDtrArtifacts: 'JSON bundle',
    packetManifests: 'List of PDFs/DICOM with SHA-256',
    digitalSignatures: 'CMS-compliant signature block',
  }), []);
  // "What it is" hint per BlakQube key for PA Case iQube
  const hintByKey: Record<string, string> = useMemo(() => ({
    patientIdentifiers: 'MRN, DOB, patient name',
    orderingProvider: 'Ordering provider NPI and name',
    coverage: 'Plan and member identifiers',
    diagnosisList: 'ICD-10 diagnosis codes for the case',
    proceduresRequested: 'CPT/HCPCS procedure codes requested',
    imaging: 'Imaging reports and DICOM links',
    conservativeTherapy: 'Proof of PT/NSAIDs durations and outcomes',
    objectiveMeasures: 'Objective measures like BMI, ROM, pain score',
    comorbidities: 'Risk/comorbidities e.g. ASA class, DM/OSA',
    medicalNecessity: 'Narrative and citations supporting necessity',
    crdDtrArtifacts: 'Raw CRD/DTR rule responses bundle',
    packetManifests: 'List of packet files with hashes',
    digitalSignatures: 'Clinician and co-signer CMS-compliant signature block',
  }), []);
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
          // Initialize Additional MetaQube Records from template if present
          if (mounted) setMetaEditRows(Array.isArray(item?.metaExtras) && item.metaExtras.length ? item.metaExtras : []);
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
      if (mounted && item) setMetaEditRows(Array.isArray(item?.metaExtras) && item.metaExtras.length ? item.metaExtras : []);
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

  // Compute Mint button visibility client-side only to avoid hydration mismatch
  useEffect(() => {
    try {
      if (!template) { setCanShowMint(!!edit); return; }
      const currentUserId = 'temp-user-id'; // TODO: wire real auth
      const ownerByFlag = isOwner(templateId);
      const ownerByRecord = !!template?.userId && template.userId === currentUserId;
      const treatUnownedAsMine = !template?.userId; // temporary fallback
      const mintedServer = template && (template.visibility === 'public' || template.visibility === 'private');
      // IMPORTANT: Ignore local minted flag to avoid stale client-only state hiding Mint
      const mintedEffective = !!mintedServer;
      const inLibrary = typeof window !== 'undefined' && localStorage.getItem(`library_${templateId}`) === '1';
      const canMintView = !edit && !mintedEffective && (ownerByFlag || ownerByRecord || treatUnownedAsMine || inLibrary);
      const show = !!edit || canMintView;
      setCanShowMint(show);
    } catch {
      setCanShowMint(!!edit);
    }
  }, [edit, template, templateId]);

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

  // ... (rest of the code remains the same)

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

              {/* Additional MetaQube Records (examples) */}
              <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
                <div className="text-sm text-slate-400 mb-2">Additional MetaQube Records</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(Array.isArray(template?.metaExtras) && template!.metaExtras!.length ? template!.metaExtras! : metaExtras).map((item: { k: string; v: string }) => (
                    <div key={item.k} className="flex items-center justify-between rounded-lg px-3 py-2 bg-black/30 ring-1 ring-white/10">
                      <div className="text-sm text-slate-300">{item.k}</div>
                      <div className="text-sm text-slate-500 text-right">{item.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Core Scores with dots (moved up under Additional MetaQube Records) */}
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
                  {(template.blakqubeLabels && Array.isArray(template.blakqubeLabels) && template.blakqubeLabels.length
                    ? template.blakqubeLabels
                    : getBlakQubeMockSchema(template.name)
                  ).map((f: any) => (
                    <div key={f.key} className="flex items-center rounded-xl px-3 py-2 bg-white/5 ring-1 ring-white/10">
                      {/* Left: Label with tooltip (what it is). Give it more flex so it shows fully unless it would wrap. */}
                      <div className="flex items-center gap-2 min-w-0 flex-[3]">
                        <div className="text-sm text-slate-200 whitespace-nowrap truncate" title={(f.hint || hintByKey[f.key]) || undefined}>{f.label}</div>
                      </div>
                      {/* Middle: example (template) or status/value (instance). Smaller width to favor label. */}
                      <div className="ml-3 pr-3 text-sm text-right text-slate-500 flex-[1] basis-32 min-w-[96px] max-w-[160px]">
                        {template.iQubeInstanceType === 'template' && (
                          <span className="truncate inline-block max-w-full" title={(f.example || exampleByKey[f.key]) || undefined}>{(f.example || exampleByKey[f.key]) || '—'}</span>
                        )}
                        {template.iQubeInstanceType !== 'template' && !isDecrypted && (
                          <span className="text-violet-300">Encrypted</span>
                        )}
                        {template.iQubeInstanceType !== 'template' && isDecrypted && (
                          <span className="text-slate-200">Sample Value</span>
                        )}
                      </div>
                      {/* Right: icon badge with tooltip (source) */}
                      <div className="ml-auto">
                        <span className="text-xs inline-flex items-center justify-center w-6 h-6 rounded bg-white/10 ring-1 ring-white/20" title={f.source}>{f.icon}</span>
                      </div>
                    </div>
                  ))}
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
              {/* Scores moved below Additional MetaQube Records */}
              {/* EDIT MODE: Additional MetaQube Records - Editable */}
              <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-slate-400">Additional MetaQube Records</div>
                  <button
                    className="px-2.5 py-1 text-xs rounded-lg border border-white/20 text-slate-200 hover:text-white hover:bg-white/10"
                    onClick={() => setMetaEditRows(prev => prev.length ? [...prev, { k: 'New Record', v: '' }] : [...metaExtras, { k: 'New Record', v: '' }])}
                  >
                    + Add Row
                  </button>
                </div>
                {/* Column headers */}
                <div className="grid grid-cols-12 gap-2 text-[11px] text-slate-400 mb-1 px-1">
                  <div className="col-span-5">Name</div>
                  <div className="col-span-6 text-right">Example</div>
                  <div className="col-span-1 text-right">Del</div>
                </div>
                <div className="space-y-2">
                  {(metaEditRows.length ? metaEditRows : metaExtras).map((row, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        aria-label="Meta Name"
                        className="col-span-5 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm text-slate-200"
                        value={row.k}
                        onChange={e => setMetaEditRows(prev => {
                          const base = prev.length ? [...prev] : [...metaExtras];
                          const next = base.map((r,i)=> i===idx?{...r,k:e.target.value}:r);
                          return next;
                        })}
                        placeholder="name"
                      />
                      <input
                        aria-label="Meta Example"
                        className="col-span-6 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm text-slate-200 text-right"
                        value={row.v}
                        onChange={e => setMetaEditRows(prev => {
                          const base = prev.length ? [...prev] : [...metaExtras];
                          const next = base.map((r,i)=> i===idx?{...r,v:e.target.value}:r);
                          return next;
                        })}
                        placeholder="example"
                      />
                      <button
                        className="col-span-1 px-2 py-1 text-xs rounded-lg border border-red-500/40 text-red-300 hover:text-white hover:bg-red-600/50 text-right"
                        onClick={() => setMetaEditRows(prev => {
                          const base = prev.length ? [...prev] : [...metaExtras];
                          const next = base.filter((_,i)=> i!==idx);
                          return next;
                        })}
                      >
                        Del
                      </button>
                    </div>
                  ))}
                  
                  {/* Public/Private Visibility Setting */}
                  <div className="mt-4 p-3 bg-black/30 rounded-lg border border-white/10">
                    <div className="text-sm text-slate-300 mb-2">Registry Visibility</div>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="visibility"
                          value="public"
                          defaultChecked
                          className="text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-slate-200">Public</span>
                        <span className="text-xs text-slate-400">(Visible to all users)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="visibility"
                          value="private"
                          className="text-purple-500 focus:ring-purple-500"
                        />
                        <span className="text-sm text-slate-200">Private</span>
                        <span className="text-xs text-slate-400">(Only visible to you)</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Editable Scores (moved below Additional MetaQube Records) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[12px] text-slate-400 mb-2" title="Sensitivity: Low 1–4, Medium 5–7, High 8–10">Sensitivity (0-10)</label>
                  <input aria-label="Sensitivity Score" name="sensitivityScore" type="number" min={0} max={10} step={1} defaultValue={template?.sensitivityScore ?? 0} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200" />
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
                {/* Column headers */}
                <div className="grid grid-cols-12 gap-2 text-[11px] text-slate-400 mb-1 px-1">
                  <div className="col-span-3">Key (machine)</div>
                  <div className="col-span-3">Label (display)</div>
                  <div className="col-span-2">Source</div>
                  <div className="col-span-2">Example</div>
                  <div className="col-span-1">Icon</div>
                  <div className="col-span-1 text-right">Del</div>
                </div>
                <div className="space-y-2">
                  {bqEditFields.map((f, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <input aria-label="BQ Key" className="col-span-3 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm text-slate-200" value={f.key}
                        onChange={e => setBqEditFields(prev => prev.map((x,i)=> i===idx?{...x,key:e.target.value}:x))} placeholder="key" />
                      <input aria-label="BQ Label" className="col-span-3 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm text-slate-200" value={f.label}
                        onChange={e => setBqEditFields(prev => prev.map((x,i)=> i===idx?{...x,label:e.target.value}:x))} placeholder="label" />
                      <input aria-label="BQ Source" className="col-span-2 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm text-slate-200" value={f.source}
                        onChange={e => setBqEditFields(prev => prev.map((x,i)=> i===idx?{...x,source:e.target.value}:x))} placeholder="source" />
                      <input aria-label="BQ Example" className="col-span-2 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm text-slate-200" value={(f as any).example || ''}
                        onChange={e => setBqEditFields(prev => prev.map((x,i)=> i===idx?{...x,example:e.target.value}:x))} placeholder="example" />
                      <input aria-label="BQ Icon" className="col-span-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm text-slate-200" value={f.icon}
                        onChange={e => setBqEditFields(prev => prev.map((x,i)=> i===idx?{...x,icon:e.target.value}:x))} placeholder="icon" />
                      <button className="col-span-1 px-2 py-1 text-xs rounded-lg border border-red-500/40 text-red-300 hover:text-white hover:bg-red-600/50 text-right"
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
          {/* Close */}
          <button
            className="px-3 py-1.5 text-sm rounded-lg border border-white/10 text-slate-300 hover:text-white hover:bg-white/10"
            onClick={onClose}
          >
            Close
          </button>
          {/* Fork Template (first action) */}
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
                window.dispatchEvent(new CustomEvent('registryTemplateUpdated', { detail: created }));
                try { toast('Fork created', 'success'); } catch {}
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

          {/* Save (edit) */}
          {edit && (
              <button
                className="px-3 py-1.5 text-sm rounded-lg border border-indigo-500/40 text-indigo-300 hover:text-white hover:bg-indigo-600/70"
                onClick={async () => {
                  if (!template) return;
                  try {
                    // Update the template via PATCH first with current simple editable fields
                    const root = containerRef.current!;
                    const get = (sel: string) => (root.querySelector(sel) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null);
                    const payload: any = {
                      name: get('input[placeholder="Enter name"]')?.value || template.name,
                      description: (root.querySelector('textarea[placeholder="Enter description"]') as HTMLTextAreaElement | null)?.value ?? template.description,
                      iQubeType: (get('select[aria-label="iQube Type"]')?.value || template.iQubeType),
                      iQubeInstanceType: (get('select[aria-label="Instance Type"]')?.value || template.iQubeInstanceType),
                      businessModel: (get('select[aria-label="Business Model"]')?.value || template.businessModel),
                      price: Number((get('input[aria-label="Price"]') as HTMLInputElement | null)?.value || template.price || 0),
                      version: (get('input[placeholder="1.0"]') as HTMLInputElement | null)?.value || template.version || '1.0',
                      sensitivityScore: Number((get('input[aria-label="Sensitivity Score"]') as HTMLInputElement | null)?.value ?? template.sensitivityScore ?? 0),
                      accuracyScore: Number((get('input[aria-label="Accuracy Score"]') as HTMLInputElement | null)?.value ?? template.accuracyScore ?? 5),
                      verifiabilityScore: Number((get('input[aria-label="Verifiability Score"]') as HTMLInputElement | null)?.value ?? template.verifiabilityScore ?? 5),
                      riskScore: Number((get('input[aria-label="Risk Score"]') as HTMLInputElement | null)?.value ?? template.riskScore ?? 5),
                      metaExtras: (metaEditRows.length ? metaEditRows : metaExtras),
                      blakqubeLabels: bqEditFields,
                    };
                    const res = await fetch(`/api/registry/templates/${templateId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    });
                    const { json: updated, text } = await parseResponse(res);
                    if (!res.ok) throw new Error(updated?.error || text || 'Failed to save');
                    window.dispatchEvent(new CustomEvent('registryTemplateUpdated', { detail: updated }));

                    // Save to Library. Prefer explicit userId from /api/dev/user if valid
                    let body: any = { templateId };
                    try {
                      const r = await fetch('/api/dev/user');
                      if (r.ok) {
                        const j = await r.json();
                        if (j?.validUuid && j?.devUserId) body = { templateId, userId: j.devUserId };
                      }
                    } catch {}
                    const lib = await fetch('/api/registry/library', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(body),
                    });
                    if (lib.ok) {
                      localStorage.setItem(`library_${templateId}`, '1');
                      try { toast('Saved to your Private Library', 'success'); } catch {}
                      onClose();
                    } else {
                      const t = await lib.text();
                      try { const j = JSON.parse(t); toast(j?.error || j?.message || 'Failed to save to library', 'error'); } catch { toast(t || 'Failed to save to library', 'error'); }
                    }
                  } catch (e) {
                    try { toast('Save failed', 'error'); } catch {}
                  }
                }}
                title="Save this iQube to your Private Library"
              >
                Save to Library
              </button>
          )}
          {/* Mint (edit or eligible view) - opens application notice */}
          {canShowMint && (
            <button
              className={`px-3 py-1.5 text-sm rounded-lg ${isMinting ? 'opacity-60 pointer-events-none' : ''} bg-emerald-600 text-white hover:bg-emerald-500`}
              disabled={isMinting}
              onClick={() => setMintPromptOpen(true)}
              title="Mint this iQube to the Registry"
            >
              Mint to Registry
            </button>
          )}
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

        {/* Mint Application Notice (uses ConfirmDialog) */}
        <ConfirmDialog
          open={mintPromptOpen}
          title="Mint iQube"
          onCancel={() => setMintPromptOpen(false)}
          onConfirm={async () => {
            if (!template) { setMintPromptOpen(false); return; }
            setMintPromptOpen(false);
            setIsMinting(true);
            try {
              // Include user id if available
              let body: any = { visibility: mintChoice };
              try {
                const r = await fetch('/api/dev/user');
                if (r.ok) { const j = await r.json(); if (j?.validUuid && j?.devUserId) body.userId = j.devUserId; }
              } catch {}
              const res = await fetch(`/api/registry/templates/${templateId}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
              });
              const { json, text } = await parseResponse(res);
              if (!res.ok) throw new Error(json?.error || text || 'Mint failed');
              setMinted(templateId, true);
              setOwner(templateId, true);
              // Clear library flag so Registry badge shows
              try { localStorage.removeItem(`library_${templateId}`); } catch {}
              try { toast(mintChoice==='public' ? 'Minted to the Public Registry' : 'Minted to the Registry Privately', 'success'); } catch {}
              try { window.dispatchEvent(new CustomEvent('registryTemplateUpdated', { detail: json })); } catch {}
              // Close the modal after successful mint
              try { onClose(); } catch {}
            } catch (e) {
              try { toast(e instanceof Error ? e.message : 'Mint failed', 'error'); } catch {}
            } finally {
              setIsMinting(false);
            }
          }}
          confirmText={mintChoice==='public' ? 'Proceed: Mint Public' : 'Proceed: Mint Private'}
          confirmClassName={mintChoice==='public' ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-purple-600 text-white hover:bg-purple-500'}
        >
          <div>
            <div className="mb-2 text-slate-300 text-sm">
              If you mint Public, others can view, fork, and mint new versions. This cannot be reverted.
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="mintVisibility" value="public" checked={mintChoice==='public'} onChange={()=>setMintChoice('public')} className="text-emerald-500 focus:ring-emerald-500" />
                <span className="text-slate-200 text-sm">Public</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="mintVisibility" value="private" checked={mintChoice==='private'} onChange={()=>setMintChoice('private')} className="text-purple-500 focus:ring-purple-500" />
                <span className="text-slate-200 text-sm">Private</span>
              </label>
            </div>
          </div>
        </ConfirmDialog>
      </div>
    </div>
  );
};
