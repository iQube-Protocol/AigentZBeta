/**
 * Cartridge Defaults API
 *
 * GET  — return { defaults: { [slug]: personaId } } for the authenticated caller
 * PUT  — upsert a single { slug, personaId } preference
 *
 * Table required (run once in Supabase SQL editor):
 *
 *   CREATE TABLE IF NOT EXISTS persona_cartridge_defaults (
 *     id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     auth_profile_id TEXT NOT NULL,
 *     cartridge_slug  TEXT NOT NULL,
 *     persona_id      TEXT NOT NULL,
 *     created_at      TIMESTAMPTZ DEFAULT now(),
 *     updated_at      TIMESTAMPTZ DEFAULT now(),
 *     UNIQUE (auth_profile_id, cartridge_slug)
 *   );
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCallerAuthProfileId } from "@/services/wallet/personaRepo";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
);

export async function GET(request: NextRequest) {
  const authProfileId = await getCallerAuthProfileId(request);
  if (!authProfileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("persona_cartridge_defaults")
    .select("cartridge_slug, persona_id")
    .eq("auth_profile_id", authProfileId);

  if (error) {
    console.error("[cartridge-defaults GET]", error);
    return NextResponse.json({ error: "Failed to fetch defaults" }, { status: 500 });
  }

  const defaults: Record<string, string> = {};
  for (const row of data ?? []) {
    defaults[row.cartridge_slug] = row.persona_id;
  }

  return NextResponse.json({ defaults });
}

export async function PUT(request: NextRequest) {
  const authProfileId = await getCallerAuthProfileId(request);
  if (!authProfileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug =
    body && typeof body === "object" && "slug" in body && typeof (body as Record<string, unknown>).slug === "string"
      ? ((body as Record<string, unknown>).slug as string).trim()
      : null;
  const personaId =
    body && typeof body === "object" && "personaId" in body && typeof (body as Record<string, unknown>).personaId === "string"
      ? ((body as Record<string, unknown>).personaId as string).trim()
      : null;

  if (!slug || !personaId) {
    return NextResponse.json({ error: "Missing slug or personaId" }, { status: 400 });
  }

  const { error } = await supabase.from("persona_cartridge_defaults").upsert(
    {
      auth_profile_id: authProfileId,
      cartridge_slug: slug,
      persona_id: personaId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "auth_profile_id,cartridge_slug" }
  );

  if (error) {
    console.error("[cartridge-defaults PUT]", error);
    return NextResponse.json({ error: "Failed to save default" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const authProfileId = await getCallerAuthProfileId(request);
  if (!authProfileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const { error } = await supabase
    .from("persona_cartridge_defaults")
    .delete()
    .eq("auth_profile_id", authProfileId)
    .eq("cartridge_slug", slug);

  if (error) {
    console.error("[cartridge-defaults DELETE]", error);
    return NextResponse.json({ error: "Failed to delete default" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
