/**
 * POST /api/assistant/brief
 *
 * Aigent Me Phase 3 — Daily / Project / Cartridge brief.
 * Per PRD v0.2 §12 (Generate brief) and §8 Golden Path 2.
 *
 * Body (all optional):
 *   {
 *     briefType?: 'daily' | 'project' | 'cartridge',  // default 'daily'
 *     scopedCartridge?: 'metame'|'knyt'|'qriptopian'|'marketa'|'mvl',
 *   }
 *
 * Response: BriefShape (services/orchestration/briefBuilder.ts).
 *
 * Privacy:
 *   - personaId resolved from the spine; never read from the body.
 *   - Brief response carries iQube usage disclosure + 'not shared' list
 *     so the calling surface can render the canonical iQube discipline.
 *   - No BlakQube payload values are surfaced — the brief reads only the
 *     meta slice via getExperienceQube → meta hint.
 *
 * Phase 3.b will add LLM enrichment for the prose; the structural shape
 * is the contract and stays stable across that change.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  buildBrief,
  type BriefType,
} from '@/services/orchestration/briefBuilder';
import { runPreflightGather } from '@/services/capabilities/preflight';
import { summarizeCartridgeAdminContext } from '@/services/orchestration/adminContextSummarizer';
import type { ActiveCartridgeSlug } from '@/services/iqube/experienceQube';

export const dynamic = 'force-dynamic';

const VALID_BRIEF_TYPES: BriefType[] = ['daily', 'project', 'cartridge'];
const VALID_CARTRIDGES: ActiveCartridgeSlug[] = [
  'metame',
  'knyt',
  'qriptopian',
  'marketa',
  'mvl',
];

interface PostBody {
  briefType?: BriefType;
  scopedCartridge?: ActiveCartridgeSlug;
}

function sanitiseBody(raw: unknown): {
  briefType: BriefType;
  scopedCartridge?: ActiveCartridgeSlug;
} {
  if (!raw || typeof raw !== 'object') return { briefType: 'daily' };
  const body = raw as PostBody;
  const briefType: BriefType =
    body.briefType && VALID_BRIEF_TYPES.includes(body.briefType)
      ? body.briefType
      : 'daily';
  const scopedCartridge =
    body.scopedCartridge && VALID_CARTRIDGES.includes(body.scopedCartridge)
      ? body.scopedCartridge
      : undefined;
  return { briefType, scopedCartridge };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Body is optional — accept JSON if present, fall through to defaults.
  let raw: unknown = {};
  try {
    raw = await request.json();
  } catch {
    /* no body / invalid json — default to daily brief */
  }
  const { briefType, scopedCartridge } = sanitiseBody(raw);

  try {
    // Capability Gateway — Pattern A pre-flight gather. Surface id is
    // 'brief' so the env allowlist can target this independently. The
    // query reflects which brief variant the user asked for so a future
    // search tool can return audience-appropriate context.
    const preflight = await runPreflightGather({
      persona: context,
      surfaceId: 'brief',
      query: `aigentMe ${briefType} brief${scopedCartridge ? ` for ${scopedCartridge}` : ''}`,
      cartridge: scopedCartridge ?? 'metame',
    });

    // 2026-05-26 chief-of-staff extension: fold admin-tier signals
    // into liveContext when the persona admins any cartridge. The
    // recommender uses this to bias toward chief-of-staff moves
    // (review queues, partner ops) over ground-level operator moves.
    // No-op for non-admins.
    const adminSummary = await summarizeCartridgeAdminContext(
      context.personaId,
      context.cartridgeFlags.adminCartridges,
      context.cartridgeFlags.isAdmin,
    );
    const liveContext = [preflight?.summary, adminSummary]
      .filter((s): s is string => typeof s === 'string' && s.length > 0)
      .join('\n\n') || null;

    const brief = await buildBrief({
      personaId: context.personaId,
      briefType,
      scopedCartridge,
      liveContext,
    });
    return NextResponse.json(
      preflight ? { ...brief, preflightContext: preflight } : brief,
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[assistant/brief] build failed: ${msg}`);
    return NextResponse.json(
      { error: 'brief-failed', detail: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
