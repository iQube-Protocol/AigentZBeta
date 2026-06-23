'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Briefcase, ClipboardList, Users, Activity, Plus, ChevronDown, ChevronUp, RefreshCw, X, Save, Layers, Compass, CalendarClock } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { VenturePortfolioWizard } from '@/components/metame/setup/VenturePortfolioWizard';
import type { VentureOperatingModel, OperatingObjective } from '@/types/ventureQube';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Venture {
  id: string;
  venture_name: string;
  venture_slug: string;
  y_maturity: number;
  x_commercialization: number;
  zone: string;
  status: string;
  payload: {
    description?: string;
    team?: string[];
    focus_area?: string;
    key_milestones?: string[];
    risks?: string[];
    next_steps?: string[];
    council_agenda_items?: string[];
    owners?: Record<string, string>;
    tags?: string[];
    overlay?: string;
    actions?: ActionItem[];
  };
  updated_at: string;
}

interface ActionItem {
  id: string;
  title: string;
  owner: string;
  due: string;
  status: 'open' | 'in-progress' | 'done';
}

type SubView = 'board' | 'scorecard' | 'council' | 'actions';

interface Props {
  theme?: 'light' | 'dark';
  isAdmin?: boolean;
}

// ── Zone colour helpers ────────────────────────────────────────────────────────

const ZONE_COLOR: Record<string, string> = {
  formation:  'text-slate-400  bg-slate-800/60  border-slate-600/30',
  validation: 'text-blue-300   bg-blue-900/30   border-blue-500/20',
  activation: 'text-emerald-300 bg-emerald-900/30 border-emerald-500/20',
  strategic:  'text-amber-300  bg-amber-900/30  border-amber-500/20',
  scale:      'text-violet-300 bg-violet-900/30 border-violet-500/20',
};

const ZONE_DOT: Record<string, string> = {
  formation:  'bg-slate-400',
  validation: 'bg-blue-400',
  activation: 'bg-emerald-400',
  strategic:  'bg-amber-400',
  scale:      'bg-violet-400',
};

// ── Scorecard Form ─────────────────────────────────────────────────────────────

function ScorecardForm({ venture, onSave, onCancel }: {
  venture: Venture;
  onSave: (payload: Venture['payload']) => void;
  onCancel: () => void;
}) {
  const p = venture.payload;
  const [description, setDescription]               = useState(p.description ?? '');
  const [focusArea, setFocusArea]                    = useState(p.focus_area ?? '');
  const [team, setTeam]                              = useState((p.team ?? []).join(', '));
  const [keyMilestones, setKeyMilestones]            = useState((p.key_milestones ?? []).join('\n'));
  const [risks, setRisks]                            = useState((p.risks ?? []).join('\n'));
  const [nextSteps, setNextSteps]                    = useState((p.next_steps ?? []).join('\n'));
  const [councilItems, setCouncilItems]              = useState((p.council_agenda_items ?? []).join('\n'));
  const [tags, setTags]                              = useState((p.tags ?? []).join(', '));
  const [saving, setSaving]                          = useState(false);

  const splitLines = (s: string) => s.split('\n').map(l => l.trim()).filter(Boolean);
  const splitComma = (s: string) => s.split(',').map(l => l.trim()).filter(Boolean);

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      ...p,
      description,
      focus_area: focusArea,
      team: splitComma(team),
      key_milestones: splitLines(keyMilestones),
      risks: splitLines(risks),
      next_steps: splitLines(nextSteps),
      council_agenda_items: splitLines(councilItems),
      tags: splitComma(tags),
    });
    setSaving(false);
  };

  return (
    <div className="space-y-4 p-4 bg-slate-900/60 border border-white/[0.07] rounded-xl">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-100">{venture.venture_name}</p>
        <button onClick={onCancel} className="text-slate-500 hover:text-slate-300">
          <X className="w-4 h-4" />
        </button>
      </div>

      {[
        { label: 'Description',           value: description,   set: setDescription,   rows: 2 },
        { label: 'Focus Area',            value: focusArea,     set: setFocusArea,     rows: 1 },
        { label: 'Team (comma-sep)',       value: team,          set: setTeam,          rows: 1 },
        { label: 'Key Milestones (one per line)', value: keyMilestones, set: setKeyMilestones, rows: 3 },
        { label: 'Risks (one per line)',   value: risks,         set: setRisks,         rows: 2 },
        { label: 'Next Steps (one per line)', value: nextSteps,  set: setNextSteps,     rows: 2 },
        { label: 'Council Agenda (one per line)', value: councilItems, set: setCouncilItems, rows: 2 },
        { label: 'Tags (comma-sep)',       value: tags,          set: setTags,          rows: 1 },
      ].map(f => (
        <div key={f.label}>
          <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
          <textarea
            value={f.value}
            onChange={e => f.set(e.target.value)}
            rows={f.rows}
            className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/40 resize-none"
          />
        </div>
      ))}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg text-sm border border-white/10 text-slate-400 hover:text-slate-200 transition-all"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 font-medium transition-all disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving…' : 'Save Scorecard'}
        </button>
      </div>
    </div>
  );
}

// ── Venture Board Card ─────────────────────────────────────────────────────────

function VentureCard({ venture, onEdit }: { venture: Venture; onEdit: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const zc = ZONE_COLOR[venture.zone] ?? ZONE_COLOR.formation;
  const zd = ZONE_DOT[venture.zone] ?? ZONE_DOT.formation;
  const p = venture.payload;

  return (
    <div className={`border rounded-xl overflow-hidden ${zc}`}>
      <div
        className="flex items-start gap-3 p-3 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${zd}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100 leading-tight">{venture.venture_name}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Y{venture.y_maturity} · X{venture.x_commercialization} · <span className="capitalize">{venture.zone}</span>
          </p>
          {p.focus_area && <p className="text-xs text-slate-400 mt-1 truncate">{p.focus_area}</p>}
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); onEdit(); }}
            className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
          >
            Edit
          </button>
          {expanded
            ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
            : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-white/[0.06] space-y-3">
          {p.description && (
            <p className="text-xs text-slate-400 leading-relaxed">{p.description}</p>
          )}
          {p.team && p.team.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 mb-1 font-medium uppercase tracking-wide">Team</p>
              <p className="text-xs text-slate-300">{p.team.join(' · ')}</p>
            </div>
          )}
          {p.key_milestones && p.key_milestones.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 mb-1.5 font-medium uppercase tracking-wide">Milestones</p>
              <ul className="space-y-1">
                {p.key_milestones.map((m, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-300">
                    <span className="text-amber-400/60 mt-0.5">·</span>
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.next_steps && p.next_steps.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 mb-1.5 font-medium uppercase tracking-wide">Next Steps</p>
              <ul className="space-y-1">
                {p.next_steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-300">
                    <span className="text-emerald-400/60 mt-0.5">→</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.risks && p.risks.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 mb-1.5 font-medium uppercase tracking-wide">Risks</p>
              <ul className="space-y-1">
                {p.risks.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-300">
                    <span className="text-rose-400/60 mt-0.5">!</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.tags && p.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {p.tags.map(t => (
                <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">{t}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Council Agenda View ────────────────────────────────────────────────────────

function CouncilView({ ventures }: { ventures: Venture[] }) {
  const items = ventures.flatMap(v =>
    (v.payload.council_agenda_items ?? []).map(item => ({
      venture: v.venture_name,
      zone: v.zone,
      item,
    }))
  );

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <ClipboardList className="w-8 h-8 mx-auto mb-3 text-slate-700" />
        <p className="text-sm text-slate-500">No council agenda items yet.</p>
        <p className="text-xs text-slate-600 mt-1">Add items in each venture's scorecard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 mb-4 font-medium">{items.length} agenda item{items.length !== 1 ? 's' : ''} across {ventures.filter(v => (v.payload.council_agenda_items ?? []).length > 0).length} venture{ventures.length !== 1 ? 's' : ''}</p>
      {items.map((item, i) => {
        const zd = ZONE_DOT[item.zone] ?? ZONE_DOT.formation;
        return (
          <div key={i} className="flex items-start gap-3 px-3 py-2.5 bg-slate-900/60 border border-white/[0.06] rounded-lg">
            <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${zd}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-200">{item.item}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{item.venture}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Actions View ──────────────────────────────────────────────────────────────

function ActionsView({ ventures }: { ventures: Venture[] }) {
  const allActions = ventures.flatMap(v =>
    (v.payload.actions ?? []).map(a => ({ ...a, venture: v.venture_name }))
  );

  const byOwner = allActions.reduce<Record<string, typeof allActions>>((acc, a) => {
    const owner = a.owner || 'Unassigned';
    if (!acc[owner]) acc[owner] = [];
    acc[owner].push(a);
    return acc;
  }, {});

  const statusColor = (s: ActionItem['status']) =>
    s === 'done' ? 'text-emerald-400' : s === 'in-progress' ? 'text-amber-400' : 'text-slate-400';

  if (allActions.length === 0) {
    return (
      <div className="text-center py-12">
        <Activity className="w-8 h-8 mx-auto mb-3 text-slate-700" />
        <p className="text-sm text-slate-500">No actions tracked yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {Object.entries(byOwner).map(([owner, actions]) => (
        <div key={owner}>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <p className="text-xs font-semibold text-slate-300">{owner}</p>
            <span className="text-[10px] text-slate-600">({actions.length})</span>
          </div>
          <div className="space-y-1.5 pl-5">
            {actions.map(a => (
              <div key={a.id} className="flex items-start gap-3 px-3 py-2 bg-slate-900/60 border border-white/[0.06] rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-200">{a.title}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{a.venture}{a.due ? ` · Due ${a.due}` : ''}</p>
                </div>
                <span className={`text-[10px] font-medium capitalize ${statusColor(a.status)}`}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Operating Brief (read-only) ──────────────────────────────────────────────
// The Chief-of-Staff layer: the citizen's own operating brief from
// venture_portfolios.payload.operatingModel, shown at a glance. Authored in the
// Venture Portfolio wizard ("My Portfolio").

const OBJ_STATUS_COLOR: Record<OperatingObjective['status'], string> = {
  active:    'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  completed: 'text-slate-400  border-slate-600/40   bg-slate-700/20',
  blocked:   'text-rose-300   border-rose-500/30    bg-rose-500/10',
  deferred:  'text-amber-300  border-amber-500/30   bg-amber-500/10',
};

function OperatingBrief({ om }: { om: VentureOperatingModel }) {
  const objectives = om.activeObjectives ?? [];
  return (
    <div className="mb-5 rounded-xl border border-violet-500/25 bg-violet-500/[0.06] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Compass className="w-4 h-4 text-violet-300" />
        <h3 className="text-sm font-semibold text-violet-100">Operating Brief</h3>
        <span className="text-[10px] text-slate-500">— what aigentMe runs as Chief of Staff</span>
        {om.reviewCadence && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-slate-400">
            <CalendarClock className="w-3 h-3" />
            {om.reviewCadence}{om.nextReviewDate ? ` · next ${om.nextReviewDate}` : ''}
          </span>
        )}
      </div>

      {om.mission && <p className="text-sm text-slate-200 leading-relaxed">{om.mission}</p>}

      {om.primaryMetric && (
        <p className="text-xs text-violet-200/90">
          <span className="uppercase tracking-wide text-[10px] text-slate-500">Primary metric · </span>
          {om.primaryMetric}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(om.successMetrics?.length ?? 0) > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Success metrics</p>
            <ul className="space-y-0.5">
              {om.successMetrics!.map((m, i) => (
                <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5"><span className="text-emerald-400/60 mt-0.5">·</span>{m}</li>
              ))}
            </ul>
          </div>
        )}
        {(om.priorityPartners?.length ?? 0) > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Priority partners</p>
            <div className="flex flex-wrap gap-1">
              {om.priorityPartners!.map((p, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-200">{p}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {objectives.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Active objectives</p>
          <div className="space-y-1">
            {objectives.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`text-[9px] px-1.5 py-0.5 rounded border capitalize ${OBJ_STATUS_COLOR[o.status]}`}>{o.status}</span>
                <span className="text-xs text-slate-300">{o.objective}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(om.priorityActions?.length ?? 0) > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Priority actions</p>
          <ul className="space-y-0.5">
            {om.priorityActions!.map((a, i) => (
              <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5"><span className="text-amber-400/60 mt-0.5">→</span>{a}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function VentureLabPortfolioTab({ isAdmin }: Props) {
  const [ventures, setVentures]         = useState<Venture[]>([]);
  const [loading, setLoading]           = useState(true);
  const [subView, setSubView]           = useState<SubView>('board');
  const [editingId, setEditingId]       = useState<string | null>(null);
  // "My Portfolio" — the citizen's OWN ventures (distinct from this admin
  // scorecard board), managed via the Venture Portfolio wizard.
  const [myPortfolioOpen, setMyPortfolioOpen] = useState(false);
  const [portfolioAccess, setPortfolioAccess] = useState(false);
  const [operatingBrief, setOperatingBrief] = useState<VentureOperatingModel | null>(null);

  const loadOperatingBrief = useCallback(async () => {
    try {
      const res = await personaFetch('/api/venture/portfolio', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.ok) setOperatingBrief(data.operatingModel ?? null);
    } catch { /* non-fatal */ }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/venture-lab/portfolio?status=active');
      const data = await res.json();
      if (data.ok) setVentures(data.ventures ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await personaFetch('/api/billing/plan', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.ok) {
          const access = !!data.wizardAccess?.portfolio || !!isAdmin;
          setPortfolioAccess(access);
          if (access) void loadOperatingBrief();
        }
      } catch { /* non-fatal */ }
    })();
  }, [isAdmin, loadOperatingBrief]);

  const saveScorecard = async (id: string, payload: Venture['payload']) => {
    const res = await fetch(`/api/venture-lab/portfolio/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload }),
    });
    const data = await res.json();
    if (data.ok) {
      setVentures(prev => prev.map(v => v.id === id ? data.venture : v));
      setEditingId(null);
    }
  };

  const SUB_VIEWS: { id: SubView; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'board',    label: 'Board',        Icon: Briefcase },
    { id: 'scorecard',label: 'Scorecards',   Icon: ClipboardList },
    { id: 'council',  label: 'Council',      Icon: Users },
    { id: 'actions',  label: 'Actions',      Icon: Activity },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-white/[0.06] flex items-center gap-3">
        <Briefcase className="w-4 h-4 text-violet-400/80 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-100 leading-tight">Venture Portfolio</h2>
          <p className="text-xs text-slate-500 mt-0.5">{ventures.length} venture{ventures.length !== 1 ? 's' : ''} tracked</p>
        </div>

        {/* Sub-view tabs */}
        <div className="flex items-center gap-0.5">
          {SUB_VIEWS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setSubView(id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                subView === id
                  ? 'bg-violet-500/[0.12] text-violet-300 ring-1 ring-violet-500/25'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setMyPortfolioOpen(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-violet-500/[0.12] text-violet-300 ring-1 ring-violet-500/25 hover:bg-violet-500/20"
          title="Manage your own venture portfolio"
        >
          <Layers className="w-3.5 h-3.5" /> My Portfolio
        </button>

        <button
          onClick={load}
          className="text-slate-500 hover:text-slate-300 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <VenturePortfolioWizard
        open={myPortfolioOpen}
        onOpenChange={setMyPortfolioOpen}
        hasPortfolioAccess={portfolioAccess}
        onSaved={() => void loadOperatingBrief()}
      />

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        {operatingBrief && <OperatingBrief om={operatingBrief} />}
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-5 h-5 text-slate-600 animate-spin" />
          </div>
        ) : ventures.length === 0 ? (
          <div className="text-center py-16">
            <Briefcase className="w-8 h-8 mx-auto mb-3 text-slate-700" />
            <p className="text-sm text-slate-500">No ventures in portfolio yet.</p>
            <p className="text-xs text-slate-600 mt-1">Add ventures via the Growth Matrix tab.</p>
          </div>
        ) : (
          <>
            {/* Board view */}
            {subView === 'board' && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {ventures.map(v => (
                  <VentureCard
                    key={v.id}
                    venture={v}
                    onEdit={() => setEditingId(v.id)}
                  />
                ))}
              </div>
            )}

            {/* Scorecards view */}
            {subView === 'scorecard' && (
              <div className="space-y-4 max-w-2xl">
                {ventures.map(v => (
                  editingId === v.id ? (
                    <ScorecardForm
                      key={v.id}
                      venture={v}
                      onSave={payload => saveScorecard(v.id, payload)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div key={v.id} className="flex items-center justify-between px-4 py-3 bg-slate-900/60 border border-white/[0.07] rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-slate-200">{v.venture_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Y{v.y_maturity} · X{v.x_commercialization} ·{' '}
                          <span className="capitalize">{v.zone}</span>
                          {v.payload.focus_area ? ` · ${v.payload.focus_area}` : ''}
                        </p>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => setEditingId(v.id)}
                          className="text-xs px-3 py-1 rounded-lg border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  )
                ))}
              </div>
            )}

            {/* Council view */}
            {subView === 'council' && <CouncilView ventures={ventures} />}

            {/* Actions view */}
            {subView === 'actions' && <ActionsView ventures={ventures} />}
          </>
        )}
      </div>
    </div>
  );
}
