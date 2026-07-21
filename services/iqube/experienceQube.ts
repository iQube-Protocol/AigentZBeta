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
import {
  backfillSphereAlignment,
  deriveOverallAlignment,
  type PersonalGuideData,
} from '@/types/experienceGuide';

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
  | 'mvl';

/**
 * Operator archetype from the Polity Participation Model. T1 (public-safe).
 * Feeds NBE reranking so aigentMe biases toward archetype-appropriate moves.
 */
export type OperatorArchetype = 'citizen' | 'entrepreneurial' | 'technical' | 'creative' | 'research';

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
  /** Polity Participation Model archetype. Null until the operator sets it. */
  operatorArchetype: OperatorArchetype | null;
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
  /**
   * Personal ExperienceGuide layer — Sphere×Maturity lattice, alignment
   * state, repair risks, precedence mode. Server-only; routes shape their
   * own T1 response surfaces.
   */
  personalGuide?: PersonalGuideData;
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
  operator_archetype: string | null;
  blak_qube: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

const VALID_TYPES = new Set<ExperienceType>([
  'personal', 'creative', 'venture', 'client', 'portfolio', 'venture_building',
]);
const VALID_ARCHETYPES = new Set<OperatorArchetype>([
  'citizen', 'entrepreneurial', 'technical', 'creative', 'research',
]);
const VALID_STAGES = new Set<ExperienceStage>([
  'setup', 'alpha_activation', 'launch', 'growth', 'scale',
]);
const VALID_CONFIDENTIALITY = new Set<ConfidentialityDefault>([
  'private_by_default', 'selective_share', 'open',
]);
const VALID_CARTRIDGES = new Set<ActiveCartridgeSlug>([
  'metame', 'knyt', 'qriptopian', 'marketa', 'mvl',
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

  const archetype: OperatorArchetype | null =
    row.operator_archetype && VALID_ARCHETYPES.has(row.operator_archetype as OperatorArchetype)
      ? (row.operator_archetype as OperatorArchetype)
      : null;

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
      operatorArchetype: archetype,
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
// Timeout-guarded query wrapper.
//
// The Supabase JS client does not honor AbortSignal cleanly across all
// network layers. When the table does not exist OR a connection stalls,
// the call can hang past Lambda's 30s timeout and surface to the client
// as a 504. We wrap every DB call in Promise.race against an explicit
// timeout so the route can return a clear 500 with a diagnostic instead.
//
// Tunable via EXPERIENCE_QUBE_DB_TIMEOUT_MS env var; defaults to 6s.
// ─────────────────────────────────────────────────────────────────────────

const DB_TIMEOUT_MS = Number(process.env.EXPERIENCE_QUBE_DB_TIMEOUT_MS) || 6000;

function withTimeout<T>(promise: Promise<T>, op: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `[ExperienceQube] ${op} timed out after ${DB_TIMEOUT_MS}ms. ` +
                `Check that the experience_qubes migration has been applied ` +
                `(supabase/migrations/20260513000000_experience_qubes.sql) ` +
                `and that the Supabase project is reachable.`,
            ),
          ),
        DB_TIMEOUT_MS,
      ),
    ),
  ]);
}

/**
 * Detect a "relation does not exist" error from supabase-js / PostgREST.
 * When the migration hasn't been applied we want to fail fast with a
 * specific error rather than hang on retries.
 */
function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42P01') return true; // PG undefined_table
  if (error.code === 'PGRST205') return true; // PostgREST: relation not found
  if (typeof error.message === 'string' && /relation .* does not exist/i.test(error.message)) {
    return true;
  }
  return false;
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
  const result = await withTimeout(
    admin
      .from('experience_qubes')
      .select('*')
      .eq('persona_id', personaId)
      .maybeSingle(),
    'getExperienceQube',
  );
  const { data, error } = result as { data: unknown; error: { code?: string; message?: string } | null };
  if (error) {
    if (isMissingTable(error)) {
      // Migration not applied yet — degrade gracefully.
      console.warn(
        '[ExperienceQube] experience_qubes table missing — returning null. ' +
          'Apply supabase/migrations/20260513000000_experience_qubes.sql.',
      );
      return null;
    }
    // Other DB errors propagate so the route layer can surface them.
    throw new Error(`getExperienceQube failed: ${error.message ?? 'unknown error'}`);
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
  operatorArchetype?: OperatorArchetype | null;
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
  'personalGuide',
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

  const operatorArchetype: OperatorArchetype | null =
    input.operatorArchetype !== undefined
      ? (input.operatorArchetype && VALID_ARCHETYPES.has(input.operatorArchetype) ? input.operatorArchetype : null)
      : existing?.meta.operatorArchetype ?? null;

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
    operator_archetype: operatorArchetype,
    blak_qube: mergedBlak as Record<string, unknown>,
  };

  const result = await withTimeout(
    admin
      .from('experience_qubes')
      .upsert(row, { onConflict: 'persona_id' })
      .select('*')
      .single(),
    'upsertExperienceQube',
  );
  const { data, error } = result as { data: unknown; error: { code?: string; message?: string } | null };

  if (error || !data) {
    if (isMissingTable(error)) {
      throw new Error(
        'upsertExperienceQube: experience_qubes table is missing. ' +
          'Apply supabase/migrations/20260513000000_experience_qubes.sql in the Supabase SQL editor.',
      );
    }
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

// ─────────────────────────────────────────────────────────────────────────
// Personal ExperienceGuide — convenience accessors over the same row.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Read just the PersonalGuide payload from the persona's ExperienceQube.
 * Returns null if the user has never completed the guide onboarding (or
 * if the ExperienceQube row itself does not exist yet).
 */
export async function getPersonalGuide(
  personaId: string,
): Promise<PersonalGuideData | null> {
  const record = await getExperienceQube(personaId);
  if (!record) return null;
  const guide = record.blak.personalGuide;
  if (!guide || typeof guide !== 'object') return null;
  // Backfill `sphereAlignment` on read for legacy rows that only have the
  // single overall `alignmentState`. Fans the global value out to every
  // sphere so consumers can rely on the per-sphere map being present.
  // Also re-derives the overall from the per-sphere map so the headline
  // is always coherent with the parts.
  if (!guide.sphereAlignment) {
    guide.sphereAlignment = backfillSphereAlignment(guide.alignmentState);
  }
  guide.alignmentState = deriveOverallAlignment(guide.sphereAlignment);
  return guide;
}

/**
 * Upsert the PersonalGuide payload. Wraps upsertExperienceQube so the
 * existing meta + other BlakQube keys are preserved untouched.
 */
export async function upsertPersonalGuide(
  personaId: string,
  data: PersonalGuideData,
): Promise<PersonalGuideData> {
  const record = await upsertExperienceQube(personaId, {
    blak: { personalGuide: data },
  });
  return record.blak.personalGuide ?? data;
}
