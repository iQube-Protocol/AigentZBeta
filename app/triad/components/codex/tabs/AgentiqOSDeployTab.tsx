"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";

const AgentiQOSTab = dynamic(
  () => import("./AgentiQOSTab").then(m => ({ default: m.AgentiQOSTab }))
);
const DevRegistryTab = dynamic(
  () => import("./DevRegistryTab").then(m => ({ default: m.DevRegistryTab }))
);
const AgentiqCartridgeTab = dynamic(
  () => import("./AgentiqCartridgeTab").then(m => ({ default: m.AgentiqCartridgeTab }))
);
const NanOSBridgeTab = dynamic(
  () => import("./NanOSBridgeTab").then(m => ({ default: m.NanOSBridgeTab }))
);

type SubTab = "build-dashboard" | "ingestion-factory" | "codex" | "nanos-bridge";

const SUBTABS: { id: SubTab; label: string }[] = [
  { id: "build-dashboard",    label: "Build Dashboard" },
  { id: "ingestion-factory",  label: "Ingestion Factory" },
  { id: "codex",              label: "Codex" },
  { id: "nanos-bridge",       label: "nanOS Bridge" },
];

interface Props {
  personaId?: string;
  isAdmin?: boolean;
}

export function AgentiqOSDeployTab({ personaId, isAdmin }: Props) {
  const [active, setActive] = useState<SubTab>("build-dashboard");

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 border-b border-slate-800/60 bg-slate-900/40 px-4 py-2">
        <div className="flex gap-1 flex-wrap">
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
        {active === "build-dashboard"   && <AgentiQOSTab />}
        {active === "ingestion-factory" && <DevRegistryTab personaId={personaId} />}
        {active === "codex"             && <AgentiqCartridgeTab packId="agentiq-os" collectionId="col_codex" />}
        {active === "nanos-bridge"      && <NanOSBridgeTab />}
      </div>
    </div>
  );
}
