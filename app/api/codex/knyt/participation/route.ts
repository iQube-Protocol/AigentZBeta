/**
 * GET /api/codex/knyt/participation
 *
 * Returns KNYT participation status at org, cohort, and individual levels.
 *
 * Query params:
 *   personaId?   — individual persona (optional; adds individual section)
 *   tenantId?    — tenant/org scope (default: 'nakamoto')
 *   limit?       — max recent events to return (default: 20)
 *
 * Response:
 *   org         — aggregate stats across the whole org (reward grants, receipts, skill invocations)
 *   cohorts     — per-role/group breakdown from knyt_persona_roles
 *   individual? — individual stats when personaId provided
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";

export const dynamic = "force-dynamic";

interface OrgStats {
  totalRewardGrants: number;
  totalQcEvents: number;
  totalReceipts: number;
  provisionalGrants: number;
  finalizedGrants: number;
}

interface CohortEntry {
  role: string;
  personaCount: number;
  totalGrantsForRole: number;
}

interface IndividualStats {
  personaId: string;
  rewardGrants: number;
  provisionalBalance: number;
  qcEvents: number;
  lastActivityAt: string | null;
  recentEvents: Array<{
    eventId: string;
    actionType: string;
    direction: string;
    amountQc: number;
    provisional: boolean;
    createdAt: string;
    skillId: string | null;
  }>;
}

export async function GET(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: true, data: null, debug: "no_supabase" });
  }

  const { searchParams } = new URL(req.url);
  const personaId = searchParams.get("personaId") ?? undefined;
  const tenantId  = searchParams.get("tenantId") ?? "nakamoto";
  const limit     = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);

  try {
    // ── Org-level stats ───────────────────────────────────────────────────────
    const [grantsRes, qcRes, receiptsRes] = await Promise.all([
      supabase
        .from("knyt_reward_grants")
        .select("id, amount_knyt, provisional", { count: "exact" })
        .limit(1000),
      supabase
        .from("qc_events")
        .select("event_id, provisional", { count: "exact" })
        .eq("cartridge_id", "knyt")
        .limit(1000),
      supabase
        .from("registry_receipts")
        .select("receipt_id, provisional", { count: "exact" })
        .limit(1000),
    ]);

    const grants   = (grantsRes.data  ?? []) as Array<{ id: string; amount_knyt: number; provisional: boolean }>;
    const qcEvents = (qcRes.data      ?? []) as Array<{ event_id: string; provisional: boolean }>;
    const receipts = (receiptsRes.data ?? []) as Array<{ receipt_id: string; provisional: boolean }>;

    const org: OrgStats = {
      totalRewardGrants:  grantsRes.count ?? grants.length,
      totalQcEvents:      qcRes.count    ?? qcEvents.length,
      totalReceipts:      receiptsRes.count ?? receipts.length,
      provisionalGrants:  grants.filter((g) => g.provisional).length,
      finalizedGrants:    grants.filter((g) => !g.provisional).length,
    };

    // ── Cohort breakdown via knyt_persona_roles ───────────────────────────────
    let cohorts: CohortEntry[] = [];
    try {
      const rolesRes = await supabase
        .from("knyt_persona_roles")
        .select("role, persona_id");

      if (!rolesRes.error && rolesRes.data) {
        const byRole = (rolesRes.data as Array<{ role: string; persona_id: string }>).reduce<
          Record<string, Set<string>>
        >((acc, row) => {
          if (!acc[row.role]) acc[row.role] = new Set();
          acc[row.role].add(row.persona_id);
          return acc;
        }, {});

        cohorts = Object.entries(byRole).map(([role, personas]) => ({
          role,
          personaCount: personas.size,
          totalGrantsForRole: 0, // would require join — placeholder for alpha
        }));
      }
    } catch {
      // knyt_persona_roles may not exist in all environments
    }

    // ── Individual stats ──────────────────────────────────────────────────────
    let individual: IndividualStats | null = null;
    if (personaId) {
      const [iGrantsRes, iQcRes] = await Promise.all([
        supabase
          .from("knyt_reward_grants")
          .select("id, amount_knyt, provisional")
          .eq("persona_id", personaId),
        supabase
          .from("qc_events")
          .select("event_id, action_type, direction, amount_qc, provisional, created_at, skill_id")
          .eq("persona_id", personaId)
          .eq("cartridge_id", "knyt")
          .order("created_at", { ascending: false })
          .limit(limit),
      ]);

      const iGrants    = (iGrantsRes.data ?? []) as Array<{ id: string; amount_knyt: number; provisional: boolean }>;
      const iQcEvents  = (iQcRes.data ?? []) as Array<{
        event_id: string;
        action_type: string;
        direction: string;
        amount_qc: number;
        provisional: boolean;
        created_at: string;
        skill_id: string | null;
      }>;

      const provisionalTotal = iGrants
        .filter((g) => g.provisional)
        .reduce((sum, g) => sum + (g.amount_knyt ?? 0), 0);

      individual = {
        personaId,
        rewardGrants:        iGrants.length,
        provisionalBalance:  provisionalTotal,
        qcEvents:            iQcEvents.length,
        lastActivityAt:      iQcEvents[0]?.created_at ?? null,
        recentEvents: iQcEvents.map((e) => ({
          eventId:    e.event_id,
          actionType: e.action_type,
          direction:  e.direction,
          amountQc:   e.amount_qc,
          provisional: e.provisional,
          createdAt:  e.created_at,
          skillId:    e.skill_id,
        })),
      };
    }

    return NextResponse.json({
      ok: true,
      data: {
        tenantId,
        org,
        cohorts,
        individual: individual ?? undefined,
      },
    });
  } catch (err) {
    console.error("[codex/knyt/participation] unexpected error:", err);
    return NextResponse.json({ ok: true, data: null, debug: "caught_error" });
  }
}
