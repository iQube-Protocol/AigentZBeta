/**
 * GET /api/marketa/campaigns
 *
 * Live campaign stats across all three active cohorts:
 *   - KS Prospects      (ks_backers_staging)
 *   - KNYT Codex        (nakamoto_knyt_personas)
 *   - KNYT Partners     (avl_partner_contacts)
 *
 * Marketa's campaign command centre reads from here.
 */

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "DB unavailable" }, { status: 503 });
  }

  try {
    const [ksResult, knytResult, partnerResult] = await Promise.all([
      supabase.from("ks_backers_staging").select("engagement_status, suppression_status").range(0, 9999),
      supabase.from("nakamoto_knyt_personas").select("campaign_cohort, campaign_state").not("Email", "is", null).range(0, 9999),
      supabase.from("avl_partner_contacts").select("wave, outreach_status").range(0, 999),
    ]);

    // ── KS Prospects ───────────────────────────────────────────────────────────
    const ksRows = ksResult.data ?? [];
    const ksActive = ksRows.filter((r) => r.suppression_status === "active");
    const ksSuppressed = ksRows.filter((r) => r.suppression_status === "suppressed").length;
    const ksOpened  = ksRows.filter((r) => r.engagement_status === "opened").length;
    const ksClicked = ksRows.filter((r) => r.engagement_status === "clicked").length;

    const sentStatuses = new Set(["sent", "opened", "clicked",
      "email_2_sent", "email_3_sent", "email_4_sent",
      "email_5_sent", "email_6_sent", "email_7_sent", "email_8_sent"]);
    const ksEmailsSent = ksRows.filter((r) => sentStatuses.has(r.engagement_status ?? "")).length;

    const maxEmail = ksRows.reduce((max, r) => {
      const m = (r.engagement_status ?? "").match(/^email_(\d+)_sent$/);
      const n = m ? parseInt(m[1], 10) : r.engagement_status === "sent" ? 1 : 0;
      return Math.max(max, n);
    }, 0);
    const nextEmail = Math.min((maxEmail || 1) + 1, 8);

    const ksCampaign = {
      id: "ks_prospects",
      name: "KS Prospects",
      description: "Kickstarter backer outreach — 8-email sequence",
      status: "active",
      cohort_size: ksRows.length,
      active: ksActive.length,
      suppressed: ksSuppressed,
      emails_sent: ksEmailsSent,
      opened: ksOpened,
      clicked: ksClicked,
      open_rate: ksEmailsSent > 0 ? Math.round((ksOpened / ksEmailsSent) * 100) : 0,
      click_rate: ksEmailsSent > 0 ? Math.round((ksClicked / ksEmailsSent) * 100) : 0,
      current_email: maxEmail || 1,
      next_email: nextEmail,
      next_action: `Fire Email ${nextEmail} — targets contacts who received E${maxEmail || 1}`,
      send_command: `node scripts/send-ks-prospects-sequence.js --email ${nextEmail} --dry-run`,
    };

    // ── KNYT Codex investors ───────────────────────────────────────────────────
    const knytRows = knytResult.data ?? [];
    const knytSubCohorts = (["top_shelf", "zero_knyt", "reactivation", "general"] as const).map((cohort) => {
      const rows = knytRows.filter((r) => r.campaign_cohort === cohort);
      const sent    = rows.filter((r) => r.campaign_state && r.campaign_state !== "unsent").length;
      const opened  = rows.filter((r) => ["opened", "clicked", "backed"].includes(r.campaign_state ?? "")).length;
      const clicked = rows.filter((r) => ["clicked", "backed"].includes(r.campaign_state ?? "")).length;
      const backed  = rows.filter((r) => r.campaign_state === "backed").length;
      return {
        cohort,
        size: rows.length,
        sent,
        unsent: rows.length - sent,
        opened,
        clicked,
        backed,
        open_rate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
        status: sent === 0 ? "pending" : sent < rows.length ? "partial" : "complete",
      };
    });

    const knytUnassigned = knytRows.filter((r) => !r.campaign_cohort).length;
    const knytPending = knytSubCohorts.find((c) => c.status === "pending" && c.size > 0);

    const knytCampaign = {
      id: "knyt_codex",
      name: "KNYT Codex Investors",
      description: "Canonical investor CRM — 4 sub-cohorts, priority sequenced",
      status: "active",
      cohort_size: knytRows.length,
      unassigned: knytUnassigned,
      sub_cohorts: knytSubCohorts,
      next_action: knytPending
        ? `Fire ${knytPending.cohort} — ${knytPending.size} contacts`
        : "All cohorts sent — monitor responses",
      send_command: knytPending
        ? `python3 scripts/send_campaign_sequence.py --sequence knyt_${knytPending.cohort}_v1 --cohort ${knytPending.cohort} --dry-run`
        : null,
    };

    // ── KNYT Partners ──────────────────────────────────────────────────────────
    const partnerRows = partnerResult.data ?? [];
    const wave1 = partnerRows.filter((r) => r.wave === 1);
    const wave2 = partnerRows.filter((r) => r.wave === 2);
    const pendingStatuses = new Set(["pending", "not_started", null, undefined]);

    const partnerCampaign = {
      id: "knyt_partners",
      name: "KNYT Partners",
      description: "18 AVL strategic partners — 2 activation waves",
      status: "pending",
      total: partnerRows.length,
      wave_1: {
        total: wave1.length,
        contacted: wave1.filter((r) => !pendingStatuses.has(r.outreach_status)).length,
        responded: wave1.filter((r) => ["responded", "engaged", "active"].includes(r.outreach_status ?? "")).length,
      },
      wave_2: {
        total: wave2.length,
        contacted: wave2.filter((r) => !pendingStatuses.has(r.outreach_status)).length,
      },
      next_action: "Launch Wave 1 — personalised outreach to all 18 partners",
      send_command: null,
    };

    return NextResponse.json({
      ok: true,
      as_of: new Date().toISOString(),
      campaigns: [ksCampaign, knytCampaign, partnerCampaign],
    });
  } catch (err) {
    console.error("[marketa/campaigns] error:", err);
    return NextResponse.json({ ok: false, error: "Failed to load campaign data" }, { status: 500 });
  }
}
