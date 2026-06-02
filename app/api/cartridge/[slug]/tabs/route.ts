/**
 * PATCH /api/cartridge/[slug]/tabs
 *
 * Bulk edit the tabs on a cartridge — visibility (member_only,
 * invite_only, role_required, token_gated), enabled flag, ordering,
 * and label. Each edit is targeted by tab slug; only the fields
 * present in the patch body are mutated.
 *
 * Phase 7 of the myCartridge PRD §14 — operator manager surface.
 * Gated write (owner / admin-role / uber).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import { cartridgeManageGuard } from "@/services/cartridge/manageGuard";
import {
  cartridgeRoleEnum,
  cartridgeTabVisibilityEnum,
  tokenIdEnum,
} from "@/services/iqube/ventureQubeSchema";

export const dynamic = "force-dynamic";

const tabPatchSchema = z
  .object({
    slug: z.string().min(1).max(128),
    label: z.string().min(1).max(140).optional(),
    enabled: z.boolean().optional(),
    order: z.number().int().nonnegative().optional(),
    visibility: cartridgeTabVisibilityEnum.optional(),
    roleRequired: cartridgeRoleEnum.nullable().optional(),
    tokenGated: z
      .object({ tokenId: tokenIdEnum, minBalance: z.string() })
      .nullable()
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 1, {
    message: "tab patch must include at least one field besides slug",
  });

const bodySchema = z.object({
  tabs: z.array(tabPatchSchema).min(1).max(24),
});

interface RouteParams {
  params: { slug: string };
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
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path?.length ? first.path.join(".") : "(root)";
    return NextResponse.json(
      {
        ok: false,
        error: "schema-validation-failed",
        detail: `${path}: ${first?.message ?? "validation failed"}`,
      },
      { status: 400 },
    );
  }

  const db = getSupabaseServer();
  if (!db) {
    return NextResponse.json({ ok: false, error: "supabase-unavailable" }, { status: 500 });
  }

  // Resolve cartridge id from slug — codex_tabs is keyed on codex_id, not slug.
  const { data: cfg, error: cfgErr } = await db
    .from("codex_configs")
    .select("id")
    .eq("slug", ctx.params.slug)
    .maybeSingle();
  if (cfgErr || !cfg) {
    return NextResponse.json(
      { ok: false, error: "not-found", detail: cfgErr?.message ?? "cartridge missing" },
      { status: 404 },
    );
  }
  const cartridgeId = (cfg as { id: string }).id;

  // Apply each patch as a single targeted UPDATE. Bulk into one request
  // would require building a CASE statement; Supabase JS doesn't expose
  // that ergonomically. Sequential updates against the same cartridge
  // are cheap (PK lookup) and keep the per-row error path clean.
  const updated: string[] = [];
  for (const tabPatch of parsed.data.tabs) {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (tabPatch.label !== undefined) update.label = tabPatch.label;
    if (tabPatch.enabled !== undefined) update.enabled = tabPatch.enabled;
    if (tabPatch.order !== undefined) update.order = tabPatch.order;
    if (tabPatch.roleRequired !== undefined) update.role_required = tabPatch.roleRequired;
    if (tabPatch.tokenGated !== undefined) update.token_gated = tabPatch.tokenGated;
    // visibility maps to the (member_only, invite_only, role_required)
    // gate trio per Phase 4a. 'public' clears all; 'token-gated' is set
    // via tokenGated; 'admin' sets role_required='admin'.
    if (tabPatch.visibility !== undefined) {
      switch (tabPatch.visibility) {
        case "public":
          update.member_only = false;
          update.invite_only = false;
          // Don't blank role_required if the caller is also setting it
          // explicitly above; otherwise clear it.
          if (tabPatch.roleRequired === undefined) update.role_required = null;
          break;
        case "member":
          update.member_only = true;
          update.invite_only = false;
          break;
        case "invite":
          update.member_only = false;
          update.invite_only = true;
          break;
        case "admin":
          update.member_only = false;
          update.invite_only = false;
          update.role_required = "admin";
          break;
        case "token-gated":
          update.member_only = false;
          update.invite_only = false;
          // tokenGated descriptor expected in the same patch; if not
          // present, the existing token_gated row stays.
          break;
      }
    }
    const { error: updateErr } = await db
      .from("codex_tabs")
      .update(update)
      .eq("codex_id", cartridgeId)
      .eq("slug", tabPatch.slug);
    if (updateErr) {
      return NextResponse.json(
        {
          ok: false,
          error: "tab-update-failed",
          detail: `tab=${tabPatch.slug}: ${updateErr.message}`,
          partial: { updated },
        },
        { status: 500 },
      );
    }
    updated.push(tabPatch.slug);
  }

  return NextResponse.json(
    { ok: true, updated },
    { headers: { "Cache-Control": "no-store" } },
  );
}
