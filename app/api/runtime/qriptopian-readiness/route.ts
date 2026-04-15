/**
 * GET /api/runtime/qriptopian-readiness?personaId=<id>
 *
 * Cross-cartridge readiness check: evaluates whether a Qriptopian user is
 * ready to be routed into the KNYT cartridge.
 *
 * Readiness signals (any combination reaching threshold):
 *   - Journey stage in Qriptopian is 'keta' or above
 *   - Cumulative signal count (like + spark + curate) >= 5 in Qriptopian domain
 *   - Explicit knyt_ready flag in journey state metadata
 *   - Active NBE plan with nextExperience = 'knyt' already exists
 *
 * Returns:
 *   ready: boolean
 *   signals: { stage_qualified, signal_qualified, flag_qualified, nbe_qualified }
 *   nbe_plan: NBEPlan with disposition='act', next_experience='knyt' (only when ready=true)
 *   rationale: string
 *
 * Phase 0.9 — Cross-cartridge routing
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Stages at which a Qriptopian user is considered KNYT-ready
const READY_STAGES = new Set(["keta", "keji", "first", "zero"]);
const SIGNAL_THRESHOLD = 5;

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function createEventId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `nbe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET(request: NextRequest) {
  const personaId = request.nextUrl.searchParams.get("personaId");
  if (!personaId) {
    return NextResponse.json({ error: "personaId required" }, { status: 400 });
  }

  const db = getDb();
  const now = new Date().toISOString();

  const [journeyResult, signalResult, nbeResult] = await Promise.allSettled([
    // Journey state (Qriptopian domain)
    db
      .from("journey_states")
      .select("stage, depth, current_experience_id")
      .eq("persona_id", personaId)
      .order("active_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Qriptopian signals
    db
      .from("knyt_signals")
      .select("signal_type")
      .eq("persona_id", personaId),

    // Check for existing KNYT-targeted NBE plan
    db
      .from("nbe_plans")
      .select("id, disposition, next_experience_depth, rationale, expires_at")
      .eq("persona_id", personaId)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const journey =
    journeyResult.status === "fulfilled" ? journeyResult.value.data : null;
  const signals =
    signalResult.status === "fulfilled" ? (signalResult.value.data ?? []) : [];
  const existingNbe =
    nbeResult.status === "fulfilled" ? nbeResult.value.data : null;

  const stage = journey?.stage ?? "prospect";
  const totalSignals = signals.length;

  // Evaluate readiness signals
  const stageQualified = READY_STAGES.has(stage);
  const signalQualified = totalSignals >= SIGNAL_THRESHOLD;
  const flagQualified = false; // future: read from journey metadata
  const nbeQualified =
    existingNbe != null &&
    (existingNbe.next_experience_depth === "knyt" ||
      existingNbe.rationale?.toLowerCase().includes("knyt"));

  const ready = stageQualified || signalQualified || flagQualified || nbeQualified;

  if (!ready) {
    return NextResponse.json({
      ready: false,
      signals: {
        stage_qualified: stageQualified,
        signal_qualified: signalQualified,
        flag_qualified: flagQualified,
        nbe_qualified: nbeQualified,
      },
      progress: {
        current_stage: stage,
        signal_count: totalSignals,
        signal_threshold: SIGNAL_THRESHOLD,
        stages_that_qualify: Array.from(READY_STAGES),
      },
      rationale: `Not yet KNYT-ready: stage=${stage}, signals=${totalSignals}/${SIGNAL_THRESHOLD}`,
      nbe_plan: null,
    });
  }

  // Persona is ready — compute or return NBE plan routing to KNYT
  const rationale = nbeQualified
    ? "Existing NBE plan targets KNYT"
    : stageQualified
    ? `Qriptopian stage '${stage}' qualifies for KNYT cartridge`
    : `Signal count (${totalSignals}) meets KNYT readiness threshold`;

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); // 48h

  // Upsert KNYT-targeting NBE plan
  const { data: nbePlan } = await db
    .from("nbe_plans")
    .upsert(
      {
        persona_id: personaId,
        experience_id: journey?.current_experience_id ?? null,
        disposition: "act",
        next_experience_depth: "knyt",
        rationale,
        expires_at: expiresAt,
      },
      { onConflict: "persona_id,experience_id" }
    )
    .select()
    .maybeSingle();

  return NextResponse.json({
    ready: true,
    signals: {
      stage_qualified: stageQualified,
      signal_qualified: signalQualified,
      flag_qualified: flagQualified,
      nbe_qualified: nbeQualified,
    },
    progress: {
      current_stage: stage,
      signal_count: totalSignals,
    },
    rationale,
    nbe_plan: nbePlan ?? {
      disposition: "act",
      next_experience_depth: "knyt",
      rationale,
      expires_at: expiresAt,
    },
  });
}
