"use client";

import React, { useState } from "react";
import { Kn0wdZTab } from "./Kn0wdZTab";
import { AgentiqCartridgeTab } from "./AgentiqCartridgeTab";
import { FeaturesTab } from "./FeaturesTab";

type SubTab = "dev-resources" | "updates" | "qriptopian";

const SUBTABS: { id: SubTab; label: string }[] = [
  { id: "dev-resources", label: "Dev Resources" },
  { id: "updates",       label: "Updates" },
  { id: "qriptopian",    label: "Qriptopian" },
];

interface Props {
  personaId?: string;
  isAdmin?: boolean;
}

export function AgentiqOSCommunityTab({ personaId, isAdmin }: Props) {
  const [active, setActive] = useState<SubTab>("dev-resources");

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
        {active === "dev-resources" && <Kn0wdZTab personaId={personaId} />}
        {active === "updates"       && <AgentiqCartridgeTab packId="agentiq" collectionId="col_updates" />}
        {active === "qriptopian"    && <FeaturesTab />}
      </div>
    </div>
  );
}
