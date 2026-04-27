"use client";

import React, { useState } from "react";
import { AgentiqCartridgeTab } from "./AgentiqCartridgeTab";
import { RefRuntimeTab } from "./RefRuntimeTab";
import { RefStudioTab } from "./RefStudioTab";

type SubTab = "sdk-api" | "smarttriad" | "liquid-ui" | "runtime-ref" | "studio-ref";

const SUBTABS: { id: SubTab; label: string }[] = [
  { id: "sdk-api",      label: "SDK / API" },
  { id: "smarttriad",   label: "SmartTriad" },
  { id: "liquid-ui",    label: "Liquid UI" },
  { id: "runtime-ref",  label: "Runtime Ref" },
  { id: "studio-ref",   label: "Studio Ref" },
];

interface Props {
  personaId?: string;
}

export function AgentiqOSBuildTab({ personaId }: Props) {
  const [active, setActive] = useState<SubTab>("sdk-api");

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
        {active === "sdk-api"     && <AgentiqCartridgeTab packId="agentiq-os" collectionId="col_sdk_api" />}
        {active === "smarttriad"  && <AgentiqCartridgeTab packId="agentiq-os" collectionId="col_smarttriad" />}
        {active === "liquid-ui"   && <AgentiqCartridgeTab packId="agentiq-os" collectionId="col_liquid_ui" />}
        {active === "runtime-ref" && <RefRuntimeTab personaId={personaId} />}
        {active === "studio-ref"  && <RefStudioTab personaId={personaId} />}
      </div>
    </div>
  );
}
