"use client";

/**
 * VentureProgressCard — Aigent Me's read-only window into MVL.
 * Per PRD v0.2 §9.2 (Runtime cards → Venture Progress Card) and §8 GP4.
 *
 * Renders the VentureProgressShape returned by POST /api/assistant/
 * venture-progress. Composes IqubeContextDisclosure + NextBestActionCard.
 *
 * Privacy:
 *   - BlakQube fields surface as counts only (operationalGoals,
 *     commercialGoals, activeKpis). Values never on the wire.
 *   - Recent activity surfaces intent name + cartridge + status only.
 */

import React from "react";
import {
  Briefcase,
  Loader2,
  Target,
  TrendingUp,
  Lock,
  Activity,
  ChevronRight,
  Compass,
  AlertCircle,
  X,
} from "lucide-react";
import {
  NextBestActionCard,
  type NextBestActionData,
} from "@/components/metame/cards/NextBestActionCard";
import { IqubeContextDisclosure } from "@/components/metame/cards/IqubeContextDisclosure";
import { PreflightByline, PreflightChip } from "@/components/metame/cards/PreflightByline";
import type { PreflightContext } from "@/services/capabilities/preflight";

export interface VentureProgressKpiSummary {
  activeKpisCount: number;
  operationalGoalsCount: number;
  commercialGoalsCount: number;
  hasFranchiseProposition: boolean;
  hasConfidentialNotes: boolean;
}

export interface VentureProgressRecentActivity {
  intentId: string;
  intentName: string;
  cartridge: string;
  status: string;
  createdAt: string;
  // Phase 2 B.2 (2/2) — derived action capabilities.
  canResume?: boolean;
  canHandOff?: boolean;
  canCancel?: boolean;
  specialist?: string | null;
  nextActionHint?: string | null;
  blockers?: string[];
}

export interface VentureProgressData {
  generatedAt: string;
  ventureName: string | null;
  primaryGoal: string | null;
  currentStage: string;
  experienceConfigured: boolean;
  linkedCartridges: string[];
  kpiSummary: VentureProgressKpiSummary;
  /** Phase 2 B.1 — rich KPI rows resolved against active activations. */
  activeKpis?: import('@/services/strategy/kpiTypes').KpiRecord[];
  operationalGoalsCount: number;
  commercialGoalsCount: number;
  recentActivity: VentureProgressRecentActivity[];
  blockersCount: number;
  recommendedActions: NextBestActionData[];
  suggestedArtifacts: string[];
  using: ("PersonaQube" | "ExperienceQube" | "IntentQube")[];
  notShared: string[];
  preflightContext?: PreflightContext;
}

interface Props {
  data: VentureProgressData | null;
  loading?: boolean;
  error?: string | null;
  onActOnNbe?: (action: NextBestActionData) => void;
  /** Same shape as BriefCard.queuedIntents — once an NBA is queued
   *  its Act button flips to a non-clickable "Queued" badge. */
  queuedIntents?: Record<string, unknown>;
  /** When provided, renders a close (X) control in the header so the
   *  user can dismiss the venture-progress card. The chip that opened
   *  it (Venture progress) can re-open it. */
  onDismiss?: () => void;
  theme?: "light" | "dark";
}

const STAGE_LABELS: Record<string, string> = {
  setup: "Setup",
  alpha_activation: "Alpha activation",
  launch: "Launch",
  growth: "Growth",
  scale: "Scale",
};

const CARTRIDGE_LABELS: Record<string, string> = {
  metame: "metaMe",
  knyt: "KNYT",
  qriptopian: "The Qriptopian",
  marketa: "Marketa",
  mvl: "metaMe Venture Lab",
};

export function VentureProgressCard({
  data,
  loading,
  error,
  onActOnNbe,
  queuedIntents,
  onDismiss,
  theme = "dark",
}: Props) {
  const isDark = theme === "dark";
  const surfaceClass = isDark
    ? "bg-slate-900/50 border-slate-700/60 text-slate-100"
    : "bg-white border-slate-200 text-slate-900";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const accentClass = isDark ? "text-violet-300" : "text-violet-700";
  const chipClass = isDark
    ? "bg-slate-800/60 border-slate-700 text-slate-200"
    : "bg-slate-100 border-slate-200 text-slate-700";
  const statClass = isDark
    ? "bg-slate-800/40 border-slate-700/60"
    : "bg-slate-50 border-slate-200";
  const dismissBtnClass = isDark
    ? "text-slate-500 hover:text-slate-200 hover:bg-slate-800/60"
    : "text-slate-400 hover:text-slate-700 hover:bg-slate-100";
  const dismissButton = onDismiss ? (
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss venture progress"
      title="Close venture progress"
      className={`shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-md transition-colors ${dismissBtnClass}`}
    >
      <X className="w-3.5 h-3.5" />
    </button>
  ) : null;

  if (loading) {
    return (
      <div className={`rounded-lg border p-6 ${surfaceClass}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
            <span className={`text-sm ${mutedClass}`}>
              Assembling venture progress…
            </span>
          </div>
          {dismissButton}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg border p-6 ${surfaceClass}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold mb-1">Venture progress unavailable</h3>
            <p className={`text-sm ${mutedClass}`}>{error}</p>
          </div>
          {dismissButton}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={`rounded-lg border p-5 lg:p-6 ${surfaceClass} space-y-5`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className={`w-4 h-4 ${accentClass}`} />
            <span className={`text-xs uppercase tracking-wider ${mutedClass}`}>
              Venture Progress · metaMe Venture Lab
            </span>
            <PreflightChip preflight={data.preflightContext} theme={theme} />
          </div>
          <h3 className="text-xl font-semibold leading-tight">
            {data.ventureName || "Your active venture"}
          </h3>
          <PreflightByline preflight={data.preflightContext} theme={theme} />
          {data.primaryGoal && (
            <p className={`text-sm mt-1 ${mutedClass}`}>
              <span className={accentClass}>Primary goal:</span>{" "}
              {data.primaryGoal}
            </p>
          )}
        </div>
        <div className="flex items-start gap-2">
          <div className="text-right">
            <div className={`text-xs ${mutedClass}`}>
              Stage · {STAGE_LABELS[data.currentStage] ?? data.currentStage}
            </div>
            {data.blockersCount > 0 && (
              <div className="flex items-center gap-1 justify-end text-xs text-amber-300 mt-1">
                <AlertCircle className="w-3 h-3" />
                {data.blockersCount} blocker{data.blockersCount === 1 ? "" : "s"}
              </div>
            )}
          </div>
          {dismissButton}
        </div>
      </div>

      {/* iQube disclosure */}
      <IqubeContextDisclosure
        using={data.using}
        notShared={data.notShared}
        theme={theme}
      />

      {/* KPI / goal counts grid */}
      <section>
        <h4 className={`text-xs uppercase tracking-wider mb-2 ${mutedClass}`}>
          State summary
        </h4>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <Stat
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            label="Active KPIs"
            value={data.kpiSummary.activeKpisCount}
            statClass={statClass}
            mutedClass={mutedClass}
            accentClass={accentClass}
          />
          <Stat
            icon={<Target className="w-3.5 h-3.5" />}
            label="Operational goals"
            value={data.operationalGoalsCount}
            statClass={statClass}
            mutedClass={mutedClass}
            accentClass={accentClass}
          />
          <Stat
            icon={<Target className="w-3.5 h-3.5" />}
            label="Commercial goals"
            value={data.commercialGoalsCount}
            statClass={statClass}
            mutedClass={mutedClass}
            accentClass={accentClass}
          />
          <Stat
            icon={<Lock className="w-3.5 h-3.5" />}
            label="Confidential notes"
            value={data.kpiSummary.hasConfidentialNotes ? "Set" : "—"}
            statClass={statClass}
            mutedClass={mutedClass}
            accentClass={accentClass}
          />
        </div>
      </section>

      {/* Linked cartridges */}
      {data.linkedCartridges.length > 0 && (
        <section>
          <h4 className={`text-xs uppercase tracking-wider mb-2 ${mutedClass}`}>
            Linked cartridges
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {data.linkedCartridges.map((slug) => (
              <span
                key={slug}
                className={`px-2 py-0.5 text-xs rounded border ${chipClass}`}
              >
                {CARTRIDGE_LABELS[slug] ?? slug}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Recent activity */}
      <section>
        <h4 className={`text-xs uppercase tracking-wider mb-2 ${mutedClass}`}>
          Recent activity
        </h4>
        {data.recentActivity.length === 0 ? (
          <p className={`text-sm ${mutedClass}`}>
            No queued intents yet. Approving an action from a brief or
            move-forward card shows up here.
          </p>
        ) : (
          <ul className={`text-sm space-y-1 ${mutedClass}`}>
            {data.recentActivity.map((a) => (
              <li key={a.intentId} className="flex items-start gap-2">
                <Activity className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-slate-200">{a.intentName}</span>
                  <span className={mutedClass}>
                    {" · "}{CARTRIDGE_LABELS[a.cartridge] ?? a.cartridge}
                    {" · "}{a.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recommended actions */}
      <section>
        <h4 className={`text-xs uppercase tracking-wider mb-2 ${mutedClass}`}>
          Recommended moves
        </h4>
        {data.recommendedActions.length === 0 ? (
          <p className={`text-sm ${mutedClass}`}>
            No catalogue match for MVL at your current stage. Set up your
            ExperienceModel to surface stage-relevant actions.
          </p>
        ) : (
          <div className="space-y-2">
            {data.recommendedActions.map((action) => (
              <NextBestActionCard
                key={action.id}
                action={action}
                onAct={onActOnNbe}
                queued={!!queuedIntents?.[action.id]}
                theme={theme}
              />
            ))}
          </div>
        )}
      </section>

      {/* Suggested artifacts */}
      {data.suggestedArtifacts.length > 0 && (
        <section>
          <h4 className={`text-xs uppercase tracking-wider mb-2 ${mutedClass}`}>
            Suggested artifacts
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {data.suggestedArtifacts.map((a) => (
              <span
                key={a}
                className={`px-2 py-0.5 text-xs rounded border ${chipClass}`}
              >
                {a}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className={`text-xs ${mutedClass} pt-2 border-t border-slate-800/40 flex items-center gap-2`}>
        <Compass className="w-3 h-3" />
        aigentMe · venture progress generated{" "}
        {new Date(data.generatedAt).toLocaleString()}
      </footer>
    </div>
  );
}

interface StatProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  statClass: string;
  mutedClass: string;
  accentClass: string;
}

function Stat({ icon, label, value, statClass, mutedClass, accentClass }: StatProps) {
  return (
    <div className={`rounded-md border p-3 ${statClass}`}>
      <div className={`flex items-center gap-1 text-[11px] uppercase tracking-wider ${mutedClass}`}>
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-semibold mt-1 ${accentClass}`}>
        {value}
      </div>
    </div>
  );
}

export default VentureProgressCard;
