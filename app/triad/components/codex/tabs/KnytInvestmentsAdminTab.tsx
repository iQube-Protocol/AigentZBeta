'use client';

import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  Calendar,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Coins,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  TrendingUp,
  Trash2,
  X,
} from 'lucide-react';

interface Props {
  personaId?: string;
  isAdmin?: boolean;
}

interface InvestorRow {
  personaId: string;
  email: string | null;
  displayName: string | null;
  fioHandle: string | null;
  summary: {
    totalInvestedUsd: number;
    totalSharesGranted: number;
    totalKnytGranted: number;
    eventCount: number;
  };
  documents: { total: number; visible: number };
}

interface CapitalEvent {
  id: string;
  eventType: string;
  amountUsd: number | null;
  amountShares: number | null;
  amountKnyt: number | null;
  vehicle: string | null;
  occurredAt: string;
  notes: string | null;
}

interface InvestorDocument {
  id: string;
  docType: string;
  title: string;
  storageMasterId: string | null;
  visibleToInvestor: boolean;
  effectiveDate: string | null;
  createdAt: string;
}

interface InvestorDetail {
  personaId: string;
  events: CapitalEvent[];
  documents: InvestorDocument[];
}

const EVENT_TYPES = [
  { value: 'investment',        label: 'Investment' },
  { value: 'share_grant',       label: 'Share Grant' },
  { value: 'token_grant',       label: 'Token Grant' },
  { value: 'vesting_milestone', label: 'Vesting Milestone' },
  { value: 'distribution',      label: 'Distribution' },
] as const;

const DOC_TYPES = [
  { value: 'subscription_agreement', label: 'Subscription Agreement' },
  { value: 'side_letter',            label: 'Side Letter' },
  { value: 'k1',                     label: 'K-1' },
  { value: '1099_b',                 label: '1099-B' },
  { value: 'quarterly_letter',       label: 'Quarterly Letter' },
  { value: 'annual_report',          label: 'Annual Report' },
  { value: 'capitalization_table',   label: 'Capitalization Table' },
  { value: 'other',                  label: 'Other' },
] as const;

const EVENT_LABELS: Record<string, string> = Object.fromEntries(EVENT_TYPES.map((t) => [t.value, t.label]));
const DOC_LABELS: Record<string, string> = Object.fromEntries(DOC_TYPES.map((t) => [t.value, t.label]));

function formatUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function formatNumber(n: number, fractionDigits = 0): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

// ── Add-event modal ──────────────────────────────────────────────────────────

function AddEventModal({
  personaId,
  onClose,
  onSaved,
}: {
  personaId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [eventType, setEventType] = useState<string>('investment');
  const [amountUsd, setAmountUsd] = useState<string>('');
  const [amountShares, setAmountShares] = useState<string>('');
  const [amountKnyt, setAmountKnyt] = useState<string>('');
  const [vehicle, setVehicle] = useState<string>('');
  const [occurredAt, setOccurredAt] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/investor-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId,
          eventType,
          amountUsd: amountUsd ? parseFloat(amountUsd) : undefined,
          amountShares: amountShares ? parseFloat(amountShares) : undefined,
          amountKnyt: amountKnyt ? parseFloat(amountKnyt) : undefined,
          vehicle: vehicle || undefined,
          occurredAt: new Date(occurredAt).toISOString(),
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-emerald-400" />
            Add Capital Event
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-400 mb-1 block">Event Type</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-white"
            >
              {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 mb-1 block">USD</label>
              <input value={amountUsd} onChange={(e) => setAmountUsd(e.target.value)} type="number" step="0.01"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-white" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 mb-1 block">Shares</label>
              <input value={amountShares} onChange={(e) => setAmountShares(e.target.value)} type="number" step="0.01"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-white" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-400 mb-1 block">KNYT</label>
              <input value={amountKnyt} onChange={(e) => setAmountKnyt(e.target.value)} type="number" step="0.01"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-white" />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-400 mb-1 block">Vehicle</label>
            <input value={vehicle} onChange={(e) => setVehicle(e.target.value)} type="text" placeholder="e.g. SAFE, Series Seed"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-white" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-400 mb-1 block">Occurred At</label>
            <input value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} type="date"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-white" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-400 mb-1 block">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-white" />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-white">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs text-white flex items-center gap-1">
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add-document modal ───────────────────────────────────────────────────────

function AddDocumentModal({
  personaId,
  onClose,
  onSaved,
}: {
  personaId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [docType, setDocType] = useState<string>('subscription_agreement');
  const [title, setTitle] = useState<string>('');
  const [storageMasterId, setStorageMasterId] = useState<string>('');
  const [effectiveDate, setEffectiveDate] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/investor-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId,
          docType,
          title: title.trim(),
          storageMasterId: storageMasterId.trim() || undefined,
          effectiveDate: effectiveDate || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <FileText className="h-4 w-4 text-violet-400" />
            Attach Investor Document
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-400 mb-1 block">Type</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-white">
              {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-400 mb-1 block">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} type="text"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-white" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-400 mb-1 block">
              Storage Master ID
              <span className="ml-2 text-slate-500 normal-case">(from admin/codex/storage upload)</span>
            </label>
            <input value={storageMasterId} onChange={(e) => setStorageMasterId(e.target.value)} type="text" placeholder="master_content_qubes.id"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-white font-mono" />
            <p className="text-[10px] text-slate-500 mt-1">
              Upload the PDF via Admin → Codex → Storage first, then paste the resulting master ID here. Leave blank to attach metadata only.
            </p>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-400 mb-1 block">Effective Date</label>
            <input value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} type="date"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-white" />
          </div>
          <p className="text-[10px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
            Note: this document will be created as <strong>not visible</strong> to the investor by default. Toggle visibility from the document row after creation.
          </p>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-white">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-xs text-white flex items-center gap-1">
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              Attach
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Per-investor expandable detail panel ─────────────────────────────────────

function InvestorDetailPanel({ personaId, onMutated }: { personaId: string; onMutated: () => void }) {
  const [detail, setDetail] = useState<InvestorDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/investor-dashboard?personaId=${encodeURIComponent(personaId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((payload: InvestorDetail) => { if (!cancelled) setDetail(payload); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [personaId, refreshKey]);

  async function toggleDocVisibility(docId: string, current: boolean) {
    try {
      const res = await fetch(`/api/admin/investor-documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibleToInvestor: !current }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRefreshKey((k) => k + 1);
      onMutated();
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(`Failed to toggle visibility: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  }

  async function deleteDoc(docId: string) {
    // eslint-disable-next-line no-alert
    if (!confirm('Delete this document attachment? The underlying storage object is not removed.')) return;
    try {
      const res = await fetch(`/api/admin/investor-documents/${docId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRefreshKey((k) => k + 1);
      onMutated();
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(`Failed to delete: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  }

  if (loading && !detail) {
    return <div className="flex items-center justify-center py-6 text-slate-400 text-xs"><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading…</div>;
  }
  if (error) {
    return <div className="py-3 px-4 text-xs text-red-400">Failed to load: {error}</div>;
  }
  if (!detail) return null;

  return (
    <div className="bg-slate-950/40 border-t border-slate-800/60 px-4 py-3 space-y-4">
      {/* Capital events section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Briefcase className="h-3 w-3" />
            Capital Events ({detail.events.length})
          </p>
          <button onClick={() => setShowEventModal(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-[10px] text-emerald-300">
            <Plus className="h-3 w-3" />
            Add event
          </button>
        </div>
        {detail.events.length === 0 ? (
          <p className="text-xs text-slate-500 px-2">No events recorded.</p>
        ) : (
          <div className="space-y-1">
            {detail.events.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-xs rounded-lg bg-slate-800/40 px-2.5 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-slate-300 truncate">{EVENT_LABELS[e.eventType] || e.eventType}</span>
                  {e.vehicle && <span className="text-[10px] text-slate-500">· {e.vehicle}</span>}
                  {e.notes && <span className="text-[10px] text-slate-500 truncate hidden md:inline" title={e.notes}>· {e.notes}</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {e.amountUsd != null && <span className="text-slate-200 font-medium">{formatUsd(Number(e.amountUsd))}</span>}
                  {e.amountShares != null && <span className="text-sky-300">{formatNumber(Number(e.amountShares))} sh</span>}
                  {e.amountKnyt != null && <span className="text-amber-300">{formatNumber(Number(e.amountKnyt), 2)} KNYT</span>}
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Calendar className="h-2.5 w-2.5" />
                    {formatDate(e.occurredAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Documents section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <FileText className="h-3 w-3" />
            Documents ({detail.documents.length})
          </p>
          <button onClick={() => setShowDocModal(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-[10px] text-violet-300">
            <Plus className="h-3 w-3" />
            Attach document
          </button>
        </div>
        {detail.documents.length === 0 ? (
          <p className="text-xs text-slate-500 px-2">No documents attached.</p>
        ) : (
          <div className="space-y-1">
            {detail.documents.map((d) => (
              <div key={d.id} className="flex items-center gap-2 rounded-lg bg-slate-800/40 px-2.5 py-1.5">
                <FileText className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{d.title}</p>
                  <p className="text-[10px] text-slate-500">
                    {DOC_LABELS[d.docType] || d.docType}
                    {d.effectiveDate && <> · {formatDate(d.effectiveDate)}</>}
                    {d.storageMasterId
                      ? <> · <span className="font-mono text-slate-600">{d.storageMasterId.slice(0, 12)}…</span></>
                      : <span className="text-amber-500/70"> · no PDF attached</span>}
                  </p>
                </div>
                <button onClick={() => toggleDocVisibility(d.id, d.visibleToInvestor)}
                  className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] shrink-0 ${
                    d.visibleToInvestor
                      ? 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30'
                      : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                  }`}
                  title={d.visibleToInvestor ? 'Hide from investor' : 'Send to investor'}>
                  {d.visibleToInvestor ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {d.visibleToInvestor ? 'Visible' : 'Hidden'}
                </button>
                <button onClick={() => deleteDoc(d.id)}
                  className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 shrink-0"
                  title="Delete attachment">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showEventModal && (
        <AddEventModal
          personaId={personaId}
          onClose={() => setShowEventModal(false)}
          onSaved={() => { setRefreshKey((k) => k + 1); onMutated(); }}
        />
      )}
      {showDocModal && (
        <AddDocumentModal
          personaId={personaId}
          onClose={() => setShowDocModal(false)}
          onSaved={() => { setRefreshKey((k) => k + 1); onMutated(); }}
        />
      )}
    </div>
  );
}

// ── Root component ───────────────────────────────────────────────────────────

export function KnytInvestmentsAdminTab({ isAdmin }: Props) {
  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch('/api/admin/investor-dashboard')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((payload: { investors: InvestorRow[] }) => { if (!cancelled) setInvestors(payload.investors ?? []); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (isAdmin === false) {
    return (
      <div className="p-6 text-center text-slate-400">
        <ShieldCheck className="h-8 w-8 text-amber-600 mx-auto mb-2" />
        <p className="text-sm font-semibold text-amber-200 mb-1">Admin access required</p>
        <p className="text-xs text-slate-500">The Investments admin tab is only visible to administrators.</p>
      </div>
    );
  }

  const filtered = search.trim()
    ? investors.filter((i) => {
        const q = search.toLowerCase();
        return (i.email?.toLowerCase().includes(q) ||
                i.displayName?.toLowerCase().includes(q) ||
                i.fioHandle?.toLowerCase().includes(q));
      })
    : investors;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-800/60 bg-slate-900/40 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <div>
              <p className="text-sm font-semibold text-white">Investments — Admin</p>
              <p className="text-[10px] text-slate-500">Per-investor capital events, equity, and document visibility</p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} type="text" placeholder="Search…"
              className="pl-7 pr-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white w-44" />
          </div>
        </div>
      </div>

      <div className="p-4">
        {loading && investors.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-slate-400 text-xs"><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading investors…</div>
        ) : error ? (
          <div className="text-center py-8 text-red-400 text-xs">Failed to load: {error}</div>
        ) : investors.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            No investors flagged in <code className="text-slate-300">nakamoto_knyt_personas</code>.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((inv) => {
              const isOpen = expandedId === inv.personaId;
              return (
                <div key={inv.personaId} className="rounded-xl border border-slate-700/40 bg-slate-900/40 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : inv.personaId)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/40 text-left"
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{inv.displayName || inv.fioHandle || inv.email || inv.personaId}</p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {inv.email}
                        {inv.fioHandle && <> · {inv.fioHandle}</>}
                      </p>
                    </div>
                    <div className="hidden md:flex items-center gap-3 text-[11px] shrink-0">
                      <div className="flex items-center gap-1 text-emerald-300" title="Total invested">
                        <CircleDollarSign className="h-3 w-3" />
                        {formatUsd(inv.summary.totalInvestedUsd)}
                      </div>
                      <div className="flex items-center gap-1 text-sky-300" title="Shares granted">
                        <TrendingUp className="h-3 w-3" />
                        {formatNumber(inv.summary.totalSharesGranted)}
                      </div>
                      <div className="flex items-center gap-1 text-amber-300" title="$KNYT granted">
                        <Coins className="h-3 w-3" />
                        {formatNumber(inv.summary.totalKnytGranted, 2)}
                      </div>
                      <div className="flex items-center gap-1 text-violet-300" title="Documents (visible / total)">
                        <FileText className="h-3 w-3" />
                        {inv.documents.visible}/{inv.documents.total}
                      </div>
                    </div>
                  </button>
                  {isOpen && <InvestorDetailPanel personaId={inv.personaId} onMutated={() => setRefreshKey((k) => k + 1)} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
