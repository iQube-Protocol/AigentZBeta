"use client";

/**
 * VentureCockpitLayout — Phase 2 Slice 3 (review-venture-progress).
 *
 * Sticky top strip (stage + primary goal) followed by three stacked
 * rows:
 *   Row 1 — KPIs (horizontal carousel of stat chips)
 *   Row 2 — Active Work (horizontal carousel of activity chips)
 *   Row 3 — Recommended (vertical stack of NextBestActionCards)
 *
 * Same shape across breakpoints. The pane is ~45% viewport on desktop,
 * which is too narrow for multi-column sections. Vertical rows with
 * horizontal carousels in the chip-heavy rows preserve readability
 * without wasting space.
 *
 * DIS template id: `venture-cockpit-layout-v1`.
 */

import React, { useCallback } from "react";
import { Briefcase, AlertCircle, Loader2 } from "lucide-react";
import {
  NextBestActionCard,
} from "@/components/metame/cards/NextBestActionCard";
import { LayoutShell } from "./LayoutShell";
import type {
  RightPaneLayoutDefinition,
  RightPaneLayoutProps,
} from "./types";

const STAGE_LABELS: Record<string, string> = {
  setup: "Setup",
  alpha_activation: "Alpha activation",
  launch: "Launch",
  growth: "Growth",
  scale: "Scale",
};

function VentureCockpitLayoutComponent(props: RightPaneLayoutProps) {
  const {
    theme = "dark",
    ventureProgress,
    ventureProgressLoading,
    ventureProgressError,
    onNbeAct,
    onDismissVenture,
    onRequestLayout,
  } = props;

  const isDark = theme === "dark";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const stripClass = isDark
    ? "bg-slate-900/60 border-slate-800/60"
    : "bg-slate-50 border-slate-200";

  const handleDismiss = useCallback(() => {
    onDismissVenture?.();
    onRequestLayout?.("stack");
  }, [onDismissVenture, onRequestLayout]);

  const data = ventureProgress;
  const stageLabel = data ? STAGE_LABELS[data.currentStage] ?? data.currentStage : "—";

  const headerActions = data && data.blockersCount > 0 ? (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] ${
      isDark
        ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
        : "border-amber-300 bg-amber-50 text-amber-700"
    }`}>
      <AlertCircle className="h-3 w-3" />
      {data.blockersCount} blocker{data.blockersCount === 1 ? "" : "s"}
    </span>
  ) : undefined;

  return (
    <LayoutShell
      surfaceId="venture-cockpit"
      disTemplateId="venture-cockpit-layout-v1"
      theme={theme}
      headerIcon={<Briefcase className="h-3.5 w-3.5" />}
      headerEyebrow="Venture cockpit"
      headerTitle={data?.ventureName ?? "Your venture"}
      headerActions={headerActions}
      onDismiss={handleDismiss}
      dismissLabel="Close venture cockpit"
      body={
        ventureProgressLoading && !data ? (
          <CockpitSkeleton isDark={isDark} />
        ) : ventureProgressError && !data ? (
          <CockpitError message={ventureProgressError} isDark={isDark} />
        ) : !data ? (
          <CockpitEmpty isDark={isDark} mutedClass={mutedClass} />
        ) : (
          <div className="space-y-5">
            {/* Top strip — stage + primary goal */}
            <div className={`rounded-lg border p-3 lg:p-4 ${stripClass}`}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className={`text-[10px] uppercase tracking-[0.16em] ${mutedClass}`}>
                    Stage
                  </div>
                  <div className="text-sm font-semibold">{stageLabel}</div>
                </div>
                {data.primaryGoal && (
                  <div className="text-right max-w-[60%]">
                    <div className={`text-[10px] uppercase tracking-[0.16em] ${mutedClass}`}>
                      Primary goal
                    </div>
                    <div className="text-xs leading-snug">{data.primaryGoal}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Row 1 — KPIs (horizontal carousel) */}
            <Row title="KPIs" mutedClass={mutedClass}>
              <Carousel>
                <StatChip label="Active KPIs" value={data.kpiSummary.activeKpisCount} isDark={isDark} />
                <StatChip label="Operational goals" value={data.operationalGoalsCount} isDark={isDark} />
                <StatChip label="Commercial goals" value={data.commercialGoalsCount} isDark={isDark} />
                {data.kpiSummary.hasFranchiseProposition && (
                  <PillChip label="Franchise proposition" isDark={isDark} accent="emerald" />
                )}
                {data.kpiSummary.hasConfidentialNotes && (
                  <PillChip label="Confidential notes" isDark={isDark} accent="slate" />
                )}
              </Carousel>
            </Row>

            {/* Row 2 — Active Work (horizontal carousel) */}
            <Row title="Active work" mutedClass={mutedClass}>
              {data.recentActivity.length === 0 ? (
                <EmptyLine isDark={isDark} text="No recent activity — fire an intent to see it land here." />
              ) : (
                <Carousel>
                  {data.recentActivity.slice(0, 12).map((a) => (
                    <ActivityChip key={a.intentId} activity={a} isDark={isDark} mutedClass={mutedClass} />
                  ))}
                </Carousel>
              )}
            </Row>

            {/* Row 3 — Recommended (vertical stack) */}
            <Row title="Recommended" mutedClass={mutedClass}>
              {data.recommendedActions.length === 0 ? (
                <EmptyLine isDark={isDark} text="Nothing recommended right now." />
              ) : (
                <div className="space-y-2">
                  {data.recommendedActions.slice(0, 3).map((a) => (
                    <NextBestActionCard
                      key={a.id}
                      action={a}
                      onAct={onNbeAct}
                      theme={theme}
                    />
                  ))}
                </div>
              )}
            </Row>
          </div>
        )
      }
    />
  );
}

function Row({
  title,
  mutedClass,
  children,
}: {
  title: string;
  mutedClass: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className={`text-[10px] uppercase tracking-[0.16em] mb-2 ${mutedClass}`}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Carousel({ children }: { children: React.ReactNode }) {
  // Horizontal scroll strip that bleeds slightly to indicate scrollability.
  // -mx-4 px-4 keeps consistent gutters with the LayoutShell body padding.
  return (
    <div className="flex items-stretch gap-2 overflow-x-auto snap-x snap-mandatory -mx-4 md:-mx-5 lg:-mx-6 px-4 md:px-5 lg:px-6 pb-1">
      {React.Children.map(children, (child, i) => (
        <div key={i} className="snap-start shrink-0">{child}</div>
      ))}
    </div>
  );
}

function StatChip({ label, value, isDark }: { label: string; value: number; isDark: boolean }) {
  const box = isDark ? "border-slate-700/60 bg-slate-900/40" : "border-slate-200 bg-white";
  return (
    <div className={`rounded-lg border p-2.5 min-w-[7.5rem] ${box}`}>
      <div className="text-xs leading-tight">{label}</div>
      <div className="text-lg font-semibold leading-tight mt-0.5">{value}</div>
    </div>
  );
}

function PillChip({ label, isDark, accent }: { label: string; isDark: boolean; accent: "emerald" | "slate" }) {
  const cls =
    accent === "emerald"
      ? isDark
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
        : "border-emerald-300 bg-emerald-50 text-emerald-700"
      : isDark
        ? "border-slate-700/60 bg-slate-900/40 text-slate-300"
        : "border-slate-200 bg-slate-50 text-slate-600";
  return (
    <div className={`rounded-lg border p-2.5 text-[11px] flex items-center min-w-[10rem] ${cls}`}>
      {label}
    </div>
  );
}

function ActivityChip({
  activity,
  isDark,
  mutedClass,
}: {
  activity: { intentId: string; intentName: string; cartridge: string; status: string };
  isDark: boolean;
  mutedClass: string;
}) {
  const box = isDark ? "border-slate-700/60 bg-slate-900/40" : "border-slate-200 bg-white";
  return (
    <div className={`rounded-lg border p-2.5 min-w-[12rem] max-w-[16rem] ${box}`}>
      <div className="text-xs font-medium truncate">{activity.intentName}</div>
      <div className={`text-[10px] mt-0.5 truncate ${mutedClass}`}>
        {activity.cartridge}
      </div>
      <div className={`text-[10px] uppercase tracking-[0.16em] mt-1 ${mutedClass}`}>
        {activity.status}
      </div>
    </div>
  );
}

function EmptyLine({ isDark, text }: { isDark: boolean; text: string }) {
  return <div className={`text-xs italic ${isDark ? "text-slate-500" : "text-slate-500"}`}>{text}</div>;
}

function CockpitSkeleton({ isDark }: { isDark: boolean }) {
  const skel = isDark ? "bg-slate-800/60" : "bg-slate-200/80";
  const box  = isDark ? "border-slate-700/60 bg-slate-900/40" : "border-slate-200 bg-white";
  return (
    <div className="space-y-5" aria-busy="true">
      <div className={`rounded-lg border p-3 ${box}`}>
        <div className={`h-3 w-32 rounded ${skel} mb-2`} />
        <div className={`h-4 w-1/2 rounded ${skel}`} />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2">
          <div className={`h-3 w-20 rounded ${skel}`} />
          <div className="flex gap-2 overflow-hidden">
            {[0, 1, 2].map((j) => (
              <div key={j} className={`rounded-lg border p-2.5 min-w-[8rem] ${box} space-y-2`}>
                <div className={`h-3 w-16 rounded ${skel}`} />
                <div className={`h-4 w-12 rounded ${skel}`} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Loader2 className="h-3 w-3 animate-spin text-violet-400" />
        <span className="text-[11px] text-slate-500">Loading venture cockpit…</span>
      </div>
    </div>
  );
}

function CockpitError({ message, isDark }: { message: string; isDark: boolean }) {
  const box = isDark ? "border-rose-500/40 bg-rose-500/5" : "border-rose-200 bg-rose-50";
  return (
    <div className={`rounded-lg border p-5 ${box}`}>
      <h3 className={`text-sm font-semibold mb-1 ${isDark ? "text-rose-200" : "text-rose-800"}`}>
        Venture progress unavailable
      </h3>
      <p className={`text-xs leading-relaxed ${isDark ? "text-rose-300/80" : "text-rose-700"}`}>
        {message}
      </p>
    </div>
  );
}

function CockpitEmpty({ isDark, mutedClass }: { isDark: boolean; mutedClass: string }) {
  const box = isDark ? "border-slate-700/60 bg-slate-900/40" : "border-slate-200 bg-white";
  return (
    <div className={`rounded-lg border p-5 lg:p-6 ${box}`}>
      <h3 className="text-sm font-semibold mb-1">No venture data yet</h3>
      <p className={`text-xs leading-relaxed ${mutedClass}`}>
        Set up your ExperienceModel and declare a primary goal so the cockpit
        has something to measure progress against.
      </p>
    </div>
  );
}

export const VentureCockpitLayout: RightPaneLayoutDefinition = {
  id: "venture-cockpit",
  label: "Venture cockpit",
  component: VentureCockpitLayoutComponent,
  disTemplateId: "venture-cockpit-layout-v1",
};
