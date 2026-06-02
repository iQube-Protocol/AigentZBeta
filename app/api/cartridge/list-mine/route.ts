/**
 * GET /api/cartridge/list-mine
 *
 * Returns the operator's owned cartridges — every `codex_configs` row
 * whose `owner_persona_id` matches the active persona OR for which the
 * persona holds an owner/admin role in `cartridge_memberships`.
 *
 * Phase 7 of the myCartridge PRD §14 — operator manager surface.
 *
 * Returns slug + display fields only. T0 columns (owner_persona_id) are
 * stripped from the response.
 */

import { NextRequest, NextResponse } from "next/server";

import { getActivePersona } from "@/services/identity/getActivePersona";
import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import { meetsCartridgeRole } from "@/types/cartridgeMembership";

export const dynamic = "force-dynamic";

interface OwnedCartridgeSummary {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: string | null;
  visibility: string | null;
  primaryTabSlug: string | null;
  tabCount: number;
  /** Operator's role on this cartridge (T1-safe). */
  role: string;
  /** Whether the manager UI should expose write actions. */
  canEdit: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const db = getSupabaseServer();
  if (!db) {
    return NextResponse.json(
      { ok: false, error: "supabase-unavailable" },
      { status: 500 },
    );
  }

  // Union of: (a) configs with owner_persona_id = persona; (b) configs
  // whose slug appears in the persona's cartridgeMemberships projection.
  // (b) covers the case where the persona was granted a role on a
  // cartridge they don't own (admin / editor) — the manager still lists
  // those, with `canEdit` reflecting the role.
  const memberships = persona.cartridgeFlags.cartridgeMemberships ?? {};
  const adminCartridges = persona.cartridgeFlags.adminCartridges ?? [];
  const membershipSlugs = Object.keys(memberships);

  const { data: ownerRows, error: ownerErr } = await db
    .from("codex_configs")
    .select("id,slug,name,metadata,primary_tab_slug,created_at,updated_at,owner_persona_id")
    .eq("owner_persona_id", persona.personaId);
  if (ownerErr) {
    return NextResponse.json(
      { ok: false, error: "owner-lookup-failed", detail: ownerErr.message },
      { status: 500 },
    );
  }

  // Pull additional rows by slug if the persona has memberships /
  // admin-cartridge grants but doesn't own the row.
  const allRelevantSlugs = Array.from(new Set([...membershipSlugs, ...adminCartridges]));
  const extraSlugsToFetch = allRelevantSlugs.filter(
    (s) => !(ownerRows ?? []).some((r) => (r as { slug: string }).slug === s),
  );
  let extraRows: typeof ownerRows = [];
  if (extraSlugsToFetch.length > 0) {
    const { data, error } = await db
      .from("codex_configs")
      .select("id,slug,name,metadata,primary_tab_slug,created_at,updated_at,owner_persona_id")
      .in("slug", extraSlugsToFetch);
    if (error) {
      return NextResponse.json(
        { ok: false, error: "membership-lookup-failed", detail: error.message },
        { status: 500 },
      );
    }
    extraRows = data ?? [];
  }

  const allRows = [...(ownerRows ?? []), ...(extraRows ?? [])];
  if (allRows.length === 0) {
    return NextResponse.json(
      { ok: true, cartridges: [] as OwnedCartridgeSummary[] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Tab counts in a single query.
  const cartridgeIds = allRows.map((r) => (r as { id: string }).id);
  const { data: tabCountsRaw } = await db
    .from("codex_tabs")
    .select("codex_id")
    .in("codex_id", cartridgeIds);
  const tabCounts = new Map<string, number>();
  for (const row of (tabCountsRaw ?? []) as Array<{ codex_id?: string }>) {
    if (!row.codex_id) continue;
    tabCounts.set(row.codex_id, (tabCounts.get(row.codex_id) ?? 0) + 1);
  }

  const summaries: OwnedCartridgeSummary[] = allRows.map((rawRow) => {
    const row = rawRow as {
      id: string;
      slug: string;
      name: string;
      metadata?: Record<string, unknown> | null;
      primary_tab_slug?: string | null;
      created_at: string;
      updated_at: string;
      owner_persona_id?: string | null;
    };
    const meta = row.metadata ?? {};
    const isOwnerRow = row.owner_persona_id === persona.personaId;
    const membershipRole = memberships[row.slug];
    const isAdminGrant = adminCartridges.includes(row.slug);
    const role =
      isOwnerRow
        ? "owner"
        : isAdminGrant
          ? "admin-grant"
          : membershipRole ?? "unknown";
    const canEdit =
      persona.cartridgeFlags.isAdmin ||
      isOwnerRow ||
      isAdminGrant ||
      membershipRole === "owner" ||
      meetsCartridgeRole(membershipRole, "admin");
    return {
      id: row.id,
      slug: row.slug,
      title: row.name,
      description: typeof meta.description === "string" ? (meta.description as string) : null,
      category: typeof meta.category === "string" ? (meta.category as string) : null,
      visibility: typeof meta.visibility === "string" ? (meta.visibility as string) : null,
      primaryTabSlug: row.primary_tab_slug ?? null,
      tabCount: tabCounts.get(row.id) ?? 0,
      role,
      canEdit,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

  // Sort: owner-rows first, then membership-rows; within each, most-recent first.
  summaries.sort((a, b) => {
    const aOwner = a.role === "owner" ? 0 : 1;
    const bOwner = b.role === "owner" ? 0 : 1;
    if (aOwner !== bOwner) return aOwner - bOwner;
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  return NextResponse.json(
    { ok: true, cartridges: summaries },
    { headers: { "Cache-Control": "no-store" } },
  );
}
