import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import { dbToCandidate } from "@/services/marketa/activation/normalizers";
import {
  BUILT_IN_OUTREACH_TEMPLATE,
  dbToOutreachTemplate,
  pickOutreachTemplate,
  renderOutreachTemplate,
  type OutreachTemplate,
} from "@/services/marketa/activation/outreachTemplates";
import { getGoogleConnector } from "@/services/google/connectors";
import { marketaSendTransactional } from "@/services/marketa/marketaConnector";

export const dynamic = "force-dynamic";

function jsonError(error: string, status = 400, detail?: string) {
  return NextResponse.json(
    { ok: false, error, ...(detail ? { detail } : {}) },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = getSupabaseServer();
  if (!supabase) return jsonError("DB unavailable", 503);

  const body = (await request.json().catch(() => ({}))) as {
    actorId?: string;
    angle?: string;
    action?: "draft" | "send" | "mark_responded";
    to?: string;
    subject?: string;
    body?: string;
    templateId?: string;
    sendVia?: "mailjet" | "gmail";
    personaId?: string;
  };
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

  const now = new Date().toISOString();

  // ── Operator-approved send. Mailjet (cohort/platform identity) is the
  // default. Gmail (aigentMe 1:1 comms) is available when sendVia=gmail
  // and a personaId with a connected Gmail account is supplied.
  if (body.action === "send") {
    const to = (body.to ?? "").trim();
    const subject = (body.subject ?? "").trim();
    const bodyText = (body.body ?? "").trim();
    if (!to || !/@/.test(to)) return jsonError("recipient-required", 422, "A recipient email is required — Marketa never infers one.");
    if (!subject || !bodyText) return jsonError("subject-body-required", 422, "Reviewed subject and body are required.");

    const sendVia = body.sendVia ?? "mailjet";
    let messageId = "";
    let sendPath = "";

    if (sendVia === "gmail") {
      const gmailPersonaId = (body.personaId ?? "").trim();
      if (!gmailPersonaId) return jsonError("persona-required-for-gmail", 422, "personaId with connected Gmail required for Gmail send.");
      const gmailSend = getGoogleConnector("google.gmail.send");
      if (!gmailSend) return jsonError("gmail-connector-unavailable", 500, "Gmail send connector not found.");
      const gmailResult = await gmailSend.execute(
        { to, subject, bodyText } as never,
        { personaId: gmailPersonaId, cartridge: "marketa" },
      );
      if (!gmailResult.ok) {
        return jsonError("outreach-gmail-send-failed", 502, `${gmailResult.code}: ${gmailResult.reason}`);
      }
      messageId = (gmailResult.output as { messageId?: string }).messageId ?? "";
      sendPath = `google.gmail.send (Gmail, persona ${gmailPersonaId})`;
    } else {
      // Reply-To: when MARKETA_OUTREACH_REPLY_TO is set (a Mailjet
      // Parse-routed inbox), replies auto-flip the candidate via
      // /api/marketa/activation/inbound-reply. Unset = Mailjet default.
      const replyTo = process.env.MARKETA_OUTREACH_REPLY_TO?.trim();
      const sendResult = await marketaSendTransactional.execute(
        { to, subject, bodyText, ...(replyTo ? { replyTo } : {}) },
        { personaId: "", cartridge: "marketa" },
      );
      if (!sendResult.ok) {
        return jsonError("outreach-send-failed", 502, `${sendResult.code}: ${sendResult.reason}`);
      }
      messageId = sendResult.output.messageId ?? "";
      sendPath = "marketa.send-transactional (Mailjet)";
    }

    const { data: updatedSent, error: sentError } = await supabase
      .schema("marketa")
      .from("marketa_candidate_agents")
      .update({
        outreach_status: "sent",
        activation_status: ["discovered", "outreach_drafted", "scored", "shortlisted"].includes(
          candidate.activationStatus,
        )
          ? "outreach_sent"
          : candidate.activationStatus,
        updated_at: now,
      })
      .eq("id", candidate.id)
      .select("*")
      .single();
    if (sentError) return jsonError("candidate-outreach-sent-update-failed", 500, sentError.message);

    await supabase
      .schema("marketa")
      .from("marketa_activation_events")
      .insert({
        candidate_agent_id: candidate.id,
        event_type: "outreach_sent",
        summary: `Outreach sent to ${to} for ${candidate.name} (operator-approved by ${actor})`,
        actor,
        metadata: {
          to,
          subject,
          messageId,
          sendPath,
          source: "marketa_activation_engine",
        },
      });

    return NextResponse.json(
      {
        ok: true,
        candidate: dbToCandidate(updatedSent as Record<string, unknown>),
        note: `Outreach sent to ${to} via ${sendPath} (message ${messageId || "queued"}). Reply tracking: mark the candidate responded when they answer.`,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // ── Reply flip: the operator records that the candidate answered.
  if (body.action === "mark_responded") {
    if (candidate.outreachStatus !== "sent") {
      return jsonError("not-sent-yet", 409, "Only sent outreach can be marked responded.");
    }
    const { data: updatedResp, error: respError } = await supabase
      .schema("marketa")
      .from("marketa_candidate_agents")
      .update({
        outreach_status: "responded",
        activation_status:
          candidate.activationStatus === "outreach_sent" ? "responded" : candidate.activationStatus,
        updated_at: now,
      })
      .eq("id", candidate.id)
      .select("*")
      .single();
    if (respError) return jsonError("candidate-responded-update-failed", 500, respError.message);

    await supabase
      .schema("marketa")
      .from("marketa_activation_events")
      .insert({
        candidate_agent_id: candidate.id,
        event_type: "outreach_responded",
        summary: `${candidate.name} responded to outreach (recorded by ${actor})`,
        actor,
        metadata: { source: "marketa_activation_engine" },
      });

    return NextResponse.json(
      {
        ok: true,
        candidate: dbToCandidate(updatedResp as Record<string, unknown>),
        note: "Response recorded — candidate moves toward qualification.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // ── Template resolution (golden path #5): explicit templateId wins, else
  // auto-pick an enabled template matching the candidate's lanes ('any' =
  // catch-all), else fall back to the built-in copy. The table is optional —
  // a missing migration just means built-in drafts.
  let template: OutreachTemplate | null = null;
  if (body.templateId) {
    const { data: templateRow, error: templateError } = await supabase
      .schema("marketa")
      .from("marketa_outreach_templates")
      .select("*")
      .eq("id", body.templateId)
      .single();
    if (templateError || !templateRow) {
      return jsonError("template-not-found", 404, templateError?.message);
    }
    template = dbToOutreachTemplate(templateRow as Record<string, unknown>);
  } else {
    const { data: templateRows } = await supabase
      .schema("marketa")
      .from("marketa_outreach_templates")
      .select("*");
    template = pickOutreachTemplate(
      (templateRows ?? []).map(row => dbToOutreachTemplate(row as Record<string, unknown>)),
      candidate.strategicLanes,
    );
  }

  const draft = renderOutreachTemplate(
    template ?? BUILT_IN_OUTREACH_TEMPLATE,
    candidate,
    body.angle ?? "",
  );
  const templateLabel = template ? `template "${template.name}"` : "the built-in template";

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
        templateId: template?.id ?? null,
        templateName: template?.name ?? "built-in",
        source: "marketa_activation_engine",
        existingOutreachPattern: "avl_compose_review_before_send",
      },
    });

  return NextResponse.json(
    {
      ok: true,
      candidate: dbToCandidate(updated as Record<string, unknown>),
      draft,
      note: `Draft only (from ${templateLabel}). No outreach was sent; operator approval remains required.`,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
