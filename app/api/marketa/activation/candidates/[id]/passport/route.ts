/**
 * Marketa → Polity Passport Bureau handoff.
 *
 * The Bureau is COMPLETE and authoritative: applications live in
 * polity_passport_applications, issued passports in polity_passport_records,
 * and the machine submission surface is POST /api/polity-passport/submit.
 *
 * Marketa recommends and PREPARES — it never issues, and it never consents on
 * behalf of the agent's operator. The four mandatory Bureau consents
 * (participant_terms_accepted, registry_pending_record_consent,
 * constraints_and_obligations_accepted, review_process_accepted) must be
 * given by the participant/operator at submission time, so this route:
 *
 *   POST — prepare/sync. If the candidate's agent card already has a Bureau
 *          application, sync its status (and issued passport id) back onto
 *          the candidate's passportIntegration. Otherwise build a draft
 *          application payload from the candidate record, dry-run it through
 *          the Bureau's own validator (consents intentionally NOT faked), and
 *          connect the candidate to the Bureau's real submit/schema URLs.
 *
 *   POST { action: "submit", consents } — operator-consented submission. The
 *          HUMAN operator has checked the four mandatory Bureau consents in
 *          the Activation Engine UI; this route forwards the prepared
 *          application (with those operator-given consents) through the
 *          Bureau's own machine surface POST /api/polity-passport/submit.
 *          All four consents must be explicitly true in the request body —
 *          Marketa still never consents on anyone's behalf.
 *
 * Only public application/status/reference fields are stored back into
 * Marketa — never private Passport payloads or blakQube data.
 */

import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import { legibilityHost } from "@/services/iqube/legibility/cardBuilder";
import {
  validateParticipantApplication,
} from "@/services/passport/participantApplicationValidator";
import { dbToCandidate } from "@/services/marketa/activation/normalizers";
import type { CandidateAgent, PassportIntegrationStub } from "@/services/marketa/activation/types";

export const dynamic = "force-dynamic";

function jsonError(error: string, status = 400, detail?: string) {
  return NextResponse.json(
    { ok: false, error, ...(detail ? { detail } : {}) },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

type BureauApplicationStatus =
  | "draft"
  | "submitted"
  | "pending_approval"
  | "approved"
  | "denied"
  | "withdrawn"
  | "needs_more_information";

function stubStatusFor(bureau: BureauApplicationStatus): PassportIntegrationStub["passportApplicationStatus"] {
  // Bureau application statuses map 1:1 onto the (extended) stub union.
  return bureau;
}

function activationStatusFor(bureau: BureauApplicationStatus, current: string): string {
  if (bureau === "approved") return "passport_approved";
  if (bureau === "submitted" || bureau === "pending_approval" || bureau === "needs_more_information")
    return "pending_passport";
  if (bureau === "denied") return "rejected";
  return current;
}

/** Draft Bureau application payload built from public candidate fields only. */
function buildDraftApplication(candidate: CandidateAgent) {
  return {
    schema_version: "0.1.0",
    application_type: "agent_participant_passport",
    participant: {
      participant_kind: "agent",
      agent_type: candidate.strategicLanes[0] ?? "general",
      display_name: candidate.name,
      description: candidate.description || undefined,
      operator_name: candidate.operatorName || undefined,
      operator_type: candidate.operatorType || undefined,
    },
    agent_identity: {
      agent_card: {
        agent_card_url: candidate.agentCardUrl,
      },
      mcp_server_url: candidate.mcpServerUrl || undefined,
      openapi_url: candidate.openapiUrl || undefined,
      repository_url: candidate.repositoryUrl || undefined,
      website_url: candidate.websiteUrl || undefined,
    },
    capabilities: {
      declared: candidate.capabilities,
      target_users: candidate.targetUsers,
    },
    policy_profile: {
      risk_flags: candidate.riskFlags,
      policy_flags: candidate.policyFlags,
      clean_revenue_review: candidate.activationStatus === "needs_review" ? "needs_review" : "screened",
    },
    risk_profile: {
      marketa_risk_score: candidate.scores.riskScore,
      marketa_overall_priority_score: candidate.scores.overallPriorityScore,
    },
    passport_request: {
      requested_passport_type: "agent_participant",
      requested_scope: candidate.strategicLanes,
      requested_status: "provisional_ok",
    },
    // Consents are intentionally OMITTED: the participant/operator must give
    // them at submission. Marketa never consents on another party's behalf.
    consents: {},
    references: {
      marketa_candidate_id: candidate.id,
      agent_iqube_id: candidate.iqubeRegistry.agentIqubeId || undefined,
      registry_record_id: candidate.iqubeRegistry.registryRecordId || undefined,
    },
  };
}

const MANDATORY_CONSENTS = [
  "participant_terms_accepted",
  "registry_pending_record_consent",
  "constraints_and_obligations_accepted",
  "review_process_accepted",
] as const;

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabaseServer();
  if (!supabase) return jsonError("DB unavailable", 503);

  const body = (await request.json().catch(() => ({}))) as {
    actorId?: string;
    action?: "prepare" | "submit";
    consents?: Record<string, unknown>;
  };
  const actor = body.actorId || "marketa";
  const isSubmit = body.action === "submit";

  if (isSubmit) {
    const missing = MANDATORY_CONSENTS.filter(consent => body.consents?.[consent] !== true);
    if (missing.length > 0) {
      return jsonError(
        "consents-required",
        422,
        `All four Bureau consents must be explicitly accepted by the operator: ${missing.join(", ")}`,
      );
    }
  }

  const { data: row, error } = await supabase
    .schema("marketa")
    .from("marketa_candidate_agents")
    .select("*")
    .eq("id", params.id)
    .single();
  if (error || !row) return jsonError("candidate-not-found", 404, error?.message);

  const candidate = dbToCandidate(row as Record<string, unknown>);

  // The Bureau anchors participant identity on the agent card URL.
  if (!candidate.agentCardUrl) {
    return jsonError(
      "agent-card-required",
      422,
      "The Polity Passport Bureau anchors participant identity on agent_card_url; add one to the candidate first.",
    );
  }

  // Registry handoff first — the Agent iQube is the passport's registry anchor.
  if (!candidate.iqubeRegistry.agentIqubeId) {
    return jsonError(
      "registry-handoff-required",
      409,
      "Run POST /api/marketa/activation/candidates/:id/registry first so the candidate has an Agent iQube / registry record.",
    );
  }

  const host = legibilityHost();
  const now = new Date().toISOString();

  // Does the Bureau already know this agent? (Bureau keys on agent_card_url.)
  const { data: apps, error: appsError } = await supabase
    .from("polity_passport_applications")
    .select("id, application_status, passport_class, submitted_at, decided_at")
    .eq("agent_card_url", candidate.agentCardUrl)
    .order("submitted_at", { ascending: false })
    .limit(1);
  if (appsError) {
    console.error("[marketa passport sync] Bureau application lookup failed:", appsError.message, "agent_card_url:", candidate.agentCardUrl);
  }

  const existingApp = apps?.[0] as
    | { id: string; application_status: BureauApplicationStatus; passport_class: string }
    | undefined;

  let passportIntegration: PassportIntegrationStub;
  let activationStatus = candidate.activationStatus as string;
  let issuedPassportId = "";
  let draftApplication: Record<string, unknown> | null = null;
  let outstandingIssues: Array<{ path: string; message: string }> = [];
  let submittedApplicationId: string | null = null;

  if (existingApp) {
    console.log("[marketa passport sync] Bureau app found:", existingApp.id, "status:", existingApp.application_status);
    if (existingApp.application_status === "approved") {
      const { data: record } = await supabase
        .from("polity_passport_records")
        .select("passport_id")
        .eq("application_id", existingApp.id)
        .maybeSingle();
      issuedPassportId = (record?.passport_id as string) ?? "";
    }

    passportIntegration = {
      ...candidate.passportIntegration,
      integrationStatus: "connected",
      participantPassportApplicationUrl: `${host}/api/polity-passport/status/${existingApp.id}`,
      participantPassportSchemaUrl: `${host}/api/polity-passport/schemas/participant-passport.application.schema.json`,
      passportApplicationStatus: stubStatusFor(existingApp.application_status),
      participantPassportId: issuedPassportId || candidate.passportIntegration.participantPassportId,
      lastSyncAt: now,
    };
    activationStatus = activationStatusFor(existingApp.application_status, activationStatus);
  } else if (isSubmit) {
    // Operator-consented submission: the human operator gave the four
    // mandatory consents in the UI; forward the prepared application through
    // the Bureau's own machine surface so its open-app check, insert, and
    // receipt pipeline all apply unchanged.
    draftApplication = {
      ...buildDraftApplication(candidate),
      consents: {
        participant_terms_accepted: true,
        registry_pending_record_consent: true,
        constraints_and_obligations_accepted: true,
        review_process_accepted: true,
        consent_actor: actor,
        consented_at: now,
      },
    };
    const validation = validateParticipantApplication(draftApplication);
    if (!validation.valid) {
      return NextResponse.json(
        { ok: false, error: "application-invalid", issues: validation.issues },
        { status: 422, headers: { "Cache-Control": "no-store" } },
      );
    }

    const submitRes = await fetch(`${host}/api/polity-passport/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draftApplication),
    });
    const submitJson = (await submitRes.json().catch(() => ({}))) as {
      ok?: boolean;
      applicationId?: string;
      applicationStatus?: string;
      error?: string;
    };
    if (!submitRes.ok || !submitJson.ok || !submitJson.applicationId) {
      return jsonError(
        "bureau-submit-failed",
        submitRes.status === 409 ? 409 : 502,
        submitJson.error || `Bureau returned ${submitRes.status}`,
      );
    }
    submittedApplicationId = submitJson.applicationId;

    passportIntegration = {
      ...candidate.passportIntegration,
      integrationStatus: "connected",
      participantPassportApplicationUrl: `${host}/api/polity-passport/status/${submitJson.applicationId}`,
      participantPassportSchemaUrl: `${host}/api/polity-passport/schemas/participant-passport.application.schema.json`,
      passportApplicationStatus: "submitted",
      lastSyncAt: now,
    };
    activationStatus = activationStatusFor("submitted", activationStatus);
  } else {
    // Prepare: build the draft application + dry-run it through the Bureau's
    // own validator. Missing consents are EXPECTED issues at this stage.
    draftApplication = buildDraftApplication(candidate);
    const validation = validateParticipantApplication(draftApplication);
    outstandingIssues = validation.issues;

    passportIntegration = {
      ...candidate.passportIntegration,
      integrationStatus: "connected",
      participantPassportApplicationUrl: `${host}/api/polity-passport/submit`,
      participantPassportSchemaUrl: `${host}/api/polity-passport/schemas/participant-passport.application.schema.json`,
      passportApplicationStatus:
        candidate.passportIntegration.passportApplicationStatus === "not_started"
          ? "draft"
          : candidate.passportIntegration.passportApplicationStatus,
      lastSyncAt: now,
    };
    if (activationStatus === "application_recommended" || activationStatus === "scored") {
      activationStatus = "passport_application_started";
    }
  }

  const { data: updated, error: updateError } = await supabase
    .schema("marketa")
    .from("marketa_candidate_agents")
    .update({
      passport_integration: passportIntegration,
      activation_status: activationStatus,
      updated_at: now,
    })
    .eq("id", candidate.id)
    .select("*")
    .single();
  if (updateError) return jsonError("candidate-passport-sync-failed", 500, updateError.message);

  await supabase
    .schema("marketa")
    .from("marketa_activation_events")
    .insert({
      candidate_agent_id: candidate.id,
      event_type: existingApp
        ? "passport_status_synced"
        : submittedApplicationId
          ? "passport_application_submitted"
          : "passport_application_prepared",
      summary: existingApp
        ? `Passport Bureau status for ${candidate.name}: ${existingApp.application_status}`
        : submittedApplicationId
          ? `Passport application submitted to the Bureau for ${candidate.name} (operator-consented by ${actor})`
          : `Passport application prepared for ${candidate.name} (operator consents pending)`,
      actor,
      metadata: {
        agentCardUrl: candidate.agentCardUrl,
        bureauApplicationId: existingApp?.id ?? submittedApplicationId,
        bureauStatus: existingApp?.application_status ?? (submittedApplicationId ? "submitted" : null),
        issuedPassportId: issuedPassportId || null,
        outstandingIssueCount: outstandingIssues.length,
        source: "marketa_activation_engine",
      },
    });

  return NextResponse.json(
    {
      ok: true,
      candidate: dbToCandidate(updated as Record<string, unknown>),
      bureau: {
        applicationId: existingApp?.id ?? submittedApplicationId,
        applicationStatus: existingApp?.application_status ?? (submittedApplicationId ? "submitted" : null),
        issuedPassportId: issuedPassportId || null,
        credentialUrl: issuedPassportId
          ? `${host}/api/polity-passport/credential/${issuedPassportId}`
          : null,
        submitUrl: `${host}/api/polity-passport/submit`,
        validateUrl: `${host}/api/polity-passport/validate`,
        schemaUrl: `${host}/api/polity-passport/schemas/participant-passport.application.schema.json`,
        discoveryUrl: `${host}/.well-known/polity-passport`,
      },
      draftApplication,
      outstandingIssues,
      note: existingApp
        ? `Synced from the Polity Passport Bureau — status: ${existingApp.application_status}${issuedPassportId ? `, passport: ${issuedPassportId}` : ""}. The Bureau owns approval; Marketa stores public status/reference fields only.`
        : submittedApplicationId
          ? "Submitted to the Polity Passport Bureau with operator-given consents. The application is now in the Bureau steward queue; the Bureau owns approval from here."
          : appsError
            ? `Bureau lookup failed (${appsError.message}) — showing last known status. Try again in a moment.`
            : "Draft prepared and dry-run validated against the Bureau's validator. The participant/operator must complete the four mandatory consents and submit via the Bureau — Marketa never consents or submits on their behalf.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
