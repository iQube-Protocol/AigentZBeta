/**
 * GET  /api/crm/partners  — list all partner outreach records
 * POST /api/crm/partners  — create or update a partner outreach record
 * PATCH /api/crm/partners — update a single partner outreach record by id
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCrmClient } from '@/services/crm/crmDataAccess';

export const dynamic = 'force-dynamic';

export async function GET() {
  const client = getCrmClient();
  const { data, error } = await client
    .from('partner_outreach')
    .select('*')
    .order('partner_name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

const ALLOWED_FIELDS = new Set([
  'partner_name',
  'contact_name',
  'contact_email',
  'contact_phone',
  'outreach_status',
  'outreach_channel',
  'partner_type',
  'notes',
  'first_contact_at',
  'last_contact_at',
  'follow_up_at',
]);

function pickAllowed(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(k)) out[k] = v;
  }
  return out;
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const payload = pickAllowed(body);
  if (!payload.partner_name) {
    return NextResponse.json({ error: '`partner_name` is required' }, { status: 400 });
  }

  const client = getCrmClient();
  const { data, error } = await client
    .from('partner_outreach')
    .insert(payload)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const id = body.id;
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: '`id` is required for PATCH' }, { status: 400 });
  }

  const payload = pickAllowed(body);
  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const client = getCrmClient();
  const { data, error } = await client
    .from('partner_outreach')
    .update(payload)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Partner record not found' }, { status: 404 });
  }

  return NextResponse.json({ data });
}
