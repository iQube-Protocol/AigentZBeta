/**
 * ventureQubeService — CRUD + the three Founder Office paths for VentureQube
 * v1.0 (the per-venture formation primitive).
 *
 * Founder Office paths (PRD v3):
 *   - discover  ("What should I build?")     → seeds intent/thesis from inputs
 *   - validate  ("Should I build this?")     → seeds an existing concept
 *   - architect ("How is it viable?")        → seeds revenue/commercial layers
 *
 * Every create/update runs the Standing-calibrated metaCommons evaluation
 * (services/venture/metacommonsSignals.ts) so the Signal Evidence + Governance
 * layers stay populated, and registers the venture in the iQube registry SoT as
 * a ClusterQube (best-effort; soft-fails if a registry migration is pending).
 *
 * T0 discipline: owner_persona_id never leaves the server. The returned
 * VentureQubeRecord is T1-safe (no owner persona id).
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  emptyVentureQubeV1,
  type VentureQubeV1,
  type VentureStage,
  type FounderPath,
} from '@/types/ventureQube';
import { parseVentureQubeV1 } from '@/services/iqube/ventureQubeSchema';
import { registerVentureIqube, deriveVenturePublicRef } from './registerVentureIqube';
import { readStandingForVenture } from './standingForVenture';
import { evaluateVentureSignals } from './metacommonsSignals';

export interface VentureQubeRecord {
  id: string;
  iqubeId: string | null;
  venturePublicRef: string;
  name: string;
  slug: string;
  stage: VentureStage;
  lastPath: FounderPath | null;
  ventureConfidence: number | null;
  status: 'active' | 'archived';
  layers: VentureQubeV1;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVentureInput {
  personaId: string;
  name: string;
  slug?: string;
  path?: FounderPath;
  stage?: VentureStage;
  /** Optional seed text that pre-fills thesis / intent depending on the path. */
  seed?: {
    problemStatement?: string;
    valueProposition?: string;
    mission?: string;
    consequenceThesis?: string;
    ventureIntents?: string[];
    founderIntents?: string[];
  };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'venture';
}

/** Map a DB row → T1-safe record. Recovers/repairs the layered object. */
function toRecord(row: Record<string, unknown>): VentureQubeRecord {
  const id = String(row.id);
  const name = String(row.venture_name ?? '');
  const slug = String(row.venture_slug ?? '');
  const stage = (row.venture_stage as VentureStage) ?? 'concept';
  let layers = row.layers as VentureQubeV1 | undefined;
  // Defensive: if the stored layers are absent/malformed, scaffold a fresh one.
  if (!layers || typeof layers !== 'object' || !('schemaVersion' in layers)) {
    layers = emptyVentureQubeV1(id, name, slug, stage);
  }
  return {
    id,
    iqubeId: row.iqube_id ? String(row.iqube_id) : null,
    venturePublicRef: deriveVenturePublicRef(id),
    name,
    slug,
    stage,
    lastPath: (row.last_path as FounderPath) ?? null,
    ventureConfidence:
      row.venture_confidence == null ? null : Number(row.venture_confidence),
    status: (row.status as 'active' | 'archived') ?? 'active',
    layers,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

/** Re-run Standing-calibrated evaluation and fold results into the layers. */
async function calibrate(
  admin: NonNullable<ReturnType<typeof getSupabaseServer>>,
  personaId: string,
  layers: VentureQubeV1,
): Promise<{ layers: VentureQubeV1; ventureConfidence: number | null }> {
  const standing = await readStandingForVenture(admin, personaId);
  const evalResult = evaluateVentureSignals(layers, standing);

  // Auto-populate capability "available" from verified capability facts (only
  // when the operator hasn't already declared them) — Standing → VentureQube.
  const capabilityFacts = [
    ...(standing.factsByDomain['professional'] ?? []),
    ...(standing.factsByDomain['founder'] ?? []),
    ...(standing.factsByDomain['extraordinary_ability'] ?? []),
  ]
    .map((f) => f.label || f.value || f.field)
    .filter((s): s is string => Boolean(s));

  const next: VentureQubeV1 = {
    ...layers,
    signalEvidence: { ...layers.signalEvidence, ...evalResult.signalEvidence },
    governance: { ...layers.governance, ...evalResult.governance },
    capability: {
      ...layers.capability,
      availableCapabilities:
        layers.capability.availableCapabilities.length > 0
          ? layers.capability.availableCapabilities
          : Array.from(new Set(capabilityFacts)).slice(0, 24),
    },
    identity: {
      ...layers.identity,
      standingPublicRefs: standing.hasStandingSignal
        ? layers.identity.standingPublicRefs ?? ['standing:calibrated']
        : layers.identity.standingPublicRefs,
    },
  };
  return { layers: next, ventureConfidence: evalResult.governance.ventureConfidence ?? null };
}

export async function createVentureQube(
  input: CreateVentureInput,
): Promise<{ ok: true; record: VentureQubeRecord } | { ok: false; error: string }> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'database unavailable' };
  const slug = slugify(input.slug || input.name);

  // Insert the row first to obtain the canonical row id (basis for refs).
  const { data: inserted, error: insErr } = await admin
    .from('venture_qubes')
    .insert({
      owner_persona_id: input.personaId,
      venture_name: input.name,
      venture_slug: slug,
      venture_stage: input.stage ?? 'concept',
      last_path: input.path ?? null,
      schema_version: 'venture-iqube/v1.0',
      layers: {},
    })
    .select('*')
    .single();
  if (insErr || !inserted) {
    const msg = insErr?.message ?? 'insert failed';
    if (msg.includes('duplicate') || insErr?.code === '23505') {
      return { ok: false, error: 'a venture with this slug already exists' };
    }
    return { ok: false, error: msg };
  }

  const id = String(inserted.id);
  let layers = emptyVentureQubeV1(id, input.name, slug, input.stage ?? 'concept');
  layers.lastPath = input.path;
  if (input.seed) {
    layers.thesis = {
      ...layers.thesis,
      problemStatement: input.seed.problemStatement,
      valueProposition: input.seed.valueProposition,
      mission: input.seed.mission,
      consequenceThesis: input.seed.consequenceThesis,
    };
    layers.intent = {
      founderIntents: input.seed.founderIntents ?? [],
      ventureIntents: input.seed.ventureIntents ?? [],
    };
  }

  const calibrated = await calibrate(admin, input.personaId, layers);
  layers = calibrated.layers;

  await admin
    .from('venture_qubes')
    .update({ layers, venture_confidence: calibrated.ventureConfidence })
    .eq('id', id);

  // Register in the registry SoT as a ClusterQube (best-effort).
  await registerVentureIqube({
    admin,
    ventureRowId: id,
    ownerPersonaId: input.personaId,
    ventureName: input.name,
    ventureSlug: slug,
  });

  const { data: finalRow } = await admin
    .from('venture_qubes')
    .select('*')
    .eq('id', id)
    .single();
  return { ok: true, record: toRecord(finalRow ?? { ...inserted, layers }) };
}

export async function listVentureQubes(personaId: string): Promise<VentureQubeRecord[]> {
  const admin = getSupabaseServer();
  if (!admin) return [];
  const { data, error } = await admin
    .from('venture_qubes')
    .select('*')
    .eq('owner_persona_id', personaId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false });
  if (error || !data) return [];
  return data.map(toRecord);
}

export async function getVentureQube(
  personaId: string,
  ventureId: string,
): Promise<VentureQubeRecord | null> {
  const admin = getSupabaseServer();
  if (!admin) return null;
  const { data, error } = await admin
    .from('venture_qubes')
    .select('*')
    .eq('id', ventureId)
    .eq('owner_persona_id', personaId)
    .maybeSingle();
  if (error || !data) return null;
  return toRecord(data);
}

/** Merge a partial layered patch, re-calibrate, and persist. */
export async function updateVentureQube(
  personaId: string,
  ventureId: string,
  patch: Partial<VentureQubeV1>,
  opts?: { stage?: VentureStage; path?: FounderPath; recalibrate?: boolean },
): Promise<{ ok: true; record: VentureQubeRecord } | { ok: false; error: string }> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'database unavailable' };
  const current = await getVentureQube(personaId, ventureId);
  if (!current) return { ok: false, error: 'venture not found' };

  let merged: VentureQubeV1 = { ...current.layers, ...patch };
  // Validate the merged object before persisting.
  const parsed = parseVentureQubeV1(merged);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  merged = parsed.data;

  let ventureConfidence = current.ventureConfidence;
  if (opts?.recalibrate !== false) {
    const calibrated = await calibrate(admin, personaId, merged);
    merged = calibrated.layers;
    ventureConfidence = calibrated.ventureConfidence;
  }

  const update: Record<string, unknown> = { layers: merged, venture_confidence: ventureConfidence };
  if (opts?.stage) update.venture_stage = opts.stage;
  if (opts?.path) update.last_path = opts.path;

  const { data, error } = await admin
    .from('venture_qubes')
    .update(update)
    .eq('id', ventureId)
    .eq('owner_persona_id', personaId)
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'update failed' };
  return { ok: true, record: toRecord(data) };
}

/** Re-pull Standing + re-run signals without other edits. */
export async function autopopulateVentureQube(
  personaId: string,
  ventureId: string,
): Promise<{ ok: true; record: VentureQubeRecord } | { ok: false; error: string }> {
  const current = await getVentureQube(personaId, ventureId);
  if (!current) return { ok: false, error: 'venture not found' };
  return updateVentureQube(personaId, ventureId, {}, { recalibrate: true });
}
