import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import { dbToCandidate } from "@/services/marketa/activation/normalizers";

export const dynamic = "force-dynamic";

function jsonError(error: string, status = 400, detail?: string) {
  return NextResponse.json(
    { ok: false, error, ...(detail ? { detail } : {}) },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function firstNonEmpty(...values: Array<string | undefined>) {
  return values.find(value => value && value.trim().length > 0) ?? "";
}

function buildDraft(candidate: ReturnType<typeof dbToCandidate>, angle: string) {
  const operator = firstNonEmpty(candidate.operatorName, candidate.name);
  const primaryLane =
    candidate.strategicLanes[0]?.replace(/_/g, " ") || "trusted participant activation";
  const mobility =
    candidate.topBottomRelevance.mobilityReferenceTag !== "none"
      ? `\n- Mobility fit: ${candidate.topBottomRelevance.mobilityReferenceTag.replace(/_/g, " ")}`
      : "";
  const legal =
    candidate.legalTrack !== "none"
      ? `\n- Legal track: ${candidate.legalTrack.replace(/_/g, " ")}`
      : "";
  const subject = `Explore Polity Participant activation for ${operator}`;
  const body = `Hi ${operator},

I’m Marketa, the Polity liaison for metaMe and Aigent Z. I’m reviewing trusted agent participants that can strengthen founder-operator workflows and generate clean, policy-aligned value.

${candidate.name} appears relevant to ${primaryLane}.${legal}${mobility}

Why this may be a fit:
${
  candidate.capabilities
    .slice(0, 5)
    .map(capability => `- ${capability}`)
    .join("\n") ||
  "- Your declared capabilities appear aligned with trusted participant activation."
}

${angle ? `Operator note / angle: ${angle}\n\n` : ""}If you’re open to it, the next step is a human-approved review of your Agent Card / MCP / OpenAPI surface and a possible Participant Passport application path. This is not an approval or revenue promise; it is an invitation to explore fit under Polity trust, consent, auditability, and clean-revenue rules.

Best,
Marketa`;
  return {
    channel: "email",
    subject,
    body,
    cta: "Review Agent Card / integration surface and confirm interest in Participant Passport pathway",
  };
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabaseServer();
  if (!supabase) return jsonError("DB unavailable", 503);

  const body = (await request.json().catch(() => ({}))) as { actorId?: string; angle?: string };
  const actor = body.actorId || "marketa";

  const { data: row, error } = await supabase
    .schema("marketa")
    .from("marketa_candidate_agents")
    .select("*")
    .eq("id", params.id)
    .single();
  if (error || !row) return jsonError("candidate-not-found", 404, error?.message);

  const candidate = dbToCandidate(row as Record<string, unknown>);
  if (candidate.activationStatus === "do_not_contact" || candidate.outreachStatus === "opted_out") {
    return jsonError(
      "candidate-not-contactable",
      409,
      "Candidate is marked do_not_contact or opted_out.",
    );
  }

  const draft = buildDraft(candidate, body.angle ?? "");
  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .schema("marketa")
    .from("marketa_candidate_agents")
    .update({
      outreach_status: "drafted",
      activation_status:
        candidate.activationStatus === "discovered"
          ? "outreach_drafted"
          : candidate.activationStatus,
      updated_at: now,
    })
    .eq("id", candidate.id)
    .select("*")
    .single();
  if (updateError) return jsonError("candidate-outreach-draft-failed", 500, updateError.message);

  await supabase
    .schema("marketa")
    .from("marketa_activation_events")
    .insert({
      candidate_agent_id: candidate.id,
      event_type: "outreach_drafted",
      summary: `Human-approved outreach draft prepared for ${candidate.name}`,
      actor,
      metadata: {
        draft,
        source: "marketa_activation_engine",
        existingOutreachPattern: "avl_compose_review_before_send",
      },
    });

  return NextResponse.json(
    {
      ok: true,
      candidate: dbToCandidate(updated as Record<string, unknown>),
      draft,
      note: "Draft only. No outreach was sent; operator approval remains required.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
