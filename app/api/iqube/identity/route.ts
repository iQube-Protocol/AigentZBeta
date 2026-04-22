/**
 * GET  /api/iqube/identity  — load the user's Identity iQube (auto-seeded from KNYT CRM on first access)
 * PATCH /api/iqube/identity — save changes (user-editable fields only)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase configuration missing");
  return createClient(url, key);
}

const USER_EDITABLE = new Set([
  "first_name", "last_name", "middle_name", "date_of_birth",
  "emails", "phones", "addresses",
  "driving_license_number", "driving_license_state", "driving_license_expiry",
  "fio_handle",
]);

function createAuthClient(authHeader: string | null) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Supabase configuration missing");
  const token = authHeader?.replace(/^Bearer\s+/i, "") ?? anon;
  return createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createAuthClient(request.headers.get("Authorization"));
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: row, error } = await supabase
      .from("identity_iqubes")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Auto-seed from KNYT CRM data on first access
    if (!row) {
      const service = createServiceClient();

      // Find the KNYT persona for this user (by user_id, falling back to email)
      let knytRow: Record<string, unknown> | null = null;
      const { data: byUserId } = await service
        .from("nakamoto_knyt_personas")
        .select('"First-Name","Last-Name","Email","Phone-Number","Address"')
        .eq("user_id", user.id)
        .maybeSingle();
      knytRow = byUserId as Record<string, unknown> | null;

      if (!knytRow && user.email) {
        const { data: byEmail } = await service
          .from("nakamoto_knyt_personas")
          .select('"First-Name","Last-Name","Email","Phone-Number","Address"')
          .ilike("Email", user.email)
          .maybeSingle();
        knytRow = byEmail as Record<string, unknown> | null;
      }

      if (knytRow) {
        const now = new Date().toISOString();
        const seed: Record<string, unknown> = {
          user_id: user.id,
          first_name: (knytRow["First-Name"] as string) || "",
          last_name: (knytRow["Last-Name"] as string) || "",
          updated_at: now,
        };

        const crmEmail = (knytRow["Email"] as string) || "";
        if (crmEmail) {
          seed.emails = [{ id: crypto.randomUUID(), address: crmEmail, label: "primary", primary: true }];
        }

        const phone = (knytRow["Phone-Number"] as string) || "";
        if (phone) {
          seed.phones = [{ id: crypto.randomUUID(), number: phone, label: "primary", primary: true }];
        }

        const address = (knytRow["Address"] as string) || "";
        if (address) {
          seed.addresses = [{ id: crypto.randomUUID(), street: address, label: "primary", primary: true }];
        }

        const { data: seeded, error: seedErr } = await service
          .from("identity_iqubes")
          .upsert(seed, { onConflict: "user_id" })
          .select("*")
          .single();

        if (!seedErr && seeded) {
          return NextResponse.json({ exists: true, data: seeded });
        }
      }

      return NextResponse.json({ exists: false, data: null });
    }

    return NextResponse.json({ exists: true, data: row });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createAuthClient(request.headers.get("Authorization"));
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json() as Record<string, unknown>;

    // Filter to allowed fields only
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (USER_EDITABLE.has(k)) patch[k] = v;
    }
    patch.updated_at = new Date().toISOString();

    // Upsert — create row if it doesn't exist yet
    const { data, error } = await supabase
      .from("identity_iqubes")
      .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
