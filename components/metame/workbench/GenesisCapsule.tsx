"use client";

import React from "react";
import { ChevronDown } from "lucide-react";

export type IntentStage =
  | "cta_issued"
  | "specialist_consulted"
  | "queued"
  | "approved"
  | "acted"
  | "complete"
  | "cancelled";

const STAGE_STEPS: Array<{ id: IntentStage; label: string }> = [
  { id: "cta_issued", label: "CTA" },
  { id: "specialist_consulted", label: "Consulted" },
  { id: "queued", label: "Queued" },
  { id: "approved", label: "Approved" },
  { id: "acted", label: "Acted" },
  { id: "complete", label: "Complete" },
];

const STAGE_ORDER: IntentStage[] = [
  "cta_issued",
  "specialist_consulted",
  "queued",
  "approved",
  "acted",
  "complete",
];

export function StageStrip({
  currentStage,
  isDark = true,
}: {
  currentStage: IntentStage;
  isDark?: boolean;
}) {
  const cancelled = currentStage === "cancelled";
  const currentIdx = cancelled ? -1 : STAGE_ORDER.indexOf(currentStage);
  const allDone = currentStage === "complete";

  if (cancelled) {
    return (
      <div className="flex items-center gap-1">
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide font-medium ${
            isDark
              ? "bg-slate-700/40 text-slate-300 border border-slate-600/60"
              : "bg-slate-200 text-slate-600 border border-slate-300"
          }`}
        >
          <span>×</span>
          Cancelled
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0 flex-wrap">
      {STAGE_STEPS.map((step, idx) => {
        const isDone = allDone || idx < currentIdx;
        const isCurrent = !allDone && idx === currentIdx;
        return (
          <React.Fragment key={step.id}>
            {idx > 0 && (
              <div
                className={`h-px w-2.5 flex-shrink-0 ${
                  isDone
                    ? "bg-emerald-500/50"
                    : isDark
                    ? "bg-slate-700"
                    : "bg-slate-300"
                }`}
              />
            )}
            <span
              className={`flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide font-medium transition-all ${
                isDone
                  ? isDark
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : isCurrent
                  ? isDark
                    ? "bg-violet-500/20 text-violet-200 border border-violet-500/40"
                    : "bg-violet-50 text-violet-700 border border-violet-200"
                  : isDark
                  ? "text-slate-600 border border-slate-800 bg-transparent"
                  : "text-slate-400 border border-slate-200 bg-transparent"
              }`}
            >
              {isDone && <span className="mr-0.5">✓</span>}
              {step.label}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

const STORAGE_KEY = "aigent.expandedCapsules.v1";

function readPersistedSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x) => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function writePersistedSet(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* quota / private mode — ignore */
  }
}

function isPersistedExpanded(key: string): boolean {
  return readPersistedSet().has(key);
}

function setPersistedExpanded(key: string, expanded: boolean) {
  const set = readPersistedSet();
  if (expanded) set.add(key);
  else set.delete(key);
  writePersistedSet(set);
}

export interface GenesisCapsuleProps {
  label: string;
  cartridge?: string;
  createdAt?: string;
  currentStage?: IntentStage;
  isDark?: boolean;
  defaultCollapsed?: boolean;
  /** When provided, expansion state persists to localStorage across tab switches + reloads. */
  persistKey?: string;
  onExpandChange?: (expanded: boolean) => void;
  children: React.ReactNode;
}

export function GenesisCapsule({
  label,
  cartridge,
  createdAt,
  currentStage,
  isDark = true,
  defaultCollapsed = true,
  persistKey,
  onExpandChange,
  children,
}: GenesisCapsuleProps) {
  const [collapsed, setCollapsed] = React.useState(() => {
    if (persistKey && typeof window !== "undefined") {
      const wasExpanded = isPersistedExpanded(persistKey);
      return !wasExpanded;
    }
    return defaultCollapsed;
  });

  // Notify the parent on mount when we restore an expanded state from
  // localStorage so it can lazy-fetch chain data without re-click.
  React.useEffect(() => {
    if (!collapsed && persistKey) onExpandChange?.(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (persistKey) setPersistedExpanded(persistKey, !next);
    onExpandChange?.(!next);
  };

  const isCancelled = currentStage === "cancelled";
  const outerBorder = isCancelled
    ? isDark
      ? "border-slate-600/40 bg-slate-900/30"
      : "border-slate-300 bg-slate-50"
    : isDark
    ? "border-emerald-500/30 bg-emerald-950/10"
    : "border-emerald-300 bg-emerald-50/20";

  // Header background kept neutral so label text reads as clear white
  // without an emerald tint wash. Border underneath retains the emerald
  // (or slate) accent so the capsule identity is still legible.
  const headerSurface = isDark
    ? "bg-slate-900/40 hover:bg-slate-900/60"
    : "bg-white hover:bg-slate-50";
  const headerBorderBottom = collapsed
    ? ""
    : isCancelled
    ? isDark
      ? "border-b border-slate-600/30"
      : "border-b border-slate-200"
    : isDark
    ? "border-b border-emerald-500/20"
    : "border-b border-emerald-200";

  const labelClass = isDark ? "text-white" : "text-slate-900";
  const metaClass = isDark ? "text-slate-400" : "text-slate-600";

  return (
    <div className={`rounded-lg border overflow-hidden ${outerBorder}`}>
      <button
        type="button"
        onClick={toggle}
        className={`w-full flex items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors ${headerSurface} ${headerBorderBottom}`}
      >
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium truncate ${labelClass}`}>
              {label}
            </span>
            {cartridge && (
              <span className={`text-[10px] uppercase tracking-wider ${metaClass}`}>
                {cartridge}
              </span>
            )}
          </div>
          {currentStage && (
            <StageStrip currentStage={currentStage} isDark={isDark} />
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          {createdAt && (
            <span className={`text-[10px] ${metaClass}`}>
              {new Date(createdAt).toLocaleDateString()}
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${metaClass} ${
              collapsed ? "" : "rotate-180"
            }`}
          />
        </div>
      </button>

      {!collapsed && <div className="p-3 space-y-2">{children}</div>}
    </div>
  );
}
