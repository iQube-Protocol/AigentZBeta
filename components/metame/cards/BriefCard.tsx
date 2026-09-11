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
import { Sparkles, Compass, ChevronRight, Loader2, X } from "lucide-react";
import {
  NextBestActionCard,
  type NextBestActionData,
} from "@/components/metame/cards/NextBestActionCard";
import { IqubeContextDisclosure } from "@/components/metame/cards/IqubeContextDisclosure";
import { PreflightByline, PreflightChip } from "@/components/metame/cards/PreflightByline";
import type { PreflightContext } from "@/services/capabilities/preflight";
import {
  ExpandedNBEPill,
  type ExpandedNBEPillQueuedState,
  type ExpandedNBEPillSecondTier,
} from "@/components/metame/cards/ExpandedNBEPill";
import type { ArtifactCardData } from "@/components/metame/cards/ArtifactCard";

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
  preflightContext?: PreflightContext;
  /**
   * Optional per-NBA compose / action prompt hints, keyed by NBA id —
   * produced by the LLM rerank pass alongside `topNbeReason`. Threads
   * into each `NextBestActionCard.promptHint`.
   */
  nbaPromptHints?: Record<string, string>;
}

interface Props {
  data: BriefCardData | null;
  loading?: boolean;
  error?: string | null;
  onActOnNbe?: (action: NextBestActionData) => void;
  /**
   * NBE ids that have already been queued as IntentQubes, keyed to the
   * full queued state. When a row's id is in this map, the NBA card is
   * replaced inline by an ExpandedNBEPill so the brief becomes the
   * single Capsule containing every Pill it spawned.
   */
  queuedIntents?: Record<string, ExpandedNBEPillQueuedState>;
  /** Artifacts grouped by their originating intent id. */
  artifactsByIntent?: Record<string, ArtifactCardData[]>;
  /** Active second-tier approval (folded into the matching Pill). */
  secondTierApproval?: ExpandedNBEPillSecondTier | null;
  actionPendingArtifactId?: string | null;
  actionErrors?: Record<string, string>;
  onDismissQueued?: (nbeId: string) => void;
  onSendArtifact?: (artifactId: string) => void;
  onDismissArtifact?: (artifactId: string) => void;
  onApproveSecondTier?: () => void;
  onCancelSecondTier?: () => void;
  onMarkPillComplete?: (nbeId: string) => void;
  /**
   * Session registry of NBA definitions for NBEs the operator has
   * already acted on. The brief endpoint isn't guaranteed to keep a
   * queued NBA in its nextBestActions list (refetch can drop it; a
   * different surface may have produced it). This registry is the
   * fallback source so every queued Pill renders inside the brief
   * Capsule regardless.
   */
  actedNbeRegistry?: Record<string, NextBestActionData>;
  /** When provided, renders a close (X) control in the header so the
   *  user can dismiss the brief instead of scrolling past it. The chip
   *  that triggered the brief can re-open it. */
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

export function BriefCard({
  data,
  loading,
  error,
  onActOnNbe,
  queuedIntents,
  artifactsByIntent,
  secondTierApproval,
  actionPendingArtifactId,
  actionErrors,
  onDismissQueued,
  onSendArtifact,
  onDismissArtifact,
  onApproveSecondTier,
  onCancelSecondTier,
  onMarkPillComplete,
  actedNbeRegistry,
  onDismiss,
  theme = "dark",
}: Props) {
  const isDark = theme === "dark";
  const surfaceClass = isDark
    ? "bg-slate-900/50 border-slate-700/60 text-slate-100"
    : "bg-white border-slate-200 text-slate-900";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const accentClass = isDark ? "text-violet-300" : "text-violet-700";
  const dismissBtnClass = isDark
    ? "text-slate-500 hover:text-slate-200 hover:bg-slate-800/60"
    : "text-slate-400 hover:text-slate-700 hover:bg-slate-100";
  const dismissButton = onDismiss ? (
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss brief"
      title="Close brief"
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
              Composing your brief…
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
            <h3 className="font-semibold mb-1">Brief unavailable</h3>
            <p className={`text-sm ${mutedClass}`}>{error}</p>
          </div>
          {dismissButton}
        </div>
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
            <PreflightChip preflight={data.preflightContext} theme={theme} />
          </div>
          <h3 className="text-xl font-semibold leading-tight">
            {data.context.experienceName || "Your active work"}
          </h3>
          <PreflightByline preflight={data.preflightContext} theme={theme} />
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
        <div className="flex items-start gap-2">
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
          {dismissButton}
        </div>
      </div>

      {/* iQube disclosure */}
      <IqubeContextDisclosure
        using={data.using}
        notShared={data.notShared}
        theme={theme}
      />

      {/* Top priorities (amber — pending / what-needs-attention semantic) */}
      {data.topPriorities.length > 0 && (
        <section>
          <h4 className={`text-xs uppercase tracking-wider mb-2 font-medium ${isDark ? "text-amber-300/90" : "text-amber-700"}`}>
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

      {/* Next best actions (violet — action-bearing, strongest emphasis) */}
      <section>
        <h4 className={`text-xs uppercase tracking-wider mb-2 font-medium ${isDark ? "text-violet-300" : "text-violet-700"}`}>
          Suggested next moves
        </h4>
        <div className="space-y-2">
          {data.nextBestActions.length === 0 && !queuedIntents ? (
            <p className={`text-sm ${mutedClass}`}>
              No actions in the catalogue match your current stage. Try a
              different cartridge or update your ExperienceModel.
            </p>
          ) : (
            // Merge brief NBAs with registry NBAs for any queued NBE
            // that isn't in brief.nextBestActions (refetch dropped it,
            // or it was queued from a different surface). Then promote
            // queued Pills to the top so the operator sees in-flight
            // work first. Preserves original ordering within each
            // bucket.
            (() => {
              const briefIds = new Set(data.nextBestActions.map((a) => a.id));
              const orphanQueued: NextBestActionData[] = [];
              if (queuedIntents && actedNbeRegistry) {
                for (const nbeId of Object.keys(queuedIntents)) {
                  if (briefIds.has(nbeId)) continue;
                  const recovered = actedNbeRegistry[nbeId];
                  if (recovered) orphanQueued.push(recovered);
                }
              }
              return [...data.nextBestActions, ...orphanQueued];
            })()
              .sort((a, b) => {
                const aq = queuedIntents?.[a.id] ? 1 : 0;
                const bq = queuedIntents?.[b.id] ? 1 : 0;
                return bq - aq;
              })
              .map((action) => {
                const queued = queuedIntents?.[action.id] ?? null;
                if (queued) {
                  const artifactsForPill =
                    (artifactsByIntent && artifactsByIntent[queued.intentId]) ?? [];
                  const matchedSecondTier =
                    secondTierApproval &&
                    artifactsForPill.some((a) => a.artifactId === secondTierApproval.artifactId)
                      ? secondTierApproval
                      : null;
                  return (
                    <ExpandedNBEPill
                      key={action.id}
                      action={action}
                      queued={queued}
                      artifacts={artifactsForPill}
                      secondTierApproval={matchedSecondTier}
                      actionPendingArtifactId={actionPendingArtifactId}
                      actionErrors={actionErrors}
                      onDismissQueued={() => onDismissQueued?.(action.id)}
                      onSendArtifact={(id) => onSendArtifact?.(id)}
                      onDismissArtifact={(id) => onDismissArtifact?.(id)}
                      onApproveSecondTier={onApproveSecondTier}
                      onCancelSecondTier={onCancelSecondTier}
                      onMarkComplete={
                        onMarkPillComplete ? () => onMarkPillComplete(action.id) : undefined
                      }
                      theme={theme}
                    />
                  );
                }
                return (
                  <NextBestActionCard
                    key={action.id}
                    action={action}
                    onAct={onActOnNbe}
                    queued={false}
                    promptHint={data.nbaPromptHints?.[action.id] ?? null}
                    theme={theme}
                  />
                );
              })
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
