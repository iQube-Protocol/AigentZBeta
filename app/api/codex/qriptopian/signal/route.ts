/**
 * GET  /api/codex/qriptopian/signal
 *   Returns aggregated KNYT engagement signals from knyt_signals.
 *   Powers the outbound direction of the Qriptopian↔KNYT bidirectional flow:
 *   KNYT participation (likes, sparks, curations) creates editorial context
 *   back in the Qriptopian Terra tab — hot content surfaces prominently.
 *
 *   Query params:
 *     limit?     — max content IDs to return as hot (default 10)
 *     since?     — ISO date string; only count signals after this date
 *
 *   Response:
 *     hotContentIds  — content IDs ranked by signal count (descending)
 *     signalCounts   — per-content { like, spark, curate } totals
 *     signalSummary  — org-wide { totalLikes, totalSparks, totalCurations }
 *     totalSignals   — total signals in window
 *
 * POST /api/codex/qriptopian/signal
 *   Logs Qriptopian engagement/amplification events for KNYT-related content.
 *   Acts as the signal bridge between Qriptopian (prepares and amplifies) and
 *   KNYT (activates and retains), per 17-qriptopian-support-spec.md.
 *
 *   Signal types:
 *     view  — content viewed; metered to Qc ledger, no reward
 *     share — content shared; metered + Herald of the Order reward eligible
 *     like  — positive signal; metered + inserts into knyt_signals
 *     spark — strong endorsement; metered + inserts into knyt_signals
 *
 *   All events are fire-and-forget / metered at 0 Qc in alpha.
 *   Share events with a personaId trigger HeraldCuriosityClicks reward evaluation.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import { logQcEventSilent } from "@/services/qc/qcEventService";
import { emitReceiptSilent } from "@/services/registry/receiptEmitter";
import { getRewardService, RewardTaskType } from "@/services/rewards/rewardService";

export const dynamic = "force-dynamic";

// ─── GET — aggregated signal feed (outbound KNYT → Qriptopian) ───────────────

export async function GET(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: true, data: null, debug: "no_supabase" });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "10", 10), 50);
  const since = searchParams.get("since") ?? undefined;

  try {
    let query = supabase
      .from("knyt_signals")
      .select("content_id, signal_type");

    if (since) {
      query = query.gte("created_at", since);
    }

    const { data, error } = await query.limit(2000);

    if (error || !data) {
      // Table may not exist yet in all environments — return empty gracefully
      return NextResponse.json({
        ok: true,
        data: {
          hotContentIds: [],
          signalCounts: {},
          signalSummary: { totalLikes: 0, totalSparks: 0, totalCurations: 0 },
          totalSignals: 0,
        },
      });
    }

    // Aggregate per content_id
    const counts: Record<string, { like: number; spark: number; curate: number; total: number }> = {};
    let totalLikes = 0, totalSparks = 0, totalCurations = 0;

    for (const row of data as Array<{ content_id: string; signal_type: string }>) {
      if (!counts[row.content_id]) {
        counts[row.content_id] = { like: 0, spark: 0, curate: 0, total: 0 };
      }
      counts[row.content_id][row.signal_type as "like" | "spark" | "curate"]++;
      counts[row.content_id].total++;
      if (row.signal_type === "like") totalLikes++;
      else if (row.signal_type === "spark") totalSparks++;
      else if (row.signal_type === "curate") totalCurations++;
    }

    // Sort by total signals desc, take top N
    const hotContentIds = Object.entries(counts)
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, limit)
      .map(([id]) => id);

    return NextResponse.json({
      ok: true,
      data: {
        hotContentIds,
        signalCounts: counts,
        signalSummary: { totalLikes, totalSparks, totalCurations },
        totalSignals: data.length,
      },
    });
  } catch (err) {
    console.error("[qriptopian/signal] GET error:", err);
    return NextResponse.json({
      ok: true,
      data: {
        hotContentIds: [],
        signalCounts: {},
        signalSummary: { totalLikes: 0, totalSparks: 0, totalCurations: 0 },
        totalSignals: 0,
      },
    });
  }
}

// ─── POST — log engagement signal ────────────────────────────────────────────

type QriptopianSignalType = "view" | "share" | "like" | "spark";

// knyt_signals table only accepts these three types
const KNYT_SIGNAL_TYPES = new Set(["like", "spark", "curate"]);

export async function POST(req: NextRequest) {
  let body: {
    personaId?: string;
    contentId?: string;
    signalType?: QriptopianSignalType;
    platform?: string;
    metadata?: Record<string, unknown>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { personaId, contentId, signalType, platform, metadata = {} } = body;

  if (!contentId || typeof contentId !== "string") {
    return NextResponse.json({ ok: false, error: "contentId is required" }, { status: 400 });
  }
  if (!signalType || !["view", "share", "like", "spark"].includes(signalType)) {
    return NextResponse.json(
      { ok: false, error: "signalType must be one of: view, share, like, spark" },
      { status: 400 }
    );
  }

  const actorId = personaId ?? "anonymous";

  // view signals are free content access — no Qc metering, no receipt.
  // Only share/like/spark represent economically meaningful participation.
  const isParticipationSignal = signalType !== "view";

  // ── 1. Log Qc event for participation signals only ────────────────────────
  if (isParticipationSignal) {
    logQcEventSilent({
      personaId: actorId,
      actionType: "session_metered",
      amountQc: 0,
      direction: "meter",
      cartridgeId: "qriptopian",
      metadata: {
        signalType,
        contentId,
        platform: platform ?? null,
        source: "qriptopian_content",
        ...metadata,
      },
    });
  }

  // ── 2. Emit DVN receipt for participation signals only ────────────────────
  if (isParticipationSignal) {
    emitReceiptSilent({
      eventType: "participation.metered",
      actorId,
      tenantId: "platform",
      payload: {
        signalType,
        contentId,
        platform: platform ?? null,
        cartridgeId: "qriptopian",
      },
    });
  }

  // ── 3. Insert into knyt_signals for like/spark (engagement signals) ───────
  if (personaId && KNYT_SIGNAL_TYPES.has(signalType)) {
    const supabase = getSupabaseServer();
    if (supabase) {
      // Upsert: unique constraint on (persona_id, content_id, signal_type)
      await supabase
        .from("knyt_signals")
        .upsert(
          { persona_id: personaId, content_id: contentId, signal_type: signalType },
          { onConflict: "persona_id,content_id,signal_type", ignoreDuplicates: true }
        )
        .then(({ error }) => {
          if (error) console.warn("[qriptopian/signal] knyt_signals upsert:", error.message);
        });
    }
  }

  // ── 4. Herald reward on share (personaId required) ────────────────────────
  let rewardResult: { granted: boolean; amount?: number; error?: string } = { granted: false };
  if (signalType === "share" && personaId) {
    try {
      const svc = getRewardService();
      const result = await svc.grantRewardForTask({
        personaId,
        taskType: RewardTaskType.HeraldCuriosityClicks,
        sourceEventId: contentId,
        metadata: {
          signalType,
          contentId,
          platform: platform ?? null,
          cartridgeId: "qriptopian",
        },
      });
      rewardResult = result.success
        ? { granted: true, amount: result.finalAmount }
        : { granted: false, error: result.error };
    } catch (err) {
      console.warn("[qriptopian/signal] Herald reward evaluation failed:", err);
      rewardResult = { granted: false, error: "reward evaluation error" };
    }
  }

  return NextResponse.json({
    ok: true,
    data: {
      signalType,
      contentId,
      personaId: personaId ?? null,
      metered: true,
      reward: rewardResult,
    },
  });
}
