"use client";

/**
 * ConstitutionalVideoCreatorFlow — the creator-facing entry point for the
 * Constitutional Video experience + the "Constitutional Video + Integrated
 * Artefacts" bundle (2026-07-19).
 *
 * Mounted in the ComposerStudio → Workflows tab beside the video+article flow.
 * A thin, self-contained launcher: a plain-language card that expands into the
 * shared ConstitutionalVideoSkillRunner. A toggle switches between the
 * standalone video and the coherent bundle (video + companion article from one
 * substrate). Holding its own open/closed state keeps ComposerStudio's state
 * tree untouched; reusing the runner means ONE generation path.
 */

import { useState } from "react";
import { ScrollText, ChevronDown, ChevronUp } from "lucide-react";
import ConstitutionalVideoSkillRunner from "./ConstitutionalVideoSkillRunner";

export default function ConstitutionalVideoCreatorFlow() {
  const [open, setOpen] = useState(false);
  const [bundle, setBundle] = useState(false);

  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Guided Creator Flow
      </span>
      <div className="rounded-lg border border-violet-500/25 bg-violet-500/5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left"
          aria-expanded={open}
        >
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-300">
              <ScrollText className="h-3.5 w-3.5 shrink-0" />
              <span>Constitutional Video</span>
              <span className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-300">
                AgentiQ native
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              A blank canvas bound by the constitutional grammar. Say what the video is about; the skill
              supplies the rules — 12-second micro-films, one constitutional threshold per segment, a
              threshold-crossing CTA, and full voiceover. 24/36/48 seconds.
            </p>
          </div>
          <span className="shrink-0 rounded-md border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-[11px] text-violet-300">
            {open ? (
              <span className="inline-flex items-center gap-1">Hide <ChevronUp className="h-3 w-3" /></span>
            ) : (
              <span className="inline-flex items-center gap-1">Open creator flow <ChevronDown className="h-3 w-3" /></span>
            )}
          </span>
        </button>
        {open && (
          <div className="border-t border-violet-500/20 px-3 py-4 space-y-3">
            <label className="flex items-center gap-2 text-[11px] text-slate-300">
              <input type="checkbox" checked={bundle} onChange={(e) => setBundle(e.target.checked)} />
              Integrated artefacts bundle (also generate a companion article + coherence score)
            </label>
            <ConstitutionalVideoSkillRunner audience="creator" bundle={bundle} />
          </div>
        )}
      </div>
    </div>
  );
}
