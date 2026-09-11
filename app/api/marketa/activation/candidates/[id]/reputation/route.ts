import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import { getActor } from "@/services/ops/icAgent";
import { rqhIDL } from "@/services/ops/idl/rqh";
import { dbToCandidate } from "@/services/marketa/activation/normalizers";

export const dynamic = "force-dynamic";

function jsonError(error: string, status = 400, detail?: string) {
  return NextResponse.json(
    { ok: false, error, ...(detail ? { detail } : {}) },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function standingFromScore(score: number | null, riskFlags: string[]) {
  if (riskFlags.length > 0) return "under_review";
  if (score === null) return "unknown";
  if (score >= 70) return "good_standing";
  if (score >= 40) return "watchlist";
  return "restricted";
}

type ReputationSource = "rqh_canister" | "reputation_bucket_mirror" | "activation_score_fallback";

/**
 * RQH (Reputation Quality Hub) is an ICP canister — the AUTHORITATIVE
 * reputation source. The Supabase `reputation_bucket` table is only a
 * cache/mirror consulted when the canister is unreachable or unconfigured.
 * The activation score is an explicit non-authoritative last resort so the
 * UI never silently treats an unscored agent as trusted.
 */
async function readRqhCanisterBucket(partitionId: string): Promise<{
  score: number;
  evidenceCount: number;
} | null> {
  const canisterId = process.env.RQH_CANISTER_ID || process.env.NEXT_PUBLIC_RQH_CANISTER_ID;
  if (!canisterId) return null;
  try {
    const actor: any = await getActor(canisterId, rqhIDL);
    const response = await actor.get_reputation_bucket(partitionId);
    if (response?.ok && Array.isArray(response.data) && response.data.length > 0) {
      const bucket = response.data[0];
      return {
        score: Number(bucket.score),
        evidenceCount: Number(bucket.evidence_count),
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function syncCandidateReputation(candidateId: string, actor = "marketa") {
  const supabase = getSupabaseServer();
  if (!supabase) return { response: jsonError("DB unavailable", 503), status: 503 as const };

  const { data: row, error } = await supabase
    .schema("marketa")
    .from("marketa_candidate_agents")
    .select("*")
    .eq("id", candidateId)
    .single();
  if (error || !row)
    return {
      response: jsonError("candidate-not-found", 404, error?.message),
      status: 404 as const,
    };

  const candidate = dbToCandidate(row as Record<string, unknown>);
  const partitionId =
    candidate.reputation.reputationBindingId ||
    candidate.iqubeRegistry.agentIqubeId ||
    `marketa-agent-${candidate.id}`;

  let score: number | null = null;
  let evidenceCount = 0;
  let source: ReputationSource = "activation_score_fallback";

  // 1. Authoritative: RQH ICP canister.
  const canisterBucket = await readRqhCanisterBucket(partitionId);
  if (canisterBucket) {
    score = canisterBucket.score;
    evidenceCount = canisterBucket.evidenceCount;
    source = "rqh_canister";
  } else {
    // 2. Cache/mirror fallback: Supabase reputation_bucket (non-authoritative).
    const { data: bucket, error: bucketError } = await supabase
      .from("reputation_bucket")
      .select("partition_id, bucket_level, score, evidence_count, updated_at, last_synced_at")
      .eq("partition_id", partitionId)
      .maybeSingle();

    if (!bucketError && bucket) {
      score = typeof bucket.score === "number" ? bucket.score : Number(bucket.score ?? 0);
      evidenceCount =
        typeof bucket.evidence_count === "number"
          ? bucket.evidence_count
          : Number(bucket.evidence_count ?? 0);
      source = "reputation_bucket_mirror";
    } else {
      // 3. Last resort: activation score, explicitly non-authoritative.
      score = candidate.scores.overallPriorityScore || null;
    }
  }

  const now = new Date().toISOString();
  const reputation = {
    ...candidate.reputation,
    reputationBindingId: partitionId,
    standingStatus: standingFromScore(score, candidate.riskFlags),
    publicScore: score,
    infractionCount: candidate.reputation.infractionCount,
    activeRestrictions: candidate.riskFlags,
    lastReputationCheckAt: now,
  };

  const { data: updated, error: updateError } = await supabase
    .schema("marketa")
    .from("marketa_candidate_agents")
    .update({ reputation, updated_at: now })
    .eq("id", candidate.id)
    .select("*")
    .single();
  if (updateError)
    return {
      response: jsonError("candidate-reputation-sync-failed", 500, updateError.message),
      status: 500 as const,
    };

  await supabase
    .schema("marketa")
    .from("marketa_activation_events")
    .insert({
      candidate_agent_id: candidate.id,
      event_type: "reputation_synced",
      summary: `Reputation checked for ${candidate.name}`,
      actor,
      metadata: { partitionId, source, score, evidenceCount },
    });

  return {
    response: NextResponse.json(
      {
        ok: true,
        candidate: dbToCandidate(updated as Record<string, unknown>),
        reputation,
        source,
        evidenceCount,
        note:
          source === "activation_score_fallback"
            ? "No RQH canister bucket or Supabase mirror row was found for this agent partition; using activation score as a non-authoritative fallback."
            : source === "reputation_bucket_mirror"
              ? "RQH canister unreachable or unconfigured; value read from the Supabase reputation_bucket cache/mirror (non-authoritative)."
              : undefined,
      },
      { headers: { "Cache-Control": "no-store" } },
    ),
    status: 200 as const,
  };
}

export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (await syncCandidateReputation(params.id)).response;
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const body = (await request.json().catch(() => ({}))) as { actorId?: string };
  return (await syncCandidateReputation(params.id, body.actorId || "marketa")).response;
}
