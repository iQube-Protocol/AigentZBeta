/**
 * GET  /api/iqube/persona/qripto  — returns the calling user's Qripto Persona iQube
 * PATCH /api/iqube/persona/qripto — updates user-editable fields only
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  personaTable,
  shapeAsIQube,
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
      .from(personaTable("qripto"))
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // CRM auto-seed: find by email (any user_id state) and link if unlinked
    let resolvedRow = row;
    if (!row && user.email) {
      const service = createServerClient();
      const { data: crmRow } = await service
        .from(personaTable("qripto"))
        .select("*")
        .ilike("Email", user.email)
        .maybeSingle();

      if (crmRow) {
        // Only stamp user_id if the record is unlinked — never overwrite a different user's link
        if (crmRow.user_id == null) {
          const { data: linked } = await service
            .from(personaTable("qripto"))
            .update({ user_id: user.id, updated_at: new Date().toISOString() })
            .eq("id", crmRow.id as string)
            .select("*")
            .maybeSingle();
          resolvedRow = linked ?? crmRow;
        } else {
          resolvedRow = crmRow;
        }
      }
    }

    if (!resolvedRow) return NextResponse.json({ exists: false, data: null });

    const shaped = shapeAsIQube(resolvedRow as Record<string, unknown>, "qripto", false);
    return NextResponse.json({ exists: true, data: shaped });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
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
    const allowed = getUserEditableFields("qripto");
    const patch = filterPatch(body as Record<string, unknown>, allowed);

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
    }

    patch.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from(personaTable("qripto"))
      .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" })
      .select("*")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const shaped = shapeAsIQube(data as Record<string, unknown>, "qripto", false);
    return NextResponse.json({ data: shaped });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
