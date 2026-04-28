"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Shield, BookOpen, Beaker } from "lucide-react";
import { AgentiqCartridgeTab } from "./AgentiqCartridgeTab";

const BoundedDelegationTab = dynamic(
  () => import("./BoundedDelegationTab").then((m) => ({ default: m.BoundedDelegationTab })),
  { ssr: false },
);

interface RefAigentTabProps {
  personaId?: string;
}

export function RefAigentTab({ personaId }: RefAigentTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"docs" | "demo">("docs");

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start gap-4 px-6 pt-6">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-violet-500/20 border border-violet-500/30">
          <Shield className="h-6 w-6 text-violet-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Aigent Reference</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Bounded delegation protocol — how to grant agents authority that is sealed, time-limited, and audited.
          </p>
        </div>
      </div>

      <div className="flex gap-1 rounded-lg border border-slate-700/40 bg-slate-900/30 p-1 w-fit mx-6 mt-4 flex-shrink-0">
        {(["docs", "demo"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveSubTab(tab)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${
              activeSubTab === tab
                ? "bg-violet-500/20 text-violet-200 border border-violet-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab === "docs" ? (
              <>
                <BookOpen className="h-3.5 w-3.5" />
                Docs
              </>
            ) : (
              <>
                <Beaker className="h-3.5 w-3.5" />
                Ref Demo
              </>
            )}
          </button>
        ))}
      </div>

      {activeSubTab === "docs" && (
        <div className="flex-1 overflow-auto">
          <AgentiqCartridgeTab
            packId="agentiq-os"
            collectionId="col_delegation"
            defaultPath="items/bounded-delegation.md"
          />
        </div>
      )}

      {activeSubTab === "demo" && (
        <div className="flex-1 overflow-auto">
          <BoundedDelegationTab personaId={personaId} />
        </div>
      )}
    </div>
  );
}
