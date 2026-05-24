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
import { accent, type Accent } from "./accentTokens";
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

            {/* Row 1 — KPIs (cyan accent) */}
            <Row
              title="KPIs"
              accentClass={isDark ? "text-cyan-300/90" : "text-cyan-700"}
            >
              <Carousel>
                {/* Phase 2 B.1 — when the server returned resolved KPIs
                    (rich shape, activation-bound), render one chip per
                    KPI showing current/target/trend. Falls back to the
                    legacy count chips when the venture has no KPIs
                    declared yet so the operator still sees the
                    operational/commercial summary. */}
                {data.activeKpis && data.activeKpis.length > 0 ? (
                  data.activeKpis.map((kpi) => (
                    <KpiChip
                      key={kpi.id}
                      kpi={kpi}
                      isDark={isDark}
                      onSelect={() => props.onSelectKpi?.(kpi.id)}
                    />
                  ))
                ) : (
                  <>
                    <StatChip label="Active KPIs" value={data.kpiSummary.activeKpisCount} isDark={isDark} accentId="cyan" />
                    <StatChip label="Operational goals" value={data.operationalGoalsCount} isDark={isDark} accentId="cyan" />
                    <StatChip label="Commercial goals" value={data.commercialGoalsCount} isDark={isDark} accentId="cyan" />
                  </>
                )}
                {data.kpiSummary.hasFranchiseProposition && (
                  <PillChip label="Franchise proposition" isDark={isDark} accentId="emerald" />
                )}
                {data.kpiSummary.hasConfidentialNotes && (
                  <PillChip label="Confidential notes" isDark={isDark} accentId="slate" />
                )}
              </Carousel>
            </Row>

            {/* Row 2 — Active Work (emerald accent) */}
            <Row
              title="Active work"
              accentClass={isDark ? "text-emerald-300/90" : "text-emerald-700"}
            >
              {data.recentActivity.length === 0 ? (
                <EmptyLine isDark={isDark} text="No recent activity — fire an intent to see it land here." />
              ) : (
                <Carousel>
                  {data.recentActivity.slice(0, 12).map((a) => (
                    <ActivityChip key={a.intentId} activity={a} isDark={isDark} />
                  ))}
                </Carousel>
              )}
            </Row>

            {/* Row 3 — Recommended (violet primary — strongest emphasis,
                action-bearing) */}
            <Row
              title="Recommended"
              accentClass={isDark ? "text-violet-300" : "text-violet-700"}
            >
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
  accentClass,
  children,
}: {
  title: string;
  /** Per-section accent (violet / cyan / emerald). Adds enough color
   *  distinction between rows that the eye can scan section → section
   *  without re-reading the labels — without breaking the glass /
   *  translucent style guide. */
  accentClass: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className={`text-[10px] uppercase tracking-[0.16em] mb-2 font-medium ${accentClass}`}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Carousel({ children }: { children: React.ReactNode }) {
  // Horizontal scroll strip stays inside the body padding so the row's
  // first + last chips align vertically with KPI/Recommended cards above
  // and below. No edge-bleed — the pane reads as a coherent column.
  return (
    <div className="flex items-stretch gap-2 overflow-x-auto snap-x snap-mandatory pb-1 pr-0.5">
      {React.Children.map(children, (child, i) => (
        <div key={i} className="snap-start shrink-0">{child}</div>
      ))}
    </div>
  );
}

function KpiChip({
  kpi,
  isDark,
  onSelect,
}: {
  kpi: import('@/services/strategy/kpiTypes').KpiRecord;
  isDark: boolean;
  onSelect?: () => void;
}) {
  // Rich KPI chip — shows name + current/target + trend arrow. Source
  // drives the accent: activation-bound KPIs use cyan when resolved,
  // muted slate when the source activation is inactive (so the
  // operator sees "this needs an activation" at a glance). Manual
  // KPIs use cyan with a small dot indicator.
  //
  // Metric class drives emphasis:
  //   - outcome   → violet accent + small dot, primary visual weight
  //   - standing  → amber accent, accumulated-position semantic
  //   - activity  → cyan accent (default; leading-indicator)
  // The operator sees outcomes pop out from activity at a glance.
  const isUnresolved = !!kpi.unresolvedReason;
  const metricClass = kpi.class ?? 'activity';
  const accentKey: 'cyan' | 'slate' | 'violet' | 'amber' = isUnresolved
    ? 'slate'
    : metricClass === 'outcome'
      ? 'violet'
      : metricClass === 'standing'
        ? 'amber'
        : 'cyan';
  const tint = accent(accentKey, isDark ? 'dark' : 'light');
  const hasValue = typeof kpi.current === 'number';
  const display = hasValue ? formatKpiValue(kpi.current!, kpi.unit) : '—';
  const targetLabel = kpi.target ? kpi.target.split(/\s+by\s+/i)[0] : '';

  const trendArrow =
    kpi.trend === 'up'
      ? '↑'
      : kpi.trend === 'down'
        ? '↓'
        : kpi.trend === 'flat'
          ? '→'
          : '';
  const trendClass =
    kpi.trend === 'up'
      ? (isDark ? 'text-emerald-300' : 'text-emerald-700')
      : kpi.trend === 'down'
        ? (isDark ? 'text-rose-300' : 'text-rose-700')
        : (isDark ? 'text-slate-400' : 'text-slate-500');

  const showOutcomeDot = metricClass === 'outcome' && !isUnresolved;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-lg border p-2.5 min-w-[10rem] max-w-[14rem] backdrop-blur-sm transition-colors hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${tint.border} ${hasValue ? tint.fillStrong : tint.fillSoft}`}
      title={
        isUnresolved
          ? `Source ${kpi.source.activationId ?? '—'} not active`
          : kpi.target || kpi.name
      }
    >
      <div className="flex items-center gap-1.5">
        {showOutcomeDot && (
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${isDark ? 'bg-violet-300' : 'bg-violet-600'}`}
            aria-label="Outcome metric"
            title="Outcome — value-bearing event the world responded to"
          />
        )}
        <div className={`text-xs truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
          {kpi.name}
        </div>
      </div>
      <div className="flex items-baseline gap-1 mt-0.5">
        <div className={`text-lg font-semibold leading-tight ${hasValue ? tint.text : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
          {display}
        </div>
        {targetLabel && hasValue && (
          <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            / {targetLabel}
          </div>
        )}
        {trendArrow && (
          <div className={`text-xs font-medium ml-auto ${trendClass}`}>
            {trendArrow}
          </div>
        )}
      </div>
      {isUnresolved && (
        <div className={`text-[10px] mt-1 ${isDark ? 'text-amber-300/80' : 'text-amber-700'}`}>
          {kpi.unresolvedReason === 'source-inactive'
            ? 'Activate source to track'
            : kpi.unresolvedReason === 'metric-unknown'
              ? 'Metric unavailable'
              : 'Source error'}
        </div>
      )}
    </button>
  );
}

function formatKpiValue(value: number, unit?: string): string {
  // Compact format: 1234 → "1.2k", 1500000 → "1.5M"
  const abs = Math.abs(value);
  let display: string;
  if (abs >= 1_000_000) display = `${(value / 1_000_000).toFixed(1)}M`;
  else if (abs >= 1_000) display = `${(value / 1_000).toFixed(1)}k`;
  else display = String(value);
  return unit ? `${display} ${unit}` : display;
}

function StatChip({
  label,
  value,
  isDark,
  accentId,
}: {
  label: string;
  value: number;
  isDark: boolean;
  accentId: Accent;
}) {
  // Tinted glass fill — translucent surface + soft border in the
  // section's accent color. Non-zero values get a slightly stronger
  // tint so "active" KPIs read at a glance.
  const tint = accent(accentId, isDark ? "dark" : "light");
  const hasValue = value > 0;
  const box = `${tint.border} ${hasValue ? tint.fillStrong : tint.fillSoft} backdrop-blur-sm`;
  const valueClass = hasValue ? tint.text : isDark ? "text-slate-200" : "text-slate-700";
  return (
    <div className={`rounded-lg border p-2.5 min-w-[7.5rem] ${box}`}>
      <div className={`text-xs leading-tight ${isDark ? "text-slate-300" : "text-slate-700"}`}>
        {label}
      </div>
      <div className={`text-lg font-semibold leading-tight mt-0.5 ${valueClass}`}>{value}</div>
    </div>
  );
}

function PillChip({ label, isDark, accentId }: { label: string; isDark: boolean; accentId: Accent }) {
  const tint = accent(accentId, isDark ? "dark" : "light");
  return (
    <div className={`rounded-lg border p-2.5 text-[11px] flex items-center min-w-[10rem] backdrop-blur-sm ${tint.border} ${tint.fillStrong} ${tint.text}`}>
      {label}
    </div>
  );
}

function ActivityChip({
  activity,
  isDark,
}: {
  activity: { intentId: string; intentName: string; cartridge: string; status: string };
  isDark: boolean;
}) {
  // Glass-fill emerald (Active Work accent). Status colors the bottom
  // line so the eye can scan completed / in-progress / failed without
  // re-reading.
  const tint = accent("emerald", isDark ? "dark" : "light");
  const status = activity.status.toLowerCase();
  const statusClass =
    status.includes("done") || status.includes("complete") || status.includes("succeed")
      ? isDark ? "text-emerald-300" : "text-emerald-700"
      : status.includes("fail") || status.includes("error")
        ? isDark ? "text-rose-300" : "text-rose-700"
        : status.includes("progress") || status.includes("running")
          ? isDark ? "text-amber-300" : "text-amber-700"
          : isDark ? "text-slate-400" : "text-slate-500";
  const cartridgeClass = isDark ? "text-slate-400" : "text-slate-600";
  return (
    <div className={`rounded-lg border p-2.5 min-w-[12rem] max-w-[16rem] backdrop-blur-sm ${tint.border} ${tint.fillSoft}`}>
      <div className={`text-xs font-medium truncate ${isDark ? "text-slate-100" : "text-slate-900"}`}>
        {activity.intentName}
      </div>
      <div className={`text-[10px] mt-0.5 truncate ${cartridgeClass}`}>
        {activity.cartridge}
      </div>
      <div className={`text-[10px] uppercase tracking-[0.16em] mt-1 font-medium ${statusClass}`}>
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
