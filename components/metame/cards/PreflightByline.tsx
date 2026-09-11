"use client";

/**
 * PreflightByline — small framing affordance for Capability Gateway results.
 *
 * Renders the optional `preflightContext` returned by the four aigentMe
 * progression routes (brief / move-forward / venture-progress /
 * ask-agent) as:
 *   - an inline "aigentMe researched: …" byline (one line, truncated)
 *   - an optional "🔍 researched" info chip that reveals the full
 *     summary + an 8-char workOrder prefix in a tooltip footer for
 *     support correlation
 *
 * Identity safety: only `summary` and an 8-char prefix of `workOrderId`
 * are exposed to the DOM. `policyHash` and full IDs stay out of the
 * user-visible surface.
 */
import React from "react";
import { Search } from "lucide-react";
import type { PreflightContext } from "@/services/capabilities/preflight";

const SUMMARY_MAX = 140;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

export function PreflightByline({
  preflight,
  theme = "dark",
}: {
  preflight: PreflightContext | null | undefined;
  theme?: "light" | "dark";
}) {
  if (!preflight) return null;
  const isDark = theme === "dark";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const labelClass = isDark ? "text-violet-300/90" : "text-violet-700";
  return (
    <p
      className={`text-[11px] leading-snug ${mutedClass} flex items-baseline gap-1.5`}
      title={preflight.summary}
    >
      <Search className={`h-3 w-3 shrink-0 ${labelClass}`} aria-hidden />
      <span className="truncate">
        <span className={labelClass}>aigentMe researched:</span>{" "}
        {truncate(preflight.summary, SUMMARY_MAX)}
      </span>
    </p>
  );
}

export function PreflightChip({
  preflight,
  theme = "dark",
}: {
  preflight: PreflightContext | null | undefined;
  theme?: "light" | "dark";
}) {
  if (!preflight) return null;
  const isDark = theme === "dark";
  const cls = isDark
    ? "border-violet-500/30 bg-violet-500/10 text-violet-200"
    : "border-violet-300 bg-violet-50 text-violet-700";
  const tooltip =
    preflight.summary +
    `\n\nworkOrder=${preflight.workOrderId.slice(0, 8)}`;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] uppercase tracking-wider ${cls}`}
      title={tooltip}
    >
      <Search className="h-2.5 w-2.5" aria-hidden />
      researched
    </span>
  );
}

export default PreflightByline;
