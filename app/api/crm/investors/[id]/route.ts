/**
 * PATCH /api/crm/investors/[id]
 *
 * Admin endpoint to update campaign-state fields on a single
 * nakamoto_knyt_personas row.  Only whitelisted campaign fields
 * can be updated — core identity / investment data is read-only
 * through this endpoint.
 *
 * Uses the service-role CRM client (server-side only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCrmClient } from '@/services/crm/crmDataAccess';

export const dynamic = 'force-dynamic';

// Only these columns may be written via this endpoint
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
  'kickstarter_clicked_at',
  'kickstarter_backed_at',
  'last_campaign_sent_at',
  'last_campaign_sequence',
  'campaign_notes',
  'campaign_tags',
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: 'Missing investor id' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Only apply allowed campaign fields
  const updatePayload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(key)) {
      updatePayload[key] = value;
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const client = getCrmClient();
  const { data, error } = await client
    .from('nakamoto_knyt_personas')
    .update(updatePayload)
    .eq('id', id)
    .select('id, campaign_cohort, campaign_state, campaign_notes')
    .maybeSingle();

  if (error) {
    console.error('[investors/[id]] PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Investor not found' }, { status: 404 });
  }

  return NextResponse.json({ data });
}
