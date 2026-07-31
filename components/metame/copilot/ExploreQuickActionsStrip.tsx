"use client";

/**
 * ExploreQuickActionsStrip — dev-tool quick links rendered at the bottom
 * of the aigentZ Development Command Center right pane. The dev-surface
 * sibling of ComposeQuickActionsStrip: same chrome, same eyebrow → Clear
 * flip, same suggested-pulse contract — but the chips open dev viewports
 * (Terminal / GitHub / DevTools / Linear) instead of compose modals.
 *
 * Suggested-highlight contract: when the chat copilot's last turn returned
 * a layout suggestion targeting one of these tools (or upload/download),
 * the parent sets `suggested[<id>] = true`. The matching chip pulses
 * emerald and scrolls itself into view. The idle "EXPLORE" eyebrow flips
 * to a clickable Clear while any chip is pulsing.
 */

import React, { useEffect, useRef } from "react";
import { Terminal, GitBranch, Wrench, BarChart3, Download, Upload, Route } from "lucide-react";

export type ExploreToolId = "terminal" | "github" | "devtools" | "linear" | "model-routes";

export type ExploreSuggestionMap = Partial<
  Record<ExploreToolId | "upload" | "download", boolean>
>;

interface Props {
  onOpen: (tool: ExploreToolId) => void;
  onDownloadsOpen?: () => void;
  onUploadOpen?: () => void;
  theme?: "light" | "dark";
  /** Which tool viewport is currently mounted in the right pane — gets the active ring. */
  activeToolId?: string | null;
  /**
   * Per-chip highlight state — driven by chat-copilot layout suggestions.
   * Matching chips get an emerald ring + animate-pulse and scroll into
   * view on mount-change.
   */
  suggested?: ExploreSuggestionMap;
  /**
   * Fired when the operator clicks the "Clear" badge that replaces the
   * idle "EXPLORE" eyebrow whenever any chip in this strip is pulsing.
   * Parent should wipe every explore-class suggestion so the strip
   * returns to neutral.
   */
  onClearSuggestions?: () => void;
}

const ACTIONS: Array<{ id: ExploreToolId; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { id: "terminal", label: "Terminal", Icon: Terminal },
  { id: "github",   label: "GitHub",   Icon: GitBranch },
  { id: "devtools", label: "DevTools", Icon: Wrench },
  { id: "linear",   label: "Linear",   Icon: BarChart3 },
  { id: "model-routes", label: "Model Routes", Icon: Route },
];

function highlightClass(isDark: boolean): string {
  return isDark
    ? "ring-2 ring-emerald-400/70 bg-emerald-500/15 text-emerald-100 animate-[pulse_2s_ease-in-out_infinite]"
    : "ring-2 ring-emerald-500 bg-emerald-50 text-emerald-800 animate-[pulse_2s_ease-in-out_infinite]";
}

export function ExploreQuickActionsStrip({
  onOpen,
  onDownloadsOpen,
  onUploadOpen,
  theme = "dark",
  activeToolId,
  suggested,
  onClearSuggestions,
}: Props) {
  const isDark = theme === "dark";
  const baseBtn = isDark
    ? "bg-slate-800/60 border-slate-700/60 text-slate-200 hover:border-emerald-500/60 hover:bg-slate-800"
    : "bg-white border-slate-200 text-slate-800 hover:border-emerald-400 hover:bg-slate-50";
  const activeBtn = isDark
    ? "bg-green-500/20 border-green-500/30 text-green-300"
    : "bg-green-50 border-green-400 text-green-700";

  const refs = useRef<Partial<Record<ExploreToolId | "upload" | "download", HTMLButtonElement | null>>>({});

  useEffect(() => {
    if (!suggested) return;
    const firstId = (Object.keys(suggested) as Array<ExploreToolId | "upload" | "download">).find(
      (k) => suggested[k] === true,
    );
    if (!firstId) return;
    const el = refs.current[firstId];
    if (!el) return;
    window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
  }, [suggested]);

  return (
    <div className={`flex flex-nowrap items-center gap-1.5 px-3 py-2 rounded-xl overflow-x-auto no-scrollbar ${isDark ? "bg-slate-950/60 ring-1 ring-white/10" : "bg-white/70 ring-1 ring-slate-200"} backdrop-blur-md shadow-lg`}>
      {(() => {
        const anySuggested = !!suggested && (Object.values(suggested) as Array<boolean | undefined>).some(Boolean);
        if (anySuggested && onClearSuggestions) {
          return (
            <button
              type="button"
              onClick={onClearSuggestions}
              title="Clear pulsing explore suggestions"
              aria-label="Clear pulsing explore suggestions"
              className={`text-[10px] uppercase tracking-wider mr-1 shrink-0 rounded px-1 py-0.5 transition-colors ${
                isDark
                  ? "text-emerald-300 hover:text-emerald-100 hover:bg-emerald-500/10"
                  : "text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100"
              }`}
            >
              Clear
            </button>
          );
        }
        return (
          <span className="text-[10px] uppercase tracking-wider mr-1 text-slate-500 shrink-0">
            Explore
          </span>
        );
      })()}
      {ACTIONS.map(({ id, label, Icon }) => {
        const isSuggested = suggested?.[id] === true;
        const isActive = activeToolId === id;
        return (
          <button
            key={id}
            ref={(el) => { refs.current[id] = el; }}
            type="button"
            onClick={() => onOpen(id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition shrink-0 ${
              isSuggested ? highlightClass(isDark) : isActive ? activeBtn : baseBtn
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        );
      })}
      {(onUploadOpen || onDownloadsOpen) && (
        <span className="mx-1 text-slate-600 select-none shrink-0">|</span>
      )}
      {onUploadOpen && (
        <button
          ref={(el) => { refs.current.upload = el; }}
          type="button"
          onClick={onUploadOpen}
          title="Upload docs / specs for aigentZ"
          aria-label="Upload docs / specs"
          className={`flex items-center justify-center p-1.5 rounded-md border transition shrink-0 ${
            suggested?.upload === true ? highlightClass(isDark) : baseBtn
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
        </button>
      )}
      {onDownloadsOpen && (
        <button
          ref={(el) => { refs.current.download = el; }}
          type="button"
          onClick={onDownloadsOpen}
          title="Downloads — implementation packages, context packs"
          aria-label="Downloads"
          className={`flex items-center justify-center p-1.5 rounded-md border transition shrink-0 ${
            suggested?.download === true ? highlightClass(isDark) : baseBtn
          }`}
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
