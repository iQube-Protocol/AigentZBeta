/**
 * GET  /api/iqube/persona/knyt  — returns the calling user's KNYT Persona iQube
 * PATCH /api/iqube/persona/knyt — updates user-editable fields only
 *
 * Auth: reads user_id from Authorization Bearer token (Supabase session).
 * Admin-only fields are stripped from the GET response.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  personaTable,
  shapeAsIQube,
  refreshKnytBalance,
  filterPatch,
  getUserEditableFields,
  createServerClient,
} from "../_lib";

export const dynamic = "force-dynamic";

function createAuthClient(authHeader: string | null) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Supabase configuration missing");
  const token = authHeader?.replace(/^Bearer\s+/i, "") ?? anon;
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createAuthClient(request.headers.get("Authorization"));
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: row, error } = await supabase
      .from(personaTable("knyt"))
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // CRM auto-seed: if no platform row, link or create one from CRM data keyed by email
    let resolvedRow = row;
    if (!row && user.email) {
      const service = createServerClient();
      const { data: crmRow } = await service
        .from(personaTable("knyt"))
        .select("*")
        .ilike("Email", user.email)
        .is("user_id", null)
        .maybeSingle();

      if (crmRow) {
        // Link existing CRM record to this platform user
        const { data: linked } = await service
          .from(personaTable("knyt"))
          .update({ user_id: user.id, platform_activated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", crmRow.id as string)
          .select("*")
          .maybeSingle();
        resolvedRow = linked;
      }
    }

    if (!resolvedRow) return NextResponse.json({ exists: false, data: null }, { status: 200 });

    // Refresh KNYT-COYN-Owned from chain if EVM address present (non-blocking)
    void refreshKnytBalance(supabase, resolvedRow as Record<string, unknown>);

    const shaped = shapeAsIQube(resolvedRow as Record<string, unknown>, "knyt", false);
    return NextResponse.json({ exists: true, data: shaped });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createAuthClient(request.headers.get("Authorization"));
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const allowed = getUserEditableFields("knyt");
    const patch = filterPatch(body as Record<string, unknown>, allowed);

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
    }

    patch.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from(personaTable("knyt"))
      .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" })
      .select("*")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const shaped = shapeAsIQube(data as Record<string, unknown>, "knyt", false);
    return NextResponse.json({ data: shaped });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
