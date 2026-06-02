/**
 * /api/assistant/cartridge-config
 *
 * POST — persist the CartridgeSetupWizard output for the active persona.
 *
 * Phase 6 of the myCartridge PRD §28 + §32.
 *
 * Writes (in a single logical transaction; see "Atomicity" below):
 *   1. `codex_configs`         — the cartridge identity + Triad config
 *   2. `codex_tabs`            — one row per picked templateId
 *   3. `cartridge_activations` — one row for the active tab
 *   4. `cartridge_memberships` — one row granting `owner` to the persona
 *
 * Auth: persona-scoped via the spine (getActivePersona). The route never
 * reads `personaId` from the body — the owning persona is whoever made
 * the request.
 *
 * Atomicity: Supabase JS doesn't expose transactions cleanly from a
 * single client. We mitigate by:
 *   - Pre-validating the slug uniqueness BEFORE any insert.
 *   - Inserting in dependency order (config → tabs → activation → membership).
 *   - On any failure after the codex_configs row exists, returning the
 *     created config id in the error response so a retry can resume.
 *     Phase 7's operator manager surfaces partial-state rows so the user
 *     can complete them.
 *
 * Returns:
 *   { ok: true, cartridge: { id, slug, ... } }   on success
 *   { ok: false, error, detail, partial? }       on any failure
 *
 * Phase 6 scope NOT included here:
 *   - DVN receipt emission (Phase 10).
 *   - v0.4 venture-iqube myCartridge block ingest — the wizard writes
 *     directly to codex_configs; the ventureQube ingest route is for
 *     uploading a pre-emitted v0.4 JSON. Both paths converge on the same
 *     `codex_configs` row; the wizard path just bypasses the iQube
 *     envelope round-trip for the operator-driven flow.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getActivePersona } from "@/services/identity/getActivePersona";
import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import {
  cartridgeCategoryEnum,
  cartridgeVisibilityEnum,
  cartridgeTabTemplateIdEnum,
  cartridgeTabVisibilityEnum,
  cartridgeCopilotSourceEnum,
  cartridgeRoleEnum,
  specialistIdEnum,
  tokenIdEnum,
} from "@/services/iqube/ventureQubeSchema";

export const dynamic = "force-dynamic";

// ─── Wizard payload schema ────────────────────────────────────────────────

const wizardPayloadSchema = z.object({
  // Step 1 — Identity
  title: z.string().min(1).max(140),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "slug must be URL-safe lowercase with dashes"),
  description: z.string().min(1).max(2000),
  category: cartridgeCategoryEnum,

  // Step 2 — Purpose
  purpose: z.string().min(1).max(4000),
  visibility: cartridgeVisibilityEnum,
  audience: z.object({
    kind: z.enum(["open", "gated", "franchise", "inner-circle"]),
    estimatedSize: z.enum(["1-10", "10-100", "100-1k", "1k-10k", "10k+"]),
    languages: z.array(z.string().min(2).max(8)).default(["en"]),
  }),

  // Step 3 — Tabs (template bundle + picked template ids)
  templateBundle: z.enum(["community", "venture", "knowledge", "creative", "custom"]),
  tabs: z
    .array(
      z.object({
        slug: z.string().min(1).max(128),
        label: z.string().min(1).max(140),
        templateId: cartridgeTabTemplateIdEnum,
        visibility: cartridgeTabVisibilityEnum,
        primary: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(24),

  // Step 4 — Audience & Permissions
  primaryTabSlug: z.string().min(1),

  // Step 5 — Triad + Active Tab + Catalogue
  smartTriad: z.object({
    copilot: z.object({
      source: cartridgeCopilotSourceEnum,
      promptContext: z.string().max(4000).optional().default(""),
    }),
    knowledgeBase: z.object({
      ingestSources: z.array(z.enum(["mycanvas", "myworkspace", "uploads", "codex", "json_blob"])),
      embeddingScope: z.enum(["cartridge", "domain"]).default("domain"),
    }),
    codex: z.object({
      enabled: z.boolean().default(true),
    }),
    wallet: z.object({
      enabled: z.boolean(),
      tokenWhitelist: z.array(tokenIdEnum).default([]),
      primitives: z
        .object({
          cryptoSend: z.boolean().default(false),
          cryptoReceive: z.boolean().default(false),
          paymentRequest: z.boolean().default(false),
          rewardPayout: z.boolean().default(false),
        })
        .default({}),
    }),
  }),
  specialists: z.object({
    available: z
      .array(specialistIdEnum)
      .max(3, "free-tier cap is 3 specialists; the 4th+ is payment-gated (PRD §35 R7)"),
    primary: specialistIdEnum.optional(),
  }),
  activeTabSlug: z.string().min(1),
  activeTabMetrics: z.array(z.string()).max(16).default([]),
  activeTabActions: z.array(z.string()).max(16).default([]),
  catalogueOptIn: z.boolean().default(false),
});

type WizardPayload = z.infer<typeof wizardPayloadSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────

function getDb() {
  const client = getSupabaseServer();
  if (!client) throw new Error("Supabase configuration missing for cartridge-config");
  return client;
}

function cartridgeIdFromSlug(slug: string): string {
  return `${slug}-cartridge`;
}

function tabRowId(cartridgeId: string, tabSlug: string): string {
  return `${cartridgeId}-${tabSlug}`;
}

function activationCatalogId(cartridgeSlug: string, tabSlug: string): string {
  return `cart-${cartridgeSlug}-${tabSlug}`;
}

// ─── Route ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const parsed = wizardPayloadSchema.safeParse(body);
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
  const payload: WizardPayload = parsed.data;

  // Tab-set sanity — primaryTabSlug + activeTabSlug must reference picked tabs
  const tabSlugs = new Set(payload.tabs.map((t) => t.slug));
  if (!tabSlugs.has(payload.primaryTabSlug)) {
    return NextResponse.json(
      { ok: false, error: "primary-tab-not-in-picked-tabs", detail: payload.primaryTabSlug },
      { status: 400 },
    );
  }
  if (!tabSlugs.has(payload.activeTabSlug)) {
    return NextResponse.json(
      { ok: false, error: "active-tab-not-in-picked-tabs", detail: payload.activeTabSlug },
      { status: 400 },
    );
  }

  const db = getDb();
  const cartridgeId = cartridgeIdFromSlug(payload.slug);

  // Slug uniqueness — fail fast before any insert.
  {
    const { data: existing, error: lookupErr } = await db
      .from("codex_configs")
      .select("id")
      .eq("slug", payload.slug)
      .maybeSingle();
    if (lookupErr) {
      return NextResponse.json(
        { ok: false, error: "slug-lookup-failed", detail: lookupErr.message },
        { status: 500 },
      );
    }
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "slug-already-exists", detail: payload.slug },
        { status: 409 },
      );
    }
  }

  // 1. codex_configs
  const nowIso = new Date().toISOString();
  const configRow = {
    id: cartridgeId,
    name: payload.title,
    slug: payload.slug,
    enabled: true,
    version: "1.0.0",
    owner: persona.personaId, // legacy text owner; spine resolves separately
    metadata: {
      description: payload.description,
      purpose: payload.purpose,
      category: payload.category,
      visibility: payload.visibility,
      audience: payload.audience,
      templateBundle: payload.templateBundle,
      source: "cartridge-setup-wizard",
      createdViaWizardAt: nowIso,
    },
    permissions: { view: ["*"], edit: [], admin: [persona.personaId] },
    owner_persona_id: persona.personaId, // Phase 4a column
    primary_tab_slug: payload.primaryTabSlug,
    available_specialists: payload.specialists.available,
    token_whitelist: payload.smartTriad.wallet.tokenWhitelist,
    smart_triad_config: payload.smartTriad,
    created_at: nowIso,
    updated_at: nowIso,
  };
  const { error: configErr } = await db.from("codex_configs").insert(configRow);
  if (configErr) {
    return NextResponse.json(
      { ok: false, error: "codex-configs-insert-failed", detail: configErr.message },
      { status: 500 },
    );
  }

  // 2. codex_tabs — one row per picked template tab
  const tabRows = payload.tabs.map((t, i) => ({
    id: tabRowId(cartridgeId, t.slug),
    codex_id: cartridgeId,
    label: t.label,
    slug: t.slug,
    enabled: true,
    order: i,
    type: "template" as const,
    config: { templateId: t.templateId, props: {} },
    metadata: null as Record<string, unknown> | null,
    member_only: t.visibility === "member",
    invite_only: t.visibility === "invite",
    token_gated: t.visibility === "token-gated" ? { tokenId: "knyt", minBalance: "1" } : null,
    role_required: t.visibility === "admin" ? "admin" : null,
    created_at: nowIso,
    updated_at: nowIso,
  }));
  const { error: tabsErr } = await db.from("codex_tabs").insert(tabRows);
  if (tabsErr) {
    return NextResponse.json(
      {
        ok: false,
        error: "codex-tabs-insert-failed",
        detail: tabsErr.message,
        partial: { cartridgeId },
      },
      { status: 500 },
    );
  }

  // 3. cartridge_activations — the active tab
  const activationStatus = payload.catalogueOptIn ? "pending_metame" : "approved";
  const { error: actErr } = await db.from("cartridge_activations").insert({
    catalog_id: activationCatalogId(payload.slug, payload.activeTabSlug),
    cartridge_slug: payload.slug,
    tab_slug: payload.activeTabSlug,
    mode: "metrics-actions",
    metrics_json: payload.activeTabMetrics.map((label) => ({ label, value: "—" })),
    actions_json: payload.activeTabActions.map((label) => ({ label })),
    status: activationStatus,
    visibility: payload.visibility,
    submitted_by: persona.personaId,
    submitted_at: nowIso,
    metadata: { source: "cartridge-setup-wizard", catalogueOptIn: payload.catalogueOptIn },
  });
  if (actErr) {
    return NextResponse.json(
      {
        ok: false,
        error: "cartridge-activations-insert-failed",
        detail: actErr.message,
        partial: { cartridgeId },
      },
      { status: 500 },
    );
  }

  // 4. cartridge_memberships — grant owner to the persona
  const ownerRole: z.infer<typeof cartridgeRoleEnum> = "owner";
  const { error: memErr } = await db.from("cartridge_memberships").insert({
    cartridge_slug: payload.slug,
    persona_id: persona.personaId,
    role: ownerRole,
    granted_at: nowIso,
    granted_by: persona.personaId, // self-grant on wizard save
    metadata: { source: "cartridge-setup-wizard" },
  });
  if (memErr) {
    return NextResponse.json(
      {
        ok: false,
        error: "cartridge-memberships-insert-failed",
        detail: memErr.message,
        partial: { cartridgeId },
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      cartridge: {
        id: cartridgeId,
        slug: payload.slug,
        title: payload.title,
        category: payload.category,
        visibility: payload.visibility,
        primaryTabSlug: payload.primaryTabSlug,
        activeTabSlug: payload.activeTabSlug,
        tabCount: payload.tabs.length,
        catalogueStatus: activationStatus,
      },
      message:
        activationStatus === "pending_metame"
          ? "Cartridge created. Your active tab was submitted to the metaMe Activations Catalogue for review."
          : "Cartridge created. The active tab is live in your private surface.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
