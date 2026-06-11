/**
 * Marketa Activation Engine — candidate opportunities (the revenue half of
 * the funnel).
 *
 * GET    — list the candidate's opportunities (normalized).
 * POST   — create an opportunity { description, opportunityType?, targetUser?,
 *          estimatedValue?, cleanRevenueStatus?, policyRisk? }.
 * PATCH  — update an opportunity { opportunityId, ...fields } (status
 *          advance, value change, clean-revenue review).
 *
 * Every create/update mechanically rolls the opportunity set up onto the
 * candidate's revenue_tracking (open → estimatedPipelineValue, completed →
 * closedCleanRevenue) and logs an activation_event, so the cartridge can
 * answer "what is Marketa earning" without a separate aggregation pass.
 */

import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import {
  dbToCandidate,
  dbToOpportunity,
  opportunityInputToDb,
  opportunityPatchToDb,
  rollUpRevenue,
} from "@/services/marketa/activation/normalizers";

export const dynamic = "force-dynamic";

function jsonError(error: string, status = 400, detail?: string) {
  return NextResponse.json(
    { ok: false, error, ...(detail ? { detail } : {}) },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function listOpportunities(supabase: NonNullable<ReturnType<typeof getSupabaseServer>>, candidateId: string) {
  const { data, error } = await supabase
    .schema("marketa")
    .from("marketa_candidate_opportunities")
    .select("*")
    .eq("candidate_agent_id", candidateId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => dbToOpportunity(row as Record<string, unknown>));
}

/** Roll the opportunity set up onto the candidate's revenue_tracking. */
async function syncRevenueRollUp(
  supabase: NonNullable<ReturnType<typeof getSupabaseServer>>,
  candidateId: string,
) {
  const opportunities = await listOpportunities(supabase, candidateId);
  const { data: row, error } = await supabase
    .schema("marketa")
    .from("marketa_candidate_agents")
    .select("*")
    .eq("id", candidateId)
    .single();
  if (error || !row) throw new Error(error?.message || "candidate-not-found");

  const candidate = dbToCandidate(row as Record<string, unknown>);
  const rollUp = rollUpRevenue(opportunities);
  const { data: updated, error: updateError } = await supabase
    .schema("marketa")
    .from("marketa_candidate_agents")
    .update({
      revenue_tracking: { ...candidate.revenueTracking, ...rollUp },
      updated_at: new Date().toISOString(),
    })
    .eq("id", candidateId)
    .select("*")
    .single();
  if (updateError) throw new Error(updateError.message);
  return { candidate: dbToCandidate(updated as Record<string, unknown>), opportunities };
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabaseServer();
  if (!supabase) return jsonError("DB unavailable", 503);
  try {
    const opportunities = await listOpportunities(supabase, params.id);
    return NextResponse.json(
      { ok: true, opportunities },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return jsonError("opportunities-list-failed", 500, e instanceof Error ? e.message : String(e));
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabaseServer();
  if (!supabase) return jsonError("DB unavailable", 503);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError("invalid-json");
  }

  let insertRow: ReturnType<typeof opportunityInputToDb>;
  try {
    insertRow = opportunityInputToDb(raw, params.id);
  } catch (e) {
    return jsonError("invalid-opportunity", 422, e instanceof Error ? e.message : String(e));
  }

  const { data: created, error } = await supabase
    .schema("marketa")
    .from("marketa_candidate_opportunities")
    .insert(insertRow)
    .select("*")
    .single();
  if (error) return jsonError("opportunity-create-failed", 500, error.message);
  const opportunity = dbToOpportunity(created as Record<string, unknown>);

  try {
    const { candidate, opportunities } = await syncRevenueRollUp(supabase, params.id);
    await supabase
      .schema("marketa")
      .from("marketa_activation_events")
      .insert({
        candidate_agent_id: params.id,
        event_type: "opportunity_created",
        summary: `Opportunity logged for ${candidate.name}: ${opportunity.description.slice(0, 120)} ($${opportunity.estimatedValue})`,
        actor: (raw as Record<string, unknown>)?.actorId ?? "marketa",
        metadata: {
          opportunityId: opportunity.id,
          opportunityType: opportunity.opportunityType,
          estimatedValue: opportunity.estimatedValue,
          source: "marketa_activation_engine",
        },
      });
    return NextResponse.json(
      { ok: true, opportunity, candidate, opportunities },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return jsonError("revenue-rollup-failed", 500, e instanceof Error ? e.message : String(e));
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabaseServer();
  if (!supabase) return jsonError("DB unavailable", 503);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError("invalid-json");
  }
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const opportunityId = typeof body.opportunityId === "string" ? body.opportunityId : "";
  if (!opportunityId) return jsonError("opportunity-id-required", 422);

  const patch = opportunityPatchToDb(body);
  if (Object.keys(patch).length <= 1) return jsonError("empty-patch", 422);

  const { data: updatedRow, error } = await supabase
    .schema("marketa")
    .from("marketa_candidate_opportunities")
    .update(patch)
    .eq("id", opportunityId)
    .eq("candidate_agent_id", params.id)
    .select("*")
    .single();
  if (error) return jsonError("opportunity-update-failed", 500, error.message);
  const opportunity = dbToOpportunity(updatedRow as Record<string, unknown>);

  try {
    const { candidate, opportunities } = await syncRevenueRollUp(supabase, params.id);
    await supabase
      .schema("marketa")
      .from("marketa_activation_events")
      .insert({
        candidate_agent_id: params.id,
        event_type: "opportunity_updated",
        summary: `Opportunity ${opportunity.activationStatus} for ${candidate.name}: ${opportunity.description.slice(0, 120)} ($${opportunity.estimatedValue})`,
        actor: body.actorId ?? "marketa",
        metadata: {
          opportunityId: opportunity.id,
          activationStatus: opportunity.activationStatus,
          estimatedValue: opportunity.estimatedValue,
          fields: Object.keys(patch).filter((key) => key !== "updated_at"),
          source: "marketa_activation_engine",
        },
      });
    return NextResponse.json(
      { ok: true, opportunity, candidate, opportunities },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return jsonError("revenue-rollup-failed", 500, e instanceof Error ? e.message : String(e));
  }
}
