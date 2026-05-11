/**
 * ExperienceQube service — per-persona governed container.
 *
 * Aigent Me Phase 2 (metaMe Personal Assistant Alpha).
 * Per PRD v0.2 §7.2.
 *
 * The ExperienceQube is the user's container for their ExperienceModel,
 * ExperienceGoals, ExperienceMap, ExperienceGuide settings, plus
 * confidential strategy / IP / partner data. One per persona.
 *
 * Two slices:
 *   - meta — public-safe (T1). Surfaces in the bootstrap response and any
 *     cross-cartridge signal that needs the user's primary goal / stage.
 *   - blak — private payload (T0). Only this service may read it. Routes
 *     emit a redacted summary controlled by evaluateAccess() decisions.
 *
 * Server-only — never imported from a browser bundle. Pair with a route
 * that surfaces the meta slice (and maybe a redacted blak summary) to
 * the client.
 *
 * Reuses (extends, does not replace):
 *   - Persona binding via the existing journey_states convention
 *     (persona_id text)
 *   - Optional FK into experience_models for users who follow a curated
 *     experience strategy from the global catalogue
 *   - getSupabaseServer() from app/api/_lib/supabaseServer
 *
 * No new resolver. The caller is responsible for passing the personaId
 * resolved by getActivePersona() at the route boundary.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

// ─────────────────────────────────────────────────────────────────────────
// Types — meta (T1) vs blak (T0).
// ─────────────────────────────────────────────────────────────────────────

export type ExperienceType =
  | 'personal'
  | 'creative'
  | 'venture'
  | 'client'
  | 'portfolio'
  | 'venture_building';

export type ExperienceStage =
  | 'setup'
  | 'alpha_activation'
  | 'launch'
  | 'growth'
  | 'scale';

export type ConfidentialityDefault =
  | 'private_by_default'
  | 'selective_share'
  | 'open';

export type ActiveCartridgeSlug =
  | 'metame'
  | 'knyt'
  | 'qriptopian'
  | 'marketa'
  | 'avl';

/** Public-safe slice — surfaces to the browser. T1. */
export interface ExperienceQubeMeta {
  experienceModelId: string | null;
  experienceName: string | null;
  experienceType: ExperienceType;
  primaryGoal: string | null;
  currentStage: ExperienceStage;
  progressModel: string;
  activeCartridges: ActiveCartridgeSlug[];
  confidentialityDefault: ConfidentialityDefault;
}

/** Private payload — server-side only. T0. PRD §7.2. */
export interface ExperienceQubeBlak {
  experienceGoals?: string[];
  experienceMap?: Record<string, unknown>;
  experienceGuideSettings?: Record<string, unknown>;
  strategicGoals?: string[];
  franchiseProposition?: Record<string, unknown>;
  activeKpis?: Record<string, unknown>;
  commercialGoals?: Record<string, unknown>;
  operationalGoals?: Record<string, unknown>;
  confidentialStrategyNotes?: string;
  unreleasedIp?: Record<string, unknown>;
  priorityPartners?: string[];
  activeCampaigns?: string[];
}

export interface ExperienceQubeRecord {
  id: string;
  meta: ExperienceQubeMeta;
  /**
   * BlakQube payload. NEVER serialise this in a route response without
   * an explicit user disclosure decision; redact via toRedactedSummary().
   */
  blak: ExperienceQubeBlak;
  createdAt: string;
  updatedAt: string;
}

/**
 * Lightweight summary surfaced to the bootstrap endpoint. Deliberately
 * narrower than ExperienceQubeMeta — exposes only what the welcome surface
 * needs to render the "configured? what's the active goal?" state line.
 */
export interface ExperienceQubeBootstrapHint {
  configured: boolean;
  experienceName?: string;
  primaryGoal?: string;
  currentStage?: ExperienceStage;
  activeCartridges?: ActiveCartridgeSlug[];
}

// ─────────────────────────────────────────────────────────────────────────
// Internal — DB row shape.
// ─────────────────────────────────────────────────────────────────────────

interface DbRow {
  id: string;
  persona_id: string;
  experience_model_id: string | null;
  experience_name: string | null;
  experience_type: string;
  primary_goal: string | null;
  current_stage: string;
  progress_model: string;
  active_cartridges: string[];
  confidentiality_default: string;
  blak_qube: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

const VALID_TYPES = new Set<ExperienceType>([
  'personal', 'creative', 'venture', 'client', 'portfolio', 'venture_building',
]);
const VALID_STAGES = new Set<ExperienceStage>([
  'setup', 'alpha_activation', 'launch', 'growth', 'scale',
]);
const VALID_CONFIDENTIALITY = new Set<ConfidentialityDefault>([
  'private_by_default', 'selective_share', 'open',
]);
const VALID_CARTRIDGES = new Set<ActiveCartridgeSlug>([
  'metame', 'knyt', 'qriptopian', 'marketa', 'avl',
]);

function rowToRecord(row: DbRow): ExperienceQubeRecord {
  const type: ExperienceType = VALID_TYPES.has(row.experience_type as ExperienceType)
    ? (row.experience_type as ExperienceType)
    : 'venture_building';
  const stage: ExperienceStage = VALID_STAGES.has(row.current_stage as ExperienceStage)
    ? (row.current_stage as ExperienceStage)
    : 'setup';
  const conf: ConfidentialityDefault = VALID_CONFIDENTIALITY.has(
    row.confidentiality_default as ConfidentialityDefault,
  )
    ? (row.confidentiality_default as ConfidentialityDefault)
    : 'private_by_default';
  const cartridges = (row.active_cartridges || []).filter(
    (slug): slug is ActiveCartridgeSlug =>
      VALID_CARTRIDGES.has(slug as ActiveCartridgeSlug),
  );

  return {
    id: row.id,
    meta: {
      experienceModelId: row.experience_model_id,
      experienceName: row.experience_name,
      experienceType: type,
      primaryGoal: row.primary_goal,
      currentStage: stage,
      progressModel: row.progress_model,
      activeCartridges: cartridges,
      confidentialityDefault: conf,
    },
    blak: (row.blak_qube ?? {}) as ExperienceQubeBlak,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getAdminClient() {
  const client = getSupabaseServer();
  if (!client) throw new Error('Supabase configuration missing for ExperienceQube service');
  return client;
}

// ─────────────────────────────────────────────────────────────────────────
// Reads.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Read the persona's ExperienceQube. Returns null when the user has not
 * yet completed setup. This is the canonical reader — every Aigent Me
 * route that needs experience context calls it.
 */
export async function getExperienceQube(
  personaId: string,
): Promise<ExperienceQubeRecord | null> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('experience_qubes')
    .select('*')
    .eq('persona_id', personaId)
    .maybeSingle();
  if (error) {
    // Table may not exist yet (migration not applied) — treat as 'no qube'.
    return null;
  }
  if (!data) return null;
  return rowToRecord(data as DbRow);
}

/**
 * Compact bootstrap hint. Used by /api/assistant/bootstrap to render the
 * "ExperienceModel: configured / not yet set up" state line on the
 * welcome surface without leaking the BlakQube payload.
 */
export async function getExperienceQubeBootstrapHint(
  personaId: string,
): Promise<ExperienceQubeBootstrapHint> {
  const record = await getExperienceQube(personaId);
  if (!record) return { configured: false };
  return {
    configured: true,
    experienceName: record.meta.experienceName ?? undefined,
    primaryGoal: record.meta.primaryGoal ?? undefined,
    currentStage: record.meta.currentStage,
    activeCartridges: record.meta.activeCartridges,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Writes — upsert on the persona-id unique key.
// ─────────────────────────────────────────────────────────────────────────

export interface ExperienceQubeUpsertInput {
  experienceModelId?: string | null;
  experienceName?: string;
  experienceType?: ExperienceType;
  primaryGoal?: string;
  currentStage?: ExperienceStage;
  progressModel?: string;
  activeCartridges?: ActiveCartridgeSlug[];
  confidentialityDefault?: ConfidentialityDefault;
  /**
   * BlakQube partial — merged into the existing payload. Only the keys
   * declared in ExperienceQubeBlak are persisted; unknown keys are dropped.
   */
  blak?: Partial<ExperienceQubeBlak>;
}

/**
 * Allowed BlakQube keys — anything else in the patch is dropped. Defends
 * against drive-by enrichment from the route layer that might otherwise
 * persist arbitrary blobs.
 */
const ALLOWED_BLAK_KEYS: Array<keyof ExperienceQubeBlak> = [
  'experienceGoals',
  'experienceMap',
  'experienceGuideSettings',
  'strategicGoals',
  'franchiseProposition',
  'activeKpis',
  'commercialGoals',
  'operationalGoals',
  'confidentialStrategyNotes',
  'unreleasedIp',
  'priorityPartners',
  'activeCampaigns',
];

function sanitiseBlak(
  patch: Partial<ExperienceQubeBlak> | undefined,
): Partial<ExperienceQubeBlak> {
  if (!patch || typeof patch !== 'object') return {};
  const out: Partial<ExperienceQubeBlak> = {};
  for (const key of ALLOWED_BLAK_KEYS) {
    if (key in patch) (out as Record<string, unknown>)[key] = (patch as Record<string, unknown>)[key];
  }
  return out;
}

/**
 * Create-or-update the persona's ExperienceQube. Single canonical writer
 * — every setup / update path calls this.
 *
 * Validation rules:
 *   - personaId must be a non-empty string
 *   - experienceType, currentStage, confidentialityDefault, activeCartridges
 *     are validated against their enum sets; bad values are dropped
 *   - blak patch is sanitised against ALLOWED_BLAK_KEYS
 *   - blak is MERGED with the existing payload (per-key override). Pass
 *     an explicit empty object to clear a key.
 */
export async function upsertExperienceQube(
  personaId: string,
  input: ExperienceQubeUpsertInput,
): Promise<ExperienceQubeRecord> {
  if (!personaId || typeof personaId !== 'string') {
    throw new Error('upsertExperienceQube: personaId is required');
  }

  const admin = getAdminClient();

  // Read current to merge BlakQube without clobbering existing keys.
  const existing = await getExperienceQube(personaId);
  const mergedBlak: ExperienceQubeBlak = {
    ...(existing?.blak ?? {}),
    ...sanitiseBlak(input.blak),
  };

  // Validate enum-bound meta fields.
  const experienceType: ExperienceType =
    input.experienceType && VALID_TYPES.has(input.experienceType)
      ? input.experienceType
      : existing?.meta.experienceType ?? 'venture_building';

  const currentStage: ExperienceStage =
    input.currentStage && VALID_STAGES.has(input.currentStage)
      ? input.currentStage
      : existing?.meta.currentStage ?? 'setup';

  const confidentialityDefault: ConfidentialityDefault =
    input.confidentialityDefault &&
    VALID_CONFIDENTIALITY.has(input.confidentialityDefault)
      ? input.confidentialityDefault
      : existing?.meta.confidentialityDefault ?? 'private_by_default';

  const activeCartridges: ActiveCartridgeSlug[] = (input.activeCartridges
    ? input.activeCartridges.filter((s) => VALID_CARTRIDGES.has(s))
    : existing?.meta.activeCartridges ?? ['metame']);

  const row = {
    persona_id: personaId,
    experience_model_id:
      input.experienceModelId !== undefined
        ? input.experienceModelId
        : existing?.meta.experienceModelId ?? null,
    experience_name:
      input.experienceName !== undefined
        ? input.experienceName
        : existing?.meta.experienceName ?? null,
    experience_type: experienceType,
    primary_goal:
      input.primaryGoal !== undefined
        ? input.primaryGoal
        : existing?.meta.primaryGoal ?? null,
    current_stage: currentStage,
    progress_model:
      input.progressModel ?? existing?.meta.progressModel ?? 'brief_decide_create_coordinate_record',
    active_cartridges: activeCartridges,
    confidentiality_default: confidentialityDefault,
    blak_qube: mergedBlak as Record<string, unknown>,
  };

  const { data, error } = await admin
    .from('experience_qubes')
    .upsert(row, { onConflict: 'persona_id' })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`upsertExperienceQube failed: ${error?.message ?? 'no row returned'}`);
  }

  return rowToRecord(data as DbRow);
}

/**
 * Returns the meta slice only — convenience for routes that must NOT touch
 * the BlakQube payload at all. Renders the same shape as the bootstrap.
 */
export function toMetaSlice(record: ExperienceQubeRecord): ExperienceQubeMeta {
  return record.meta;
}
