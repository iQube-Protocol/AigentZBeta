"use client";

/**
 * ExperienceModelCard — Aigent Me canonical card for the user's
 * ExperienceModel state. Renders the meta slice (T1) and counts-only
 * blakQube summary returned by GET /api/assistant/experience-model.
 *
 * Per PRD v0.2 §9.2 (Runtime cards → ExperienceModel Card):
 *   - active experience name
 *   - active cartridges
 *   - primary goal
 *   - current stage
 *   - progress model
 *   - confidentiality state
 *   - next setup action
 *
 * Used by:
 *   - AigentMeWelcomeTab (displays current state inline)
 *   - Future surfaces that need a compact view of the user's current
 *     experience (e.g. the AVL Venture Progress card in Phase 4)
 *
 * Privacy: never renders BlakQube payload values — only counts. Per
 * services/iqube/experienceQube.ts, the GET endpoint never serialises
 * raw BlakQube to the wire.
 */

import React from "react";
import { Sparkles, Pencil, Lock, Globe, Eye } from "lucide-react";

export interface ExperienceModelCardData {
  configured: boolean;
  meta: {
    experienceName: string | null;
    experienceType: string;
    primaryGoal: string | null;
    currentStage: string;
    progressModel: string;
    activeCartridges: string[];
    confidentialityDefault: string;
  } | null;
  blakSummary: {
    goalsCount: number;
    strategicGoalsCount: number;
    priorityPartnersCount: number;
    activeCampaignsCount: number;
    hasFranchiseProposition: boolean;
    hasConfidentialNotes: boolean;
  } | null;
  updatedAt: string | null;
}

interface Props {
  data: ExperienceModelCardData | null;
  loading?: boolean;
  /** Click handler for the Edit / Set Up CTA. */
  onEdit?: () => void;
  theme?: "light" | "dark";
}

const STAGE_LABELS: Record<string, string> = {
  setup: "Setup",
  alpha_activation: "Alpha activation",
  launch: "Launch",
  growth: "Growth",
  scale: "Scale",
};

const TYPE_LABELS: Record<string, string> = {
  personal: "Personal",
  creative: "Creative",
  venture: "Venture",
  client: "Client",
  portfolio: "Portfolio",
  venture_building: "Venture building",
};

const CONF_META: Record<string, { label: string; icon: typeof Lock }> = {
  private_by_default: { label: "Private by default", icon: Lock },
  selective_share: { label: "Selective share", icon: Eye },
  open: { label: "Open", icon: Globe },
};

const CARTRIDGE_LABELS: Record<string, string> = {
  metame: "metaMe",
  knyt: "KNYT",
  qriptopian: "The Qriptopian",
  marketa: "Marketa",
  avl: "AgentiQ Venture Lab",
};

export function ExperienceModelCard({ data, loading, onEdit, theme = "dark" }: Props) {
  const isDark = theme === "dark";
  const surfaceClass = isDark
    ? "bg-slate-900/40 border-slate-700/60 text-slate-100"
    : "bg-white border-slate-200 text-slate-900";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const accentClass = isDark ? "text-violet-300" : "text-violet-700";
  const chipClass = isDark
    ? "bg-slate-800/60 border-slate-700 text-slate-200"
    : "bg-slate-100 border-slate-200 text-slate-700";
  const buttonClass = isDark
    ? "bg-violet-500/20 hover:bg-violet-500/30 border-violet-500/40 text-violet-200"
    : "bg-violet-100 hover:bg-violet-200 border-violet-300 text-violet-800";

  if (loading) {
    return (
      <div className={`rounded-lg border p-5 ${surfaceClass} animate-pulse`}>
        <div className="h-4 w-1/3 bg-slate-700/40 rounded mb-2" />
        <div className="h-6 w-2/3 bg-slate-700/40 rounded" />
      </div>
    );
  }

  // Unconfigured — invitation state.
  if (!data || !data.configured || !data.meta) {
    return (
      <div className={`rounded-lg border p-5 ${surfaceClass}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className={`w-4 h-4 ${accentClass}`} />
              <span className={`text-xs uppercase tracking-wider ${mutedClass}`}>
                ExperienceModel
              </span>
            </div>
            <h3 className="text-lg font-semibold mb-1">Not yet set up</h3>
            <p className={`text-sm ${mutedClass}`}>
              Define what you&apos;re building, which cartridges matter, what
              outcomes count, and what stays confidential. Aigent Me uses your
              ExperienceModel for every brief and recommendation.
            </p>
          </div>
          {onEdit && (
            <button
              onClick={onEdit}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition ${buttonClass}`}
            >
              Set up
            </button>
          )}
        </div>
      </div>
    );
  }

  const { meta, blakSummary } = data;
  const confMeta = CONF_META[meta.confidentialityDefault] ?? CONF_META.private_by_default;
  const ConfIcon = confMeta.icon;

  return (
    <div className={`rounded-lg border p-5 ${surfaceClass}`}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className={`w-4 h-4 ${accentClass}`} />
            <span className={`text-xs uppercase tracking-wider ${mutedClass}`}>
              ExperienceModel · {TYPE_LABELS[meta.experienceType] ?? meta.experienceType}
            </span>
          </div>
          <h3 className="text-lg font-semibold truncate">
            {meta.experienceName || "Untitled experience"}
          </h3>
          {meta.primaryGoal && (
            <p className={`text-sm mt-1 ${mutedClass}`}>{meta.primaryGoal}</p>
          )}
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${buttonClass}`}
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>
        )}
      </div>

      {/* Stage + confidentiality + progress model. Stage chip gets the
          metaMe emerald accent to anchor the brand colour alongside the
          violet header. */}
      <div className="flex flex-wrap items-center gap-3 text-xs mb-4">
        <span
          className={`px-2 py-1 rounded-full border ${
            isDark
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-emerald-400 bg-emerald-50 text-emerald-800"
          }`}
        >
          Stage · {STAGE_LABELS[meta.currentStage] ?? meta.currentStage}
        </span>
        <span className={`flex items-center gap-1 px-2 py-1 rounded-full border ${chipClass}`}>
          <ConfIcon className="w-3 h-3" />
          {confMeta.label}
        </span>
        <span className={`px-2 py-1 rounded-full border ${chipClass}`}>
          {meta.progressModel.replace(/_/g, " · ")}
        </span>
      </div>

      {/* Active cartridges */}
      {meta.activeCartridges.length > 0 && (
        <div className="mb-4">
          <div className={`text-xs uppercase tracking-wider mb-1 ${mutedClass}`}>
            Active cartridges
          </div>
          <div className="flex flex-wrap gap-1.5">
            {meta.activeCartridges.map((slug) => (
              <span
                key={slug}
                className={`px-2 py-0.5 text-xs rounded border ${chipClass}`}
              >
                {CARTRIDGE_LABELS[slug] ?? slug}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* BlakQube counts — never values */}
      {blakSummary && (
        <div className={`text-xs ${mutedClass} pt-3 border-t border-slate-800/40`}>
          <span>
            {blakSummary.goalsCount} {blakSummary.goalsCount === 1 ? "goal" : "goals"}
          </span>
          <span> · </span>
          <span>
            {blakSummary.priorityPartnersCount} priority{" "}
            {blakSummary.priorityPartnersCount === 1 ? "partner" : "partners"}
          </span>
          <span> · </span>
          <span>
            {blakSummary.activeCampaignsCount} active{" "}
            {blakSummary.activeCampaignsCount === 1 ? "campaign" : "campaigns"}
          </span>
          {blakSummary.hasConfidentialNotes && (
            <>
              <span> · </span>
              <span>confidential notes set</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default ExperienceModelCard;
