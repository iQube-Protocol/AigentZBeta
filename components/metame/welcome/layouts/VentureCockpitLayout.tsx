"use client";

/**
 * VentureCockpitLayout — Phase 2 Slice 3 (review-venture-progress).
 *
 * Desktop: top strip (stage + blockers) + 3-column body (KPIs / Goals /
 * Pending NBEs).
 * Mobile: sticky top strip + sticky section tab strip; one section at
 * a time (DIS `mobileShapes.venture-cockpit-layout-v1`).
 *
 * Reuses VentureProgressCard's existing data via a focused split — KPI
 * grid in the left column, recommended actions in the right. The full
 * card content (intro paragraph, iQube disclosure) sits in the top strip
 * so the columns stay scannable.
 *
 * DIS template id: `venture-cockpit-layout-v1`.
 */

import React, { useCallback, useState } from "react";
import { Briefcase, AlertCircle, Target, TrendingUp, Activity, Loader2 } from "lucide-react";
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

type SectionId = "kpis" | "goals" | "actions";

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
  const surfaceClass = isDark
    ? "border-slate-700/60 bg-slate-900/40"
    : "border-slate-200 bg-white";
  const stripClass = isDark
    ? "bg-slate-900/60 border-slate-800/60"
    : "bg-slate-50 border-slate-200";

  const [activeSection, setActiveSection] = useState<SectionId>("kpis");

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

  const sections: { id: SectionId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "kpis",    label: "KPIs",    icon: TrendingUp },
    { id: "goals",   label: "Goals",   icon: Target },
    { id: "actions", label: "Actions", icon: Activity },
  ];

  const sectionTabs = (
    <div role="tablist" aria-label="Cockpit sections" className="inline-flex items-center gap-1">
      {sections.map(({ id, label, icon: Icon }) => {
        const isActive = id === activeSection;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setActiveSection(id)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              isActive
                ? isDark
                  ? "border-violet-500/50 bg-violet-500/10 text-violet-100"
                  : "border-violet-300 bg-violet-50 text-violet-800"
                : isDark
                  ? "border-slate-700/60 text-slate-300 hover:bg-slate-800/40"
                  : "border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        );
      })}
    </div>
  );

  const kpisColumn = data ? (
    <ColumnSection title="KPIs" mutedClass={mutedClass}>
      <Stat label="Active KPIs" value={data.kpiSummary.activeKpisCount} isDark={isDark} />
      <Stat label="Operational goals" value={data.operationalGoalsCount} isDark={isDark} />
      <Stat label="Commercial goals" value={data.commercialGoalsCount} isDark={isDark} />
      {data.kpiSummary.hasFranchiseProposition && (
        <Pill label="Franchise proposition declared" isDark={isDark} accent="emerald" />
      )}
      {data.kpiSummary.hasConfidentialNotes && (
        <Pill label="Confidential notes present" isDark={isDark} accent="slate" />
      )}
    </ColumnSection>
  ) : null;

  const goalsColumn = data ? (
    <ColumnSection title="Active work" mutedClass={mutedClass}>
      {data.recentActivity.length === 0 ? (
        <EmptyLine isDark={isDark} text="No recent activity yet — fire an intent to see it land here." />
      ) : (
        <ul className="space-y-1.5">
          {data.recentActivity.slice(0, 6).map((a) => (
            <li
              key={a.intentId}
              className={`flex items-start justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${surfaceClass}`}
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{a.intentName}</div>
                <div className={`text-[10px] ${mutedClass}`}>{a.cartridge}</div>
              </div>
              <span className={`text-[10px] uppercase tracking-[0.16em] ${mutedClass}`}>
                {a.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ColumnSection>
  ) : null;

  const actionsColumn = data ? (
    <ColumnSection title="Recommended" mutedClass={mutedClass}>
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
    </ColumnSection>
  ) : null;

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
      mobileStickyStrip={sectionTabs}
      body={
        ventureProgressLoading && !data ? (
          <CockpitSkeleton isDark={isDark} />
        ) : ventureProgressError && !data ? (
          <CockpitError message={ventureProgressError} isDark={isDark} />
        ) : !data ? (
          <CockpitEmpty isDark={isDark} mutedClass={mutedClass} />
        ) : (
          <div className="space-y-4">
            {/* Top strip — stage + primary goal */}
            <div className={`rounded-lg border p-3 lg:p-4 ${stripClass}`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
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

            {/* Desktop: 3-column body */}
            <div className="hidden md:grid md:grid-cols-3 gap-4">
              {kpisColumn}
              {goalsColumn}
              {actionsColumn}
            </div>

            {/* Mobile: one section at a time, driven by sticky tab strip */}
            <div className="md:hidden">
              {activeSection === "kpis"    && kpisColumn}
              {activeSection === "goals"   && goalsColumn}
              {activeSection === "actions" && actionsColumn}
            </div>
          </div>
        )
      }
    />
  );
}

function ColumnSection({
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
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Stat({ label, value, isDark }: { label: string; value: number; isDark: boolean }) {
  const box = isDark ? "border-slate-700/60 bg-slate-900/40" : "border-slate-200 bg-white";
  return (
    <div className={`rounded-lg border p-2.5 flex items-center justify-between ${box}`}>
      <span className="text-xs">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function Pill({ label, isDark, accent }: { label: string; isDark: boolean; accent: "emerald" | "slate" }) {
  const cls =
    accent === "emerald"
      ? isDark
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
        : "border-emerald-300 bg-emerald-50 text-emerald-700"
      : isDark
        ? "border-slate-700/60 bg-slate-900/40 text-slate-300"
        : "border-slate-200 bg-slate-50 text-slate-600";
  return (
    <div className={`rounded-md border px-2.5 py-1 text-[11px] ${cls}`}>{label}</div>
  );
}

function EmptyLine({ isDark, text }: { isDark: boolean; text: string }) {
  const cls = isDark ? "text-slate-500" : "text-slate-500";
  return <div className={`text-xs italic ${cls}`}>{text}</div>;
}

function CockpitSkeleton({ isDark }: { isDark: boolean }) {
  const skel = isDark ? "bg-slate-800/60" : "bg-slate-200/80";
  const box  = isDark ? "border-slate-700/60 bg-slate-900/40" : "border-slate-200 bg-white";
  return (
    <div className="space-y-4" aria-busy="true">
      <div className={`rounded-lg border p-3 ${box}`}>
        <div className={`h-3 w-32 rounded ${skel} mb-2`} />
        <div className={`h-4 w-1/2 rounded ${skel}`} />
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`rounded-lg border p-3 ${box} space-y-2`}>
            <div className={`h-3 w-16 rounded ${skel}`} />
            <div className={`h-3 w-3/4 rounded ${skel}`} />
            <div className={`h-3 w-2/3 rounded ${skel}`} />
            <div className="flex items-center gap-2 pt-1">
              <Loader2 className="h-3 w-3 animate-spin text-violet-400" />
              <span className="text-[11px] text-slate-500">Loading…</span>
            </div>
          </div>
        ))}
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
