/**
 * GET  /api/iqube/memory  — paginated chat history for the authenticated user
 * POST /api/iqube/memory  — store one interaction (called non-blocking from the runtime)
 *
 * Query params (GET):
 *   type     — interaction_type filter: 'aigent'|'earn'|'learn'|'connect'|'all'  (default: 'all')
 *   persona  — metadata.activePersona filter: persona UUID or 'all'              (default: 'all')
 *   limit    — rows to return (default: 50, max: 100)
 *   offset   — pagination offset (default: 0)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const VALID_TYPES = new Set(["aigent", "earn", "learn", "connect"]);
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const SUMMARY_LIMIT = 3;

function createAuthClient(authHeader: string | null): SupabaseClient {
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

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? "all";
    const persona = searchParams.get("persona") ?? "all";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10), MAX_LIMIT);
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0);

    // ── Interactions query ────────────────────────────────────────────────────
    let interactionsQuery = supabase
      .from("user_interactions")
      .select("id, query, response, interaction_type, metadata, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (type !== "all" && VALID_TYPES.has(type)) {
      interactionsQuery = interactionsQuery.eq("interaction_type", type);
    }

    // Persona filter — PostgREST JSON path operator
    if (persona !== "all" && persona) {
      interactionsQuery = interactionsQuery.eq("metadata->>activePersona", persona);
    }

    const { data: interactions, error: intErr } = await interactionsQuery;
    if (intErr) return NextResponse.json({ error: intErr.message }, { status: 500 });

    // ── Summaries query ───────────────────────────────────────────────────────
    let summariesQuery = supabase
      .from("conversation_summaries")
      .select("id, conversation_type, summary_text, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(SUMMARY_LIMIT);

    if (type !== "all" && VALID_TYPES.has(type)) {
      summariesQuery = summariesQuery.eq("conversation_type", type);
    }

    const { data: summaries, error: sumErr } = await summariesQuery;
    if (sumErr) return NextResponse.json({ error: sumErr.message }, { status: 500 });

    return NextResponse.json({
      interactions: interactions ?? [],
      summaries: summaries ?? [],
      pagination: { limit, offset, returned: (interactions ?? []).length },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAuthClient(request.headers.get("Authorization"));
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json() as Record<string, unknown>;
    const { query, response, interaction_type, metadata } = body;

    if (typeof query !== "string" || !query.trim()) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }
    if (typeof response !== "string" || !response.trim()) {
      return NextResponse.json({ error: "response is required" }, { status: 400 });
    }
    const type =
      typeof interaction_type === "string" && VALID_TYPES.has(interaction_type)
        ? interaction_type
        : "aigent";

    const enrichedMetadata = {
      ...(typeof metadata === "object" && metadata !== null ? metadata : {}),
      timestamp: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("user_interactions")
      .insert({
        user_id: user.id,
        query: query.trim(),
        response: response.trim(),
        interaction_type: type,
        metadata: enrichedMetadata,
      })
      .select("id, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: data.id, created_at: data.created_at });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
