'use client';

/**
 * InvestorDirectoryTab
 *
 * KNYT Codex admin tab — full investor directory with campaign management.
 * Surfaces the complete nakamoto_knyt_personas investor set (all 3,501 records)
 * with search, cohort tagging, bulk actions, sequence dispatch, and the
 * KNYT Wheel campaign dashboard.
 *
 * Data: /api/crm/investors  (nakamoto_knyt_personas — full paginated set)
 * Write: /api/crm/investors/[id]  (PATCH single record)
 *        /api/crm/investors/bulk  (POST bulk cohort/state update)
 *        /api/marketa/sequence/dispatch  (POST Make.com sequence trigger)
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Search, TrendingUp, ChevronRight, AlertCircle,
  Zap, Clock, Filter, CheckSquare, Square, Send, Edit2,
  BarChart3, X, ExternalLink,
} from 'lucide-react';
import type { CodexTab } from '@/types/codex';

// ── Types ─────────────────────────────────────────────────────────────────────

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
  campaign_cohort?: string | null;
  campaign_state?: string | null;
  campaign_notes?: string | null;
  investment_amount_band?: string | null;
}

interface DashboardMetrics {
  total_sends: number;
  opens: number;
  clicks: number;
  ks_visits: number;
  ks_backed: number;
  top_shelf_conversions: number;
  zero_knyt_conversions: number;
  slots_remaining: number;
  reactivated: number;
  shares_count: number;
  runtime_followups: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COHORT_OPTIONS  = ['top_shelf', 'zero_knyt', 'reactivation', 'partner', 'cold'];
const STATE_OPTIONS   = ['unsent', 'sent', 'opened', 'clicked', 'backed', 'opted_out'];
const CHANNEL_OPTIONS = ['email', 'sms', 'telegram', 'discord', 'linkedin', 'x', 'whatsapp'];
const SEQUENCE_OPTIONS = [
  { id: 'knyt_top_shelf_v1',    label: 'Top Shelf — Equity Offer' },
  { id: 'knyt_zero_v1',         label: 'Zero KNYT — Collectible Offer' },
  { id: 'knyt_reactivation_v1', label: 'Reactivation — Come Back' },
  { id: 'knyt_general_v1',      label: 'General — KNYT Wheel Launch' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const tierBadge = (tier: string) => {
  switch (tier?.toUpperCase()) {
    case 'KETA':  return 'bg-amber-400/20 text-amber-300 ring-amber-400/30';
    case 'KEJI':  return 'bg-purple-400/20 text-purple-300 ring-purple-400/30';
    case 'FIRST': return 'bg-cyan-400/20 text-cyan-300 ring-cyan-400/30';
    case 'ZERO':  return 'bg-slate-400/20 text-slate-300 ring-slate-400/30';
    case 'SAT':   return 'bg-orange-400/20 text-orange-300 ring-orange-400/30';
    default:      return 'bg-slate-400/10 text-slate-500 ring-slate-400/20';
  }
};

const cohortBadge = (cohort: string | null | undefined) => {
  switch (cohort) {
    case 'top_shelf':    return 'bg-amber-500/20 text-amber-300';
    case 'zero_knyt':    return 'bg-purple-500/20 text-purple-300';
    case 'reactivation': return 'bg-cyan-500/20 text-cyan-300';
    case 'partner':      return 'bg-emerald-500/20 text-emerald-300';
    case 'cold':         return 'bg-slate-500/20 text-slate-400';
    default:             return 'bg-white/5 text-slate-500';
  }
};

function MetricTile({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  tab: CodexTab;
  codexId: string;
  personaId?: string;
}

export function InvestorDirectoryTab({ tab: _tab, codexId: _codexId, personaId: _personaId }: Props) {
  const router = useRouter();

  const [activeView, setActiveView] = useState<'investors' | 'dashboard'>('investors');
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activatedFilter, setActivatedFilter] = useState<'all' | 'activated' | 'inactive'>('all');
  const [sort, setSort] = useState<'name' | 'invested' | 'activated' | 'tier'>('tier');

  // Bulk select
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCohort, setBulkCohort] = useState('');
  const [bulkState, setBulkState] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  // Sequence dispatch modal
  const [showSequenceModal, setShowSequenceModal] = useState(false);
  const [sequenceId, setSequenceId] = useState(SEQUENCE_OPTIONS[0].id);
  const [sequenceChannel, setSequenceChannel] = useState('email');
  const [dispatching, setDispatching] = useState(false);

  // Inline edit
  const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null);
  const [editForm, setEditForm] = useState({
    campaign_cohort: '', campaign_state: '', campaign_notes: '', preferred_channel_primary: '',
  });
  const [editSaving, setEditSaving] = useState(false);

  // Dashboard
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const fetchInvestors = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const params = new URLSearchParams({ limit: '500', sort, ...(search ? { search } : {}) });
      const res = await fetch(`/api/crm/investors?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load investors');
      setInvestors(json.data ?? []);
      setSelected(new Set());
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Failed to load investors');
      setInvestors([]);
    } finally {
      setLoading(false);
    }
  }, [search, sort]);

  useEffect(() => { fetchInvestors(); }, [fetchInvestors]);

  async function fetchMetrics() {
    setMetricsLoading(true);
    try {
      const res = await fetch('/api/crm/campaign/metrics');
      const json = await res.json();
      if (res.ok) setMetrics(json.metrics);
    } finally {
      setMetricsLoading(false);
    }
  }

  useEffect(() => {
    if (activeView === 'dashboard') fetchMetrics();
  }, [activeView]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const displayed = activatedFilter === 'activated'
    ? investors.filter((i) => i.isActivated)
    : activatedFilter === 'inactive'
    ? investors.filter((i) => !i.isActivated)
    : investors;

  const activatedCount = investors.filter((i) => i.isActivated).length;
  const inactiveCount  = investors.filter((i) => !i.isActivated).length;
  const allSelected    = displayed.length > 0 && displayed.every((i) => selected.has(i.id));

  // ── Handlers ────────────────────────────────────────────────────────────────

  const toggleSelect = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleSelectAll = () =>
    setSelected(allSelected ? new Set() : new Set(displayed.map((i) => i.id)));

  async function handleBulkAssign() {
    if (selected.size === 0) return;
    const updates: Record<string, string> = {};
    if (bulkCohort) updates.campaign_cohort = bulkCohort;
    if (bulkState)  updates.campaign_state  = bulkState;
    if (!Object.keys(updates).length) return;
    setBulkSaving(true);
    try {
      const res = await fetch('/api/crm/investors/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), updates }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Bulk update failed');
      fetchInvestors();
      setBulkCohort(''); setBulkState('');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Bulk update failed');
    } finally { setBulkSaving(false); }
  }

  async function handleDispatchSequence() {
    if (selected.size === 0) return;
    setDispatching(true);
    try {
      const res = await fetch('/api/marketa/sequence/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequenceId, recipientIds: Array.from(selected), channel: sequenceChannel, context: { campaignName: 'KNYT Wheel' } }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Dispatch failed');
      setShowSequenceModal(false);
      alert(`Dispatched sequence to ${selected.size} investors.`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Dispatch failed');
    } finally { setDispatching(false); }
  }

  function openEdit(investor: Investor) {
    setEditingInvestor(investor);
    setEditForm({ campaign_cohort: investor.campaign_cohort ?? '', campaign_state: investor.campaign_state ?? '', campaign_notes: investor.campaign_notes ?? '', preferred_channel_primary: '' });
  }

  async function saveEdit() {
    if (!editingInvestor) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/crm/investors/${editingInvestor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
      setEditingInvestor(null);
      fetchInvestors();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Save failed');
    } finally { setEditSaving(false); }
  }

  const initials = (inv: Investor) => {
    const f = inv.firstName.charAt(0).toUpperCase();
    const l = inv.lastName.charAt(0).toUpperCase();
    return f || l ? `${f}${l}` : inv.email.charAt(0).toUpperCase();
  };

  const hasAssets = (inv: Investor) =>
    !!(inv.metaiyeShares || inv.knytCoyn || inv.motionComics || inv.paperComics ||
       inv.digitalComics || inv.knytPosters || inv.knytCards || inv.characters);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 p-1">

      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-amber-400" />
          <span className="font-semibold text-white">Investors</span>
          <span className="text-xs text-slate-500 ml-1">
            {investors.length > 0 ? `${investors.length} total · ${activatedCount} activated` : ''}
          </span>
        </div>
        {/* View switcher */}
        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
          <button
            onClick={() => setActiveView('investors')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${activeView === 'investors' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <Users size={12} className="inline mr-1" />Directory
          </button>
          <button
            onClick={() => setActiveView('dashboard')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${activeView === 'dashboard' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <BarChart3 size={12} className="inline mr-1" />Dashboard
          </button>
        </div>
      </div>

      {/* ── Dashboard view ──────────────────────────────────────────────────── */}
      {activeView === 'dashboard' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">KNYT Wheel campaign metrics — live from CRM</p>
            <button onClick={fetchMetrics} className="text-xs text-slate-400 hover:text-white transition">Refresh</button>
          </div>
          {metricsLoading && <p className="text-slate-400 text-sm">Loading…</p>}
          {metrics && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <MetricTile label="Total Sends"          value={metrics.total_sends} />
              <MetricTile label="Opens"                value={metrics.opens} sub="Requires Make.com write-back" />
              <MetricTile label="Clicks"               value={metrics.clicks} />
              <MetricTile label="KS Visits"            value={metrics.ks_visits} />
              <MetricTile label="KS Backed"            value={metrics.ks_backed} />
              <MetricTile label="Top Shelf Conv."      value={metrics.top_shelf_conversions} />
              <MetricTile label="Zero KNYT Conv."      value={metrics.zero_knyt_conversions} />
              <MetricTile label="Slots Remaining"      value={metrics.slots_remaining} sub="of 500 total" />
              <MetricTile label="Reactivated"          value={metrics.reactivated} />
              <MetricTile label="Shares"               value={metrics.shares_count} sub="Phase 2" />
              <MetricTile label="Runtime Follow-ups"   value={metrics.runtime_followups} sub="Phase 2" />
            </div>
          )}
        </div>
      )}

      {/* ── Directory view ───────────────────────────────────────────────────── */}
      {activeView === 'investors' && (
        <>
          {/* Activation filters */}
          <div className="flex flex-wrap gap-2">
            {([['all', 'All', investors.length], ['activated', 'Activated', activatedCount], ['inactive', 'Inactive', inactiveCount]] as const).map(
              ([val, label, count]) => (
                <button
                  key={val}
                  onClick={() => setActivatedFilter(val)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium ring-1 transition ${
                    activatedFilter === val
                      ? val === 'activated' ? 'bg-emerald-500/20 ring-emerald-500/30 text-emerald-300'
                        : val === 'inactive' ? 'bg-amber-500/20 ring-amber-500/30 text-amber-300'
                        : 'bg-white/10 ring-white/20 text-white'
                      : 'bg-white/5 ring-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {label} <span className="text-slate-500 ml-1">{count}</span>
                </button>
              )
            )}
          </div>

          {apiError && (
            <div className="rounded-xl p-3 bg-amber-500/10 ring-1 ring-amber-500/20 flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-400 shrink-0" />
              <p className="text-xs text-amber-400">{apiError}</p>
            </div>
          )}

          {/* Search + sort */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, email, KNYT-ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="bg-white/5 border border-white/10 rounded-lg text-xs text-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="tier">OM Tier</option>
              <option value="invested">Invested ↓</option>
              <option value="name">Name</option>
              <option value="activated">Activated first</option>
            </select>
          </div>

          {/* Bulk toolbar */}
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 bg-amber-500/10 ring-1 ring-amber-500/20 rounded-xl">
              <span className="text-xs font-medium text-amber-300">{selected.size} selected</span>
              <button onClick={() => setSelected(new Set())} className="text-xs text-slate-400 hover:text-white">Clear</button>
              <select value={bulkCohort} onChange={(e) => setBulkCohort(e.target.value)}
                className="bg-slate-800 border border-white/10 rounded-lg text-xs text-slate-300 px-2 py-1 focus:outline-none">
                <option value="">Set cohort…</option>
                {COHORT_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={bulkState} onChange={(e) => setBulkState(e.target.value)}
                className="bg-slate-800 border border-white/10 rounded-lg text-xs text-slate-300 px-2 py-1 focus:outline-none">
                <option value="">Set state…</option>
                {STATE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={handleBulkAssign} disabled={bulkSaving || (!bulkCohort && !bulkState)}
                className="px-2.5 py-1 bg-amber-500/30 text-amber-300 ring-1 ring-amber-500/30 rounded-lg text-xs font-medium disabled:opacity-40 hover:bg-amber-500/40 transition">
                {bulkSaving ? 'Saving…' : 'Apply'}
              </button>
              <button onClick={() => setShowSequenceModal(true)}
                className="flex items-center gap-1 px-2.5 py-1 bg-fuchsia-500/20 text-fuchsia-300 ring-1 ring-fuchsia-500/30 rounded-lg text-xs font-medium hover:bg-fuchsia-500/30 transition">
                <Send size={11} />Send Sequence
              </button>
            </div>
          )}

          {/* Sequence modal */}
          {showSequenceModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="w-full max-w-md bg-slate-900 ring-1 ring-white/15 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">Dispatch Sequence</h2>
                  <button onClick={() => setShowSequenceModal(false)}><X size={18} className="text-slate-400 hover:text-white" /></button>
                </div>
                <p className="text-xs text-slate-400">Sending to <span className="text-amber-300 font-medium">{selected.size} investors</span> via Make.com</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Sequence</label>
                    <select value={sequenceId} onChange={(e) => setSequenceId(e.target.value)}
                      className="w-full bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500">
                      {SEQUENCE_OPTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Channel</label>
                    <select value={sequenceChannel} onChange={(e) => setSequenceChannel(e.target.value)}
                      className="w-full bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500">
                      {CHANNEL_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={handleDispatchSequence} disabled={dispatching}
                    className="flex-1 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">
                    {dispatching ? 'Dispatching…' : `Send to ${selected.size} investors`}
                  </button>
                  <button onClick={() => setShowSequenceModal(false)} className="px-4 text-slate-400 hover:text-white text-sm">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Inline edit panel */}
          {editingInvestor && (
            <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Edit — <span className="text-amber-300">{editingInvestor.name}</span></p>
                <button onClick={() => setEditingInvestor(null)}><X size={16} className="text-slate-400 hover:text-white" /></button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {([
                  ['Cohort', 'campaign_cohort', COHORT_OPTIONS],
                  ['State', 'campaign_state', STATE_OPTIONS],
                  ['Channel', 'preferred_channel_primary', CHANNEL_OPTIONS],
                ] as const).map(([lbl, key, opts]) => (
                  <div key={key}>
                    <label className="text-xs text-slate-400 mb-1 block">{lbl}</label>
                    <select value={(editForm as Record<string, string>)[key]} onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                      className="w-full bg-slate-800 border border-white/10 rounded-lg text-xs text-slate-300 px-2 py-1.5 focus:outline-none">
                      <option value="">None</option>
                      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Notes</label>
                  <input value={editForm.campaign_notes} onChange={(e) => setEditForm({ ...editForm, campaign_notes: e.target.value })}
                    className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Operator notes…" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={saveEdit} disabled={editSaving}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition">
                  {editSaving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditingInvestor(null)} className="text-slate-400 hover:text-white text-xs">Cancel</button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs text-slate-400">
                  <th className="px-3 py-3">
                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-white">
                      {allSelected ? <CheckSquare size={14} className="text-amber-400" /> : <Square size={14} />}
                    </button>
                  </th>
                  <th className="text-left px-3 py-3 font-medium">Investor</th>
                  <th className="text-left px-3 py-3 font-medium">Tier</th>
                  <th className="text-right px-3 py-3 font-medium">Invested</th>
                  <th className="text-left px-3 py-3 font-medium hidden lg:table-cell">Assets</th>
                  <th className="text-left px-3 py-3 font-medium">Status</th>
                  <th className="text-left px-3 py-3 font-medium hidden xl:table-cell">Cohort</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-sm">Loading investors…</td></tr>
                ) : displayed.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-sm">No investors found</td></tr>
                ) : (
                  displayed.map((inv) => (
                    <tr key={inv.id} className={`border-b border-white/5 transition ${selected.has(inv.id) ? 'bg-amber-500/5' : 'hover:bg-white/5'}`}>
                      <td className="px-3 py-3">
                        <button onClick={(e) => { e.stopPropagation(); toggleSelect(inv.id); }} className="text-slate-400 hover:text-amber-400">
                          {selected.has(inv.id) ? <CheckSquare size={14} className="text-amber-400" /> : <Square size={14} />}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xs font-bold text-black shrink-0">
                            {initials(inv)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-xs truncate">{inv.name || <span className="text-slate-500 italic">Unknown</span>}</p>
                            {inv.email && <p className="text-xs text-slate-400 truncate">{inv.email}</p>}
                            {inv.knytId && <p className="text-xs text-amber-400/70 truncate">KNYT: {inv.knytId}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {inv.omTier
                          ? <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ring-1 ${tierBadge(inv.omTier)}`}>{inv.omTier.toUpperCase()}</span>
                          : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {inv.totalInvested
                          ? <span className="text-xs font-medium text-emerald-300">${inv.totalInvested}</span>
                          : inv.metaiyeShares
                          ? <span className="text-xs text-purple-300">{inv.metaiyeShares} sh</span>
                          : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell">
                        {hasAssets(inv) ? (
                          <div className="flex flex-wrap gap-1">
                            {inv.knytCoyn && <span className="px-1 py-0.5 bg-amber-500/15 text-amber-300 rounded text-xs">{inv.knytCoyn} KNYT</span>}
                            {(inv.motionComics || inv.paperComics || inv.digitalComics) && <span className="px-1 py-0.5 bg-cyan-500/15 text-cyan-300 rounded text-xs">comics</span>}
                            {(inv.knytCards || inv.knytPosters || inv.characters) && <span className="px-1 py-0.5 bg-emerald-500/15 text-emerald-300 rounded text-xs">collectibles</span>}
                          </div>
                        ) : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        {inv.isActivated
                          ? <span className="flex items-center gap-1 text-xs font-medium text-emerald-400"><Zap size={11} />Activated</span>
                          : inv.isLinked
                          ? <span className="flex items-center gap-1 text-xs font-medium text-cyan-400"><Users size={11} />Linked</span>
                          : <span className="flex items-center gap-1 text-xs font-medium text-slate-500"><Clock size={11} />Inactive</span>}
                      </td>
                      <td className="px-3 py-3 hidden xl:table-cell">
                        {inv.campaign_cohort
                          ? <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${cohortBadge(inv.campaign_cohort)}`}>{inv.campaign_cohort}</span>
                          : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-0.5">
                          <button onClick={(e) => { e.stopPropagation(); openEdit(inv); }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition" title="Edit campaign fields">
                            <Edit2 size={13} />
                          </button>
                          {inv.personaId && (
                            <button onClick={(e) => { e.stopPropagation(); router.push(`/crm/personas/${inv.personaId}`); }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition" title="View persona">
                              <ExternalLink size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && (
            <p className="text-xs text-slate-600 text-right">
              {displayed.length} of {investors.length} · {activatedCount} activated · {inactiveCount} inactive
              {selected.size > 0 && ` · ${selected.size} selected`}
            </p>
          )}
        </>
      )}
    </div>
  );
}
