import { NextRequest, NextResponse } from "next/server";
import { listIQubes } from "@/app/(shell)/copilot/services/qubebase";
import {
  buildProviderMapFromModelIQubes,
  getStaticAgentLlmProviders,
} from "@/services/metame/agentLlmOrchestra";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function countModelsByAgent(
  map: Record<string, Array<{ id: string; models: Array<{ id: string }> }>>
): number {
  let total = 0;
  for (const providers of Object.values(map)) {
    for (const provider of providers) total += provider.models.length;
  }
  return total;
}

export async function GET(_request: NextRequest) {
  try {
    const live = await listIQubes(undefined, "ModelQube");
    if (live.success) {
      const liveMap = buildProviderMapFromModelIQubes(live.iqubes as any[]);
      const liveModelCount = countModelsByAgent(liveMap as any);
      if (liveModelCount > 0) {
        return NextResponse.json(
          {
            success: true,
            source: "qubebase",
            providerMap: liveMap,
            modelCount: liveModelCount,
          },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
    }
  } catch (error) {
    console.error("[MetaMe Agent LLM Options] live lookup failed:", error);
  }

  const fallback = getStaticAgentLlmProviders();
  return NextResponse.json(
    {
      success: true,
      source: "fallback",
      providerMap: fallback,
      modelCount: countModelsByAgent(fallback as any),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
