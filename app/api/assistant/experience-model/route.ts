/**
 * POST /api/assistant/experience-model
 * GET  /api/assistant/experience-model
 *
 * Aigent Me Phase 2 — ExperienceQube setup / read.
 *
 * Per PRD v0.2 §12 (Setup/update ExperienceModel) and §6.2-6.3.
 *
 * - GET returns the active persona's ExperienceQube as a T1-safe meta
 *   slice. NEVER returns the BlakQube payload — that requires an explicit
 *   evaluateAccess() decision (lands in Phase 5 specialist routing).
 *
 * - POST upserts the ExperienceQube. Accepts the meta fields plus a
 *   sanitised BlakQube patch. The service merges into existing payload,
 *   so partial updates are safe.
 *
 * Privacy:
 *   - personaId resolved from the spine — never read from the body.
 *   - Response carries the meta slice + a redacted summary of the BlakQube
 *     (counts only — "x goals set, y partners listed") for UI confidence
 *     without exposing values.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  getExperienceQube,
  upsertExperienceQube,
  type ExperienceQubeRecord,
  type ExperienceQubeUpsertInput,
  type ExperienceType,
  type ExperienceStage,
  type ConfidentialityDefault,
  type ActiveCartridgeSlug,
} from '@/services/iqube/experienceQube';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────
// Response shaping — never serialise the BlakQube payload.
// ─────────────────────────────────────────────────────────────────────────

interface ExperienceQubeApiSurface {
  configured: boolean;
  meta: {
    experienceModelId: string | null;
    experienceName: string | null;
    experienceType: ExperienceType;
    primaryGoal: string | null;
    currentStage: ExperienceStage;
    progressModel: string;
    activeCartridges: ActiveCartridgeSlug[];
    confidentialityDefault: ConfidentialityDefault;
  } | null;
  /**
   * Counts-only view of the BlakQube — confirms presence without disclosing
   * values. Used by the welcome surface to render "5 goals set,
   * 3 priority partners listed" style copy.
   */
  blakSummary: {
    goalsCount: number;
    strategicGoalsCount: number;
    priorityPartnersCount: number;
    activeCampaignsCount: number;
    hasFranchiseProposition: boolean;
    hasConfidentialNotes: boolean;
  } | null;
  updatedAt: string | null;
}

function shape(record: ExperienceQubeRecord | null): ExperienceQubeApiSurface {
  if (!record) {
    return { configured: false, meta: null, blakSummary: null, updatedAt: null };
  }
  const blak = record.blak;
  return {
    configured: true,
    meta: record.meta,
    blakSummary: {
      goalsCount: blak.experienceGoals?.length ?? 0,
      strategicGoalsCount: blak.strategicGoals?.length ?? 0,
      priorityPartnersCount: blak.priorityPartners?.length ?? 0,
      activeCampaignsCount: blak.activeCampaigns?.length ?? 0,
      hasFranchiseProposition: !!blak.franchiseProposition && Object.keys(blak.franchiseProposition).length > 0,
      hasConfidentialNotes:
        typeof blak.confidentialStrategyNotes === 'string' &&
        blak.confidentialStrategyNotes.trim().length > 0,
    },
    updatedAt: record.updatedAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// GET — read.
// ─────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const record = await getExperienceQube(context.personaId);
  return NextResponse.json(shape(record), {
    headers: { 'Cache-Control': 'no-store' },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// POST — upsert.
// ─────────────────────────────────────────────────────────────────────────

interface PostBody {
  experienceModelId?: string | null;
  experienceName?: string;
  experienceType?: ExperienceType;
  primaryGoal?: string;
  currentStage?: ExperienceStage;
  progressModel?: string;
  activeCartridges?: ActiveCartridgeSlug[];
  confidentialityDefault?: ConfidentialityDefault;
  blak?: {
    experienceGoals?: string[];
    strategicGoals?: string[];
    priorityPartners?: string[];
    activeCampaigns?: string[];
    franchiseProposition?: Record<string, unknown>;
    confidentialStrategyNotes?: string;
    activeKpis?: Record<string, unknown>;
    commercialGoals?: Record<string, unknown>;
    operationalGoals?: Record<string, unknown>;
    unreleasedIp?: Record<string, unknown>;
    experienceMap?: Record<string, unknown>;
    experienceGuideSettings?: Record<string, unknown>;
  };
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function sanitiseBody(raw: unknown): ExperienceQubeUpsertInput {
  if (!raw || typeof raw !== 'object') return {};
  const body = raw as PostBody;
  const out: ExperienceQubeUpsertInput = {};

  if (typeof body.experienceModelId === 'string' || body.experienceModelId === null) {
    out.experienceModelId = body.experienceModelId;
  }
  if (typeof body.experienceName === 'string') out.experienceName = body.experienceName.slice(0, 500);
  if (typeof body.experienceType === 'string') out.experienceType = body.experienceType as ExperienceType;
  if (typeof body.primaryGoal === 'string') out.primaryGoal = body.primaryGoal.slice(0, 1000);
  if (typeof body.currentStage === 'string') out.currentStage = body.currentStage as ExperienceStage;
  if (typeof body.progressModel === 'string') out.progressModel = body.progressModel.slice(0, 200);
  if (isStringArray(body.activeCartridges)) {
    out.activeCartridges = body.activeCartridges as ActiveCartridgeSlug[];
  }
  if (typeof body.confidentialityDefault === 'string') {
    out.confidentialityDefault = body.confidentialityDefault as ConfidentialityDefault;
  }
  if (body.blak && typeof body.blak === 'object') {
    out.blak = body.blak;
  }
  return out;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid-json' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const input = sanitiseBody(raw);

  try {
    const record = await upsertExperienceQube(context.personaId, input);
    return NextResponse.json(shape(record), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[assistant/experience-model] upsert failed: ${msg}`);
    return NextResponse.json(
      { error: 'upsert-failed', detail: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
