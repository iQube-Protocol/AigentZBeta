'use client';

/**
 * MobilityActivationTab — Human Mobility Services case list + new case activation.
 *
 * Admin view: all cases.
 * Citizen view: own cases only.
 *
 * This is the entry point for the HMS Cartridge. Operator selects an existing
 * case or activates a new one (launches the MAF intake wizard).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  PlusCircle,
  FolderOpen,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  Home,
  Briefcase,
  GraduationCap,
  Package,
  TrendingUp,
  Heart,
  Shield,
} from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

function cls(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

type CaseSummary = {
  id: string;
  case_type: string;
  case_status: string;
  priority_level: string;
  classification: string;
  intake_sections_complete: string[];
  capability_score: number | null;
  continuity_score: number | null;
  recovery_velocity_class: string | null;
  standing_risk_level: string | null;
  housing_risk_level: string | null;
  education_risk_level: string | null;
  business_continuity_risk: string | null;
  intake_completed_at: string | null;
  created_at: string;
};

const STATUS_CONFIG = {
  intake:    { label: 'Intake',    color: 'amber'   },
  active:    { label: 'Active',    color: 'emerald' },
  paused:    { label: 'Paused',    color: 'slate'   },
  complete:  { label: 'Complete',  color: 'violet'  },
  closed:    { label: 'Closed',    color: 'slate'   },
} as const;

const RV_CONFIG = {
  'RV-1': { label: 'Immediate Recovery (<30d)',  color: 'emerald' },
  'RV-2': { label: 'Rapid Recovery (<90d)',      color: 'sky'     },
  'RV-3': { label: 'Moderate Recovery (<180d)',  color: 'amber'   },
  'RV-4': { label: 'Long-term Recovery (180d+)', color: 'rose'    },
} as const;

const RISK_COLOR = { low: 'emerald', medium: 'amber', high: 'rose' } as const;

interface Props {
  onSelectCase?: (caseId: string) => void;
}

export function MobilityActivationTab({ onSelectCase }: Props) {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch('/api/mobility/cases', { cache: 'no-store' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Failed to load cases');
      setCases(json.cases ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      const res = await personaFetch('/api/mobility/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseType: 'repatriation', priorityLevel: 'critical', classification: 'black_cube' }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Failed to create case');
      onSelectCase?.(json.case.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setCreating(false);
    }
  }, [load, onSelectCase]);

  const intakeProgress = (c: CaseSummary) => {
    const REQUIRED = ['household_profile', 'capability_profile', 'continuity_profile', 'housing_profile', 'financial_profile'];
    const done = REQUIRED.filter(s => c.intake_sections_complete?.includes(s)).length;
    return { done, total: REQUIRED.length, pct: Math.round((done / REQUIRED.length) * 100) };
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Home className="h-7 w-7 text-emerald-400" />
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Human Mobility Services</h2>
            <p className="text-sm text-slate-400">Polity Capability Preservation — PSC-001</p>
          </div>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          {creating ? 'Activating…' : 'Activate Case'}
        </button>
      </div>

      {/* Classification notice */}
      <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-2">
        <Shield className="h-4 w-4 text-rose-400 shrink-0" />
        <p className="text-xs text-rose-200/80">
          <span className="font-semibold">BlakQube</span> — all case data is compartmentalized.
          Agents receive only information required for their assigned workstream.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-2">
          <AlertTriangle className="h-4 w-4 text-rose-400" />
          <p className="text-sm text-rose-300">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-28 rounded-xl border border-slate-700 bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-8 text-center">
          <FolderOpen className="mx-auto h-10 w-10 text-slate-600 mb-3" />
          <p className="text-sm text-slate-400">No active mobility cases.</p>
          <p className="text-xs text-slate-500 mt-1">Activate a new case to begin the Mobility Activation File intake.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cases.map(c => {
            const status = STATUS_CONFIG[c.case_status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.intake;
            const rv = c.recovery_velocity_class ? RV_CONFIG[c.recovery_velocity_class as keyof typeof RV_CONFIG] : null;
            const progress = intakeProgress(c);
            return (
              <button
                key={c.id}
                onClick={() => onSelectCase?.(c.id)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-left hover:border-emerald-500/40 hover:bg-slate-800/60 transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    {/* Status + classification row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cls(
                        'text-[10px] px-2 py-0.5 rounded-full font-semibold border',
                        `bg-${status.color}-500/10 text-${status.color}-300 border-${status.color}-500/30`,
                      )}>
                        {status.label}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/30 font-semibold">
                        {c.classification === 'black_cube' ? 'BlakQube' : c.classification}
                      </span>
                      {rv && (
                        <span className={cls(
                          'text-[10px] px-2 py-0.5 rounded-full font-medium border',
                          `bg-${rv.color}-500/10 text-${rv.color}-300 border-${rv.color}-500/30`,
                        )}>
                          {c.recovery_velocity_class} — {rv.label.split(' ')[0]} {rv.label.split(' ')[1]}
                        </span>
                      )}
                    </div>

                    {/* Case type + date */}
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-100 capitalize">{c.case_type.replace('_', ' ')}</span>
                      <span className="text-xs text-slate-500">{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>

                    {/* Scores row */}
                    {(c.capability_score !== null || c.continuity_score !== null) && (
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        {c.capability_score !== null && (
                          <span>Capability <span className="text-slate-200 font-medium">{c.capability_score}</span>/100</span>
                        )}
                        {c.continuity_score !== null && (
                          <span>Continuity <span className="text-slate-200 font-medium">{c.continuity_score}</span>/100</span>
                        )}
                      </div>
                    )}

                    {/* Risk badges */}
                    {(c.housing_risk_level || c.education_risk_level || c.business_continuity_risk) && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {c.housing_risk_level && (
                          <RiskBadge icon={<Home className="h-3 w-3" />} label="Housing" level={c.housing_risk_level} />
                        )}
                        {c.education_risk_level && (
                          <RiskBadge icon={<GraduationCap className="h-3 w-3" />} label="Education" level={c.education_risk_level} />
                        )}
                        {c.business_continuity_risk && (
                          <RiskBadge icon={<Briefcase className="h-3 w-3" />} label="Business" level={c.business_continuity_risk} />
                        )}
                      </div>
                    )}

                    {/* Intake progress */}
                    {!c.intake_completed_at && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Intake {progress.done}/{progress.total} sections</span>
                          <span>{progress.pct}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-slate-700">
                          <div
                            className="h-1 rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${progress.pct}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {c.intake_completed_at && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        Intake complete
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-emerald-400 transition-colors mt-1 shrink-0" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RiskBadge({ icon, label, level }: { icon: React.ReactNode; label: string; level: string }) {
  const color = RISK_COLOR[level as keyof typeof RISK_COLOR] ?? 'slate';
  return (
    <span className={cls(
      'flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-medium',
      `bg-${color}-500/10 text-${color}-300 border-${color}-500/20`,
    )}>
      {icon}
      {label}: {level}
    </span>
  );
}
