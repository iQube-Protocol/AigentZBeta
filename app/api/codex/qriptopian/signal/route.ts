/**
 * POST /api/codex/qriptopian/signal
 *
 * Logs Qriptopian engagement/amplification events for KNYT-related content.
 * Acts as the signal bridge between Qriptopian (prepares and amplifies) and
 * KNYT (activates and retains), per 17-qriptopian-support-spec.md.
 *
 * Signal types:
 *   view  — content viewed; metered to Qc ledger, no reward
 *   share — content shared; metered + Herald of the Order reward eligible
 *   like  — positive signal; metered + inserts into knyt_signals
 *   spark — strong endorsement; metered + inserts into knyt_signals
 *
 * All events are fire-and-forget / metered at 0 Qc in alpha.
 * Share events with a personaId trigger HeraldCuriosityClicks reward evaluation.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import { logQcEventSilent } from "@/services/qc/qcEventService";
import { emitReceiptSilent } from "@/services/registry/receiptEmitter";
import { getRewardService, RewardTaskType } from "@/services/rewards/rewardService";

export const dynamic = "force-dynamic";

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

  // ── 1. Log Qc event (fire-and-forget, 0 Qc in alpha) ─────────────────────
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

  // ── 2. Emit DVN participation receipt (fire-and-forget) ───────────────────
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
