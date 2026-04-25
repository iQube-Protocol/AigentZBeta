"use client";

/**
 * /runtime — Standalone KNYT Runtime Surface
 *
 * Full-shell version of the CartridgeRuntimeTemplate for users who have set
 * KNYT as their active runtime experience context in metaMe. Provides the
 * same reactive, streaming surface as the in-cartridge Runtime tab, but
 * promoted to a first-class shell route with full CopilotKit/AG-UI access.
 *
 * URL params:
 *   ?personaId=<id>  — persona whose journey state to load
 */

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SmartTriadProvider } from "@/app/components/content";
import { SmartTriadSurfaces } from "@/app/components/content/SmartTriadSurfaces";
import { CartridgeRuntimeTemplate } from "@/app/triad/components/codex/liquidTemplates/CartridgeRuntimeTemplate";

const KNYT_RUNTIME_CONFIG = {
  cartridgeSlug: "knyt-codex",
  worldLabel: "KNYT Cartridge",
  livingCanonEndpoint: "/api/codex/knyt/living-canon",
  dataSource: "/api/runtime/knyt-state",
  patronageAxis: [
    "OutsideOrder", "Acolyte", "Keta", "Keji", "First", "Zero", "Satoshi",
  ],
  pcsAxis: [
    "Observer", "Collector", "Curator", "Remixer", "Creator",
    "Correspondent", "Steward", "FranchiseAligned",
  ],
  defaultStage: "OutsideOrder",
  defaultDepth: "Observer",
  accentColor: "amber" as const,
  pcsAccentColor: "indigo" as const,
  agentLeadLabel: "Kn0w1",
  agentLeadCopilotContextId: "knyt-runtime",
  investorCampaignEnabled: true,
  signalEndpoints: {
    like: "/api/codex/knyt/living-canon/like",
    spark: "/api/codex/knyt/living-canon/spark",
    vote: "/api/codex/knyt/living-canon/vote",
    curate: "/api/codex/knyt/living-canon/curate",
    remix: "/api/codex/knyt/living-canon/remix",
    contribute: "/api/codex/knyt/living-canon/contribute",
  },
} as const;

function KnytRuntimeContent() {
  const searchParams = useSearchParams();
  const personaId = searchParams.get("personaId") ?? undefined;

  return (
    <SmartTriadProvider personaId={personaId ?? ""} agentId="knyt-runtime">
      <div className="flex flex-col h-screen bg-slate-950 text-white overflow-hidden">
        <CartridgeRuntimeTemplate
          personaId={personaId}
          {...KNYT_RUNTIME_CONFIG}
        />
      </div>
      <SmartTriadSurfaces personaId={personaId} />
    </SmartTriadProvider>
  );
}

export default function KnytRuntimePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
          <p className="text-sm text-slate-400 animate-pulse">Loading KNYT Runtime…</p>
        </div>
      }
    >
      <KnytRuntimeContent />
    </Suspense>
  );
}
