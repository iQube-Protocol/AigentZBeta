'use client';

/**
 * MobilityActivationsTab — cross-case institutional engagement tracker.
 *
 * Shows all active cases with their IES institutions grouped by phase.
 * Each institution card displays PDEP package, engagement stage, scores,
 * and recommended action — giving the operator a single pane to manage
 * all outreach activations without navigating into individual cases.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Target,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Shield,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Building2,
  FolderOpen,
} from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

function cls(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

type DisclosurePackage = 'A' | 'B' | 'AB' | 'C' | 'D';

interface Institution {
  id: string;
  name: string;
  category: string;
  phase: number;
  context_authority: number;
  referral_authority: number;
  capability_preservation: number;
  continuity_preservation: number;
  execution_impact: number;
  rationale: string;
  recommended_action: string;
  expected_response?: string;
  escalation_criteria?: string;
  engagement_stage?: number;
  recommended_package?: DisclosurePackage;
  disclosure_level?: 'FULL' | 'CAPABILITY_ONLY' | 'SUMMARY_ONLY';
}

interface Phase {
  phase: number;
  label: string;
  objective: string;
  institution_ids: string[];
}

interface IESContent {
  institutions: Institution[];
  phases: Phase[];
  strategic_note?: string;
  engagement_tempo?: string;
}

interface CaseActivation {
  id: string;
  case_type: string;
  case_status: string;
  classification: string;
  ies_content: IESContent | null;
  ies_status: string;
  srb_status: string;
  created_at: string;
}

const PACKAGE_COLORS: Record<string, string> = {
  A:  'bg-slate-500/10 text-slate-300 ring-slate-500/20',
  B:  'bg-sky-500/10 text-sky-400 ring-sky-500/20',
  AB: 'bg-violet-500/10 text-violet-400 ring-violet-500/20',
  C:  'bg-amber-500/10 text-amber-400 ring-amber-500/20',
  D:  'bg-rose-500/10 text-rose-400 ring-rose-500/20',
};

const CAT_COLORS: Record<string, string> = {
  A: 'bg-violet-500/10 text-violet-400 ring-violet-500/20',
  B: 'bg-sky-500/10 text-sky-400 ring-sky-500/20',
  C: 'bg-slate-500/10 text-slate-400 ring-slate-500/20',
};

function ScoreDot({ value }: { value: number }) {
  const pct = Math.round((value / 10) * 100);
  const color = value >= 7 ? 'bg-emerald-400' : value >= 4 ? 'bg-amber-400' : 'bg-rose-400';
  return (
    <div className="flex items-center gap-1">
      <div className={cls('h-1.5 w-1.5 rounded-full', color)} />
      <span className="text-[10px] text-slate-400">{pct}%</span>
    </div>
  );
}

function InstitutionCard({ inst }: { inst: Institution }) {
  const [expanded, setExpanded] = useState(false);
  const pkg = inst.recommended_package ?? (inst.disclosure_level === 'FULL' ? 'C' : inst.disclosure_level === 'CAPABILITY_ONLY' ? 'AB' : 'A');

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-800/40 transition-colors text-left"
      >
        <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-200 truncate">{inst.name}</p>
          <p className="text-[10px] text-slate-500 truncate">{inst.recommended_action}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cls('text-[10px] px-1.5 py-0.5 rounded ring-1 font-medium', CAT_COLORS[inst.category] ?? CAT_COLORS.C)}>Cat {inst.category}</span>
          <span className={cls('text-[10px] px-1.5 py-0.5 rounded ring-1 font-medium', PACKAGE_COLORS[pkg] ?? PACKAGE_COLORS.AB)}>Pkg {pkg}</span>
          <span className="text-[10px] text-slate-500">Stage {inst.engagement_stage ?? 0}</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-slate-500" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-500" />}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-2 border-t border-slate-800">
          <p className="text-[11px] text-slate-400 leading-relaxed pt-2">{inst.rationale}</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-slate-500 mb-1">Scores</p>
              <div className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">Context auth</span>
                  <ScoreDot value={inst.context_authority} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">Referral auth</span>
                  <ScoreDot value={inst.referral_authority} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">Cap. preservation</span>
                  <ScoreDot value={inst.capability_preservation} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">Execution impact</span>
                  <ScoreDot value={inst.execution_impact} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {inst.expected_response && (
                <div>
                  <p className="text-[10px] text-slate-500 mb-0.5">Expected response</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{inst.expected_response}</p>
                </div>
              )}
              {inst.escalation_criteria && (
                <div>
                  <p className="text-[10px] text-slate-500 mb-0.5">Escalation criteria</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{inst.escalation_criteria}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CaseActivationPanel({ caseData }: { caseData: CaseActivation }) {
  const [expanded, setExpanded] = useState(true);
  const ies = caseData.ies_content;
  const institutions = ies?.institutions ?? [];
  const phases = ies?.phases ?? [];

  const phaseInstitutions = (phaseNum: number) => {
    const phaseObj = phases.find(p => p.phase === phaseNum);
    if (!phaseObj) return institutions.filter(i => i.phase === phaseNum);
    return phaseObj.institution_ids.map(id => institutions.find(i => i.id === id)).filter(Boolean) as Institution[];
  };

  const allPhaseNums = [...new Set(institutions.map(i => i.phase))].sort();

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/20 overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/30 transition-colors"
      >
        <FolderOpen className="h-4 w-4 text-emerald-400" />
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-slate-200 capitalize">{caseData.case_type.replace('_', ' ')} Case</p>
          <p className="text-xs text-slate-500">{institutions.length} institutions · {caseData.ies_status === 'approved' ? 'IES Authorized' : 'IES Draft'}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {caseData.ies_status === 'approved' && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Authorized
            </span>
          )}
          {caseData.ies_status === 'draft' && (
            <span className="text-[10px] text-amber-400">Draft</span>
          )}
          {(!caseData.ies_status || caseData.ies_status === 'not_generated') && (
            <span className="text-[10px] text-slate-500">No IES</span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-800">
          {institutions.length === 0 ? (
            <div className="py-6 text-center">
              <Target className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No IES generated for this case yet.</p>
              <p className="text-xs text-slate-600 mt-1">Approve the SRB first, then generate the IES from the Case Overview.</p>
            </div>
          ) : (
            <>
              {ies?.strategic_note && (
                <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2 mt-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Shield className="h-3.5 w-3.5 text-violet-400" />
                    <span className="text-[10px] font-semibold text-violet-300 uppercase tracking-wider">Strategic Note</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{ies.strategic_note}</p>
                </div>
              )}

              {allPhaseNums.map(phaseNum => {
                const phaseObj = phases.find(p => p.phase === phaseNum);
                const phaseInsts = phaseInstitutions(phaseNum);
                if (phaseInsts.length === 0) return null;
                return (
                  <div key={phaseNum} className="space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-slate-300">
                        {phaseNum}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-300">{phaseObj?.label ?? `Phase ${phaseNum}`}</p>
                        {phaseObj?.objective && <p className="text-[10px] text-slate-500">{phaseObj.objective}</p>}
                      </div>
                    </div>
                    <div className="ml-7 space-y-1.5">
                      {phaseInsts.map(inst => (
                        <InstitutionCard key={inst.id} inst={inst} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function MobilityActivationsTab() {
  const [cases, setCases] = useState<CaseActivation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch('/api/mobility/cases', { cache: 'no-store' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Failed to load cases');

      // For each case with an IES, fetch the IES content
      const casesWithIES = await Promise.all(
        (json.cases as CaseActivation[]).map(async (c) => {
          if (c.ies_status && c.ies_status !== 'not_generated') {
            try {
              const iesRes = await personaFetch(`/api/mobility/cases/${c.id}/ies`, { cache: 'no-store' });
              const iesJson = await iesRes.json();
              if (iesJson.ok && iesJson.ies) {
                return { ...c, ies_content: iesJson.ies as IESContent };
              }
            } catch {
              // skip
            }
          }
          return { ...c, ies_content: null };
        })
      );

      setCases(casesWithIES);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeCases = cases.filter(c => c.ies_content?.institutions?.length);
  const pendingCases = cases.filter(c => !c.ies_content?.institutions?.length);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Institutional Activations</h2>
          <p className="text-sm text-slate-400 mt-0.5">PDEP-governed engagement tracker · PSC-001</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cls('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading activations…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* PDEP doctrine note */}
          <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-violet-400" />
              <span className="text-xs font-semibold text-violet-300 uppercase tracking-wider">PDEP Active</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              All institutional engagement is governed by the Progressive Disclosure & Engagement Protocol.
              Phase 1 institutions receive Package AB (anonymous rich context). Identity disclosed only at
              Stage 2+ after pathway validation and principal authorization.
            </p>
          </div>

          {/* Active cases with IES */}
          {activeCases.length > 0 && (
            <div className="space-y-4">
              {activeCases.map(c => (
                <CaseActivationPanel key={c.id} caseData={c} />
              ))}
            </div>
          )}

          {/* Cases awaiting IES */}
          {pendingCases.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Awaiting IES Generation</p>
              {pendingCases.map(c => (
                <div key={c.id} className="flex items-center gap-3 rounded-lg border border-slate-700/40 bg-slate-900/20 px-4 py-3">
                  <FolderOpen className="h-4 w-4 text-slate-500" />
                  <div className="flex-1">
                    <p className="text-xs text-slate-400 capitalize">{c.case_type.replace('_', ' ')} case</p>
                    <p className="text-[10px] text-slate-600">
                      SRB: {c.srb_status} · IES: {c.ies_status || 'not generated'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {cases.length === 0 && (
            <div className="py-12 text-center">
              <Target className="h-10 w-10 text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-400">No active cases found.</p>
              <p className="text-xs text-slate-600 mt-1">Create a case in the Cases tab to begin institutional activation planning.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
