"use client";

/**
 * NextBestActionCard — single NBE rendered as an actionable card.
 *
 * Aigent Me Phase 3. Per PRD v0.2 §9.2 (Runtime cards → Next Best Action
 * Card): recommended action, rationale, source cartridge, effort,
 * impact, available actions.
 *
 * Two presentations:
 *   - compact (for stacking inside BriefCard / MoveForwardCard)
 *   - hero    (for "Move this forward" — single big action)
 *
 * The card itself does NOT execute — it surfaces the action and emits an
 * `onAct` callback. Phase 6 wires the actual artifact creation /
 * specialist routing behind that callback.
 */

import React from "react";
import {
  ArrowRight,
  Pencil,
  Sparkles,
  Users,
  Zap,
  ShieldAlert,
} from "lucide-react";

export interface NextBestActionData {
  id: string;
  label: string;
  rationale: string;
  cartridge: string;
  effort: "light" | "standard" | "deep";
  impact: "low" | "medium" | "high";
  approvalRequired: boolean;
  specialist: "marketa" | "quill" | "kn0w1" | "aigent-z" | "aigent-c" | "aigent-nakamoto" | null;
  suggestedArtifact: string | null;
}

interface Props {
  action: NextBestActionData;
  variant?: "compact" | "hero";
  /** Click handler for the "Act" button. Phase 6 wires execution. */
  onAct?: (action: NextBestActionData) => void;
  theme?: "light" | "dark";
}

const CARTRIDGE_LABELS: Record<string, string> = {
  metame: "metaMe",
  knyt: "KNYT",
  qriptopian: "The Qriptopian",
  marketa: "Marketa",
  avl: "AVL",
};

const SPECIALIST_LABELS: Record<string, string> = {
  marketa: "Marketa",
  quill: "Quill",
  kn0w1: "Kn0w1",
  "aigent-z": "Aigent Z",
  "aigent-c": "Aigent C",
  "aigent-nakamoto": "Aigent Nakamoto",
};

const EFFORT_CHIP: Record<NextBestActionData["effort"], string> = {
  light: "Light",
  standard: "Standard",
  deep: "Deep",
};

const IMPACT_CHIP: Record<NextBestActionData["impact"], { label: string; ring: string }> = {
  low:    { label: "Low impact",    ring: "border-slate-700 text-slate-300" },
  medium: { label: "Medium impact", ring: "border-violet-700/60 text-violet-200" },
  high:   { label: "High impact",   ring: "border-violet-500/70 text-violet-100 bg-violet-500/10" },
};

export function NextBestActionCard({
  action,
  variant = "compact",
  onAct,
  theme = "dark",
}: Props) {
  const isDark = theme === "dark";
  const isHero = variant === "hero";
  const surfaceClass = isDark
    ? "bg-slate-900/40 border-slate-700/60 text-slate-100"
    : "bg-white border-slate-200 text-slate-900";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const accentClass = isDark ? "text-violet-300" : "text-violet-700";
  const chipClass = isDark
    ? "border-slate-700 text-slate-300"
    : "border-slate-300 text-slate-600";
  const buttonClass = isDark
    ? "bg-violet-500/20 hover:bg-violet-500/30 border-violet-500/40 text-violet-200"
    : "bg-violet-100 hover:bg-violet-200 border-violet-300 text-violet-800";

  const impact = IMPACT_CHIP[action.impact];

  return (
    <div
      className={`rounded-lg border ${isHero ? "p-5" : "p-4"} ${surfaceClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className={`w-3.5 h-3.5 ${accentClass}`} />
            <span className={`text-xs uppercase tracking-wider ${mutedClass}`}>
              {CARTRIDGE_LABELS[action.cartridge] ?? action.cartridge}
            </span>
            {action.specialist && (
              <>
                <span className={`text-xs ${mutedClass}`}>·</span>
                <Users className={`w-3 h-3 ${mutedClass}`} />
                <span className={`text-xs ${mutedClass}`}>
                  Coordinate with{" "}
                  {SPECIALIST_LABELS[action.specialist] ?? action.specialist}
                </span>
              </>
            )}
          </div>
          <h4 className={`${isHero ? "text-lg" : "text-base"} font-semibold leading-tight`}>
            {action.label}
          </h4>
          <p className={`text-sm mt-1 ${mutedClass}`}>{action.rationale}</p>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className={`px-2 py-0.5 text-[11px] rounded-full border ${chipClass}`}>
              <Zap className="w-3 h-3 inline -mt-0.5 mr-0.5" />
              {EFFORT_CHIP[action.effort]}
            </span>
            <span
              className={`px-2 py-0.5 text-[11px] rounded-full border ${impact.ring}`}
            >
              {impact.label}
            </span>
            {action.approvalRequired && (
              <span className={`px-2 py-0.5 text-[11px] rounded-full border border-amber-500/40 text-amber-300 bg-amber-500/10`}>
                <ShieldAlert className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                Approval required
              </span>
            )}
            {action.suggestedArtifact && (
              <span className={`px-2 py-0.5 text-[11px] rounded-full border ${chipClass}`}>
                <Pencil className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                {action.suggestedArtifact}
              </span>
            )}
          </div>
        </div>

        {onAct && (
          <button
            onClick={() => onAct(action)}
            className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-md border text-xs font-medium transition ${buttonClass}`}
          >
            Act
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export default NextBestActionCard;
