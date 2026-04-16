import { NextRequest, NextResponse } from "next/server";
import {
  getMetaMeSettings,
  upsertMetaMeSettings,
} from "@/services/metame/metaMeSettingsService";
import type { MetaMeSettings } from "@/services/metame/metaMeSettingsService";

export const dynamic = "force-dynamic";

/**
 * GET /api/metame/settings?personaId=<id>
 *
 * Returns the metaMe sovereignty settings for the given persona.
 * Falls back to alpha defaults when no row exists.
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

  try {
    const settings = await getMetaMeSettings(personaId);
    return NextResponse.json({ ok: true, data: settings });
  } catch (err) {
    console.error("[metame/settings] GET error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/metame/settings
 * Body: { personaId: string; settings: MetaMeSettings }
 *
 * Upserts the metaMe sovereignty settings for the given persona.
 */
export async function POST(req: NextRequest) {
  let body: { personaId?: string; settings?: MetaMeSettings };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { personaId, settings } = body;

  if (!personaId || typeof personaId !== "string") {
    return NextResponse.json(
      { ok: false, error: "personaId is required" },
      { status: 400 }
    );
  }
  if (!settings || typeof settings !== "object") {
    return NextResponse.json(
      { ok: false, error: "settings object is required" },
      { status: 400 }
    );
  }

  try {
    const saved = await upsertMetaMeSettings(personaId, settings);
    return NextResponse.json({ ok: true, data: saved });
  } catch (err) {
    console.error("[metame/settings] POST error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
