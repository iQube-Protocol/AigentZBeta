/**
 * GET / PATCH /api/cartridge/[slug]
 *
 * Operator manager surface — read + edit a single cartridge.
 *
 * Phase 7 of the myCartridge PRD §14.
 *
 * GET: returns the full cartridge config + tabs + membership roster.
 *      Gated read (member or above).
 * PATCH: edit any subset of {title, description, category, visibility,
 *      primaryTabSlug, availableSpecialists, tokenWhitelist,
 *      smartTriadConfig}. Gated write (owner / admin-role / uber).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import { cartridgeManageGuard } from "@/services/cartridge/manageGuard";
import {
  cartridgeCategoryEnum,
  cartridgeVisibilityEnum,
  specialistIdEnum,
  tokenIdEnum,
} from "@/services/iqube/ventureQubeSchema";

export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    title: z.string().min(1).max(140).optional(),
    description: z.string().max(2000).optional(),
    purpose: z.string().max(4000).optional(),
    category: cartridgeCategoryEnum.optional(),
    visibility: cartridgeVisibilityEnum.optional(),
    primaryTabSlug: z.string().min(1).optional(),
    availableSpecialists: z
      .array(specialistIdEnum)
      .max(3, "free-tier cap is 3 specialists; the 4th+ is payment-gated (PRD §35 R7)")
      .optional(),
    tokenWhitelist: z.array(tokenIdEnum).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "patch body cannot be empty" });

interface RouteParams {
  params: { slug: string };
}

function getDb() {
  const client = getSupabaseServer();
  if (!client) throw new Error("Supabase configuration missing");
  return client;
}

export async function GET(req: NextRequest, ctx: RouteParams): Promise<NextResponse> {
  const guard = await cartridgeManageGuard(req, ctx.params.slug, { requireWrite: false });
  if (guard instanceof NextResponse) return guard;

  const db = getDb();
  const slug = ctx.params.slug;

  // Config row.
  const { data: cfg, error: cfgErr } = await db
    .from("codex_configs")
    .select(
      "id,slug,name,enabled,metadata,owner_persona_id,primary_tab_slug,available_specialists,token_whitelist,smart_triad_config,published_to_cluster,created_at,updated_at",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (cfgErr) {
    return NextResponse.json(
      { ok: false, error: "config-lookup-failed", detail: cfgErr.message },
      { status: 500 },
    );
  }
  if (!cfg) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }

  // Tabs.
  const { data: tabRows, error: tabsErr } = await db
    .from("codex_tabs")
    .select(
      "id,slug,label,enabled,order,type,config,member_only,invite_only,token_gated,role_required",
    )
    .eq("codex_id", (cfg as { id: string }).id)
    .order("order", { ascending: true });
  if (tabsErr) {
    return NextResponse.json(
      { ok: false, error: "tabs-lookup-failed", detail: tabsErr.message },
      { status: 500 },
    );
  }

  // Memberships — emit slug + role only. Drop persona_id to keep the
  // response T1-safe; the manager UI doesn't need the underlying
  // persona id. Phase 7b will add a separate inspector endpoint for
  // owner+admin debug that returns persona ids (gated on isAdmin).
  const { data: memRowsRaw, error: memErr } = await db
    .from("cartridge_memberships")
    .select("persona_id,role,granted_at")
    .eq("cartridge_slug", slug);
  if (memErr) {
    return NextResponse.json(
      { ok: false, error: "memberships-lookup-failed", detail: memErr.message },
      { status: 500 },
    );
  }
  const memberships = ((memRowsRaw ?? []) as Array<{
    persona_id?: string;
    role?: string;
    granted_at?: string;
  }>).map((row) => ({
    // The persona_id is T0; we expose a short display token instead so
    // the owner can see "who" without exposing the canonical id. Phase
    // 7b's persona inspector endpoint returns the full id when the
    // caller is admin-tier.
    personaDisplayToken: row.persona_id ? `persona-${row.persona_id.slice(0, 8)}` : null,
    role: row.role ?? "unknown",
    grantedAt: row.granted_at ?? null,
  }));

  const cfgTyped = cfg as {
    id: string;
    slug: string;
    name: string;
    enabled: boolean;
    metadata: Record<string, unknown> | null;
    owner_persona_id: string | null;
    primary_tab_slug: string | null;
    available_specialists: string[] | null;
    token_whitelist: string[] | null;
    smart_triad_config: Record<string, unknown> | null;
    published_to_cluster: boolean;
    created_at: string;
    updated_at: string;
  };

  return NextResponse.json(
    {
      ok: true,
      cartridge: {
        id: cfgTyped.id,
        slug: cfgTyped.slug,
        title: cfgTyped.name,
        enabled: cfgTyped.enabled,
        description: cfgTyped.metadata?.description ?? null,
        purpose: cfgTyped.metadata?.purpose ?? null,
        category: cfgTyped.metadata?.category ?? null,
        visibility: cfgTyped.metadata?.visibility ?? null,
        audience: cfgTyped.metadata?.audience ?? null,
        primaryTabSlug: cfgTyped.primary_tab_slug,
        availableSpecialists: cfgTyped.available_specialists ?? [],
        tokenWhitelist: cfgTyped.token_whitelist ?? [],
        smartTriadConfig: cfgTyped.smart_triad_config ?? null,
        publishedToCluster: cfgTyped.published_to_cluster ?? false,
        createdAt: cfgTyped.created_at,
        updatedAt: cfgTyped.updated_at,
        // T0 owner_persona_id intentionally NOT echoed.
        isOwnerCaller: cfgTyped.owner_persona_id === guard.persona.personaId,
      },
      tabs: tabRows ?? [],
      memberships,
      caller: {
        canEdit: guard.canWrite,
        reason: guard.reason,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(req: NextRequest, ctx: RouteParams): Promise<NextResponse> {
  const guard = await cartridgeManageGuard(req, ctx.params.slug, { requireWrite: true });
  if (guard instanceof NextResponse) return guard;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path?.length ? first.path.join(".") : "(root)";
    return NextResponse.json(
      { ok: false, error: "schema-validation-failed", detail: `${path}: ${first?.message ?? "validation failed"}` },
      { status: 400 },
    );
  }
  const patch = parsed.data;

  const db = getDb();

  // Read current row so we can merge metadata cleanly.
  const { data: current, error: readErr } = await db
    .from("codex_configs")
    .select("id,name,metadata,primary_tab_slug,available_specialists,token_whitelist")
    .eq("slug", ctx.params.slug)
    .maybeSingle();
  if (readErr || !current) {
    return NextResponse.json(
      { ok: false, error: "not-found", detail: readErr?.message },
      { status: 404 },
    );
  }
  const cur = current as {
    id: string;
    name: string;
    metadata: Record<string, unknown> | null;
    primary_tab_slug: string | null;
    available_specialists: string[] | null;
    token_whitelist: string[] | null;
  };

  // primaryTabSlug must reference a real tab on this cartridge.
  if (patch.primaryTabSlug) {
    const { data: tabHit } = await db
      .from("codex_tabs")
      .select("slug")
      .eq("codex_id", cur.id)
      .eq("slug", patch.primaryTabSlug)
      .maybeSingle();
    if (!tabHit) {
      return NextResponse.json(
        { ok: false, error: "primary-tab-not-found", detail: patch.primaryTabSlug },
        { status: 400 },
      );
    }
  }

  // Merge metadata JSONB for the wizard-only fields.
  const mergedMetadata: Record<string, unknown> = { ...(cur.metadata ?? {}) };
  if (patch.description !== undefined) mergedMetadata.description = patch.description;
  if (patch.purpose !== undefined) mergedMetadata.purpose = patch.purpose;
  if (patch.category !== undefined) mergedMetadata.category = patch.category;
  if (patch.visibility !== undefined) mergedMetadata.visibility = patch.visibility;

  const update: Record<string, unknown> = {
    metadata: mergedMetadata,
    updated_at: new Date().toISOString(),
  };
  if (patch.title !== undefined) update.name = patch.title;
  if (patch.primaryTabSlug !== undefined) update.primary_tab_slug = patch.primaryTabSlug;
  if (patch.availableSpecialists !== undefined) {
    update.available_specialists = patch.availableSpecialists;
  }
  if (patch.tokenWhitelist !== undefined) update.token_whitelist = patch.tokenWhitelist;

  const { error: updateErr } = await db
    .from("codex_configs")
    .update(update)
    .eq("id", cur.id);
  if (updateErr) {
    return NextResponse.json(
      { ok: false, error: "update-failed", detail: updateErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: true, slug: ctx.params.slug, updated: Object.keys(patch) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
