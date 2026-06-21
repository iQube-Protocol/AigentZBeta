'use client';

/**
 * FounderOfficeTab — the Founder Office surface inside the Venture Lab
 * cartridge. The venture-formation operating system: turn an idea/opportunity
 * into an executable Venture Blueprint (VentureQube v1.0) and hand it to the
 * execution agents.
 *
 * Internal sub-views (the "sub menus"):
 *   Workspace · Discover · Validate · Architect · Blueprint (per venture)
 *
 * Reads/writes via /api/venture/* (spine-authenticated through personaFetch).
 * v1.0 is the per-venture premium tier; the one-operator-one-venture v0.4
 * experience-model wrapper is unchanged and lives in the aigentMe onboarding.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Rocket, Plus, RefreshCw, Send, ChevronLeft, Compass, ShieldCheck,
  Building2, Layers, Gauge, X, Loader2, Sparkles,
} from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import type {
  VentureQubeV1, VentureStage, FounderPath, VentureAgentConsumer,
} from '@/types/ventureQube';

interface VentureRecord {
  id: string;
  iqubeId: string | null;
  venturePublicRef: string;
  name: string;
  slug: string;
  stage: VentureStage;
  lastPath: FounderPath | null;
  ventureConfidence: number | null;
  status: string;
  layers: VentureQubeV1;
  createdAt: string;
  updatedAt: string;
}

interface StandingSummary {
  standing: { personal: number; delegated: number; stewardship: number; overall: number; bucket: number } | null;
  reputation: { overall: number; lifetimeCvs: number; entrepreneurial: number } | null;
  score: { score: number; veracityScore: number; contributionScore: number; verifiedFactCount: number; hasCompiledVsp: boolean; qualified: boolean } | null;
  factCountsByDomain: Record<string, number>;
  hasStandingSignal: boolean;
}

interface SpineStage {
  id: string;
  label: string;
  complete: boolean;
  detail: string;
  target: string;
}

interface SpineState {
  stages: SpineStage[];
  verticals: Array<{ id: string; label: string; active: boolean }>;
  nextStep: { id: string; label: string; cta: string; target: string } | null;
  standingScore: number;
  ventureCount: number;
}

type SubView = 'workspace' | 'discover' | 'validate' | 'architect' | 'blueprint';

interface Props {
  personaId?: string;
  theme?: 'light' | 'dark';
  isAdmin?: boolean;
}

const STAGE_COLOR: Record<string, string> = {
  concept: 'text-slate-300 bg-slate-800/60 border-slate-600/30',
  validation: 'text-blue-300 bg-blue-900/30 border-blue-500/20',
  formation: 'text-cyan-300 bg-cyan-900/30 border-cyan-500/20',
  launch: 'text-emerald-300 bg-emerald-900/30 border-emerald-500/20',
  growth: 'text-amber-300 bg-amber-900/30 border-amber-500/20',
  scale: 'text-violet-300 bg-violet-900/30 border-violet-500/20',
  institution: 'text-fuchsia-300 bg-fuchsia-900/30 border-fuchsia-500/20',
};

function confidenceColor(v: number | null): string {
  if (v == null) return 'text-slate-500';
  if (v <= 33) return 'text-red-400';
  if (v <= 66) return 'text-amber-400';
  return 'text-emerald-400';
}

const PATHS: Array<{ id: FounderPath; label: string; question: string; icon: React.ElementType }> = [
  { id: 'discover', label: 'Discover', question: 'What should I build?', icon: Compass },
  { id: 'validate', label: 'Validate', question: 'Should I build this?', icon: ShieldCheck },
  { id: 'architect', label: 'Architect', question: 'How do I make it viable?', icon: Building2 },
];

const AGENT_LABELS: Record<VentureAgentConsumer, string> = {
  aigentMe: 'aigentMe',
  devon: 'DevOn',
  marketa: 'Marketa',
  'venture-lab': 'Venture Lab',
  'investor-office': 'Investor Office',
};

export function FounderOfficeTab({ personaId, isAdmin }: Props) {
  const [view, setView] = useState<SubView>('workspace');
  const [ventures, setVentures] = useState<VentureRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<VentureRecord | null>(null);
  const [standing, setStanding] = useState<StandingSummary | null>(null);
  const [spine, setSpine] = useState<SpineState | null>(null);
  const [plan, setPlan] = useState<{ ventureProUnlocked: boolean; founderOfficeLabel: string; planLabel: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVentures = useCallback(async () => {
    setLoading(true);
    try {
      const res = await personaFetch('/api/venture/qubes', { cache: 'no-store' });
      const json = await res.json();
      if (json.ok) setVentures(json.ventures ?? []);
      else setError(json.error ?? 'Failed to load ventures');
    } catch {
      setError('Failed to load ventures');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStanding = useCallback(async () => {
    try {
      const res = await personaFetch('/api/venture/standing-summary', { cache: 'no-store' });
      const json = await res.json();
      if (json.ok) setStanding(json);
    } catch {
      /* non-fatal */
    }
  }, []);

  const loadSpine = useCallback(async () => {
    try {
      const res = await personaFetch('/api/journey/commercial-spine', { cache: 'no-store' });
      const json = await res.json();
      if (json.ok) setSpine(json);
    } catch {
      /* non-fatal */
    }
  }, []);

  const loadPlan = useCallback(async () => {
    try {
      const res = await personaFetch('/api/billing/plan', { cache: 'no-store' });
      const json = await res.json();
      if (json.ok) setPlan(json);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    loadVentures();
    loadStanding();
    loadSpine();
    loadPlan();
  }, [loadVentures, loadStanding, loadSpine, loadPlan]);

  const openBlueprint = useCallback(async (id: string) => {
    setError(null);
    try {
      const res = await personaFetch(`/api/venture/qubes/${id}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.ok) {
        setSelected(json.venture);
        setView('blueprint');
      } else setError(json.error ?? 'Failed to open venture');
    } catch {
      setError('Failed to open venture');
    }
  }, []);

  const autopopulate = useCallback(async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await personaFetch(`/api/venture/qubes/${selected.id}/autopopulate`, { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        setSelected(json.venture);
        await loadVentures();
      } else setError(json.error ?? 'Auto-populate failed');
    } catch {
      setError('Auto-populate failed');
    } finally {
      setBusy(false);
    }
  }, [selected, loadVentures]);

  const handoff = useCallback(async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await personaFetch(`/api/venture/qubes/${selected.id}/handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!json.ok) setError(json.error ?? 'Handoff failed');
      else setError(null);
    } catch {
      setError('Handoff failed');
    } finally {
      setBusy(false);
    }
  }, [selected]);

  // ── Sub-view nav ───────────────────────────────────────────────────────────
  const nav = (
    <div className="flex items-center gap-1 flex-wrap">
      {([
        { id: 'workspace' as SubView, label: 'Workspace', icon: Layers },
        { id: 'discover' as SubView, label: 'Discover', icon: Compass },
        { id: 'validate' as SubView, label: 'Validate', icon: ShieldCheck },
        { id: 'architect' as SubView, label: 'Architect', icon: Building2 },
      ]).map((t) => {
        const Icon = t.icon;
        const active = view === t.id;
        return (
          <button
            key={t.id}
            onClick={() => { setView(t.id); setSelected(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              active
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                : 'bg-slate-900/40 border-white/[0.06] text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 text-slate-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <Rocket className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Founder Office <span className="text-[10px] font-medium align-middle px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">{plan?.ventureProUnlocked ? 'Pro' : 'Lite'}</span>
            </h2>
            <p className="text-xs text-slate-400">
              Venture formation operating system — turn an idea into an executable Venture Blueprint{plan?.ventureProUnlocked ? ' (VentureQube Pro)' : ''}.
            </p>
          </div>
        </div>
        {view !== 'blueprint' && nav}
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-red-900/20 border border-red-500/30 text-red-300 text-xs">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Commercial spine progress */}
      {spine && view !== 'blueprint' && <SpineStrip spine={spine} />}

      {/* Standing calibration banner */}
      {standing && view !== 'blueprint' && (
        <StandingBanner standing={standing} />
      )}

      {view === 'workspace' && (
        <Workspace
          loading={loading}
          ventures={ventures}
          onOpen={openBlueprint}
          onNew={() => setView('discover')}
        />
      )}

      {(view === 'discover' || view === 'validate' || view === 'architect') && (
        <PathForm
          path={view}
          onCreated={async (id) => { await loadVentures(); await openBlueprint(id); }}
          onError={setError}
        />
      )}

      {view === 'blueprint' && selected && (
        <Blueprint
          venture={selected}
          standing={standing}
          busy={busy}
          isAdmin={Boolean(isAdmin)}
          onBack={() => { setView('workspace'); setSelected(null); }}
          onAutopopulate={autopopulate}
          onHandoff={handoff}
        />
      )}
    </div>
  );
}

// ── Commercial spine strip ───────────────────────────────────────────────────
function SpineStrip({ spine }: { spine: SpineState }) {
  return (
    <div className="p-3 rounded-xl bg-slate-900/50 border border-white/[0.06]">
      <div className="flex items-center gap-1.5 flex-wrap">
        {spine.stages.map((s, i) => (
          <React.Fragment key={s.id}>
            <div
              title={s.detail}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] ${
                s.complete
                  ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-200'
                  : spine.nextStep?.id === s.id
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                    : 'bg-slate-800/40 border-white/[0.06] text-slate-500'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${s.complete ? 'bg-emerald-400' : spine.nextStep?.id === s.id ? 'bg-amber-400' : 'bg-slate-600'}`} />
              {s.label}
            </div>
            {i < spine.stages.length - 1 && <span className="text-slate-600 text-[11px]">→</span>}
          </React.Fragment>
        ))}
      </div>
      {spine.nextStep && (
        <p className="text-[11px] text-amber-300/80 mt-2">
          Next step: <span className="font-medium">{spine.nextStep.cta}</span>
          {' — '}
          <span className="text-slate-400">
            {spine.stages.find((s) => s.id === spine.nextStep?.id)?.detail}
          </span>
        </p>
      )}
    </div>
  );
}

// ── Standing banner ──────────────────────────────────────────────────────────
function StandingBanner({ standing }: { standing: StandingSummary }) {
  if (!standing.hasStandingSignal) {
    return (
      <div className="px-3 py-2 rounded-lg bg-slate-900/50 border border-white/[0.06] text-xs text-slate-400">
        <Sparkles className="w-3.5 h-3.5 inline mr-1.5 text-slate-500" />
        No Standing signal yet — establish Standing (declarations + verified facts) to calibrate
        confidence in your venture inputs. Ventures still work; confidence is uncalibrated until then.
      </div>
    );
  }
  const factTotal = Object.values(standing.factCountsByDomain).reduce((a, b) => a + b, 0);
  const sc = standing.score;
  return (
    <div className="px-3 py-2 rounded-lg bg-emerald-900/15 border border-emerald-500/20 text-xs text-emerald-200 flex items-center gap-4 flex-wrap">
      <span className="flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5" /> Standing calibrating your ventures
      </span>
      {sc && <span className="font-mono">Score {Math.round(sc.score)}/100</span>}
      {sc && <span>veracity {Math.round(sc.veracityScore)} · contribution {Math.round(sc.contributionScore)}</span>}
      <span>{factTotal} verified fact{factTotal === 1 ? '' : 's'}</span>
      {sc?.hasCompiledVsp && <span className="text-emerald-300">VSP anchored</span>}
    </div>
  );
}

// ── Workspace ────────────────────────────────────────────────────────────────
function Workspace({
  loading, ventures, onOpen, onNew,
}: {
  loading: boolean;
  ventures: VentureRecord[];
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Venture Portfolio</h3>
        <button
          onClick={onNew}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 hover:bg-amber-500/25"
        >
          <Plus className="w-3.5 h-3.5" /> New Venture
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading ventures…
        </div>
      ) : ventures.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm border border-dashed border-white/[0.08] rounded-xl">
          No ventures yet. Start with a Founder Office path: Discover, Validate, or Architect.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ventures.map((v) => (
            <button
              key={v.id}
              onClick={() => onOpen(v.id)}
              className="text-left p-4 rounded-xl bg-slate-900/50 border border-white/[0.06] hover:border-amber-500/30 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2 py-0.5 rounded-md text-[10px] border ${STAGE_COLOR[v.stage] ?? STAGE_COLOR.concept}`}>
                  {v.stage}
                </span>
                <span className={`text-xs font-mono ${confidenceColor(v.ventureConfidence)}`}>
                  {v.ventureConfidence == null ? '—' : `${Math.round(v.ventureConfidence)}%`}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-100 truncate">{v.name}</p>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                {v.layers?.thesis?.valueProposition || v.layers?.thesis?.problemStatement || 'No thesis yet.'}
              </p>
              <p className="text-[10px] text-slate-600 mt-2 font-mono">ref {v.venturePublicRef}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Path form (Discover / Validate / Architect) ──────────────────────────────
function PathForm({
  path, onCreated, onError,
}: {
  path: FounderPath;
  onCreated: (id: string) => void;
  onError: (e: string) => void;
}) {
  const meta = PATHS.find((p) => p.id === path)!;
  const Icon = meta.icon;
  const [name, setName] = useState('');
  const [problem, setProblem] = useState('');
  const [value, setValue] = useState('');
  const [intent, setIntent] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) { onError('Give the venture a name'); return; }
    setSaving(true);
    try {
      const res = await personaFetch('/api/venture/qubes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          path,
          seed: {
            problemStatement: problem.trim() || undefined,
            valueProposition: value.trim() || undefined,
            ventureIntents: intent.trim() ? [intent.trim()] : undefined,
          },
        }),
      });
      const json = await res.json();
      if (json.ok && json.venture) onCreated(json.venture.id);
      else onError(json.error ?? 'Failed to create venture');
    } catch {
      onError('Failed to create venture');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
          <Icon className="w-4.5 h-4.5 text-amber-300" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{meta.label}</h3>
          <p className="text-xs text-slate-400">{meta.question}</p>
        </div>
      </div>

      <Field label="Venture name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Mobility Concierge"
          className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/40"
        />
      </Field>
      <Field label={path === 'discover' ? 'Opportunity / need you sense' : 'Problem statement'}>
        <textarea
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          rows={2}
          className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/40 resize-none"
        />
      </Field>
      <Field label="Value proposition">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={2}
          className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/40 resize-none"
        />
      </Field>
      <Field label="Primary venture intent">
        <input
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="What outcome are you driving toward?"
          className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/40"
        />
      </Field>

      <button
        onClick={submit}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-100 hover:bg-amber-500/30 disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
        Create VentureQube Pro
      </button>
      <p className="text-[11px] text-slate-500">
        On create, your Standing auto-populates the Signal Evidence + Capability layers and calibrates
        venture confidence. You can refine every layer in the Blueprint.
      </p>
    </div>
  );
}

// ── Blueprint detail (the 13 layers) ─────────────────────────────────────────
function Blueprint({
  venture, busy, isAdmin, onBack, onAutopopulate, onHandoff,
}: {
  venture: VentureRecord;
  standing: StandingSummary | null;
  busy: boolean;
  isAdmin: boolean;
  onBack: () => void;
  onAutopopulate: () => void;
  onHandoff: () => void;
}) {
  const L = venture.layers;
  const se = L.signalEvidence;
  const g = L.governance;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200">
          <ChevronLeft className="w-4 h-4" /> Workspace
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onAutopopulate}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-slate-800 border border-white/10 text-slate-200 hover:border-amber-500/30 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Auto-populate from Standing
          </button>
          <button
            onClick={onHandoff}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-100 hover:bg-amber-500/30 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" /> Hand off Blueprint
          </button>
        </div>
      </div>

      {/* Identity + confidence */}
      <div className="p-4 rounded-xl bg-slate-900/50 border border-white/[0.06]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-semibold text-slate-100">{venture.name}</h2>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              ref {venture.venturePublicRef}{venture.iqubeId ? ` · iQube ${venture.iqubeId.slice(0, 8)}…` : ' · registry pending'}
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-md text-xs border ${STAGE_COLOR[venture.stage] ?? STAGE_COLOR.concept}`}>
            {venture.stage}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
          <ConfidenceStat label="Venture" value={g.ventureConfidence ?? venture.ventureConfidence ?? null} />
          <ConfidenceStat label="Signal" value={se.signalConfidence} />
          <ConfidenceStat label="Demand" value={se.demandConfidence} />
          <ConfidenceStat label="Capability" value={se.capabilityConfidence} />
          <ConfidenceStat label="PoWP" value={g.proofOfWorkPotential ?? null} />
        </div>
      </div>

      {/* Layers */}
      <LayerSection title="Thesis" icon={Layers}>
        <KV k="Mission" v={L.thesis.mission} />
        <KV k="Problem" v={L.thesis.problemStatement} />
        <KV k="Value proposition" v={L.thesis.valueProposition} />
        <KV k="Consequence thesis" v={L.thesis.consequenceThesis} />
      </LayerSection>

      <LayerSection title="Intent" icon={Compass}>
        <ListKV k="Founder intents" items={L.intent.founderIntents} />
        <ListKV k="Venture intents" items={L.intent.ventureIntents} />
      </LayerSection>

      <LayerSection title="Customer Archetypes" icon={Building2}>
        {L.archetypes.length === 0 ? <Empty /> : L.archetypes.map((a, i) => (
          <div key={i} className="text-xs text-slate-300">
            <span className="text-slate-400">{a.label}</span> ({a.kind})
            {a.willingnessToPay ? ` · WTP ${a.willingnessToPay}` : ''}
          </div>
        ))}
      </LayerSection>

      <LayerSection title="Revenue Architecture" icon={Gauge}>
        {L.revenueArchitecture.engines.length === 0 ? <Empty /> : L.revenueArchitecture.engines.map((e, i) => (
          <div key={i} className="text-xs text-slate-300">
            <span className="text-slate-400">{e.engineName}</span> — {e.engineType}
            {e.estimatedRevenue ? ` · ${e.estimatedRevenue}` : ''}
          </div>
        ))}
      </LayerSection>

      <LayerSection title="Capability" icon={Sparkles}>
        <ListKV k="Available (Standing-derived)" items={L.capability.availableCapabilities} />
        <ListKV k="Required" items={L.capability.requiredCapabilities} />
        <ListKV k="Gaps" items={L.capability.capabilityGaps} />
      </LayerSection>

      <LayerSection title="Execution" icon={Layers}>
        {L.execution.phases.length === 0 ? <Empty /> : L.execution.phases.map((p, i) => (
          <div key={i} className="text-xs text-slate-300">
            <span className="text-slate-400">{p.phaseName}</span> — {p.objectives.length} objective(s), {p.deliverables.length} deliverable(s)
          </div>
        ))}
      </LayerSection>

      <LayerSection title="Delegation (Agent Handoff)" icon={Send}>
        {L.delegation.assignments.length === 0 ? (
          <p className="text-xs text-slate-500">
            No agent assignments yet. Add assignments (aigentMe / DevOn / Marketa / Venture Lab) to enable handoff.
          </p>
        ) : L.delegation.assignments.map((a, i) => (
          <div key={i} className="text-xs text-slate-300">
            <span className="text-amber-300">{AGENT_LABELS[a.agentType]}</span> — {a.responsibility}
          </div>
        ))}
      </LayerSection>

      {isAdmin && (
        <LayerSection title="Governance & Institutional" icon={ShieldCheck}>
          <KV k="Standing confidence" v={g.standingConfidence != null ? `${Math.round(g.standingConfidence)}%` : undefined} />
          <KV k="Institutional readiness" v={L.institutional.institutionalReadiness != null ? `${Math.round(L.institutional.institutionalReadiness)}%` : undefined} />
          <KV k="Commons visibility" v={L.institutional.commonsVisibility} />
        </LayerSection>
      )}
    </div>
  );
}

// ── Small presentational helpers ─────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ConfidenceStat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-mono ${confidenceColor(value)}`}>
        {value == null ? '—' : `${Math.round(value)}`}
      </p>
      <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
    </div>
  );
}

function LayerSection({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl bg-slate-900/40 border border-white/[0.06]">
      <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wide mb-3">
        <Icon className="w-3.5 h-3.5 text-amber-400/70" /> {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return (
    <div className="text-xs">
      <span className="text-slate-500">{k}: </span>
      <span className="text-slate-200">{v}</span>
    </div>
  );
}

function ListKV({ k, items }: { k: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="text-xs">
      <span className="text-slate-500">{k}: </span>
      <span className="text-slate-200">{items.join(', ')}</span>
    </div>
  );
}

function Empty() {
  return <p className="text-xs text-slate-500">Not yet defined.</p>;
}

export default FounderOfficeTab;
