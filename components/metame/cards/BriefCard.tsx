"use client";

/**
 * BriefCard — Aigent Me daily/project/cartridge brief shape.
 *
 * Per PRD v0.2 §9.2 (Runtime cards → Brief Card):
 *   - current context
 *   - top priorities
 *   - relevant events/docs/messages (Phase 6 wires Workspace inclusion)
 *   - active goals
 *   - next best actions
 *   - iQube context disclosure (uses IqubeContextDisclosure)
 *
 * Receives the BriefShape returned from POST /api/assistant/brief and
 * renders deterministic content. Phase 3.b layers LLM-enriched prose
 * for the rationale strings without changing the shape.
 */

import React from "react";
import { Sparkles, Compass, ChevronRight, Loader2 } from "lucide-react";
import {
  NextBestActionCard,
  type NextBestActionData,
} from "@/components/metame/cards/NextBestActionCard";
import { IqubeContextDisclosure } from "@/components/metame/cards/IqubeContextDisclosure";

export interface BriefCardData {
  briefType: "daily" | "project" | "cartridge";
  generatedAt: string;
  context: {
    activeCartridges: string[];
    primaryGoal: string | null;
    currentStage: string;
    experienceName: string | null;
    experienceConfigured: boolean;
    personalGuide?: {
      alignmentState: string;
      precedenceMode: string;
      focusIntent?: string;
      guidanceNote: string;
    };
  };
  topPriorities: Array<{ id: string; label: string; cartridge: string }>;
  nextBestActions: NextBestActionData[];
  pendingApprovalsCount: number;
  using: ("PersonaQube" | "ExperienceQube" | "IntentQube")[];
  notShared: string[];
}

interface Props {
  data: BriefCardData | null;
  loading?: boolean;
  error?: string | null;
  onActOnNbe?: (action: NextBestActionData) => void;
  theme?: "light" | "dark";
}

const STAGE_LABELS: Record<string, string> = {
  setup: "Setup",
  alpha_activation: "Alpha activation",
  launch: "Launch",
  growth: "Growth",
  scale: "Scale",
};

export function BriefCard({ data, loading, error, onActOnNbe, theme = "dark" }: Props) {
  const isDark = theme === "dark";
  const surfaceClass = isDark
    ? "bg-slate-900/50 border-slate-700/60 text-slate-100"
    : "bg-white border-slate-200 text-slate-900";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const accentClass = isDark ? "text-violet-300" : "text-violet-700";

  if (loading) {
    return (
      <div className={`rounded-lg border p-6 ${surfaceClass}`}>
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
          <span className={`text-sm ${mutedClass}`}>
            Composing your brief…
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg border p-6 ${surfaceClass}`}>
        <h3 className="font-semibold mb-1">Brief unavailable</h3>
        <p className={`text-sm ${mutedClass}`}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const briefHeading =
    data.briefType === "cartridge"
      ? "Cartridge brief"
      : data.briefType === "project"
        ? "Project brief"
        : "Today's brief";

  return (
    <div className={`rounded-lg border p-5 lg:p-6 ${surfaceClass} space-y-5`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Compass className={`w-4 h-4 ${accentClass}`} />
            <span className={`text-xs uppercase tracking-wider ${mutedClass}`}>
              {briefHeading}
            </span>
          </div>
          <h3 className="text-xl font-semibold leading-tight">
            {data.context.experienceName || "Your active work"}
          </h3>
          {data.context.primaryGoal && (
            <p className={`text-sm mt-1 ${mutedClass}`}>
              <span className={accentClass}>Primary goal:</span>{" "}
              {data.context.primaryGoal}
            </p>
          )}
          {data.context.personalGuide?.guidanceNote && (
            <p className={`text-xs mt-1.5 ${mutedClass} italic`}>
              {data.context.personalGuide.guidanceNote}
            </p>
          )}
        </div>
        <div className="text-right">
          <div className={`text-xs ${mutedClass}`}>
            Stage · {STAGE_LABELS[data.context.currentStage] ?? data.context.currentStage}
          </div>
          {data.pendingApprovalsCount > 0 && (
            <div className="text-xs text-amber-300 mt-1">
              {data.pendingApprovalsCount} pending approval
              {data.pendingApprovalsCount === 1 ? "" : "s"}
            </div>
          )}
        </div>
      </div>

      {/* iQube disclosure */}
      <IqubeContextDisclosure
        using={data.using}
        notShared={data.notShared}
        theme={theme}
      />

      {/* Top priorities */}
      {data.topPriorities.length > 0 && (
        <section>
          <h4 className={`text-xs uppercase tracking-wider mb-2 ${mutedClass}`}>
            Top priorities
          </h4>
          <ul className="space-y-1.5">
            {data.topPriorities.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 text-sm"
              >
                <ChevronRight className={`w-4 h-4 ${isDark ? "text-emerald-300" : "text-emerald-700"}`} />
                <span>{p.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Next best actions */}
      <section>
        <h4 className={`text-xs uppercase tracking-wider mb-2 ${mutedClass}`}>
          Suggested next moves
        </h4>
        <div className="space-y-2">
          {data.nextBestActions.length === 0 ? (
            <p className={`text-sm ${mutedClass}`}>
              No actions in the catalogue match your current stage. Try a
              different cartridge or update your ExperienceModel.
            </p>
          ) : (
            data.nextBestActions.map((action) => (
              <NextBestActionCard
                key={action.id}
                action={action}
                onAct={onActOnNbe}
                theme={theme}
              />
            ))
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className={`text-xs ${mutedClass} pt-2 border-t border-slate-800/40`}>
        <Sparkles className="w-3 h-3 inline -mt-0.5 mr-1" />
        aigentMe · brief generated{" "}
        {new Date(data.generatedAt).toLocaleString()}
      </footer>
    </div>
  );
}

export default BriefCard;
