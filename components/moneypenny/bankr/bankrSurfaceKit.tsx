"use client";

/**
 * Shared presentation primitives for the Bankr token-launch atomic surfaces
 * (components/moneypenny/bankr/*). Slate house style only (CLAUDE.md
 * "Canonical Surface Styling") — bg-slate-900/40, border-slate-800, no white
 * hairlines. Every surface in this directory imports from here rather than
 * hand-rolling its own badge/section chrome.
 */

import type { ReactNode } from "react";

export function BankrSection({ title, children, tone = "default" }: { title: string; children: ReactNode; tone?: "default" | "warning" }) {
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

export type BankrMode = "live" | "simulated" | "unavailable";

/** Derives the honest live/simulated/unavailable mode from the pieces every
 *  Bankr payload already carries — never inferred silently beyond this one
 *  named function, so every surface classifies the same payload the same
 *  way. */
export function classifyBankrMode(opts: { configured?: boolean; simulated?: boolean; missing?: boolean }): BankrMode {
  if (opts.missing) return "unavailable";
  if (opts.simulated || opts.configured === false) return "simulated";
  return "live";
}

const MODE_META: Record<BankrMode, { label: string; className: string }> = {
  live: { label: "Live", className: "border-emerald-700/60 bg-emerald-500/10 text-emerald-200" },
  simulated: { label: "Simulated", className: "border-amber-700/60 bg-amber-500/10 text-amber-200" },
  unavailable: { label: "Unavailable", className: "border-slate-700 bg-slate-800/60 text-slate-400" },
};

export function BankrModeBadge({ mode }: { mode: BankrMode }) {
  const meta = MODE_META[mode];
  return <span className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>{meta.label}</span>;
}

export function BankrBadge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "good" | "warn" | "bad" | "info" }) {
  const toneClass = {
    neutral: "border-slate-700 bg-slate-800/60 text-slate-300",
    good: "border-emerald-700/60 bg-emerald-500/10 text-emerald-200",
    warn: "border-amber-700/60 bg-amber-500/10 text-amber-200",
    bad: "border-rose-700/60 bg-rose-500/10 text-rose-200",
    info: "border-sky-700/60 bg-sky-500/10 text-sky-200",
  }[tone];
  return <span className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneClass}`}>{label}</span>;
}

export function BankrProvenance({ sourceUrl, retrievedAt }: { sourceUrl?: string | null; retrievedAt?: string | null }) {
  if (!sourceUrl && !retrievedAt) return null;
  return (
    <p className="text-[11px] text-slate-500">
      {retrievedAt && <>retrieved {new Date(retrievedAt).toLocaleString()}</>}
      {retrievedAt && sourceUrl && " · "}
      {sourceUrl && (
        <a href={sourceUrl} target="_blank" rel="noreferrer" className="underline hover:text-slate-300">
          source
        </a>
      )}
    </p>
  );
}

export function BankrActionButton({
  label,
  onClick,
  busy,
  disabled,
  tone = "default",
}: {
  label: string;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  tone?: "default" | "primary" | "danger";
}) {
  const toneClass = {
    default: "border-slate-700 text-slate-200 hover:border-violet-500/50",
    primary: "border-violet-500/70 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20",
    danger: "border-rose-700/60 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs disabled:opacity-50 ${toneClass}`}
    >
      {busy && <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {label}
    </button>
  );
}

export function BankrErrorNote({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return <p className="text-xs text-rose-300">{message}</p>;
}
