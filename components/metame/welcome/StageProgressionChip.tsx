"use client";

/**
 * StageProgressionChip — compact identity-row chip showing the persona's
 * current ExperienceStage and (when eligible) the next-stage suggestion.
 *
 * Used by the split aigentMe tab, the classic aigentMe tab, and the
 * metaMe runtime client — anywhere the identity row already shows
 * ExpQube / ExpGuide / PersonaQube badges.
 */

import React from "react";
import type { StageEvaluation } from "@/services/strategy/stageProgression";

const STAGE_SHORT: Record<string, string> = {
  setup: "Setup",
  alpha_activation: "Alpha",
  launch: "Launch",
  growth: "Growth",
  scale: "Scale",
};

export function StageProgressionChip({
  evaluation,
}: {
  evaluation: StageEvaluation | null;
}) {
  if (!evaluation) return null;
  const stageLabel = STAGE_SHORT[evaluation.currentStage] ?? evaluation.currentStage;
  if (evaluation.eligible && evaluation.recommendedStage !== evaluation.currentStage) {
    const nextLabel = STAGE_SHORT[evaluation.recommendedStage] ?? evaluation.recommendedStage;
    return (
      <span
        title={`Eligible to advance: ${evaluation.currentStage} → ${evaluation.recommendedStage}. Open the Strategy tab to confirm.`}
        className="text-xs px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 bg-emerald-500/10 border-emerald-500/40 text-emerald-200"
      >
        Stage: {stageLabel} → {nextLabel}
      </span>
    );
  }
  const totalCriteria = evaluation.criteria.length || 0;
  const metCount = evaluation.criteria.filter((c) => c.met).length;
  return (
    <span
      title={`Current stage: ${evaluation.currentStage}. ${
        totalCriteria > 0 ? `${metCount}/${totalCriteria} criteria met for next stage.` : "No further stages."
      }`}
      className="text-xs px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 bg-slate-500/10 border-slate-500/30 text-slate-200"
    >
      Stage: {stageLabel}
      {totalCriteria > 0 ? ` · ${metCount}/${totalCriteria}` : ""}
    </span>
  );
}

export default StageProgressionChip;
