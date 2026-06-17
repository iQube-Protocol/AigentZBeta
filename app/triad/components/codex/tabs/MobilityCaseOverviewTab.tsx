'use client';

/**
 * MobilityCaseOverviewTab — live case dashboard for an active MAF.
 *
 * Shows: generated scores, workstream status board, critical date register,
 * and links into the intake wizard for any incomplete sections.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Home,
  GraduationCap,
  Briefcase,
  Package,
  TrendingUp,
  Heart,
  Search,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Calendar,
  ArrowRight,
  ChevronRight,
  Building2,
  FileText,
} from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { MobilityPassportPanel } from './MobilityPassportPanel';

function cls(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

type Workstream = {
  id: string;
  workstream_key: string;
  label: string;
  priority: string;
  status: string;
  notes: string | null;
  tasks: unknown[];
};

type CriticalDate = {
  id: string;
  label: string;
  date_category: string;
  due_date: string;
  is_hard_deadline: boolean;
  status: string;
  workstream_key: string | null;
};

type CaseDetail = {
  id: string;
  case_type: string;
  case_status: string;
  priority_level: string;
  classification: string;
  capability_score: number | null;
  continuity_score: number | null;
  recovery_velocity_class: string | null;
  standing_risk_level: string | null;
  housing_risk_level: string | null;
  education_risk_level: string | null;
  business_continuity_risk: string | null;
  intake_sections_complete: string[];
  intake_completed_at: string | null;
};

const WORKSTREAM_ICONS: Record<string, React.ReactNode> = {
  A: <Search className="h-4 w-4" />,
  B: <Home className="h-4 w-4" />,
  C: <GraduationCap className="h-4 w-4" />,
  D: <Package className="h-4 w-4" />,
  E: <Briefcase className="h-4 w-4" />,
  F: <TrendingUp className="h-4 w-4" />,
  G: <Heart className="h-4 w-4" />,
};

const PRIORITY_ORDER = { immediate: 0, critical: 1, high: 2, medium: 3, low: 4 };

const STATUS_COLOR = {
  pending:   'slate',
  active:    'emerald',
  blocked:   'rose',
  complete:  'violet',
  deferred:  'slate',
} as const;

const RISK_COLOR = { low: 'emerald', medium: 'amber', high: 'rose' } as const;
const RV_COLOR = { 'RV-1': 'emerald', 'RV-2': 'sky', 'RV-3': 'amber', 'RV-4': 'rose' } as const;

const SECTION_LABELS: Record<string, string> = {
  household_profile: 'Household',
  capability_profile: 'Capability',
  continuity_profile: 'Continuity',
  housing_profile: 'Housing',
  education_profile: 'Education',
  business_profile: 'Business',
  financial_profile: 'Financial',
  mobility_profile: 'Relocation',
  family_profile: 'Family',
  confidentiality_profile: 'Confidentiality',
};

interface Props {
  caseId: string;
  onOpenIntake?: () => void;
  onOpenWorkstream?: (key: string) => void;
  onOpenSRB?: () => void;
  onOpenIES?: () => void;
}

export function MobilityCaseOverviewTab({ caseId, onOpenIntake, onOpenWorkstream, onOpenSRB, onOpenIES }: Props) {
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [workstreams, setWorkstreams] = useState<Workstream[]>([]);
  const [criticalDates, setCriticalDates] = useState<CriticalDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch(`/api/mobility/cases/${caseId}`, { cache: 'no-store' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Failed to load case');
      setCaseData(json.case);
      setWorkstreams(
        (json.workstreams ?? []).sort(
          (a: Workstream, b: Workstream) =>
            (PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] ?? 99) -
            (PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] ?? 99),
        ),
      );
      setCriticalDates(
        (json.criticalDates ?? []).sort(
          (a: CriticalDate, b: CriticalDate) =>
            new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="flex items-center gap-2 p-6">
        <AlertTriangle className="h-5 w-5 text-rose-400" />
        <p className="text-sm text-rose-300">{error ?? 'Case not found'}</p>
      </div>
    );
  }

  const incompleteSections = Object.keys(SECTION_LABELS).filter(
    k => !caseData.intake_sections_complete?.includes(k),
  );

  const daysUntil = (d: string) => {
    const diff = new Date(d).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Home className="h-6 w-6 text-emerald-400" />
          <div>
            <h2 className="text-base font-semibold text-slate-100 capitalize">{caseData.case_type.replace('_', ' ')} — Case Overview</h2>
            <p className="text-xs text-slate-400">PSC-001 · {caseData.classification === 'black_cube' ? 'BlakQube' : caseData.classification}</p>
          </div>
        </div>
        <button onClick={load} className="text-slate-500 hover:text-slate-300 transition-colors">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Incomplete intake banner */}
      {incompleteSections.length > 0 && (
        <button
          onClick={onOpenIntake}
          className="w-full flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 hover:bg-amber-500/10 transition-colors group"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-sm text-amber-200">
              Intake incomplete — {incompleteSections.length} section{incompleteSections.length !== 1 ? 's' : ''} remaining
            </span>
            <div className="flex gap-1 flex-wrap">
              {incompleteSections.map(s => (
                <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  {SECTION_LABELS[s]}
                </span>
              ))}
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}

      {/* Score grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ScoreCard
          label="Capability"
          value={caseData.capability_score !== null ? `${caseData.capability_score}/100` : '—'}
          color={caseData.capability_score !== null && caseData.capability_score >= 70 ? 'emerald' : 'amber'}
        />
        <ScoreCard
          label="Continuity"
          value={caseData.continuity_score !== null ? `${caseData.continuity_score}/100` : '—'}
          color={caseData.continuity_score !== null && caseData.continuity_score >= 60 ? 'emerald' : 'amber'}
        />
        <ScoreCard
          label="Recovery"
          value={caseData.recovery_velocity_class ?? '—'}
          color={RV_COLOR[caseData.recovery_velocity_class as keyof typeof RV_COLOR] ?? 'slate'}
        />
        <ScoreCard
          label="Standing Risk"
          value={caseData.standing_risk_level ?? '—'}
          color={RISK_COLOR[caseData.standing_risk_level as keyof typeof RISK_COLOR] ?? 'slate'}
        />
      </div>

      {/* Risk row */}
      <div className="grid grid-cols-3 gap-3">
        <RiskCard label="Housing" icon={<Home className="h-3.5 w-3.5" />} level={caseData.housing_risk_level} />
        <RiskCard label="Education" icon={<GraduationCap className="h-3.5 w-3.5" />} level={caseData.education_risk_level} />
        <RiskCard label="Business" icon={<Briefcase className="h-3.5 w-3.5" />} level={caseData.business_continuity_risk} />
      </div>

      {/* Polity Passport — identity shield, locker, attestation */}
      <MobilityPassportPanel caseId={caseId} caseClassification={caseData.classification} />

      {/* Critical dates */}
      {criticalDates.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            Critical Date Register
          </h3>
          <div className="space-y-1.5">
            {criticalDates.map(d => {
              const days = daysUntil(d.due_date);
              const urgent = days <= 14;
              const passed = days < 0;
              return (
                <div
                  key={d.id}
                  className={cls(
                    'flex items-center justify-between rounded-lg border px-3 py-2',
                    passed ? 'border-slate-600 bg-slate-800/30' :
                    urgent ? 'border-rose-500/30 bg-rose-500/5' :
                    'border-slate-700 bg-slate-900/40',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className={cls('h-3.5 w-3.5', passed ? 'text-slate-500' : urgent ? 'text-rose-400' : 'text-slate-400')} />
                    <span className="text-sm text-slate-200">{d.label}</span>
                    {d.workstream_key && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 border border-slate-600">
                        {d.workstream_key}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">{new Date(d.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                    <span className={cls(
                      'font-medium',
                      passed ? 'text-slate-500' : urgent ? 'text-rose-300' : 'text-slate-300',
                    )}>
                      {passed ? `${Math.abs(days)}d ago` : `${days}d`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Operational Outputs — SRB + IES */}
      {(onOpenSRB || onOpenIES) && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-200">Operational Outputs</h3>
          <div className="space-y-1.5">
            {onOpenSRB && (
              <button
                onClick={onOpenSRB}
                className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5 w-full text-left hover:border-violet-500/30 hover:bg-slate-800/60 transition-all cursor-pointer group"
              >
                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-slate-100">Strategic Repatriation Brief</span>
                  <p className="text-[11px] text-slate-500">Capability and continuity narrative for institutional engagement</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-violet-400 transition-colors shrink-0" />
              </button>
            )}
            {onOpenIES && (
              <button
                onClick={onOpenIES}
                className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5 w-full text-left hover:border-emerald-500/30 hover:bg-slate-800/60 transition-all cursor-pointer group"
              >
                <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-slate-100">Institutional Engagement Strategy</span>
                  <p className="text-[11px] text-slate-500">Sequenced outreach plan and partner institution drafts</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-emerald-400 transition-colors shrink-0" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Workstream board */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-200">Workstreams</h3>
        <div className="space-y-1.5">
          {workstreams.map(ws => {
            const statusColor = STATUS_COLOR[ws.status as keyof typeof STATUS_COLOR] ?? 'slate';
            const hasDetail = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(ws.workstream_key);
            const WsWrapper = hasDetail ? 'button' : 'div';
            return (
              <WsWrapper
                key={ws.id}
                {...(hasDetail ? { onClick: () => onOpenWorkstream?.(ws.workstream_key) } : {})}
                className={cls(
                  'flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5 w-full text-left',
                  hasDetail ? 'hover:border-emerald-500/30 hover:bg-slate-800/60 transition-all cursor-pointer group' : '',
                )}
              >
                <span className="shrink-0 text-slate-400">{WORKSTREAM_ICONS[ws.workstream_key]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">{ws.workstream_key}</span>
                    <span className="text-sm text-slate-100 truncate">{ws.label}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <PriorityBadge priority={ws.priority} />
                  <span className={cls(
                    'text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize',
                    `bg-${statusColor}-500/10 text-${statusColor}-300 border-${statusColor}-500/20`,
                  )}>
                    {ws.status}
                  </span>
                  {hasDetail && (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-emerald-400 transition-colors" />
                  )}
                </div>
              </WsWrapper>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ScoreCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={cls('rounded-xl border p-3 text-center', `border-${color}-500/20 bg-${color}-500/5`)}>
      <p className={cls('text-lg font-bold', `text-${color}-300`)}>{value}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

function RiskCard({ label, icon, level }: { label: string; icon: React.ReactNode; level: string | null }) {
  const color = RISK_COLOR[(level ?? 'low') as keyof typeof RISK_COLOR] ?? 'slate';
  return (
    <div className={cls('rounded-lg border px-3 py-2 flex items-center gap-2', `border-${color}-500/20 bg-${color}-500/5`)}>
      <span className={`text-${color}-400`}>{icon}</span>
      <div>
        <p className="text-[11px] text-slate-400">{label} risk</p>
        <p className={cls('text-xs font-medium capitalize', `text-${color}-300`)}>{level ?? 'pending'}</p>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const color = priority === 'critical' || priority === 'immediate' ? 'rose' : priority === 'high' ? 'amber' : 'slate';
  return (
    <span className={cls(
      'text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize',
      `bg-${color}-500/10 text-${color}-300 border-${color}-500/20`,
    )}>
      {priority}
    </span>
  );
}
