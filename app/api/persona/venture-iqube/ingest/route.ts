/**
 * POST /api/persona/venture-iqube/ingest
 *
 * Accept a Venture iQube JSON file (schemaVersion 'venture-iqube/v0.1'
 * or 'v0.2'), validate the high-level shape, and return a structured
 * preview of what aigentMe will hydrate. This is Phase A1 — preview
 * + persist only. Phase A2 wires the actual ExperienceQube +
 * IntentQube hydration; this route's response shape is forward-
 * compatible so the FE doesn't change when A2 lands.
 *
 * Body: { uploadId?: string; payload?: VentureIqube } — provide
 *        either an existing persona_uploads.id whose use_kind is
 *        'venture_iqube' OR the JSON inline.
 *
 * Auth: persona-scoped via the spine.
 *
 * Schema: codexes/packs/agentiq/updates/2026-05-29_venture-iqube-
 *         schema-v0.1.md (base) + 2026-05-29_venture-iqube-schema-
 *         v0.2.md (cartridgeSlug enum extension).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getPersonaUploadService } from '@/services/uploads/supabaseUploadAdapter';

export const dynamic = 'force-dynamic';

type SchemaVersion = 'venture-iqube/v0.1' | 'venture-iqube/v0.2';

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
}

function validateShape(payload: unknown): { ok: true; data: VentureIqube } | { ok: false; error: string } {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'payload must be a JSON object' };
  const p = payload as Partial<VentureIqube>;
  if (p.schemaVersion !== 'venture-iqube/v0.1' && p.schemaVersion !== 'venture-iqube/v0.2') {
    return { ok: false, error: `schemaVersion must be 'venture-iqube/v0.1' or 'venture-iqube/v0.2' (got ${JSON.stringify(p.schemaVersion)})` };
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
  return { ok: true, data: p as VentureIqube };
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

  // Phase A1: preview only. Phase A2 will here:
  //   1. Call upsertExperienceQubeMeta with experienceQubeHydrate
  //   2. For each intentQubeQueue entry, create an IntentQubeRecord
  //   3. Emit a DVN receipt: 'venture_iqube_ingested'
  //   4. Update the persona_uploads row metadata with the ingest result
  return NextResponse.json(
    {
      ok: true,
      phase: 'preview-only',
      message: 'Phase A1 — validation + hydration preview returned. ExperienceQube + IntentQube wiring lands in Phase A2.',
      result,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
