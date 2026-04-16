/**
 * POST /api/experience/capsule
 *
 * Given a persona's position in the matrix (patronage_stage × pcs_stage),
 * returns the prescribed experience capsule — type, label, CTA, and next step.
 *
 * Body (all optional if personaId is supplied):
 *   personaId      — loads journey_state from DB to resolve stages automatically
 *   patronage_stage — "Prospect"|"Acolyte"|"Keta"|"Keji"|"First"|"Zero"|"Sat KNYT"
 *   pcs_stage       — "Observer"|"Collector"|"Curator"|"Remixer"|"Creator"|"Correspondent"|"Steward"|"Franchisee"
 *
 * Response:
 *   { depth, label, cta_label, cta_action, patronage_stage, pcs_stage, fallback }
 *
 * Phase 1 — Experience capsule delivery pipeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ── Matrix prescription data ────────────────────────────────────────────────
// Source of truth is ComposerStudio.tsx CARTRIDGE_FRAMEWORK["knyt-codex"].matrix
// Key: "PCS_STAGE:PATRONAGE_STAGE"  Value: "depth: label"

const KNYT_MATRIX_CELLS: Record<string, string> = {
  // Entry zone — pills
  "Observer:Prospect":          "pill: World discovery",
  "Observer:Acolyte":           "pill: First lore hook",
  "Collector:Prospect":         "pill: Card preview",
  "Collector:Acolyte":          "capsule: First card acquisition",
  "Collector:Keta":             "capsule: Card set curation",
  // Early-mid diagonal — capsules
  "Curator:Acolyte":            "pill: Curation intro",
  "Curator:Keta":               "capsule: Curation challenge",
  "Curator:Keji":               "capsule: Signal shaping",
  "Remixer:Keta":               "capsule: Remix template",
  "Remixer:Keji":               "mini_rt: Remix session",
  "Remixer:First":              "mini_rt: Guided creation",
  // Mid-upper diagonal — mini_runtimes
  "Creator:Keji":               "capsule: First contribution",
  "Creator:First":              "mini_rt: Creation session",
  "Creator:Zero":               "mini_rt: Asset submission",
  "Correspondent:First":        "mini_rt: Editorial surface",
  "Correspondent:Zero":         "codex: Correspondent codex",
  // Upper zone — codex
  "Steward:Zero":               "codex: Governance session",
  "Steward:Sat KNYT":           "codex: Stewardship codex",
  "Franchisee:Zero":            "codex: World shaping",
  "Franchisee:Sat KNYT":        "codex: Canon authoring",
  // Off-diagonal — high engagement, early patronage
  "Curator:Prospect":           "pill: Curation tease",
  "Remixer:Prospect":           "pill: Remix welcome",
  "Remixer:Acolyte":            "capsule: First remix attempt",
  "Creator:Prospect":           "pill: Creator welcome",
  "Creator:Acolyte":            "pill: Early contribution hook",
  "Creator:Keta":               "capsule: Creation pathway",
  "Correspondent:Prospect":     "pill: Correspondent tease",
  "Correspondent:Acolyte":      "capsule: Recognition path",
  "Correspondent:Keta":         "capsule: Correspondent intro",
  "Correspondent:Keji":         "capsule: Recognition moment",
  "Steward:Prospect":           "pill: Stewardship preview",
  "Steward:Acolyte":            "capsule: Governance intro",
  "Steward:Keta":               "capsule: Stewardship path",
  "Steward:First":              "mini_rt: Mentorship session",
  "Franchisee:Prospect":        "pill: Franchise tease",
  "Franchisee:Acolyte":         "capsule: Franchise path",
  "Franchisee:Keta":            "capsule: Sovereign intro",
  "Franchisee:Keji":            "mini_rt: Franchise unlock",
  "Franchisee:First":           "mini_rt: Sovereign ascent",
  // Off-diagonal — low engagement, advanced patronage
  "Observer:Keta":              "capsule: World intro tour",
  "Observer:Keji":              "capsule: Re-engagement",
  "Observer:Zero":              "mini_rt: Deep world discovery",
  "Collector:Keji":             "capsule: Collection narrative",
  "Collector:First":            "mini_rt: Collection expansion",
  "Collector:Zero":             "mini_rt: Portfolio stewardship",
  "Remixer:Zero":               "mini_rt: Advanced remix",
  "Creator:Sat KNYT":           "codex: Apex creation",
};

// Runtime stage names → matrix stage names (handles the OutsideOrder/Satoshi/FranchiseAligned variants)
const PATRONAGE_RUNTIME_TO_MATRIX: Record<string, string> = {
  OutsideOrder:     "Prospect",
  Prospect:         "Prospect",
  Acolyte:          "Acolyte",
  Keta:             "Keta",
  Keji:             "Keji",
  First:            "First",
  Zero:             "Zero",
  Satoshi:          "Sat KNYT",
  "Sat KNYT":       "Sat KNYT",
};

const PCS_RUNTIME_TO_MATRIX: Record<string, string> = {
  Observer:         "Observer",
  Collector:        "Collector",
  Curator:          "Curator",
  Remixer:          "Remixer",
  Creator:          "Creator",
  Correspondent:    "Correspondent",
  Steward:          "Steward",
  FranchiseAligned: "Franchisee",
  Franchisee:       "Franchisee",
};

// depth → CTA label
const DEPTH_CTA: Record<string, string> = {
  pill:     "Explore",
  capsule:  "Open capsule",
  mini_rt:  "Enter experience",
  codex:    "Open codex",
};

// depth → next recommended depth
const DEPTH_NEXT: Record<string, string> = {
  pill:     "capsule",
  capsule:  "mini_rt",
  mini_rt:  "codex",
  codex:    "codex",
};

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Journey state depth → PCS stage (same mapping used in KnytRuntimeSurface)
function depthToPcsStage(depth: string): string {
  const map: Record<string, string> = {
    pill:         "Observer",
    capsule:      "Collector",
    mini_runtime: "Remixer",
    codex:        "Correspondent",
  };
  return map[depth] ?? "Observer";
}

function journeyStageToPatronage(stage: string): string {
  const map: Record<string, string> = {
    prospect:  "Prospect",
    acolyte:   "Acolyte",
    keta:      "Keta",
    keji:      "Keji",
    first:     "First",
    zero:      "Zero",
    "sat knyt": "Sat KNYT",
  };
  return map[stage.toLowerCase()] ?? "Prospect";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { personaId, patronage_stage: patronageIn, pcs_stage: pcsIn } = body as {
      personaId?: string;
      patronage_stage?: string;
      pcs_stage?: string;
    };

    let resolvedPatronage = patronageIn ?? "";
    let resolvedPcs = pcsIn ?? "";

    // If personaId supplied, load journey_state from DB to resolve stages
    if (personaId && (!resolvedPatronage || !resolvedPcs)) {
      const db = getDb();
      const { data: journey } = await db
        .from("journey_states")
        .select("stage, depth")
        .eq("persona_id", personaId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (journey) {
        if (!resolvedPatronage) resolvedPatronage = journeyStageToPatronage(journey.stage);
        if (!resolvedPcs) resolvedPcs = depthToPcsStage(journey.depth);
      }
    }

    // Normalise to matrix key names
    const matrixPatronage = PATRONAGE_RUNTIME_TO_MATRIX[resolvedPatronage] ?? "Prospect";
    const matrixPcs = PCS_RUNTIME_TO_MATRIX[resolvedPcs] ?? "Observer";
    const cellKey = `${matrixPcs}:${matrixPatronage}`;

    const prescription = KNYT_MATRIX_CELLS[cellKey];
    const fallback = !prescription;

    // Parse "depth: label"
    let depth = "pill";
    let label = "World discovery";
    if (prescription) {
      const sep = prescription.indexOf(":");
      if (sep > -1) {
        depth = prescription.slice(0, sep).trim();
        label = prescription.slice(sep + 1).trim();
      }
    }

    return NextResponse.json({
      patronage_stage: matrixPatronage,
      pcs_stage: matrixPcs,
      cell_key: cellKey,
      depth,
      label,
      cta_label: DEPTH_CTA[depth] ?? "Explore",
      cta_action: depth,
      next_depth: DEPTH_NEXT[depth] ?? "capsule",
      fallback,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
