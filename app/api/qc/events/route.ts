import { NextRequest, NextResponse } from "next/server";
import { listQcEvents } from "@/services/qc/qcEventService";

export const dynamic = "force-dynamic";

/**
 * GET /api/qc/events?personaId=<id>&cartridgeId=<id>&limit=<n>
 *
 * Returns the Qc event ledger for a persona — newest first.
 * cartridgeId and limit are optional filters.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const personaId = searchParams.get("personaId");

  if (!personaId) {
    return NextResponse.json(
      { ok: false, error: "personaId is required" },
      { status: 400 }
    );
  }

  const cartridgeId = searchParams.get("cartridgeId") ?? undefined;
  const limit = searchParams.get("limit")
    ? parseInt(searchParams.get("limit")!, 10)
    : 50;

  try {
    const events = await listQcEvents(personaId, { cartridgeId, limit });
    return NextResponse.json({ ok: true, data: events, count: events.length });
  } catch (err) {
    console.error("[qc/events] GET error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
