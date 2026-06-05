"use client";

import React from "react";
import { ChevronDown } from "lucide-react";

export type IntentStage =
  | "cta_issued"
  | "specialist_consulted"
  | "queued"
  | "approved"
  | "acted"
  | "complete";

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
  const currentIdx = STAGE_ORDER.indexOf(currentStage);
  return (
    <div className="flex items-center gap-0 flex-wrap">
      {STAGE_STEPS.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
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

export interface GenesisCapsuleProps {
  label: string;
  cartridge?: string;
  createdAt?: string;
  currentStage?: IntentStage;
  isDark?: boolean;
  defaultCollapsed?: boolean;
  receiptCount?: number;
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
  onExpandChange,
  children,
}: GenesisCapsuleProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    onExpandChange?.(!next);
  };

  return (
    <div
      className={`rounded-lg border overflow-hidden ${
        isDark
          ? "border-emerald-500/30 bg-emerald-950/10"
          : "border-emerald-300 bg-emerald-50/20"
      }`}
    >
      {/* Capsule header — click to expand/collapse */}
      <button
        type="button"
        onClick={toggle}
        className={`w-full flex items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors ${
          isDark
            ? "bg-emerald-950/30 hover:bg-emerald-950/50 border-b border-emerald-500/20"
            : "bg-emerald-50 hover:bg-emerald-100 border-b border-emerald-200"
        } ${collapsed ? "border-b-0" : ""}`}
      >
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs font-medium truncate ${
                isDark ? "text-emerald-100" : "text-emerald-900"
              }`}
            >
              {label}
            </span>
            {cartridge && (
              <span
                className={`text-[10px] uppercase tracking-wider ${
                  isDark ? "text-emerald-400/60" : "text-emerald-600"
                }`}
              >
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
            <span
              className={`text-[10px] ${
                isDark ? "text-slate-500" : "text-slate-400"
              }`}
            >
              {new Date(createdAt).toLocaleDateString()}
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${
              isDark ? "text-emerald-400/60" : "text-emerald-600"
            } ${collapsed ? "" : "rotate-180"}`}
          />
        </div>
      </button>

      {/* Capsule body */}
      {!collapsed && (
        <div className="p-3 space-y-2">{children}</div>
      )}
    </div>
  );
}
