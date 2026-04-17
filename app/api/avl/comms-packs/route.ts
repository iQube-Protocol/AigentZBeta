/**
 * GET /api/avl/comms-packs
 *
 * Returns all active AVL comms packs from avl_comms_packs.
 */

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "DB unavailable" }, { status: 503 });
  }

  try {
    const { data, error } = await supabase
      .from("avl_comms_packs")
      .select("slug, title, comms_type, template_markdown, subject_lines, cta_options, active")
      .eq("active", true)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (err) {
    console.error("[avl/comms-packs] error:", err);
    return NextResponse.json({ ok: false, error: "Failed to load comms packs" }, { status: 500 });
  }
}
