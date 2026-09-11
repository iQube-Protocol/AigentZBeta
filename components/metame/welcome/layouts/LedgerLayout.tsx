"use client";

/**
 * LedgerLayout — Phase 2 Slice 6 (receipts).
 *
 * Dedicated chronological view for activity receipts. Replaces the
 * receipts accordion section in StackLayout with a focused ledger:
 * filter chips at top (All / Receipts / Approvals / Brief / Composer),
 * full-width chronological list below.
 *
 * Mobile: filter chips collapse to a single "Filter (n)" button that
 * opens a bottom sheet; list inline-expands receipt detail (DIS
 * `mobileShapes.ledger-layout-v1`).
 *
 * v1 keeps mobile as a horizontal-scroll chip strip; full bottom-sheet
 * filter UI is a follow-on.
 *
 * DIS template id: `ledger-layout-v1`.
 */

import React, { useCallback, useMemo, useState } from "react";
import { Receipt, Loader2 } from "lucide-react";
import {
  ActivityReceiptCard,
} from "@/components/metame/cards/ActivityReceiptCard";
import { LayoutShell } from "./LayoutShell";
import { accent, type Accent } from "./accentTokens";
import type {
  RightPaneLayoutDefinition,
  RightPaneLayoutProps,
} from "./types";

type LedgerFilterId = "all" | "receipt" | "approval" | "brief" | "composer";

// Each filter carries an accent so the active state inherits a meaningful
// color (Receipts=slate/neutral, Approvals=amber/pending,
// Briefs=violet/primary, Composer=cyan/composition).
const FILTERS: { id: LedgerFilterId; label: string; accent: Accent }[] = [
  { id: "all",      label: "All",       accent: "violet"  },
  { id: "receipt",  label: "Receipts",  accent: "slate"   },
  { id: "approval", label: "Approvals", accent: "amber"   },
  { id: "brief",    label: "Briefs",    accent: "violet"  },
  { id: "composer", label: "Composer",  accent: "cyan"    },
];

function LedgerLayoutComponent(props: RightPaneLayoutProps) {
  const {
    theme = "dark",
    receipts,
    receiptsLoading,
    receiptsPersonaLabel,
    onRequestLayout,
  } = props;

  const isDark = theme === "dark";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const [filter, setFilter] = useState<LedgerFilterId>("all");

  const handleDismiss = useCallback(() => {
    onRequestLayout?.("stack");
  }, [onRequestLayout]);

  const filtered = useMemo(() => {
    if (!receipts) return [];
    if (filter === "all") return receipts;
    return receipts.filter((r) => {
      const kind = String((r as { kind?: string }).kind ?? "");
      const eventType = String((r as { eventType?: string }).eventType ?? "");
      const tag = (kind || eventType).toLowerCase();
      return tag.includes(filter);
    });
  }, [receipts, filter]);

  const baseChip = isDark
    ? "border-slate-700/60 text-slate-300 hover:bg-slate-800/40"
    : "border-slate-200 text-slate-600 hover:bg-slate-100";

  const filterStrip = (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
      {FILTERS.map((f) => {
        const tint = accent(f.accent, isDark ? "dark" : "light");
        const isActive = filter === f.id;
        return (
          <button
            key={f.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors backdrop-blur-sm ${
              isActive
                ? `${tint.border} ${tint.fillStrong} ${tint.text}`
                : baseChip
            }`}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <LayoutShell
      surfaceId="ledger"
      disTemplateId="ledger-layout-v1"
      theme={theme}
      headerIcon={<Receipt className="h-3.5 w-3.5" />}
      headerEyebrow="Ledger"
      headerTitle={`${filtered.length} ${filter === "all" ? "events" : FILTERS.find((f) => f.id === filter)?.label.toLowerCase() ?? ""}`}
      onDismiss={handleDismiss}
      dismissLabel="Close ledger"
      body={
        <div className="space-y-3">
          {filterStrip}

          {receiptsLoading && (!receipts || receipts.length === 0) ? (
            <LedgerSkeleton isDark={isDark} />
          ) : filtered.length === 0 ? (
            <LedgerEmptyState isDark={isDark} mutedClass={mutedClass} filterLabel={
              FILTERS.find((f) => f.id === filter)?.label ?? "All"
            } />
          ) : (
            <div className="space-y-2">
              {filtered.map((r) => (
                <ActivityReceiptCard
                  key={r.id}
                  data={r}
                  personaDisplayLabel={receiptsPersonaLabel}
                  theme={theme}
                />
              ))}
            </div>
          )}
        </div>
      }
    />
  );
}

function LedgerSkeleton({ isDark }: { isDark: boolean }) {
  const skel = isDark ? "bg-slate-800/60" : "bg-slate-200/80";
  const box  = isDark ? "border-slate-700/60 bg-slate-900/40" : "border-slate-200 bg-white";
  return (
    <div className="space-y-2" aria-busy="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`rounded-lg border p-3 ${box} space-y-2`}>
          <div className={`h-3 w-1/3 rounded ${skel}`} />
          <div className={`h-3 w-full rounded ${skel}`} />
          {i === 0 && (
            <div className="flex items-center gap-2 pt-1">
              <Loader2 className="h-3 w-3 animate-spin text-violet-400" />
              <span className="text-[11px] text-slate-500">Loading activity…</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function LedgerEmptyState({
  isDark,
  mutedClass,
  filterLabel,
}: {
  isDark: boolean;
  mutedClass: string;
  filterLabel: string;
}) {
  const box = isDark ? "border-slate-700/60 bg-slate-900/40" : "border-slate-200 bg-white";
  return (
    <div className={`rounded-lg border p-5 lg:p-6 ${box}`}>
      <div className="flex items-start gap-3">
        <Receipt className={`h-5 w-5 mt-0.5 ${isDark ? "text-violet-300" : "text-violet-700"}`} />
        <div>
          <h3 className="text-sm font-semibold mb-1">
            {filterLabel === "All" ? "No activity yet" : `No ${filterLabel.toLowerCase()} yet`}
          </h3>
          <p className={`text-xs leading-relaxed ${mutedClass}`}>
            Brief, move-forward, compose, approve — every action shows up here
            with its receipt and decision trail.
          </p>
        </div>
      </div>
    </div>
  );
}

export const LedgerLayout: RightPaneLayoutDefinition = {
  id: "ledger",
  label: "Ledger",
  component: LedgerLayoutComponent,
  disTemplateId: "ledger-layout-v1",
};
