"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";

const AgentiqCartridgeTab = dynamic(
  () => import("./AgentiqCartridgeTab").then(m => ({ default: m.AgentiqCartridgeTab }))
);
const AigentCOSTab = dynamic(
  () => import("./AigentCOSTab").then(m => ({ default: m.AigentCOSTab }))
);

type SubTab = "start-here" | "aigent-c";

const SUBTABS: { id: SubTab; label: string }[] = [
  { id: "start-here", label: "Start Here" },
  { id: "aigent-c",   label: "Aigent C" },
];

interface Props {
  personaId?: string;
}

export function AgentiqOSHomeTab({ personaId }: Props) {
  const [active, setActive] = useState<SubTab>("start-here");

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 border-b border-slate-800/60 bg-slate-900/40 px-4 py-2">
        <div className="flex gap-1">
          {SUBTABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActive(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                active === id
                  ? "bg-green-500/20 border border-green-500/30 text-green-300"
                  : "text-slate-400 hover:text-slate-300 border border-transparent"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {active === "start-here" && (
          <AgentiqCartridgeTab packId="agentiq-os" collectionId="col_start_here" />
        )}
        {active === "aigent-c" && (
          <AigentCOSTab />
        )}
      </div>
    </div>
  );
}
