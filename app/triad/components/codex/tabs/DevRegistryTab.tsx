"use client";

import React from "react";
import { Database } from "lucide-react";
import { IngestionFactoryPanel } from "@/components/registry/IngestionFactoryPanel";

interface DevRegistryTabProps {
  personaId?: string;
}

export function DevRegistryTab({ personaId: _personaId }: DevRegistryTabProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start gap-4 px-6 pt-6 pb-4 flex-shrink-0">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-violet-500/20 border border-violet-500/30">
          <Database className="h-6 w-6 text-violet-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">AgentiQ OS Registry</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Browse published assets and submit your own SkillQubes, WorkflowQubes, ConnectorQubes, and AigentQubes.
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <IngestionFactoryPanel />
      </div>
    </div>
  );
}
