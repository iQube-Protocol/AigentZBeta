/**
 * /api/assistant/cartridge-recommend
 *
 * POST — given the persona's ExperienceQube, return a recommended
 * template bundle + category + specialist set for the
 * CartridgeSetupWizard step 2 "Recommended:" chip.
 *
 * Phase 6 of the myCartridge PRD §28.
 *
 * MVP semantics (no LLM call): pure mapping from `experienceType` and
 * `experienceName` keywords to one of the 4 template bundles. The
 * wizard treats the recommendation as a hint — the user can override
 * any field on the next step.
 *
 * Phase 6b will:
 *   - Add an `/api/assistant/cartridge-recommend?explain=1` mode that
 *     calls aigentMe for a one-line natural-language rationale.
 *   - Read the persona's active IntentQubes for sharper recommendations.
 *
 * Auth: persona-scoped via the spine.
 *
 * The route accepts an optional body with `experienceName` /
 * `experienceType` overrides — surfaced by the wizard when the user
 * has already started filling in step 1; otherwise the route reads the
 * ExperienceQube row directly.
 */

import { NextRequest, NextResponse } from "next/server";

import { getActivePersona } from "@/services/identity/getActivePersona";
import { getExperienceQube } from "@/services/iqube/experienceQube";

export const dynamic = "force-dynamic";

type TemplateBundle = "community" | "venture" | "knowledge" | "creative";

interface Recommendation {
  templateBundle: TemplateBundle;
  category: string;
  visibility: "public" | "private" | "invite-only" | "member-only";
  availableSpecialists: string[];
  primarySpecialist: string;
  rationale: string;
}

// Default specialists per template bundle, lifted verbatim from PRD §24.
const BUNDLE_DEFAULTS: Record<
  TemplateBundle,
  { category: string; specialists: string[]; primary: string }
> = {
  community: {
    category: "community",
    specialists: ["aigent-c", "marketa", "kn0w1"],
    primary: "aigent-c",
  },
  venture: {
    category: "venture",
    specialists: ["aigent-c", "moneypenny", "marketa"],
    primary: "aigent-c",
  },
  knowledge: {
    category: "knowledge",
    specialists: ["quill", "kn0w1"],
    primary: "quill",
  },
  creative: {
    category: "creative",
    specialists: ["quill", "metaye", "kn0w1"],
    primary: "quill",
  },
};

function recommendFor(
  experienceType: string | undefined,
  experienceName: string | undefined,
): Recommendation {
  const name = (experienceName || "").toLowerCase();
  const type = (experienceType || "").toLowerCase();

  // First-pass — keyword overrides anchor the obvious cases.
  if (/franchise|community|cohort|cult|tribe/.test(name)) {
    return finalize("community", "open community / franchise signal in name");
  }
  if (/launch|venture|raise|fundraise|investor|cap table/.test(name)) {
    return finalize("venture", "venture-building signal in name");
  }
  if (/codex|library|knowledge|research|paper|wiki|archive/.test(name)) {
    return finalize("knowledge", "knowledge-estate signal in name");
  }
  if (/story|episode|comic|film|art|music|creative|narrative/.test(name)) {
    return finalize("creative", "creative-universe signal in name");
  }

  // Second-pass — experienceType from ExperienceQube.
  if (type === "venture_building") return finalize("venture", "experienceType=venture_building");
  if (type === "creative") return finalize("creative", "experienceType=creative");
  if (type === "client") return finalize("venture", "client work routes to venture bundle (KPI-driven)");
  if (type === "portfolio") return finalize("venture", "portfolio oversight routes to venture bundle");
  if (type === "personal") return finalize("knowledge", "personal experience routes to knowledge estate");

  // Default — venture, since that's the most common Alpha intent.
  return finalize("venture", "no strong signal; defaulting to venture");
}

function finalize(bundle: TemplateBundle, rationale: string): Recommendation {
  const d = BUNDLE_DEFAULTS[bundle];
  return {
    templateBundle: bundle,
    category: d.category,
    visibility: "private", // private-by-default — operator can flip on Step 4
    availableSpecialists: d.specialists,
    primarySpecialist: d.primary,
    rationale,
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Body is optional — wizard may pass partial in-flight values.
  let body: { experienceName?: string; experienceType?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // tolerated — fall back to ExperienceQube
  }

  let experienceName = body.experienceName?.trim();
  let experienceType = body.experienceType?.trim();

  if (!experienceName || !experienceType) {
    try {
      const expQube = await getExperienceQube(persona.personaId);
      if (expQube?.meta) {
        experienceName = experienceName || expQube.meta.experienceName || undefined;
        // experienceType isn't surfaced on every ExperienceQube projection;
        // defensive read.
        const meta = expQube.meta as { experienceType?: string };
        experienceType = experienceType || meta.experienceType || undefined;
      }
    } catch {
      // tolerate — falls into the no-signal default below
    }
  }

  const recommendation = recommendFor(experienceType, experienceName);

  return NextResponse.json(
    { ok: true, recommendation },
    { headers: { "Cache-Control": "no-store" } },
  );
}
