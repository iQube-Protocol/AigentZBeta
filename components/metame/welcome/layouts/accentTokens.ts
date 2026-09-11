"use client";

/**
 * Shared accent + glass-fill tokens for Phase 2 right-pane layouts.
 *
 * Lives in one place so every layout draws from the same palette.
 * Designed to compose cleanly with the existing glass / translucent
 * style guide — soft border + translucent fill + optional
 * `backdrop-blur-sm` per chip / card.
 *
 * Accent semantics (handbook §8a):
 *   - violet  → primary aigentMe accent; reserved for the strongest
 *               action emphasis (primary CTAs, Recommended rows).
 *   - cyan    → measurement / data accent (KPIs, metrics).
 *   - emerald → active-work / momentum accent (in-progress, active
 *               campaigns, KNYT cartridge).
 *   - amber   → caution / pending / approval-required.
 *   - rose    → error / blocked / failed.
 *   - slate   → neutral / muted / informational.
 */

export type Accent = "violet" | "cyan" | "emerald" | "amber" | "rose" | "slate";

export interface AccentToken {
  /** Border class for the chip / card. */
  border: string;
  /** Soft translucent fill — base/empty state. */
  fillSoft: string;
  /** Stronger translucent fill — active / non-zero state. */
  fillStrong: string;
  /** Text color used for the chip's value / accent label. */
  text: string;
  /** Eyebrow / section heading color. */
  eyebrow: string;
}

const ACCENTS: Record<Accent, { dark: AccentToken; light: AccentToken }> = {
  violet: {
    dark:  { border: "border-violet-500/40", fillSoft: "bg-violet-500/5", fillStrong: "bg-violet-500/10", text: "text-violet-200", eyebrow: "text-violet-300" },
    light: { border: "border-violet-300",    fillSoft: "bg-violet-50",    fillStrong: "bg-violet-100/70", text: "text-violet-800", eyebrow: "text-violet-700" },
  },
  cyan: {
    dark:  { border: "border-cyan-500/30",   fillSoft: "bg-cyan-500/5",   fillStrong: "bg-cyan-500/10",   text: "text-cyan-200",   eyebrow: "text-cyan-300/90" },
    light: { border: "border-cyan-300",      fillSoft: "bg-cyan-50",      fillStrong: "bg-cyan-100/70",   text: "text-cyan-800",   eyebrow: "text-cyan-700" },
  },
  emerald: {
    dark:  { border: "border-emerald-500/30", fillSoft: "bg-emerald-500/5", fillStrong: "bg-emerald-500/10", text: "text-emerald-200", eyebrow: "text-emerald-300/90" },
    light: { border: "border-emerald-300",    fillSoft: "bg-emerald-50",    fillStrong: "bg-emerald-100/70", text: "text-emerald-800", eyebrow: "text-emerald-700" },
  },
  amber: {
    dark:  { border: "border-amber-500/40", fillSoft: "bg-amber-500/5", fillStrong: "bg-amber-500/10", text: "text-amber-200", eyebrow: "text-amber-300" },
    light: { border: "border-amber-300",    fillSoft: "bg-amber-50",    fillStrong: "bg-amber-100/70", text: "text-amber-800", eyebrow: "text-amber-700" },
  },
  rose: {
    dark:  { border: "border-rose-500/40", fillSoft: "bg-rose-500/5", fillStrong: "bg-rose-500/10", text: "text-rose-200", eyebrow: "text-rose-300" },
    light: { border: "border-rose-300",    fillSoft: "bg-rose-50",    fillStrong: "bg-rose-100/70", text: "text-rose-800", eyebrow: "text-rose-700" },
  },
  slate: {
    dark:  { border: "border-slate-700/60", fillSoft: "bg-slate-900/40", fillStrong: "bg-slate-900/60", text: "text-slate-200", eyebrow: "text-slate-400" },
    light: { border: "border-slate-200",    fillSoft: "bg-slate-50",     fillStrong: "bg-slate-100",     text: "text-slate-800", eyebrow: "text-slate-600" },
  },
};

export function accent(accentId: Accent, theme: "light" | "dark" = "dark"): AccentToken {
  return ACCENTS[accentId][theme === "dark" ? "dark" : "light"];
}
