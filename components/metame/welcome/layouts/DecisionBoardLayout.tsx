"use client";

/**
 * DecisionBoardLayout — Phase 2 Slice 2 (move-forward).
 *
 * Desktop: hero NBE on the left, alternates as comparable column on the
 * right, rationale trace pinned in the footer.
 * Mobile: horizontal-swipe between hero + alternates with page-dot
 * indicator (DIS `mobileShapes.decision-board-layout-v1`).
 *
 * DIS template id: `decision-board-layout-v1`.
 */

import React, { useCallback, useRef, useState } from "react";
import { Sparkles, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import {
  NextBestActionCard,
  type NextBestActionData,
} from "@/components/metame/cards/NextBestActionCard";
import { LayoutShell } from "./LayoutShell";
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

  const [activeMobileSlide, setActiveMobileSlide] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const slides: NextBestActionData[] = [
    ...(topAction ? [topAction] : []),
    ...alternates,
  ];

  const goToSlide = useCallback((idx: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const slide = scroller.children[idx] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    setActiveMobileSlide(idx);
  }, []);

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
      mobileStickyStrip={
        slides.length > 1 ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Previous option"
              onClick={() => goToSlide(Math.max(0, activeMobileSlide - 1))}
              disabled={activeMobileSlide === 0}
              className={`inline-flex items-center justify-center h-7 w-7 rounded-md ${
                isDark ? "text-slate-300 hover:bg-slate-800/60 disabled:opacity-30" : "text-slate-600 hover:bg-slate-100 disabled:opacity-30"
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Go to option ${idx + 1}`}
                  onClick={() => goToSlide(idx)}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === activeMobileSlide
                      ? "w-6 bg-violet-400"
                      : isDark
                        ? "w-1.5 bg-slate-700"
                        : "w-1.5 bg-slate-300"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Next option"
              onClick={() => goToSlide(Math.min(slides.length - 1, activeMobileSlide + 1))}
              disabled={activeMobileSlide === slides.length - 1}
              className={`inline-flex items-center justify-center h-7 w-7 rounded-md ${
                isDark ? "text-slate-300 hover:bg-slate-800/60 disabled:opacity-30" : "text-slate-600 hover:bg-slate-100 disabled:opacity-30"
              }`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : undefined
      }
      body={
        moveForwardLoading && !topAction ? (
          <DecisionSkeleton isDark={isDark} />
        ) : !topAction ? (
          <DecisionEmptyState isDark={isDark} />
        ) : (
          <>
            {/* Desktop: hero + alternates grid */}
            <div className="hidden md:grid md:grid-cols-2 gap-4">
              <div>
                <h3 className={`text-[10px] uppercase tracking-[0.16em] mb-2 ${mutedClass}`}>
                  Recommended
                </h3>
                <NextBestActionCard
                  action={topAction}
                  variant="hero"
                  onAct={onNbeAct}
                  theme={theme}
                />
              </div>
              <div>
                <h3 className={`text-[10px] uppercase tracking-[0.16em] mb-2 ${mutedClass}`}>
                  Or instead ({alternates.length})
                </h3>
                {alternates.length === 0 ? (
                  <div className={`rounded-lg border p-4 text-xs ${
                    isDark ? "border-slate-700/60 bg-slate-900/40 text-slate-400" : "border-slate-200 bg-white text-slate-600"
                  }`}>
                    No alternates — the recommended action stands alone at this stage.
                  </div>
                ) : (
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
                )}
              </div>
            </div>

            {/* Mobile: horizontal swipe */}
            <div
              ref={scrollerRef}
              className="md:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 pb-2"
              onScroll={(e) => {
                const el = e.currentTarget;
                const idx = Math.round(el.scrollLeft / el.clientWidth);
                if (idx !== activeMobileSlide) setActiveMobileSlide(idx);
              }}
            >
              {slides.map((slide, idx) => (
                <div
                  key={slide.id}
                  className="snap-start shrink-0 w-full"
                >
                  <h3 className={`text-[10px] uppercase tracking-[0.16em] mb-2 ${mutedClass}`}>
                    {idx === 0 ? "Recommended" : `Alternative ${idx}`}
                  </h3>
                  <NextBestActionCard
                    action={slide}
                    variant={idx === 0 ? "hero" : "compact"}
                    onAct={onNbeAct}
                    theme={theme}
                  />
                </div>
              ))}
            </div>
          </>
        )
      }
    />
  );
}

function DecisionSkeleton({ isDark }: { isDark: boolean }) {
  const skel = isDark ? "bg-slate-800/60" : "bg-slate-200/80";
  const box  = isDark ? "border-slate-700/60 bg-slate-900/40" : "border-slate-200 bg-white";
  return (
    <div className="grid md:grid-cols-2 gap-4" aria-busy="true">
      {[0, 1].map((i) => (
        <div key={i} className={`rounded-lg border p-4 ${box} space-y-3`}>
          <div className={`h-3 w-20 rounded ${skel}`} />
          <div className={`h-5 w-3/4 rounded ${skel}`} />
          <div className={`h-3 w-full rounded ${skel}`} />
          <div className={`h-3 w-5/6 rounded ${skel}`} />
          <div className="flex items-center gap-2 pt-2">
            <Loader2 className="h-3 w-3 animate-spin text-violet-400" />
            <span className="text-[11px] text-slate-500">Finding next best action…</span>
          </div>
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
