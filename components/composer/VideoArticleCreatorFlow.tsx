"use client";

/**
 * VideoArticleCreatorFlow — the marketer/creator-facing entry point for the
 * 24-second video + article skill (pack 2026-07-15 remedy #1: "Add a
 * marketer/creator-facing UI surface (form or guided flow) ... that exposes
 * video+article generation controls, confirming UX delivery for that persona").
 *
 * Mounted in the ComposerStudio → Workflows tab, the surface marketers and
 * creators actually work in. It is a thin, self-contained launcher: a
 * plain-language card that expands into the shared VideoArticleSkillRunner in
 * its `audience="creator"` mode (no invariant/experiment vocabulary). Holding
 * its own open/closed state keeps ComposerStudio's giant state tree untouched,
 * and reusing the runner means ONE generation path — not a forked creator
 * implementation (Extend, Don't Duplicate).
 */

import { useState } from "react";
import { Clapperboard, ChevronDown, ChevronUp } from "lucide-react";
import VideoArticleSkillRunner from "./VideoArticleSkillRunner";

export default function VideoArticleCreatorFlow() {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Guided Creator Flow
      </span>
      <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left"
          aria-expanded={open}
        >
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
              <Clapperboard className="h-3.5 w-3.5 shrink-0" />
              <span>24-Second Video + Article</span>
              <span className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-300">
                AgentiQ native
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              Pick a theme, name your piece, and generate a 24-second video with a matching
              companion article — both from the same brief. Preview and read them here before publishing.
            </p>
          </div>
          <span className="shrink-0 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300">
            {open ? (
              <span className="inline-flex items-center gap-1">Hide <ChevronUp className="h-3 w-3" /></span>
            ) : (
              <span className="inline-flex items-center gap-1">Open creator flow <ChevronDown className="h-3 w-3" /></span>
            )}
          </span>
        </button>
        {open && (
          <div className="border-t border-emerald-500/20 px-3 py-4">
            <VideoArticleSkillRunner audience="creator" />
          </div>
        )}
      </div>
    </div>
  );
}
