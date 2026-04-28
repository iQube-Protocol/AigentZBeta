"use client";

import React from "react";
import { X, ArrowRight, Sparkles } from "lucide-react";
import type { RuntimeTakeoverManifest } from "@/types/runtimeTakeover";

const THEME_STYLES: Record<string, { border: string; bg: string; accent: string; badge: string }> = {
  patronage:    { border: "border-amber-500/30",   bg: "bg-amber-950/30",   accent: "text-amber-300",  badge: "bg-amber-500/15 text-amber-300 border-amber-500/25" },
  discovery:    { border: "border-cyan-500/30",    bg: "bg-cyan-950/30",    accent: "text-cyan-300",   badge: "bg-cyan-500/15 text-cyan-300 border-cyan-500/25" },
  contributor:  { border: "border-violet-500/30",  bg: "bg-violet-950/30",  accent: "text-violet-300", badge: "bg-violet-500/15 text-violet-300 border-violet-500/25" },
  stewardship:  { border: "border-emerald-500/30", bg: "bg-emerald-950/30", accent: "text-emerald-300",badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" },
  collector:    { border: "border-rose-500/30",    bg: "bg-rose-950/30",    accent: "text-rose-300",   badge: "bg-rose-500/15 text-rose-300 border-rose-500/25" },
  sovereign:    { border: "border-slate-400/30",   bg: "bg-slate-800/40",   accent: "text-slate-200",  badge: "bg-slate-700/50 text-slate-300 border-slate-600/30" },
};

// Cartridge-context overrides — take precedence over theme-based styling.
// KNYT → amber glass; metaMe → coral/rose glass.
const CONTEXT_STYLES: Record<string, { border: string; bg: string; accent: string; badge: string }> = {
  knyt:   { border: "border-amber-500/30",  bg: "bg-amber-950/30 backdrop-blur-sm",  accent: "text-amber-300",  badge: "bg-amber-500/15 text-amber-300 border-amber-500/30 backdrop-blur-sm" },
  metame: { border: "border-emerald-500/30", bg: "bg-emerald-950/30 backdrop-blur-sm", accent: "text-emerald-300", badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 backdrop-blur-sm" },
};

const DEFAULT_STYLE = THEME_STYLES.discovery;

interface RuntimeTakeoverBannerProps {
  manifest: RuntimeTakeoverManifest;
  cartridgeDisplayName?: string;
  /** When set, overrides theme-based colour with the cartridge brand colour (amber=KNYT, rose=metaMe). */
  cartridgeContext?: 'knyt' | 'metame';
  onDismiss?: () => void;
  onNextBestAction?: (target: string, targetType: string) => void;
  className?: string;
}

export function RuntimeTakeoverBanner({
  manifest,
  cartridgeDisplayName,
  cartridgeContext,
  onDismiss,
  onNextBestAction,
  className = "",
}: RuntimeTakeoverBannerProps) {
  const style = (cartridgeContext ? CONTEXT_STYLES[cartridgeContext] : null) ?? THEME_STYLES[manifest.theme ?? ""] ?? DEFAULT_STYLE;

  return (
    <div
      className={`rounded-xl border ${style.border} ${style.bg} px-4 py-3 flex items-start gap-3 ${className}`}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <Sparkles className={`h-4 w-4 ${style.accent}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Source badge + personalised indicator */}
        <div className="flex items-center gap-2 flex-wrap">
          {cartridgeDisplayName && (
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${style.badge}`}>
              {cartridgeDisplayName}
            </span>
          )}
          {manifest.isPersonalised && (
            <span className="text-[10px] text-slate-500 uppercase tracking-wide">
              personalised
            </span>
          )}
        </div>

        {/* Welcome narrative */}
        <p className="text-sm text-slate-200 leading-snug">
          {manifest.welcomeNarrative}
        </p>

        {/* Next best action */}
        {manifest.nextBestAction && onNextBestAction && (
          <button
            type="button"
            onClick={() =>
              onNextBestAction(
                manifest.nextBestAction!.target,
                manifest.nextBestAction!.targetType,
              )
            }
            className={`inline-flex items-center gap-1.5 text-xs font-medium ${style.accent} hover:opacity-80 transition-opacity`}
          >
            {manifest.nextBestAction.label}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Dismiss */}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded text-slate-600 hover:text-slate-400 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
