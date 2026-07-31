/**
 * GET  /api/marketa/activation/templates — list outreach templates
 * POST /api/marketa/activation/templates — create one
 *
 * Operator-curated outreach template library (golden path #5). If the
 * marketa_outreach_templates table hasn't been migrated yet, GET returns
 * an empty list with setupRequired so the UI degrades to the built-in
 * draft copy instead of erroring.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { dbToOutreachTemplate, outreachTemplateInputToDb } from '@/services/marketa/activation/outreachTemplates';

export const dynamic = 'force-dynamic';

function jsonError(error: string, status = 400, detail?: string) {
  return NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status, headers: { 'Cache-Control': 'no-store' } });
}

const isMissingTable = (message: string) =>
  /relation .*marketa_outreach_templates.* does not exist|42P01/i.test(message);

export async function GET() {
  const supabase = getSupabaseServer();
  if (!supabase) return jsonError('DB unavailable', 503);

  const { data, error } = await supabase
    .schema('marketa')
    .from('marketa_outreach_templates')
    .select('*')
    .order('strategic_lane')
    .order('name');
  if (error) {
    if (isMissingTable(error.message)) {
      return NextResponse.json(
        { ok: true, templates: [], setupRequired: true },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return jsonError('template-list-failed', 500, error.message);
  }

  return NextResponse.json(
    { ok: true, templates: (data ?? []).map((row) => dbToOutreachTemplate(row as Record<string, unknown>)) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return jsonError('DB unavailable', 503);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError('invalid-json');
  }

  let insert: Record<string, unknown>;
  try {
    insert = outreachTemplateInputToDb(raw);
  } catch (err) {
    return jsonError('template-validation-failed', 422, err instanceof Error ? err.message : String(err));
  }

  const { data, error } = await supabase
    .schema('marketa')
    .from('marketa_outreach_templates')
    .insert(insert)
    .select('*')
    .single();
  if (error) {
    if (isMissingTable(error.message)) {
      return jsonError('templates-table-missing', 503, 'Run the 20260612000000_marketa_outreach_templates migration first.');
    }
    return jsonError('template-create-failed', 500, error.message);
  }

  return NextResponse.json(
    { ok: true, template: dbToOutreachTemplate(data as Record<string, unknown>) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
