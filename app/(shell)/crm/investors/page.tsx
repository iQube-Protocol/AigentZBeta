'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  TrendingUp,
  ChevronRight,
  AlertCircle,
  Zap,
  Clock,
  Filter,
  CheckSquare,
  Square,
  Send,
  Edit2,
  BarChart3,
  X,
  ExternalLink,
} from 'lucide-react';

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
  // Campaign fields (may be null until migration applied)
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

const COHORT_OPTIONS = ['top_shelf', 'zero_knyt', 'reactivation', 'partner', 'cold'];
const STATE_OPTIONS  = ['unsent', 'sent', 'opened', 'clicked', 'backed', 'opted_out'];
const CHANNEL_OPTIONS = ['email', 'sms', 'telegram', 'discord', 'linkedin', 'x', 'whatsapp'];
const SEQUENCE_OPTIONS = [
  { id: 'knyt_top_shelf_v1', label: 'Top Shelf — Equity Offer' },
  { id: 'knyt_zero_v1',       label: 'Zero KNYT — Collectible Offer' },
  { id: 'knyt_reactivation_v1', label: 'Reactivation — Come Back' },
  { id: 'knyt_general_v1',    label: 'General — KNYT Wheel Launch' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const OM_TIER_ORDER: Record<string, number> = { KETA: 5, KEJI: 4, FIRST: 3, ZERO: 2, SAT: 1 };

const tierBadge = (tier: string) => {
  switch (tier?.toUpperCase()) {
    case 'KETA': return 'bg-amber-400/20 text-amber-300 ring-amber-400/30';
    case 'KEJI': return 'bg-purple-400/20 text-purple-300 ring-purple-400/30';
    case 'FIRST': return 'bg-cyan-400/20 text-cyan-300 ring-cyan-400/30';
    case 'ZERO': return 'bg-slate-400/20 text-slate-300 ring-slate-400/30';
    case 'SAT':  return 'bg-orange-400/20 text-orange-300 ring-orange-400/30';
    default:     return 'bg-slate-400/10 text-slate-500 ring-slate-400/20';
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InvestorsPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'investors' | 'dashboard'>('investors');
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

  // Inline edit panel
  const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null);
  const [editForm, setEditForm] = useState<{
    campaign_cohort: string;
    campaign_state: string;
    campaign_notes: string;
    preferred_channel_primary: string;
  }>({ campaign_cohort: '', campaign_state: '', campaign_notes: '', preferred_channel_primary: '' });
  const [editSaving, setEditSaving] = useState(false);

  // Dashboard metrics
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
    if (activeTab === 'dashboard') fetchMetrics();
  }, [activeTab]);

  // ── Derived lists ───────────────────────────────────────────────────────────

  const displayedInvestors = activatedFilter === 'activated'
    ? investors.filter((i) => i.isActivated)
    : activatedFilter === 'inactive'
    ? investors.filter((i) => !i.isActivated)
    : investors;

  const activatedCount = investors.filter((i) => i.isActivated).length;
  const inactiveCount  = investors.filter((i) => !i.isActivated).length;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === displayedInvestors.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(displayedInvestors.map((i) => i.id)));
    }
  };

  async function handleBulkAssign() {
    if (selected.size === 0) return;
    const updates: Record<string, string> = {};
    if (bulkCohort) updates.campaign_cohort = bulkCohort;
    if (bulkState)  updates.campaign_state  = bulkState;
    if (Object.keys(updates).length === 0) return;

    setBulkSaving(true);
    try {
      const res = await fetch('/api/crm/investors/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), updates }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Bulk update failed');
      fetchInvestors();
      setBulkCohort('');
      setBulkState('');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Bulk update failed');
    } finally {
      setBulkSaving(false);
    }
  }

  async function handleDispatchSequence() {
    if (selected.size === 0) return;
    setDispatching(true);
    try {
      const res = await fetch('/api/marketa/sequence/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sequenceId,
          recipientIds: Array.from(selected),
          channel: sequenceChannel,
          context: { campaignName: 'KNYT Wheel' },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Dispatch failed');
      setShowSequenceModal(false);
      alert(`Dispatched sequence to ${selected.size} investors.`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Dispatch failed');
    } finally {
      setDispatching(false);
    }
  }

  function openEdit(investor: Investor) {
    setEditingInvestor(investor);
    setEditForm({
      campaign_cohort: investor.campaign_cohort ?? '',
      campaign_state: investor.campaign_state ?? '',
      campaign_notes: investor.campaign_notes ?? '',
      preferred_channel_primary: '',
    });
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
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      setEditingInvestor(null);
      fetchInvestors();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setEditSaving(false);
    }
  }

  const initials = (inv: Investor) => {
    const f = inv.firstName.charAt(0).toUpperCase();
    const l = inv.lastName.charAt(0).toUpperCase();
    return f || l ? `${f}${l}` : inv.email.charAt(0).toUpperCase();
  };

  const hasAssets = (inv: Investor) =>
    !!(inv.metaiyeShares || inv.knytCoyn || inv.motionComics || inv.paperComics ||
       inv.digitalComics || inv.knytPosters || inv.knytCards || inv.characters);

  const allCurrentSelected = displayedInvestors.length > 0 &&
    displayedInvestors.every((i) => selected.has(i.id));

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-3">
            <TrendingUp className="text-amber-400" />
            Investors
          </h1>
          <p className="text-slate-400 mt-1">All StartEngine / Metaiye Media investors — Nakamoto database</p>
        </div>
        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('investors')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              activeTab === 'investors' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users size={14} className="inline mr-1.5" />
            Investors
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              activeTab === 'dashboard' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 size={14} className="inline mr-1.5" />
            Dashboard
          </button>
        </div>
      </div>

      {/* ── Dashboard Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-sm">KNYT Wheel campaign metrics — live from the CRM</p>
            <button
              onClick={fetchMetrics}
              className="text-xs text-slate-400 hover:text-white transition"
            >
              Refresh
            </button>
          </div>
          {metricsLoading && (
            <p className="text-slate-400 text-sm">Loading metrics…</p>
          )}
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <MetricTile label="Total Sends" value={metrics.total_sends} />
              <MetricTile label="Opens" value={metrics.opens} sub="Requires Make.com write-back" />
              <MetricTile label="Clicks" value={metrics.clicks} />
              <MetricTile label="KS Visits" value={metrics.ks_visits} />
              <MetricTile label="KS Backed" value={metrics.ks_backed} />
              <MetricTile label="Top Shelf Conversions" value={metrics.top_shelf_conversions} />
              <MetricTile label="Zero KNYT Conversions" value={metrics.zero_knyt_conversions} />
              <MetricTile label="Slots Remaining" value={metrics.slots_remaining} sub="of 500 total" />
              <MetricTile label="Reactivated" value={metrics.reactivated} />
              <MetricTile label="Shares" value={metrics.shares_count} sub="Social tracking Phase 2" />
              <MetricTile label="Runtime Follow-ups" value={metrics.runtime_followups} sub="Phase 2" />
            </div>
          )}
        </div>
      )}

      {/* ── Investors Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'investors' && (
        <>
          {/* Activation filter chips */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setActivatedFilter('all')}
              className={`px-4 py-2 rounded-xl text-sm font-medium ring-1 transition ${
                activatedFilter === 'all'
                  ? 'bg-white/10 ring-white/20 text-white'
                  : 'bg-white/5 ring-white/10 text-slate-400 hover:text-white'
              }`}
            >
              <Users size={14} className="inline mr-1.5" />
              All <span className="text-slate-500 ml-1">{investors.length}</span>
            </button>
            <button
              onClick={() => setActivatedFilter('activated')}
              className={`px-4 py-2 rounded-xl text-sm font-medium ring-1 transition ${
                activatedFilter === 'activated'
                  ? 'bg-emerald-500/20 ring-emerald-500/30 text-emerald-300'
                  : 'bg-white/5 ring-white/10 text-slate-400 hover:text-white'
              }`}
            >
              <Zap size={14} className="inline mr-1.5" />
              Activated <span className="text-slate-500 ml-1">{activatedCount}</span>
            </button>
            <button
              onClick={() => setActivatedFilter('inactive')}
              className={`px-4 py-2 rounded-xl text-sm font-medium ring-1 transition ${
                activatedFilter === 'inactive'
                  ? 'bg-amber-500/20 ring-amber-500/30 text-amber-300'
                  : 'bg-white/5 ring-white/10 text-slate-400 hover:text-white'
              }`}
            >
              <Clock size={14} className="inline mr-1.5" />
              Inactive <span className="text-slate-500 ml-1">{inactiveCount}</span>
            </button>
          </div>

          {apiError && (
            <div className="rounded-xl p-4 bg-amber-500/10 ring-1 ring-amber-500/20 flex items-center gap-3">
              <AlertCircle size={20} className="text-amber-400" />
              <p className="text-sm text-amber-400">{apiError}</p>
            </div>
          )}

          {/* Search + Sort */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email, or KNYT-ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="bg-white/5 border border-white/10 rounded-lg text-sm text-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="tier">Sort: OM Tier</option>
                <option value="invested">Sort: Invested (high)</option>
                <option value="name">Sort: Name</option>
                <option value="activated">Sort: Activated first</option>
              </select>
            </div>
          </div>

          {/* Bulk action toolbar — visible when any rows are selected */}
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-amber-500/10 ring-1 ring-amber-500/20 rounded-xl">
              <span className="text-sm font-medium text-amber-300">
                {selected.size} selected
              </span>
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs text-slate-400 hover:text-white transition"
              >
                Clear
              </button>
              <div className="flex items-center gap-2 ml-2">
                <select
                  value={bulkCohort}
                  onChange={(e) => setBulkCohort(e.target.value)}
                  className="bg-slate-800 border border-white/10 rounded-lg text-xs text-slate-300 px-2 py-1.5 focus:outline-none"
                >
                  <option value="">Set cohort…</option>
                  {COHORT_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={bulkState}
                  onChange={(e) => setBulkState(e.target.value)}
                  className="bg-slate-800 border border-white/10 rounded-lg text-xs text-slate-300 px-2 py-1.5 focus:outline-none"
                >
                  <option value="">Set state…</option>
                  {STATE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button
                  onClick={handleBulkAssign}
                  disabled={bulkSaving || (!bulkCohort && !bulkState)}
                  className="px-3 py-1.5 bg-amber-500/30 text-amber-300 ring-1 ring-amber-500/30 rounded-lg text-xs font-medium disabled:opacity-40 hover:bg-amber-500/40 transition"
                >
                  {bulkSaving ? 'Saving…' : 'Apply'}
                </button>
              </div>
              <button
                onClick={() => setShowSequenceModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-fuchsia-500/20 text-fuchsia-300 ring-1 ring-fuchsia-500/30 rounded-lg text-xs font-medium hover:bg-fuchsia-500/30 transition"
              >
                <Send size={12} />
                Send Sequence
              </button>
            </div>
          )}

          {/* Sequence dispatch modal */}
          {showSequenceModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="w-full max-w-md bg-slate-900 ring-1 ring-white/15 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Dispatch Sequence</h2>
                  <button onClick={() => setShowSequenceModal(false)}>
                    <X size={20} className="text-slate-400 hover:text-white" />
                  </button>
                </div>
                <p className="text-sm text-slate-400">
                  Sending to <span className="text-amber-300 font-medium">{selected.size} investors</span> via Make.com
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Sequence</label>
                    <select
                      value={sequenceId}
                      onChange={(e) => setSequenceId(e.target.value)}
                      className="w-full bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                    >
                      {SEQUENCE_OPTIONS.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Channel</label>
                    <select
                      value={sequenceChannel}
                      onChange={(e) => setSequenceChannel(e.target.value)}
                      className="w-full bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                    >
                      {CHANNEL_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleDispatchSequence}
                    disabled={dispatching}
                    className="flex-1 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
                  >
                    {dispatching ? 'Dispatching…' : `Send to ${selected.size} investors`}
                  </button>
                  <button
                    onClick={() => setShowSequenceModal(false)}
                    className="px-4 py-2 text-slate-400 hover:text-white text-sm transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Inline edit panel */}
          {editingInvestor && (
            <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">
                  Edit Campaign Fields —{' '}
                  <span className="text-amber-300">{editingInvestor.name}</span>
                </h2>
                <button onClick={() => setEditingInvestor(null)}>
                  <X size={18} className="text-slate-400 hover:text-white" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Cohort</label>
                  <select
                    value={editForm.campaign_cohort}
                    onChange={(e) => setEditForm({ ...editForm, campaign_cohort: e.target.value })}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-300 px-3 py-2 focus:outline-none"
                  >
                    <option value="">None</option>
                    {COHORT_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">State</label>
                  <select
                    value={editForm.campaign_state}
                    onChange={(e) => setEditForm({ ...editForm, campaign_state: e.target.value })}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-300 px-3 py-2 focus:outline-none"
                  >
                    <option value="">None</option>
                    {STATE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Primary Channel</label>
                  <select
                    value={editForm.preferred_channel_primary}
                    onChange={(e) => setEditForm({ ...editForm, preferred_channel_primary: e.target.value })}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-300 px-3 py-2 focus:outline-none"
                  >
                    <option value="">None</option>
                    {CHANNEL_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Notes</label>
                  <input
                    value={editForm.campaign_notes}
                    onChange={(e) => setEditForm({ ...editForm, campaign_notes: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Operator notes…"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={saveEdit}
                  disabled={editSaving}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
                >
                  {editSaving ? 'Saving…' : 'Save Changes'}
                </button>
                <button onClick={() => setEditingInvestor(null)} className="px-4 py-2 text-slate-400 hover:text-white text-sm transition">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-4">
                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-white transition">
                      {allCurrentSelected
                        ? <CheckSquare size={16} className="text-amber-400" />
                        : <Square size={16} />
                      }
                    </button>
                  </th>
                  <th className="text-left px-4 py-4 text-sm font-medium text-slate-400">Investor</th>
                  <th className="text-left px-4 py-4 text-sm font-medium text-slate-400">OM Tier</th>
                  <th className="text-right px-4 py-4 text-sm font-medium text-slate-400">Invested</th>
                  <th className="text-left px-4 py-4 text-sm font-medium text-slate-400 hidden lg:table-cell">Assets</th>
                  <th className="text-left px-4 py-4 text-sm font-medium text-slate-400">Status</th>
                  <th className="text-left px-4 py-4 text-sm font-medium text-slate-400 hidden xl:table-cell">Cohort</th>
                  <th className="px-4 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">Loading investors…</td>
                  </tr>
                ) : displayedInvestors.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">No investors found</td>
                  </tr>
                ) : (
                  displayedInvestors.map((investor) => (
                    <tr
                      key={investor.id}
                      className={`border-b border-white/5 transition ${
                        selected.has(investor.id) ? 'bg-amber-500/5' : 'hover:bg-white/5'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-4">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSelect(investor.id); }}
                          className="text-slate-400 hover:text-amber-400 transition"
                        >
                          {selected.has(investor.id)
                            ? <CheckSquare size={16} className="text-amber-400" />
                            : <Square size={16} />
                          }
                        </button>
                      </td>

                      {/* Name / Email */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xs font-bold text-black shrink-0">
                            {initials(investor)}
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {investor.name || <span className="text-slate-500 italic">Unknown</span>}
                            </p>
                            {investor.email && <p className="text-xs text-slate-400">{investor.email}</p>}
                            {investor.knytId && <p className="text-xs text-amber-400/70">KNYT-ID: {investor.knytId}</p>}
                          </div>
                        </div>
                      </td>

                      {/* OM Tier */}
                      <td className="px-4 py-4">
                        {investor.omTier ? (
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ring-1 ${tierBadge(investor.omTier)}`}>
                            {investor.omTier.toUpperCase()}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>

                      {/* Total Invested */}
                      <td className="px-4 py-4 text-right">
                        {investor.totalInvested ? (
                          <span className="text-sm font-medium text-emerald-300">${investor.totalInvested}</span>
                        ) : investor.metaiyeShares ? (
                          <span className="text-xs text-purple-300">{investor.metaiyeShares} shares</span>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>

                      {/* Assets */}
                      <td className="px-4 py-4 hidden lg:table-cell">
                        {hasAssets(investor) ? (
                          <div className="flex flex-wrap gap-1">
                            {investor.knytCoyn && (
                              <span className="px-1.5 py-0.5 bg-amber-500/15 text-amber-300 rounded text-xs">{investor.knytCoyn} KNYT</span>
                            )}
                            {(investor.motionComics || investor.paperComics || investor.digitalComics) && (
                              <span className="px-1.5 py-0.5 bg-cyan-500/15 text-cyan-300 rounded text-xs">comics</span>
                            )}
                            {(investor.knytCards || investor.knytPosters || investor.characters) && (
                              <span className="px-1.5 py-0.5 bg-emerald-500/15 text-emerald-300 rounded text-xs">collectibles</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        {investor.isActivated ? (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400"><Zap size={12} />Activated</span>
                        ) : investor.isLinked ? (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-cyan-400"><Users size={12} />Linked</span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Clock size={12} />Inactive</span>
                        )}
                      </td>

                      {/* Cohort */}
                      <td className="px-4 py-4 hidden xl:table-cell">
                        {investor.campaign_cohort ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cohortBadge(investor.campaign_cohort)}`}>
                            {investor.campaign_cohort}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(investor); }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition"
                            title="Edit campaign fields"
                          >
                            <Edit2 size={14} />
                          </button>
                          {investor.personaId && (
                            <button
                              onClick={(e) => { e.stopPropagation(); router.push(`/crm/personas/${investor.personaId}`); }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
                              title="View persona"
                            >
                              <ExternalLink size={14} />
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
              {displayedInvestors.length} of {investors.length} investors · {activatedCount} activated · {inactiveCount} inactive
              {selected.size > 0 && ` · ${selected.size} selected`}
            </p>
          )}
        </>
      )}
    </div>
  );
}
