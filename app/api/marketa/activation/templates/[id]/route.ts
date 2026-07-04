/**
 * PATCH /api/marketa/activation/templates/[id] — update an outreach
 * template (any subset of name / strategicLane / subjectTemplate /
 * bodyTemplate / cta / enabled; enabled=false is the soft-disable).
 */

import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { dbToOutreachTemplate } from '@/services/marketa/activation/outreachTemplates';

export const dynamic = 'force-dynamic';

function jsonError(error: string, status = 400, detail?: string) {
  return NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = getSupabaseServer();
  if (!supabase) return jsonError('DB unavailable', 503);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError('invalid-json');
  }
  const body = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};

  const patch: Record<string, unknown> = {};
  const fieldMap: Record<string, string> = {
    name: 'name',
    strategicLane: 'strategic_lane',
    subjectTemplate: 'subject_template',
    bodyTemplate: 'body_template',
    cta: 'cta',
  };
  for (const [camel, snake] of Object.entries(fieldMap)) {
    if (typeof body[camel] === 'string') {
      const value = (body[camel] as string).trim();
      if (camel !== 'cta' && !value) return jsonError('template-validation-failed', 422, `${camel} cannot be empty`);
      patch[snake] = camel === 'strategicLane' && !value ? 'any' : value;
    }
  }
  if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;
  if (Object.keys(patch).length === 0) return jsonError('empty-patch', 422, 'Provide at least one field to update.');
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .schema('marketa')
    .from('marketa_outreach_templates')
    .update(patch)
    .eq('id', params.id)
    .select('*')
    .single();
  if (error) return jsonError('template-update-failed', 500, error.message);
  if (!data) return jsonError('template-not-found', 404);

  return NextResponse.json(
    { ok: true, template: dbToOutreachTemplate(data as Record<string, unknown>) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
