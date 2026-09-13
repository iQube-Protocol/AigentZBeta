"use client";

/**
 * Shared presentation primitives for the Constitutional Risk Flow panel
 * (Use Case Zero build-order item 10a). Mirrors
 * `components/moneypenny/bankr/bankrSurfaceKit.tsx`'s SHAPE and SLATE
 * STYLING exactly (CLAUDE.md "Canonical Surface Styling" is PARAMOUNT —
 * `bg-slate-900/40`, `border-slate-800`, no white hairlines) — but is NOT a
 * re-export of it: Bankr's kit is a token-launch-domain surface, and this is
 * a different domain (the Vela underwriting chain), so this file writes its
 * own small, parallel primitives rather than importing Bankr's by name into
 * a non-Bankr surface (that would be domain-confusing naming).
 *
 * Every component in `ConstitutionalRiskFlowPanel.tsx` imports from here
 * rather than hand-rolling its own badge/section/capsule chrome.
 */

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import type { ConstitutionalRiskFlowStepState } from "@/services/vela/velaUnderwritingChainProjection";

// ── Section / capsule chrome ────────────────────────────────────────────────

export function RiskFlowSection({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: ReactNode;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border p-3 ${
        tone === "warning" ? "border-amber-800/50 bg-amber-500/5" : "border-slate-800 bg-slate-900/40"
      }`}
    >
      <h4 className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</h4>
      {children}
    </div>
  );
}

/** Expandable capsule — click the header to expand/collapse. Plain local
 *  state, no external accordion dependency (checked `components/ui/` first:
 *  no accordion/disclosure primitive exists there today — CLAUDE.md File and
 *  Component Discipline). */
export function RiskFlowCapsule({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          )}
          <span className="text-sm font-medium text-slate-200">{title}</span>
        </span>
        {badge}
      </button>
      {open && <div className="space-y-2 border-t border-slate-800 px-3 py-3">{children}</div>}
    </div>
  );
}

// ── Step-state chip vocabulary (derived STRICTLY from the service's own
//    ConstitutionalRiskFlowStepState — never invented at render time) ──────

const STEP_STATE_META: Record<ConstitutionalRiskFlowStepState, { label: string; className: string }> = {
  not_started: { label: "Not started", className: "border-slate-700 bg-slate-800/60 text-slate-400" },
  in_progress: { label: "In progress", className: "border-sky-700/60 bg-sky-500/10 text-sky-200" },
  blocked: { label: "Blocked", className: "border-rose-700/60 bg-rose-500/10 text-rose-200" },
  unresolved: { label: "Unresolved", className: "border-amber-700/60 bg-amber-500/10 text-amber-200" },
  complete: { label: "Complete", className: "border-emerald-700/60 bg-emerald-500/10 text-emerald-200" },
};

export function RiskFlowStepChip({
  state,
  label,
}: {
  state: ConstitutionalRiskFlowStepState;
  /** Overrides the default state label (e.g. "ADMITTED" instead of
   *  "Complete") — the underlying colour/tone still derives strictly from
   *  `state`, never from the override text. */
  label?: string;
}) {
  const meta = STEP_STATE_META[state];
  return (
    <span className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
      {label ?? meta.label}
    </span>
  );
}

// ── Generic tone badge (neutral/good/warn/bad/info) ─────────────────────────

export function RiskFlowBadge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "good" | "warn" | "bad" | "info" }) {
  const toneClass = {
    neutral: "border-slate-700 bg-slate-800/60 text-slate-300",
    good: "border-emerald-700/60 bg-emerald-500/10 text-emerald-200",
    warn: "border-amber-700/60 bg-amber-500/10 text-amber-200",
    bad: "border-rose-700/60 bg-rose-500/10 text-rose-200",
    info: "border-sky-700/60 bg-sky-500/10 text-sky-200",
  }[tone];
  return <span className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneClass}`}>{label}</span>;
}

// ── Provider-mode badge (SIMULATED amber / LIVE emerald — mirrors
//    bankrSurfaceKit.tsx's BankrModeBadge tone vocabulary exactly, per the
//    brief's own instruction, without importing that Bankr-named component
//    into this non-Bankr surface). ───────────────────────────────────────────

export type RiskFlowProviderMode = "SIMULATED" | "LIVE" | "unavailable";

/** Derives the honest SIMULATED/LIVE/unavailable mode from a nullable
 *  `providerMode` field already carried on the evidence — never inferred
 *  beyond this one named function, mirroring `classifyBankrMode`'s naming
 *  spirit under its own, non-Bankr name. */
export function classifyProviderMode(providerMode: "SIMULATED" | "LIVE" | null | undefined): RiskFlowProviderMode {
  if (providerMode === "LIVE") return "LIVE";
  if (providerMode === "SIMULATED") return "SIMULATED";
  return "unavailable";
}

const PROVIDER_MODE_META: Record<RiskFlowProviderMode, { label: string; className: string }> = {
  SIMULATED: { label: "Simulated", className: "border-amber-700/60 bg-amber-500/10 text-amber-200" },
  LIVE: { label: "Live", className: "border-emerald-700/60 bg-emerald-500/10 text-emerald-200" },
  unavailable: { label: "Unavailable", className: "border-slate-700 bg-slate-800/60 text-slate-400" },
};

export function RiskFlowProviderModeBadge({ mode }: { mode: RiskFlowProviderMode }) {
  const meta = PROVIDER_MODE_META[mode];
  return <span className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>{meta.label}</span>;
}

export function RiskFlowEmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950 px-3 py-4 text-center text-xs text-slate-500">
      {children}
    </div>
  );
}

export function RiskFlowErrorNote({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-1.5 rounded border border-rose-500/40 bg-rose-500/10 px-2.5 py-2 text-xs text-rose-300">
      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      {message}
    </div>
  );
}

export function RiskFlowFieldRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-200">{value}</span>
    </div>
  );
}
