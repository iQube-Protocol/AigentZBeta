"use client";

/**
 * IqubeContextDisclosure — the "Using: …" / "Not shared: …" strip per
 * PRD v0.2 §9.2 (Brief Card → Required iQube display).
 *
 * Renders the canonical iQube-discipline disclosure that every Aigent Me
 * surface must show before it returns context-bearing output. Replaces
 * the inline copy that would otherwise be duplicated across the welcome
 * surface, the Brief Card, the Move-Forward card, the Specialist Request
 * Card, the Approval Card, and the Activity Receipt Card.
 *
 * The component is *purely informational* — it does not gate render. It
 * makes visible the iQube context the route layer used. Surfaces opt in
 * by passing the iQubes they actually consulted.
 */

import React from "react";
import { Layers, EyeOff } from "lucide-react";

export type IqubeKind =
  | "PersonaQube"
  | "ExperienceQube"
  | "IntentQube"
  | "CohortQube";

interface Props {
  /** Which iQubes the calling surface used to produce its output. */
  using: IqubeKind[];
  /** Categories of context that are explicitly NOT shared. */
  notShared?: string[];
  theme?: "light" | "dark";
  className?: string;
}

const DEFAULT_NOT_SHARED = [
  "confidential strategy notes",
  "private investor data",
  "unreleased IP",
];

export function IqubeContextDisclosure({
  using,
  notShared,
  theme = "dark",
  className = "",
}: Props) {
  const isDark = theme === "dark";
  // metaMe brand secondary — emerald — appears on every persistent iQube
  // disclosure strip across the runtime. Keeps violet as the welcome /
  // ExperienceModel primary while emerald grounds the "this is metaMe" rail.
  const surfaceClass = isDark
    ? "bg-emerald-500/5 border-emerald-500/30 text-slate-300"
    : "bg-emerald-50 border-emerald-200 text-slate-700";
  const accentClass = isDark ? "text-emerald-300" : "text-emerald-700";
  const mutedClass = isDark ? "text-slate-500" : "text-slate-500";

  const notSharedList =
    notShared && notShared.length > 0 ? notShared : DEFAULT_NOT_SHARED;

  return (
    <div
      className={`rounded-md border px-3 py-2 text-xs ${surfaceClass} ${className}`}
    >
      <div className="flex items-start gap-2">
        <Layers className={`w-3 h-3 mt-0.5 shrink-0 ${accentClass}`} />
        <div className="flex-1 min-w-0">
          <span className={accentClass}>Using:</span>{" "}
          <span>{using.join(", ")}</span>
          {notSharedList.length > 0 && (
            <>
              <span className={mutedClass}> · </span>
              <EyeOff className={`w-3 h-3 inline-block mr-1 ${mutedClass}`} />
              <span className={mutedClass}>Not shared:</span>{" "}
              <span className={mutedClass}>
                {notSharedList.join(" / ")} unless approved
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default IqubeContextDisclosure;
