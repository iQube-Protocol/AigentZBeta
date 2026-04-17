"use client";

import React from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AgentiqCartridgeTab } from "./AgentiqCartridgeTab";

const VENTURE_LAB_PROGRAMME_URL =
  "/triad/embed/codex/venture-lab?tab=alpha-programme";

export function VentureLabAlphaTab() {
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Back link */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800/60 flex-shrink-0">
        <a
          href={VENTURE_LAB_PROGRAMME_URL}
          className="flex items-center gap-1.5 text-[11px] text-amber-400 hover:text-amber-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to KNYT Wheel — α Programme
          <ExternalLink className="h-3 w-3 opacity-60" />
        </a>
      </div>

      {/* Venture Lab α planning docs */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <AgentiqCartridgeTab
          packId="alpha-knyt"
          collectionId="col_venture_lab"
          defaultPath="items/01-alpha-program-positioning.md"
        />
      </div>
    </div>
  );
}
