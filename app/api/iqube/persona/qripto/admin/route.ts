/**
 * GET  /api/iqube/persona/qripto/admin?userId=<uuid>
 * PATCH /api/iqube/persona/qripto/admin?userId=<uuid>
 *
 * Admin-gated full read/write for Qripto Persona iQube records.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createServerClient,
  isAdminEmail,
  personaTable,
  shapeAsIQube,
  filterPatch,
  getAdminEditableFields,
} from "../../_lib";

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

async function resolveAdminAccess(authHeader: string | null) {
  const authClient = createAuthClient(authHeader);
  const { data: { user } } = await authClient.auth.getUser();
  if (!user?.email) return { user: null, isAdmin: false };
  const serviceClient = createServerClient();
  const admin = await isAdminEmail(serviceClient, user.email);
  return { user, isAdmin: admin };
}

export async function GET(request: NextRequest) {
  try {
    const { user, isAdmin } = await resolveAdminAccess(
      request.headers.get("Authorization")
    );
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const userId = new URL(request.url).searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const supabase = createServerClient();
    const { data: row, error } = await supabase
      .from(personaTable("qripto"))
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!row) return NextResponse.json({ exists: false, data: null });

    const shaped = shapeAsIQube(row as Record<string, unknown>, "qripto", true);
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
    const { user, isAdmin } = await resolveAdminAccess(
      request.headers.get("Authorization")
    );
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const userId = new URL(request.url).searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const body = await request.json();
    const allowed = getAdminEditableFields("qripto");
    const patch = filterPatch(body as Record<string, unknown>, allowed);

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
    }

    patch.updated_at = new Date().toISOString();

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from(personaTable("qripto"))
      .update(patch)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const shaped = shapeAsIQube(data as Record<string, unknown>, "qripto", true);
    return NextResponse.json({ data: shaped });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
