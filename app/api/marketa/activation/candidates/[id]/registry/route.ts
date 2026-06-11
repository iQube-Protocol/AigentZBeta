import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import { createAsset, getAsset } from "@/services/registry/persistence";
import { emitReceiptSilent } from "@/services/registry/receiptEmitter";
import { dbToCandidate } from "@/services/marketa/activation/normalizers";
import type { CandidateAgent } from "@/services/marketa/activation/types";
import type { PolicyClass, WrapperStrategy } from "@/types/registryIngestion";

export const dynamic = "force-dynamic";

function jsonError(error: string, status = 400, detail?: string) {
  return NextResponse.json(
    { ok: false, error, ...(detail ? { detail } : {}) },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "marketa-agent-candidate"
  );
}

function registryAssetId(candidate: CandidateAgent) {
  return candidate.iqubeRegistry.agentIqubeId || `marketa-agent-${candidate.id}`;
}

function policyClassFor(candidate: CandidateAgent): PolicyClass {
  return candidate.riskFlags.length > 0 || candidate.policyFlags.length > 0
    ? "human_approval_required"
    : "read_only";
}

function wrapperStrategyFor(candidate: CandidateAgent): WrapperStrategy {
  if (candidate.mcpServerUrl) return "mcp";
  if (candidate.openapiUrl || candidate.websiteUrl || candidate.agentCardUrl) return "http";
  return "http";
}

function capabilityDescriptors(candidate: CandidateAgent) {
  return candidate.capabilities.map(capability => ({
    name: capability,
    description: `${candidate.name} declared capability: ${capability}`,
    tags: [...candidate.strategicLanes, ...candidate.verticals, candidate.legalTrack].filter(
      tag => tag && tag !== "none",
    ),
  }));
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabaseServer();
  if (!supabase) return jsonError("DB unavailable", 503);

  const body = (await request.json().catch(() => ({}))) as {
    tenantId?: string;
    actorId?: string;
    publish?: boolean;
  };
  const tenantId = body.tenantId || "metame";
  const actorId = body.actorId || "marketa";

  const { data: row, error: fetchError } = await supabase
    .schema("marketa")
    .from("marketa_candidate_agents")
    .select("*")
    .eq("id", params.id)
    .single();
  if (fetchError || !row) return jsonError("candidate-not-found", 404, fetchError?.message);

  const candidate = dbToCandidate(row as Record<string, unknown>);
  const assetId = registryAssetId(candidate);
  const existing = await getAsset(assetId);
  const now = new Date().toISOString();
  const publicRegistryUrl = `/registry/assets/${assetId}`;

  const asset =
    existing ??
    (await createAsset({
      assetId,
      tenantId,
      assetClass: "AigentQube",
      name: candidate.name,
      slug: slugify(candidate.name),
      description: candidate.description,
      policyClass: policyClassFor(candidate),
      wrapperStrategy: wrapperStrategyFor(candidate),
      interfaceSchema: {
        agentCardUrl: candidate.agentCardUrl || undefined,
        mcpServerUrl: candidate.mcpServerUrl || undefined,
        openapiUrl: candidate.openapiUrl || undefined,
        websiteUrl: candidate.websiteUrl || undefined,
      },
      capabilities: capabilityDescriptors(candidate),
      tags: [
        "marketa-activation-engine",
        ...candidate.strategicLanes,
        ...candidate.verticals,
        candidate.legalTrack,
        candidate.topBottomRelevance.mobilityReferenceTag,
      ].filter(tag => tag && tag !== "none"),
      metadata: {
        source: "marketa_activation_engine",
        candidateId: candidate.id,
        operatorName: candidate.operatorName,
        sourceType: candidate.sourceType,
        sourceUrl: candidate.sourceUrl,
        score: candidate.scores.overallPriorityScore,
        riskFlags: candidate.riskFlags,
        policyFlags: candidate.policyFlags,
        phase: "phase_2_registry_link",
      },
      createdBy: actorId,
    }));

  const iqubeRegistry = {
    ...candidate.iqubeRegistry,
    registryStatus:
      existing && candidate.iqubeRegistry.registryStatus !== "not_registered"
        ? candidate.iqubeRegistry.registryStatus
        : "registered",
    agentIqubeId: asset.assetId,
    registryRecordId: asset.assetId,
    publicRegistryUrl,
    agentCardRef: candidate.agentCardUrl,
    lastRegistrySyncAt: now,
  };
  const passportIntegration = {
    ...candidate.passportIntegration,
    integrationStatus: "stub",
    agentIqubeId: asset.assetId,
    registryRecordId: asset.assetId,
    lastSyncAt: now,
  };

  const { data: updated, error: updateError } = await supabase
    .schema("marketa")
    .from("marketa_candidate_agents")
    .update({
      iqube_registry: iqubeRegistry,
      passport_integration: passportIntegration,
      activation_status:
        candidate.activationStatus === "discovered"
          ? "application_recommended"
          : candidate.activationStatus,
      updated_at: now,
    })
    .eq("id", candidate.id)
    .select("*")
    .single();
  if (updateError) return jsonError("candidate-registry-sync-failed", 500, updateError.message);

  await supabase
    .schema("marketa")
    .from("marketa_activation_events")
    .insert({
      candidate_agent_id: candidate.id,
      event_type: existing ? "registry_asset_relinked" : "registry_asset_created",
      summary: `${candidate.name} linked to iQube Registry asset ${asset.assetId}`,
      actor: actorId,
      metadata: {
        assetId: asset.assetId,
        registryStatus: iqubeRegistry.registryStatus,
        publicRegistryUrl,
      },
    });

  emitReceiptSilent({
    eventType: "asset.packaged",
    actorId,
    tenantId,
    assetId: asset.assetId,
    payload: {
      source: "marketa_activation_engine",
      candidateId: candidate.id,
      action: existing ? "relink_candidate_to_registry_asset" : "create_candidate_registry_asset",
      registryStatus: iqubeRegistry.registryStatus,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      candidate: dbToCandidate(updated as Record<string, unknown>),
      asset,
      reusedExistingAsset: Boolean(existing),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
