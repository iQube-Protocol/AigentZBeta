/**
 * GET  /api/runtime/settings/context → { context: 'metame' | 'knyt' }
 * PUT  /api/runtime/settings/context → { context: 'metame' | 'knyt' }
 *
 * Server-side persistence for the runtime takeover context preference.
 * Replaces the localStorage-only approach which doesn't propagate across
 * origins (admin tab on dev-beta vs thin client iframe on metame.live).
 *
 * Storage: single row in orchestration_events with a well-known event_id.
 * No migration needed — orchestration_events already exists.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SETTING_EVENT_ID = 'platform:runtime-context-preference';

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function isValidContext(v: unknown): v is 'metame' | 'knyt' {
  return v === 'metame' || v === 'knyt';
}

export async function GET(): Promise<NextResponse> {
  try {
    const { data } = await sb()
      .from('orchestration_events')
      .select('metadata')
      .eq('event_id', SETTING_EVENT_ID)
      .maybeSingle();

    const ctx = data?.metadata?.context;
    return NextResponse.json(
      { context: isValidContext(ctx) ? ctx : 'metame' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ context: 'metame' }, { headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => ({}));
  const ctx = body?.context;

  if (!isValidContext(ctx)) {
    return NextResponse.json({ error: 'context must be "metame" or "knyt"' }, { status: 400 });
  }

  const db = sb();
  const now = new Date().toISOString();

  const { error } = await db
    .from('orchestration_events')
    .upsert(
      {
        event_id: SETTING_EVENT_ID,
        event_type: 'platform.runtime-context-preference',
        from_role: 'admin',
        to_role: 'system',
        reason: 'admin-toggle',
        journey_stage: 'admin',
        active_cartridge: ctx === 'knyt' ? 'knyt' : 'metame',
        receipt_eligible: false,
        metadata: { context: ctx, updated_at: now },
      },
      { onConflict: 'event_id' },
    );

  if (error) {
    return NextResponse.json({ error: 'Failed to save', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ context: ctx }, { headers: { 'Cache-Control': 'no-store' } });
}
