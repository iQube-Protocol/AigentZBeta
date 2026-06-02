/**
 * POST /api/persona/venture-iqube/ingest
 *
 * Accept a Venture iQube JSON file (schemaVersion 'venture-iqube/v0.1',
 * 'v0.2', 'v0.3', or 'v0.4'), validate the high-level shape, and return
 * a structured preview of what aigentMe will hydrate. This is Phase A1
 * — preview + persist only. Phase A2 wires the actual ExperienceQube +
 * IntentQube hydration; this route's response shape is forward-
 * compatible so the FE doesn't change when A2 lands.
 *
 * v0.4 (2026-06-01) — accepts the nested ventures[].myCartridge block
 * per myCartridge PRD v0.2 §27. MVP behavior: the block is validated
 * via Zod and echoed back in the preview, but cartridge persistence
 * to codex_configs is deferred to Phase 11 (Active Surface Access /
 * Requests). The legacy top-level `smartTriad` key is rejected with
 * a migration error.
 *
 * Body: { uploadId?: string; payload?: VentureIqube } — provide
 *        either an existing persona_uploads.id whose use_kind is
 *        'venture_iqube' OR the JSON inline.
 *
 * Auth: persona-scoped via the spine.
 *
 * Schema docs:
 *   codexes/packs/agentiq/updates/2026-05-29_venture-iqube-schema-v0.1.md (base)
 *   codexes/packs/agentiq/updates/2026-05-29_venture-iqube-schema-v0.2.md (cartridgeSlug enum)
 *   codexes/packs/agentiq/updates/2026-05-29_venture-iqube-schema-v0.3.md (avl → mvl)
 *   codexes/packs/agentiq/updates/2026-06-01_venture-iqube-schema-v0.4.md (myCartridge block)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getPersonaUploadService } from '@/services/uploads/supabaseUploadAdapter';
import {
  upsertExperienceQube,
  type ActiveCartridgeSlug,
  type ExperienceStage,
} from '@/services/iqube/experienceQube';
import { parseVentureQube } from '@/services/iqube/ventureQubeSchema';
import type { MyCartridgeBlock } from '@/types/ventureQube';

export const dynamic = 'force-dynamic';

type SchemaVersion =
  | 'venture-iqube/v0.1'
  | 'venture-iqube/v0.2'
  | 'venture-iqube/v0.3'
  | 'venture-iqube/v0.4';

interface VentureIqube {
  schemaVersion: SchemaVersion;
  emittedAt?: string;
  operator: { displayLabel: string; archetype: string; tagline?: string; fioHandle?: string };
  strategy: {
    headline: string;
    thesis: string;
    currentStage?: string;
    blockers?: string[];
    constraints?: string[];
  };
  ventures: Array<{
    id: string;
    name: string;
    tagline?: string;
    stage?: string;
    cartridgeBindings?: string[];
    northStarKpi?: string;
    objectives: Array<{
      id: string;
      title: string;
      summary?: string;
      impact: string;
      effort: string;
      horizon?: string;
      successCriteria?: string[];
      dependencies?: string[];
      specialistHint?: string;
    }>;
    partners?: Array<{ name: string; role?: string; status?: string }>;
    notes?: string;
  }>;
  plan: Record<string, { focus: string; actions: Array<{ title: string; ventureId: string; objectiveId?: string; owner?: string; due?: string; blocker?: string }> }>;
  specialistPreferences?: Record<string, string>;
  kpiBoard?: Array<{ name: string; metric: string; current?: string | number | null; target: string | number; horizon: string; ventureId?: string }>;
}

interface IngestPreview {
  schemaVersion: SchemaVersion;
  operatorDisplayLabel: string;
  experienceQubeHydrate: {
    experienceName: string;
    primaryGoal: string;
    currentStage: string | null;
    activeCartridges: string[];
  };
  intentQubeQueue: Array<{
    id: string;
    title: string;
    ventureId: string;
    horizon: string | null;
    specialistHint: string | null;
    impact: string;
  }>;
  kpiCount: number;
  partnerCount: number;
  warnings: string[];
  // v0.4 — present iff the payload carries a configured myCartridge block.
  // MVP behavior: echoed back in the preview only; persistence to
  // codex_configs ships in Phase 11.
  myCartridge?: {
    slug: string;
    title: string;
    category: MyCartridgeBlock['category'];
    visibility: MyCartridgeBlock['visibility'];
    primaryTabSlug: string | null;
    triadEnabled: { codex: boolean; copilotSource: MyCartridgeBlock['smartTriad']['copilot']['source']; walletEnabled: boolean };
    catalogueOptIn: boolean;
    persistencePending: true;
  };
}

function validateShape(payload: unknown): { ok: true; data: VentureIqube } | { ok: false; error: string } {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'payload must be a JSON object' };
  const p = payload as Partial<VentureIqube>;
  if (
    p.schemaVersion !== 'venture-iqube/v0.1' &&
    p.schemaVersion !== 'venture-iqube/v0.2' &&
    p.schemaVersion !== 'venture-iqube/v0.3' &&
    p.schemaVersion !== 'venture-iqube/v0.4'
  ) {
    return { ok: false, error: `schemaVersion must be 'venture-iqube/v0.1', 'v0.2', 'v0.3', or 'v0.4' (got ${JSON.stringify(p.schemaVersion)})` };
  }
  if (!p.operator?.displayLabel) return { ok: false, error: 'operator.displayLabel is required' };
  if (!p.strategy?.headline) return { ok: false, error: 'strategy.headline is required' };
  if (!p.strategy?.thesis) return { ok: false, error: 'strategy.thesis is required' };
  if (!Array.isArray(p.ventures) || p.ventures.length === 0) return { ok: false, error: 'ventures must be a non-empty array' };
  if (!p.plan || typeof p.plan !== 'object') return { ok: false, error: 'plan must be present' };
  for (const horizon of ['today', 'next24h', 'next7d', 'next30d', 'next90d']) {
    if (!(horizon in p.plan)) return { ok: false, error: `plan.${horizon} is required` };
  }
  for (const v of p.ventures) {
    if (!v.id || !v.name || !Array.isArray(v.objectives)) {
      return { ok: false, error: `ventures[].id, .name, and .objectives[] are required (offending venture: ${v.id ?? v.name ?? 'unknown'})` };
    }
  }
  // v0.4 — run the strict Zod schema to validate the nested myCartridge
  // block (when present) and reject the legacy top-level `smartTriad`
  // key with a migration error.
  if (p.schemaVersion === 'venture-iqube/v0.4') {
    const strict = parseVentureQube(payload);
    if (!strict.ok) {
      return { ok: false, error: `v0.4 validation failed — ${strict.error}` };
    }
  }
  return { ok: true, data: p as VentureIqube };
}

/**
 * Extract the (at most one) myCartridge block from a validated v0.4
 * payload. Returns null for v0.1/v0.2/v0.3 or v0.4 payloads without a
 * configured myCartridge.
 *
 * MVP rule: 1 venture per persona (non-sys-admin); enforcement of
 * "exactly one venture carries myCartridge" lands when Phase 11 wires
 * cartridge persistence. Today we silently take the first one.
 */
function extractMyCartridge(data: VentureIqube): MyCartridgeBlock | null {
  if (data.schemaVersion !== 'venture-iqube/v0.4') return null;
  for (const v of data.ventures) {
    const block = (v as { myCartridge?: MyCartridgeBlock }).myCartridge;
    if (block && block.configured === true) return block;
  }
  return null;
}

function preview(data: VentureIqube): IngestPreview {
  const warnings: string[] = [];
  const allBindings = new Set<string>();
  for (const v of data.ventures) {
    for (const c of v.cartridgeBindings ?? []) allBindings.add(c);
  }
  // Sub-surface bindings translate to known cartridge slugs at ingest
  // time (see codexes/.../venture-iqube-schema-v0.2.md). For v0.1
  // payloads, these slugs never appear, so the mapper is a no-op.
  const SUB_SURFACE_MAP: Record<string, string> = {
    'studio': 'metame',
    'iqube-registry': 'agentiq-os',
    'moneypenny': 'metame',
    'legal-metacommons': 'metame',
    // 2026-05-29 rename: AgentiQ Venture Lab → metaMe Venture Lab.
    // v0.1 / v0.2 payloads still emit 'avl'; translate so they hydrate
    // against the current ActiveCartridgeSlug enum which only knows 'mvl'.
    // v0.4 will drop this and reject any 'avl' binding outright.
    'avl': 'mvl',
  };
  const mapped = new Set<string>();
  for (const s of allBindings) {
    mapped.add(SUB_SURFACE_MAP[s] ?? s);
  }
  const intentQubeQueue: IngestPreview['intentQubeQueue'] = [];
  for (const v of data.ventures) {
    for (const o of v.objectives) {
      intentQubeQueue.push({
        id: `${v.id}:${o.id}`,
        title: o.title,
        ventureId: v.id,
        horizon: o.horizon ?? null,
        specialistHint: o.specialistHint ?? null,
        impact: o.impact,
      });
    }
  }
  const partnerCount = data.ventures.reduce((acc, v) => acc + (v.partners?.length ?? 0), 0);
  if (data.schemaVersion === 'venture-iqube/v0.1' && [...allBindings].some((b) => ['studio', 'iqube-registry', 'moneypenny', 'legal-metacommons'].includes(b))) {
    warnings.push('Detected v0.2 sub-surface bindings in a v0.1 payload — re-emit with schemaVersion "venture-iqube/v0.2" to avoid translation drift.');
  }

  // v0.4 — surface the myCartridge block as a slim preview. Persistence
  // to codex_configs is deferred to Phase 11; flagged via
  // `persistencePending: true` so callers don't assume the cartridge is
  // live yet.
  const myCartridge = extractMyCartridge(data);
  let myCartridgePreview: IngestPreview['myCartridge'];
  if (myCartridge) {
    const primaryTab = myCartridge.tabs.find((t) => t.primary === true);
    myCartridgePreview = {
      slug: myCartridge.slug,
      title: myCartridge.title,
      category: myCartridge.category,
      visibility: myCartridge.visibility,
      primaryTabSlug: primaryTab?.slug ?? null,
      triadEnabled: {
        codex: myCartridge.smartTriad.codex.enabled,
        copilotSource: myCartridge.smartTriad.copilot.source,
        walletEnabled: myCartridge.smartTriad.wallet.enabled,
      },
      catalogueOptIn: myCartridge.catalogueOptIn ?? false,
      persistencePending: true,
    };
    warnings.push(
      'v0.4 myCartridge block accepted in preview; cartridge persistence to codex_configs is deferred to Phase 11 (Active Surface Access / Requests).',
    );
  }

  return {
    schemaVersion: data.schemaVersion,
    operatorDisplayLabel: data.operator.displayLabel,
    experienceQubeHydrate: {
      experienceName: data.strategy.headline.slice(0, 140),
      primaryGoal: data.strategy.headline.slice(0, 200),
      currentStage: data.strategy.currentStage ?? null,
      activeCartridges: Array.from(mapped),
    },
    intentQubeQueue,
    kpiCount: data.kpiBoard?.length ?? 0,
    partnerCount,
    warnings,
    ...(myCartridgePreview ? { myCartridge: myCartridgePreview } : {}),
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  let body: { uploadId?: string; payload?: unknown };
  try {
    body = (await req.json()) as { uploadId?: string; payload?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  let payload: unknown;
  if (body.payload) {
    payload = body.payload;
  } else if (body.uploadId) {
    // Resolve the persona_uploads row, ensure it's tagged venture_iqube,
    // and read the bytes as JSON.
    const service = getPersonaUploadService();
    const row = await service.get(body.uploadId, persona.personaId);
    if (!row) return NextResponse.json({ error: 'upload-not-found' }, { status: 404 });
    if (row.useKind !== 'venture_iqube') {
      return NextResponse.json({ error: 'upload-wrong-use-kind', detail: `upload ${body.uploadId} has use_kind '${row.useKind}', expected 'venture_iqube'` }, { status: 400 });
    }
    const bytes = await service.readBytes(body.uploadId, persona.personaId);
    if (!bytes) return NextResponse.json({ error: 'upload-read-failed' }, { status: 500 });
    try {
      payload = JSON.parse(new TextDecoder().decode(bytes));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: 'invalid-json-payload', detail: msg }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: 'missing-payload-or-uploadId' }, { status: 400 });
  }

  const validated = validateShape(payload);
  if (!validated.ok) {
    return NextResponse.json({ error: 'schema-validation-failed', detail: validated.error }, { status: 400 });
  }

  const result = preview(validated.data);

  // Phase A2: commit the ExperienceQube hydration.
  //
  // Map the Venture iQube fields onto the ExperienceQube shape:
  //   - meta.experienceName     ← strategy.headline (clipped to 140)
  //   - meta.primaryGoal        ← strategy.headline (clipped to 200)
  //   - meta.currentStage       ← stage-mapped from the metaMe ladder
  //   - meta.activeCartridges   ← preview.experienceQubeHydrate.activeCartridges
  //                                 (already sub-surface-translated;
  //                                 upsertExperienceQube filters to its
  //                                 own VALID_CARTRIDGES set)
  //   - blak.strategicGoals     ← strategy.headline + ventures[].northStarKpi
  //                                 lines (operator-readable strategic
  //                                 anchor list, surfaces in Briefs)
  //   - blak.experienceGoals    ← all objective titles across ventures
  //                                 (the NBE catalog filters against
  //                                 these for goalKeyword scoring)
  //   - blak.confidentialStrategyNotes ← strategy.thesis (T0; never
  //                                 emitted to the browser; used as
  //                                 LLM-only context)
  //
  // PersonalGuide (the 7×7 sphere × maturity lattice) is intentionally
  // NOT hydrated from the Venture iQube — that's a separate "lived
  // state" layer the operator sets up via the metaMe wizard. Same
  // story for the Matrix step (Sphere × Maturity goals) which depends
  // on the PersonalGuide.
  //
  // IntentQube row creation (one per objective) is queued for a later
  // pass — the IntentQube path has its own routing / nbe_plans gating
  // that takes a heavier lift. Phase A2 here is the smaller wins:
  // Experience Model live; Briefs / Move-forward / Venture progress
  // start grounding in the operator's actual strategy on next render.
  try {
    const ladderToStage: Record<string, ExperienceStage> = {
      prospect: 'setup',
      acolyte: 'setup',
      keta: 'alpha_activation',
      keji: 'alpha_activation',
      first: 'launch',
      zero: 'launch',
    };
    const stage =
      validated.data.strategy.currentStage && ladderToStage[validated.data.strategy.currentStage]
        ? ladderToStage[validated.data.strategy.currentStage]
        : undefined;

    const strategicGoals = [
      validated.data.strategy.headline.slice(0, 200),
      ...validated.data.ventures
        .map((v) => v.northStarKpi)
        .filter((s): s is string => typeof s === 'string' && s.length > 0)
        .map((s) => s.slice(0, 200)),
    ].slice(0, 10);

    const experienceGoals = validated.data.ventures
      .flatMap((v) => v.objectives.map((o) => o.title))
      .map((s) => s.slice(0, 200))
      .slice(0, 30);

    const hydrated = await upsertExperienceQube(persona.personaId, {
      experienceName: validated.data.strategy.headline.slice(0, 140),
      primaryGoal: validated.data.strategy.headline.slice(0, 200),
      ...(stage ? { currentStage: stage } : {}),
      activeCartridges: result.experienceQubeHydrate.activeCartridges as ActiveCartridgeSlug[],
      blak: {
        strategicGoals,
        experienceGoals,
        confidentialStrategyNotes: validated.data.strategy.thesis.slice(0, 4000),
      },
    });

    return NextResponse.json(
      {
        ok: true,
        phase: 'hydrated',
        message:
          'ExperienceQube hydrated. Next Brief / Move-forward / Venture progress / Ask specialists render will ground in the ingested strategy. PersonalGuide + Matrix still need the wizard. IntentQube row creation deferred — objectives are queued in the preview payload only.',
        result,
        experienceQube: {
          experienceName: hydrated.meta.experienceName,
          primaryGoal: hydrated.meta.primaryGoal,
          currentStage: hydrated.meta.currentStage,
          activeCartridges: hydrated.meta.activeCartridges,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[venture-iqube/ingest] hydrate failed', msg);
    return NextResponse.json(
      {
        ok: false,
        phase: 'preview-only',
        error: 'hydrate-failed',
        detail: msg,
        message:
          'Schema validated and preview computed, but ExperienceQube upsert failed. The preview payload is still safe to inspect — no partial state was committed.',
        result,
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
