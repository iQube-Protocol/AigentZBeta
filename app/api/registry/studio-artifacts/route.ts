import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";

/**
 * GET /api/registry/studio-artifacts?personaId=<id>
 *
 * Returns the most recent studio_artifact for a persona.
 * Queries by persona_id first; falls back to created_by if no persona_id column.
 * Returns graceful empty on missing table (42P01).
 */
export async function GET(req: NextRequest) {
  try {
    const personaId = new URL(req.url).searchParams.get("personaId");
    if (!personaId) {
      return NextResponse.json({ ok: false, error: "personaId is required" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    if (!supabase) {
      return NextResponse.json({ ok: true, data: null, _note: "supabase_unavailable" });
    }

    // Try persona_id column first (canonical)
    const { data, error } = await (supabase as any)
      .from("studio_artifacts")
      .select("id, status, artifact_type, created_at, updated_at, persona_id, created_by")
      .eq("persona_id", personaId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      // If persona_id column doesn't exist, fall back to created_by
      if (error.message?.includes("persona_id") || error.message?.includes("column")) {
        const { data: fallback, error: fbError } = await (supabase as any)
          .from("studio_artifacts")
          .select("id, status, artifact_type, created_at, updated_at, created_by")
          .eq("created_by", personaId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fbError) {
          const msg = fbError.message ?? "";
          if (msg.includes("42P01") || msg.includes("does not exist") || msg.includes("relation")) {
            return NextResponse.json({ ok: true, data: null, _note: "table_pending" });
          }
          throw new Error(fbError.message);
        }
        return NextResponse.json({ ok: true, data: fallback ?? null });
      }

      const msg = error.message ?? "";
      if (msg.includes("42P01") || msg.includes("does not exist") || msg.includes("relation")) {
        return NextResponse.json({ ok: true, data: null, _note: "table_pending" });
      }
      throw new Error(msg);
    }

    return NextResponse.json({ ok: true, data: data ?? null });
  } catch (err) {
    console.error("[registry/studio-artifacts] GET error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/registry/studio-artifacts
 *
 * Create a StudioArtifact record — the canonical handoff object when Studio
 * hands work off to Codex or the Registry. Called at composition save.
 *
 * Body: { job_id, source_surface, created_by, target_surfaces?,
 *         journey_segments_affected?, ui_surfaces_affected?,
 *         package_dependencies?, codex_entry_ids? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { job_id, source_surface, created_by } = body;

    if (!job_id || !source_surface || !created_by) {
      return NextResponse.json(
        { ok: false, error: "job_id, source_surface, and created_by are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Database unavailable" }, { status: 503 });
    }

    const { data, error } = await (supabase as any)
      .from("studio_artifacts")
      .insert({
        job_id,
        source_surface,
        created_by,
        status: body.status ?? "draft",
        target_surfaces: body.target_surfaces ?? [],
        journey_segments_affected: body.journey_segments_affected ?? [],
        ui_surfaces_affected: body.ui_surfaces_affected ?? [],
        package_dependencies: body.package_dependencies ?? [],
        codex_entry_ids: body.codex_entry_ids ?? [],
        validation_status: "pending",
        rollback_available: false,
      })
      .select()
      .single();

    if (error) {
      const msg = error.message ?? "";
      if (msg.includes("42P01") || msg.includes("does not exist")) {
        return NextResponse.json({ ok: false, error: "studio_artifacts table not yet migrated" }, { status: 503 });
      }
      if (msg.includes("23505")) {
        return NextResponse.json({ ok: false, error: `Artifact with job_id '${job_id}' already exists` }, { status: 409 });
      }
      throw new Error(msg);
    }

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (err) {
    console.error("[registry/studio-artifacts] POST error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
