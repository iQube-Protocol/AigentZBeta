/**
 * POST /api/runtime/orchestration
 *   Body: { event_type, persona_id, journey_stage, active_cartridge?,
 *           active_codex?, from_role?, to_role?, reason?, receipt_eligible?,
 *           metadata? }
 *   Persists an OrchestrationEvent to orchestration_events.
 *
 * GET  /api/runtime/orchestration?personaId=<id>[&limit=20][&journey_stage=<stage>]
 *   Returns recent orchestration events for a persona.
 *
 * Phase 1 — KNYT Sprint 1
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  emitOrchestrationEvent,
  getRecentOrchestrationEvents,
} from '@/services/orchestration/orchestrationEvents';
import type { OrchestrationEvent } from '@/types/orchestration';

export const dynamic = 'force-dynamic';

function createEventId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    event_type,
    persona_id,
    journey_stage,
    active_cartridge,
    active_codex,
    from_role,
    to_role,
    reason,
    receipt_eligible = false,
    metadata = {},
  } = body;

  if (!event_type || !persona_id) {
    return NextResponse.json(
      { error: 'event_type and persona_id are required' },
      { status: 400 }
    );
  }

  const event: OrchestrationEvent = {
    event_id: createEventId(),
    timestamp: new Date().toISOString(),
    event_type,
    from_role: from_role ?? null,
    to_role: to_role ?? null,
    reason: reason ?? null,
    journey_stage: journey_stage ?? null,
    active_cartridge: active_cartridge ?? null,
    active_codex: active_codex ?? null,
    receipt_eligible,
    metadata: { persona_id, ...metadata },
  };

  await emitOrchestrationEvent(event);

  return NextResponse.json({ ok: true, event_id: event.event_id });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const personaId = searchParams.get('personaId');
  const limitParam = searchParams.get('limit');
  const journey_stage = searchParams.get('journey_stage') ?? undefined;

  // personaId is required — prevents cross-persona event disclosure
  if (!personaId) {
    return NextResponse.json({ error: 'personaId required' }, { status: 400 });
  }

  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 20;

  const events = await getRecentOrchestrationEvents({ limit, journey_stage });

  // Filter server-side by personaId via metadata.persona_id
  const filtered = events.filter((e) => e.metadata?.persona_id === personaId);

  return NextResponse.json({ events: filtered, count: filtered.length });
}
