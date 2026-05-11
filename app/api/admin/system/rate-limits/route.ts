/**
 * GET   /api/admin/system/rate-limits
 * PATCH /api/admin/system/rate-limits   { endpointKey, scope, maxRequests, windowSeconds, isActive?, notes? }
 *
 * Admin-only. Live CRUD over the system_rate_limits table — operators
 * tune per-endpoint anti-abuse caps during alpha without redeploys.
 *
 * Audit: every PATCH emits an orchestration_events row with
 * event_type='admin.rate-limit-edit' so the security audit can trace
 * any cap changes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { listRateLimits, upsertRateLimit } from '@/services/rateLimit/rateLimitService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function assertAdmin(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return { ok: false as const, status: 401, error: 'Unauthorized' };
  if (!persona.cartridgeFlags?.isAdmin) {
    return { ok: false as const, status: 403, error: 'Admin required' };
  }
  return { ok: true as const, persona };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await assertAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const limits = await listRateLimits();
    return NextResponse.json({ limits }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

interface PatchPayload {
  endpointKey: string;
  scope: 'persona' | 'ip';
  maxRequests: number;
  windowSeconds: number;
  isActive?: boolean;
  notes?: string | null;
}

const ALLOWED_ENDPOINT_KEYS = new Set([
  'wallet:tasks:share-link',
  'wallet:tasks:track-click',
  'referral:resolve-code',
]);

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const auth = await assertAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json().catch(() => ({}))) as PatchPayload;

  if (!body.endpointKey || typeof body.endpointKey !== 'string') {
    return NextResponse.json({ error: 'endpointKey required' }, { status: 400 });
  }
  if (!ALLOWED_ENDPOINT_KEYS.has(body.endpointKey)) {
    return NextResponse.json(
      { error: `endpointKey must be one of: ${Array.from(ALLOWED_ENDPOINT_KEYS).join(', ')}` },
      { status: 400 },
    );
  }
  if (body.scope !== 'persona' && body.scope !== 'ip') {
    return NextResponse.json({ error: 'scope must be "persona" or "ip"' }, { status: 400 });
  }
  const maxRequests = Number(body.maxRequests);
  if (!Number.isInteger(maxRequests) || maxRequests <= 0 || maxRequests > 1_000_000) {
    return NextResponse.json({ error: 'maxRequests must be a positive integer ≤ 1,000,000' }, { status: 400 });
  }
  const windowSeconds = Number(body.windowSeconds);
  if (!Number.isInteger(windowSeconds) || windowSeconds <= 0 || windowSeconds > 86_400 * 30) {
    return NextResponse.json({ error: 'windowSeconds must be a positive integer ≤ 30 days' }, { status: 400 });
  }
  if (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') {
    return NextResponse.json({ error: 'notes must be string or null' }, { status: 400 });
  }
  if (body.notes && body.notes.length > 500) {
    return NextResponse.json({ error: 'notes too long (max 500 chars)' }, { status: 400 });
  }

  try {
    const updated = await upsertRateLimit({
      endpointKey: body.endpointKey,
      scope: body.scope,
      maxRequests,
      windowSeconds,
      isActive: body.isActive ?? true,
      notes: body.notes ?? null,
    });

    // Audit trail for the security review.
    try {
      const { emitOrchestrationEvent } = await import('@/services/orchestration/orchestrationEvents');
      await emitOrchestrationEvent({
        event_id: `admin:rate-limit:${body.endpointKey}:${body.scope}:${Date.now()}`,
        event_type: 'admin.rate-limit-edit',
        from_role: 'admin',
        to_role: 'system',
        reason: 'admin-edit',
        journey_stage: 'admin',
        active_cartridge: 'knyt',
        active_codex: 'knyt-codex',
        receipt_eligible: false,
        timestamp: new Date().toISOString(),
        metadata: {
          endpoint_key: body.endpointKey,
          scope: body.scope,
          max_requests: maxRequests,
          window_seconds: windowSeconds,
          is_active: body.isActive ?? true,
        },
      });
    } catch { /* non-fatal */ }

    return NextResponse.json({ limit: updated }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
