/**
 * POST /api/assistant/move-forward
 *
 * Aigent Me Phase 3 — Move This Cartridge Forward.
 * Per PRD v0.2 §12 (Move cartridge forward) and §8 Golden Path 3.
 *
 * Body (all optional):
 *   {
 *     cartridge?: 'metame'|'knyt'|'qriptopian'|'marketa'|'mvl'
 *   }
 *
 * - Body omitted → builder picks the strongest NBE across the user's active
 *   cartridges. This is Aigent Me's default move ("KNYT is the highest-
 *   leverage move today, here's the hero action").
 * - Body with `cartridge` → scope to that cartridge for steering.
 *
 * Response: MoveForwardShape (services/orchestration/briefBuilder.ts).
 *
 * Privacy mirrors /api/assistant/brief — personaId from the spine, no
 * BlakQube values, iQube disclosure included in the response.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { buildMoveForward } from '@/services/orchestration/briefBuilder';
import { runPreflightGather } from '@/services/capabilities/preflight';
import { summarizeCartridgeAdminContext } from '@/services/orchestration/adminContextSummarizer';
import type { ActiveCartridgeSlug } from '@/services/iqube/experienceQube';

export const dynamic = 'force-dynamic';

const VALID_CARTRIDGES: ActiveCartridgeSlug[] = [
  'metame',
  'knyt',
  'qriptopian',
  'marketa',
  'mvl',
];

interface PostBody {
  cartridge?: ActiveCartridgeSlug;
  /** Optional operator chat input — feeds the contextual-title backstop. */
  chatContext?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Body is optional. Empty / missing body → auto-pick top NBE across
  // active cartridges. Explicit `cartridge` → scope to one for steering.
  let raw: unknown = {};
  try {
    raw = await request.json();
  } catch {
    /* no body — auto-pick mode */
  }

  const body = (raw && typeof raw === 'object' ? raw : {}) as PostBody;
  const scoped: ActiveCartridgeSlug | undefined =
    body.cartridge && VALID_CARTRIDGES.includes(body.cartridge)
      ? body.cartridge
      : undefined;
  const chatContext =
    typeof body.chatContext === 'string' && body.chatContext.trim().length > 0
      ? body.chatContext.trim().slice(0, 240)
      : undefined;

  try {
    // Capability Gateway — Pattern A pre-flight gather. Surface id is
    // 'move-forward' so the env allowlist can target this independently.
    const preflight = await runPreflightGather({
      persona: context,
      surfaceId: 'move-forward',
      query: `next best action${scoped ? ` for ${scoped} cartridge` : ' across active cartridges'}`,
      cartridge: scoped ?? 'metame',
    });

    // 2026-05-26 chief-of-staff: fold admin-tier signals into
    // liveContext when the persona admins any cartridge. Recommender
    // biases toward orchestration moves (review queues, partner ops)
    // for admins; no-op for non-admin operators.
    const adminSummary = await summarizeCartridgeAdminContext(
      context.personaId,
      context.cartridgeFlags.adminCartridges,
      context.cartridgeFlags.isAdmin,
    );
    const liveContext = [preflight?.summary, adminSummary]
      .filter((s): s is string => typeof s === 'string' && s.length > 0)
      .join('\n\n') || null;

    const result = await buildMoveForward({
      personaId: context.personaId,
      ...(scoped ? { cartridge: scoped } : {}),
      liveContext,
      chatContext,
    });
    return NextResponse.json(
      preflight ? { ...result, preflightContext: preflight } : result,
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[assistant/move-forward] build failed: ${msg}`);
    return NextResponse.json(
      { error: 'move-forward-failed', detail: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
