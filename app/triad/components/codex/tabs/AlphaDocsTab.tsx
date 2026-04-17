"use client";

import React, { useState } from "react";
import { AgentiqCartridgeTab } from "./AgentiqCartridgeTab";

type SubTab = "venture-lab" | "agentiq" | "agentiq-os" | "programme";

const SUB_TABS: { id: SubTab; label: string; packId: string; collectionId: string; defaultPath?: string }[] = [
  {
    id: "venture-lab",
    label: "Venture Labs α",
    packId: "alpha-knyt",
    collectionId: "col_venture_lab",
    defaultPath: "items/01-alpha-program-positioning.md",
  },
  {
    id: "agentiq",
    label: "AgentiQ α",
    packId: "agentiq",
    collectionId: "col_alpha_program",
    defaultPath: "items/ALPHA_PROGRAM_OVERVIEW.md",
  },
  {
    id: "agentiq-os",
    label: "AgentiQ OS α",
    packId: "agentiq",
    collectionId: "col_operators",
  },
  {
    id: "programme",
    label: "Programme α",
    packId: "alpha-knyt",
    collectionId: "col_relationship_builder_alpha",
    defaultPath: "items/24-relationship-builder-overview.md",
  },
];

export function AlphaDocsTab() {
  const [active, setActive] = useState<SubTab>("venture-lab");
  const current = SUB_TABS.find((t) => t.id === active)!;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 px-3 pt-3 pb-0 border-b border-slate-800/60 flex-shrink-0">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`px-3 py-1.5 text-[11px] font-medium rounded-t-md transition-colors whitespace-nowrap ${
              active === t.id
                ? "bg-slate-800 text-amber-400 border border-b-transparent border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <AgentiqCartridgeTab
          key={current.id}
          packId={current.packId}
          collectionId={current.collectionId}
          defaultPath={current.defaultPath}
        />
      </div>
    </div>
  );
}
