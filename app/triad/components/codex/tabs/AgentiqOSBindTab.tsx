"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";

const DevPersonaTab = dynamic(
  () => import("./DevPersonaTab").then(m => ({ default: m.DevPersonaTab }))
);
const BoundedDelegationTab = dynamic(
  () => import("./BoundedDelegationTab").then(m => ({ default: m.BoundedDelegationTab }))
);

type SubTab = "persona" | "delegation";

const SUBTABS: { id: SubTab; label: string }[] = [
  { id: "persona",    label: "Persona" },
  { id: "delegation", label: "Bound Delegates" },
];

interface Props {
  personaId?: string;
}

export function AgentiqOSBindTab({ personaId }: Props) {
  const [active, setActive] = useState<SubTab>("persona");

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
        {active === "persona"    && <DevPersonaTab personaId={personaId} />}
        {active === "delegation" && <BoundedDelegationTab personaId={personaId} />}
      </div>
    </div>
  );
}
