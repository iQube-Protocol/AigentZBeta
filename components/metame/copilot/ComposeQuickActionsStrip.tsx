"use client";

/**
 * ComposeQuickActionsStrip — six compose actions rendered inside the
 * SmartTriadCopilotLayer footerContent slot on the aigentMe split tab.
 *
 * Each button flips a boolean on the parent split tab, opening the
 * corresponding compose modal. The modals themselves stay mounted at
 * the split tab root — this strip never owns modal state.
 *
 * Suggested-highlight contract: when the chat copilot's last turn returned
 * a layout suggestion, the parent sets `suggested[<kind>] = true` (or
 * `suggested.upload` / `suggested.download`). The matching chip pulses
 * emerald and scrolls itself into view if it's outside the carousel fold.
 * Click clears the suggestion via the parent's onOpen / onUploadOpen /
 * onDownloadsOpen handlers.
 */

import React, { useEffect, useRef } from "react";
import { Mail, Calendar, FileText, Sheet, Layout, Megaphone, Download, Upload } from "lucide-react";

export type ComposeKind = "gmail" | "event" | "doc" | "sheet" | "slides" | "marketa";

export type ComposeSuggestionMap = Partial<
  Record<ComposeKind | "upload" | "download", boolean>
>;

interface Props {
  onOpen: (kind: ComposeKind) => void;
  onDownloadsOpen?: () => void;
  onUploadOpen?: () => void;
  theme?: "light" | "dark";
  /**
   * Per-chip highlight state — driven by chat-copilot layout suggestions.
   * Matching chips get an emerald ring + animate-pulse and scroll into
   * view on mount-change.
   */
  suggested?: ComposeSuggestionMap;
}

const ACTIONS: Array<{ kind: ComposeKind; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { kind: "gmail",   label: "Email",   Icon: Mail },
  { kind: "event",   label: "Event",   Icon: Calendar },
  { kind: "doc",     label: "Doc",     Icon: FileText },
  { kind: "sheet",   label: "Sheet",   Icon: Sheet },
  { kind: "slides",  label: "Slides",  Icon: Layout },
  { kind: "marketa", label: "Marketa", Icon: Megaphone },
];

function highlightClass(isDark: boolean): string {
  return isDark
    ? "ring-2 ring-emerald-400/70 bg-emerald-500/15 text-emerald-100 animate-[pulse_2s_ease-in-out_infinite]"
    : "ring-2 ring-emerald-500 bg-emerald-50 text-emerald-800 animate-[pulse_2s_ease-in-out_infinite]";
}

export function ComposeQuickActionsStrip({
  onOpen,
  onDownloadsOpen,
  onUploadOpen,
  theme = "dark",
  suggested,
}: Props) {
  const isDark = theme === "dark";
  const baseBtn = isDark
    ? "bg-slate-800/60 border-slate-700/60 text-slate-200 hover:border-emerald-500/60 hover:bg-slate-800"
    : "bg-white border-slate-200 text-slate-800 hover:border-emerald-400 hover:bg-slate-50";

  // Refs for each suggestible chip so we can scrollIntoView the first
  // highlighted one when the suggestion map flips. Mirrors the way the
  // R/T dot strip stagger-pulses via shared per-element refs.
  const refs = useRef<Partial<Record<ComposeKind | "upload" | "download", HTMLButtonElement | null>>>({});

  useEffect(() => {
    if (!suggested) return;
    const firstId = (Object.keys(suggested) as Array<ComposeKind | "upload" | "download">).find(
      (k) => suggested[k] === true,
    );
    if (!firstId) return;
    const el = refs.current[firstId];
    if (!el) return;
    // Defer one frame so the parent strip layout settles before measuring.
    window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
  }, [suggested]);

  return (
    <div className={`flex flex-nowrap items-center gap-1.5 px-3 py-2 rounded-xl overflow-x-auto no-scrollbar ${isDark ? "bg-slate-950/60 ring-1 ring-white/10" : "bg-white/70 ring-1 ring-slate-200"} backdrop-blur-md shadow-lg`}>
      <span className="text-[10px] uppercase tracking-wider mr-1 text-slate-500 shrink-0">
        Compose
      </span>
      {ACTIONS.map(({ kind, label, Icon }) => {
        const isSuggested = suggested?.[kind] === true;
        return (
          <button
            key={kind}
            ref={(el) => { refs.current[kind] = el; }}
            type="button"
            onClick={() => onOpen(kind)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition shrink-0 ${
              isSuggested ? highlightClass(isDark) : baseBtn
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
          title="Upload docs / content for aigentMe"
          aria-label="Upload docs / content"
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
          title="Downloads for your off-platform agent (VentureQube schema, runbooks)"
          aria-label="Downloads for your off-platform agent"
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
