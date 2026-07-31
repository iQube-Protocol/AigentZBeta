/**
 * GET /api/cartridge/published-for-cluster
 *
 * Returns the calling persona's personal cartridges that have
 * published_to_cluster = true. Used by CodexPanelDynamic to inject
 * dynamic sub-tabs into the mycluster group when rendering metame-codex.
 *
 * Response (T1-safe — no T0 fields):
 *   { ok: true, cartridges: [{ id, slug, title }] }
 *
 * Silently returns an empty array on any auth/DB failure so the metaMe
 * cartridge still loads when the persona has no published cartridges.
 */

import { NextRequest, NextResponse } from "next/server";
import { getActivePersona } from "@/services/identity/getActivePersona";
import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";

export const dynamic = "force-dynamic";

const EMPTY_RESPONSE = NextResponse.json(
  { ok: true, cartridges: [] },
  { headers: { "Cache-Control": "no-store" } },
);

export async function GET(req: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona) return EMPTY_RESPONSE;

  const db = getSupabaseServer();
  if (!db) return EMPTY_RESPONSE;

  const { data, error } = await db
    .from("codex_configs")
    .select("id, slug, name")
    .eq("owner_persona_id", persona.personaId)
    .eq("published_to_cluster", true)
    .eq("enabled", true)
    .order("created_at", { ascending: true });

  if (error || !data) return EMPTY_RESPONSE;

  const cartridges = (data as Array<{ id: string; slug: string; name: string }>).map((r) => ({
    id: String(r.id),
    slug: String(r.slug),
    title: String(r.name ?? r.slug),
  }));

  return NextResponse.json(
    { ok: true, cartridges },
    { headers: { "Cache-Control": "no-store" } },
  );
}
