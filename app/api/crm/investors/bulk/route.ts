/**
 * POST /api/crm/investors/bulk
 *
 * Bulk-update campaign fields on multiple nakamoto_knyt_personas rows.
 * Processes in chunks of 100 to avoid Supabase payload limits.
 *
 * Body:
 *   {
 *     ids:     string[]                    -- nakamoto_knyt_personas UUIDs
 *     updates: Record<string, unknown>     -- fields to apply (same allowlist as PATCH /[id])
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCrmClient } from '@/services/crm/crmDataAccess';

export const dynamic = 'force-dynamic';

const ALLOWED_FIELDS = new Set([
  'campaign_cohort',
  'campaign_state',
  'offer_fit',
  'message_angle',
  'preferred_channel_primary',
  'preferred_channel_secondary',
  'reactivation_potential',
  'investment_amount_band',
  'investor_priority_band',
  'last_campaign_sequence',
  'campaign_notes',
  'campaign_tags',
]);

const CHUNK_SIZE = 100;

export async function POST(request: NextRequest) {
  let body: { ids?: unknown; updates?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const ids = body.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: '`ids` must be a non-empty array' }, { status: 400 });
  }

  const rawUpdates = body.updates;
  if (!rawUpdates || typeof rawUpdates !== 'object') {
    return NextResponse.json({ error: '`updates` must be an object' }, { status: 400 });
  }

  const updatePayload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawUpdates as Record<string, unknown>)) {
    if (ALLOWED_FIELDS.has(key)) {
      updatePayload[key] = value;
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const client = getCrmClient();
  let applied = 0;
  const errors: string[] = [];

  // Process in chunks
  const validIds = ids.filter((id): id is string => typeof id === 'string');
  for (let i = 0; i < validIds.length; i += CHUNK_SIZE) {
    const chunk = validIds.slice(i, i + CHUNK_SIZE);
    const { error } = await client
      .from('nakamoto_knyt_personas')
      .update(updatePayload)
      .in('id', chunk);

    if (error) {
      errors.push(`Chunk ${i}–${i + chunk.length}: ${error.message}`);
    } else {
      applied += chunk.length;
    }
  }

  return NextResponse.json({
    applied,
    total: validIds.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
