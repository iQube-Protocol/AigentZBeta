"use client";

/**
 * DecisionBoardLayout — Phase 2 Slice 2 (move-forward).
 *
 * Single vertical stack — hero recommended card at top, alternates
 * stacked below as 'or instead' choices. Same shape across breakpoints.
 * Multi-column splits were tried first; they cramped each card below
 * a readable width in the ~45% right pane. Vertical stack uses the
 * available width fully and lets the eye scan top-to-bottom.
 *
 * Rationale trace lives in the footer (one primary surface for "why").
 *
 * DIS template id: `decision-board-layout-v1`.
 */

import React, { useCallback } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import {
  NextBestActionCard,
} from "@/components/metame/cards/NextBestActionCard";
import { LayoutShell } from "./LayoutShell";
import { accent } from "./accentTokens";
import type {
  RightPaneLayoutDefinition,
  RightPaneLayoutProps,
} from "./types";

function DecisionBoardLayoutComponent(props: RightPaneLayoutProps) {
  const {
    theme = "dark",
    moveForwardResult,
    moveForwardLoading,
    queuedIntents,
    onNbeAct,
    onDismissMoveForward,
    onRequestLayout,
  } = props;

  const isDark = theme === "dark";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const topAction = moveForwardResult?.topAction ?? null;
  const alternates = (moveForwardResult?.alternates ?? []).filter(
    (a) => !queuedIntents[a.id],
  );

  const handleDismiss = useCallback(() => {
    onDismissMoveForward?.();
    onRequestLayout?.("stack");
  }, [onDismissMoveForward, onRequestLayout]);

  const reason = moveForwardResult?.topActionReason;

  return (
    <LayoutShell
      surfaceId="decision-board"
      disTemplateId="decision-board-layout-v1"
      theme={theme}
      headerIcon={<Sparkles className="h-3.5 w-3.5" />}
      headerEyebrow="Move forward"
      headerTitle={topAction ? topAction.label : "Choosing your move…"}
      onDismiss={handleDismiss}
      dismissLabel="Close decision board"
      footer={
        reason ? (
          <div className={`text-[11px] leading-relaxed ${mutedClass} mr-auto`}>
            <span className={isDark ? "text-violet-300" : "text-violet-700"}>Why this ranking:</span>{" "}
            {reason}
          </div>
        ) : undefined
      }
      body={
        moveForwardLoading && !topAction ? (
          <DecisionSkeleton isDark={isDark} />
        ) : !topAction ? (
          <DecisionEmptyState isDark={isDark} />
        ) : (
          <div className="space-y-5">
            {/* Recommended — violet primary, the action-bearing card */}
            <section>
              <h3 className={`text-[10px] uppercase tracking-[0.16em] mb-2 font-medium ${
                isDark ? "text-violet-300" : "text-violet-700"
              }`}>
                Recommended
              </h3>
              <div className={`rounded-2xl border backdrop-blur-sm ${
                accent("violet", isDark ? "dark" : "light").border
              } ${
                accent("violet", isDark ? "dark" : "light").fillSoft
              }`}>
                <NextBestActionCard
                  action={topAction}
                  variant="hero"
                  onAct={onNbeAct}
                  theme={theme}
                />
              </div>
            </section>

            {alternates.length > 0 && (
              <section>
                <h3 className={`text-[10px] uppercase tracking-[0.16em] mb-2 font-medium ${
                  isDark ? "text-slate-300" : "text-slate-600"
                }`}>
                  Or instead ({alternates.length})
                </h3>
                <div className="space-y-2">
                  {alternates.map((alt) => (
                    <NextBestActionCard
                      key={alt.id}
                      action={alt}
                      onAct={onNbeAct}
                      theme={theme}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )
      }
    />
  );
}

function DecisionSkeleton({ isDark }: { isDark: boolean }) {
  const skel = isDark ? "bg-slate-800/60" : "bg-slate-200/80";
  const box  = isDark ? "border-slate-700/60 bg-slate-900/40" : "border-slate-200 bg-white";
  return (
    <div className="space-y-4" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className={`rounded-lg border p-4 ${box} space-y-3`}>
          <div className={`h-3 w-20 rounded ${skel}`} />
          <div className={`h-5 w-3/4 rounded ${skel}`} />
          <div className={`h-3 w-full rounded ${skel}`} />
          <div className={`h-3 w-5/6 rounded ${skel}`} />
          {i === 0 && (
            <div className="flex items-center gap-2 pt-1">
              <Loader2 className="h-3 w-3 animate-spin text-violet-400" />
              <span className="text-[11px] text-slate-500">Finding next best action…</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DecisionEmptyState({ isDark }: { isDark: boolean }) {
  const box = isDark ? "border-slate-700/60 bg-slate-900/40" : "border-slate-200 bg-white";
  const muted = isDark ? "text-slate-400" : "text-slate-600";
  return (
    <div className={`rounded-lg border p-5 lg:p-6 ${box}`}>
      <h3 className="text-sm font-semibold mb-1">Nothing to recommend yet</h3>
      <p className={`text-xs leading-relaxed ${muted}`}>
        Aigent Me didn't find a strong move at your current stage. Try setting
        up your ExperienceModel first, or declare a goal so the rerank has
        something to score against.
      </p>
    </div>
  );
}

export const DecisionBoardLayout: RightPaneLayoutDefinition = {
  id: "decision-board",
  label: "Decision board",
  component: DecisionBoardLayoutComponent,
  disTemplateId: "decision-board-layout-v1",
};
