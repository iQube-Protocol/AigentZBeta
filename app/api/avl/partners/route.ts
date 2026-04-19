/**
 * GET /api/avl/partners
 *
 * Returns all AVL partner contacts from avl_partner_contacts.
 * Sorted by strategic_value_tier ASC then name ASC.
 *
 * Query params:
 *   wave? — filter by wave number (1 | 2)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wave = searchParams.get("wave");

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "DB unavailable" }, { status: 503 });
  }

  try {
    let query = supabase
      .from("avl_partner_contacts")
      .select("*")
      .order("strategic_value_tier", { ascending: true })
      .order("name", { ascending: true });

    if (wave) {
      query = query.eq("wave", parseInt(wave, 10));
    }

    const { data, error } = await query;
    if (error) throw error;

    const partners = (data ?? []) as Array<{
      id: string;
      name: string;
      org: string;
      wave: number;
      contact_email: string | null;
      contact_name: string | null;
      outreach_status: string;
      bd_stage: string;
      first_contact_at: string | null;
      last_contact_at: string | null;
      response_signal: string | null;
      strategic_value_tier: number | null;
      audience_overlap_notes: string | null;
      next_action: string | null;
      assigned_agent: string;
      notes: string | null;
      created_at: string;
    }>;

    const summary = {
      total:       partners.length,
      wave1:       partners.filter((p) => p.wave === 1).length,
      wave2:       partners.filter((p) => p.wave === 2).length,
      tier1:       partners.filter((p) => p.strategic_value_tier === 1).length,
      uncontacted: partners.filter((p) => p.outreach_status === "uncontacted").length,
      responded:   partners.filter((p) => p.outreach_status === "responded").length,
    };

    return NextResponse.json({ ok: true, data: { partners, summary } });
  } catch (err) {
    console.error("[avl/partners] error:", err);
    return NextResponse.json({ ok: false, error: "Failed to load partners" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "DB unavailable" }, { status: 503 });
  }

  try {
    const { id, ...fields } = await req.json() as { id: string; [key: string]: unknown };
    if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

    const allowed = ["outreach_status", "bd_stage", "next_action", "notes", "contact_email", "contact_name", "response_signal", "wave", "strategic_value_tier", "name", "org"];
    const update = Object.fromEntries(
      Object.entries(fields).filter(([k]) => allowed.includes(k))
    );

    const { error } = await supabase
      .from("avl_partner_contacts")
      .update(update)
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[avl/partners PATCH] error:", err);
    return NextResponse.json({ ok: false, error: "Update failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "DB unavailable" }, { status: 503 });
  }

  try {
    const body = await req.json() as {
      name?: string;
      org?: string;
      wave?: number;
      contact_name?: string;
      contact_email?: string;
      strategic_value_tier?: number;
      audience_overlap_notes?: string;
      assigned_agent?: string;
    };

    if (!body.name?.trim()) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });

    const { data, error } = await supabase
      .from("avl_partner_contacts")
      .insert({
        name:                  body.name.trim(),
        org:                   (body.org ?? body.name).trim(),
        wave:                  body.wave ?? 1,
        contact_name:          body.contact_name?.trim() || null,
        contact_email:         body.contact_email?.trim() || null,
        strategic_value_tier:  body.strategic_value_tier ?? 2,
        audience_overlap_notes: body.audience_overlap_notes?.trim() || null,
        assigned_agent:        body.assigned_agent ?? "marketa",
      })
      .select("id")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, id: (data as { id: string }).id });
  } catch (err) {
    console.error("[avl/partners POST] error:", err);
    return NextResponse.json({ ok: false, error: "Create failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, error: "DB unavailable" }, { status: 503 });

  try {
    const { error } = await supabase.from("avl_partner_contacts").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[avl/partners DELETE] error:", err);
    return NextResponse.json({ ok: false, error: "Delete failed" }, { status: 500 });
  }
}
