/**
 * GET /api/codex/knyt/governance
 *
 * Returns the OrgQube policy for a given org — the institutional governance
 * envelope covering agents, skills, cartridges, trust thresholds, budget
 * posture, and receipt requirements.
 *
 * Query params:
 *   orgId?  — org/tenant identifier (default: 'nakamoto')
 *
 * Response:
 *   policy  — OrgQube policy row (null if not configured)
 *   isDefault — true if falling back to built-in alpha defaults
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";

export const dynamic = "force-dynamic";

const ALPHA_DEFAULT = {
  orgId:               "nakamoto",
  policyName:          "Nakamoto Alpha Policy",
  allowedAgents:       ["aigent-z", "aigent-c", "aigent-kn0w1", "aigent-marketa", "metame"],
  allowedSkills:       ["*"],
  allowedCartridges:   ["knyt", "qriptopian", "agentiq", "metame"],
  trustThresholdMin:   0,
  skillBudgetPosture:  "open",
  nativeAssetExposure: "none",
  requiredReceipts:    [] as string[],
  escalationBehavior:  {},
  active:              true,
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId") ?? "nakamoto";

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: true, data: { policy: ALPHA_DEFAULT, isDefault: true } });
  }

  try {
    const { data, error } = await supabase
      .from("orgqube_policies")
      .select("*")
      .eq("org_id", orgId)
      .single();

    if (error || !data) {
      return NextResponse.json({ ok: true, data: { policy: ALPHA_DEFAULT, isDefault: true } });
    }

    const row = data as {
      org_id: string;
      policy_name: string | null;
      allowed_agents: string[];
      allowed_skills: string[];
      allowed_cartridges: string[];
      trust_threshold_min: number;
      skill_budget_posture: string;
      native_asset_exposure: string;
      required_receipts: string[];
      escalation_behavior: Record<string, unknown>;
      active: boolean;
    };

    return NextResponse.json({
      ok: true,
      data: {
        policy: {
          orgId:               row.org_id,
          policyName:          row.policy_name ?? "Unnamed Policy",
          allowedAgents:       row.allowed_agents,
          allowedSkills:       row.allowed_skills,
          allowedCartridges:   row.allowed_cartridges,
          trustThresholdMin:   row.trust_threshold_min,
          skillBudgetPosture:  row.skill_budget_posture,
          nativeAssetExposure: row.native_asset_exposure,
          requiredReceipts:    row.required_receipts,
          escalationBehavior:  row.escalation_behavior,
          active:              row.active,
        },
        isDefault: false,
      },
    });
  } catch (err) {
    console.error("[codex/knyt/governance] unexpected error:", err);
    return NextResponse.json({ ok: true, data: { policy: ALPHA_DEFAULT, isDefault: true } });
  }
}
