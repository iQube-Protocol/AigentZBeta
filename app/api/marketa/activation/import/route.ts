import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { candidateInputToDb, dbToCandidate, normalizeCandidateInput } from '@/services/marketa/activation/normalizers';

export const dynamic = 'force-dynamic';

function jsonError(error: string, status = 400, detail?: string) {
  return NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((value) => value.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, index) => { row[header] = values[index] ?? ''; });
    return row;
  });
}

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(/[|;]/).map((item) => item.trim()).filter(Boolean);
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return jsonError('DB unavailable', 503);

  const contentType = request.headers.get('content-type') ?? '';
  let rows: unknown[] = [];

  if (contentType.includes('text/csv')) {
    const csv = await request.text();
    rows = parseCsv(csv).map((row) => ({
      ...row,
      capabilities: parseList(row.capabilities),
      targetUsers: parseList(row.targetUsers ?? row.target_users),
    }));
  } else {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return jsonError('invalid-json');
    }
    rows = Array.isArray(raw) ? raw : Array.isArray((raw as { candidates?: unknown[] })?.candidates) ? (raw as { candidates: unknown[] }).candidates : [];
  }

  if (rows.length === 0) return jsonError('empty-import', 400, 'Provide a JSON array, { candidates }, or CSV body.');

  const inserts: Record<string, unknown>[] = [];
  const errors: Array<{ index: number; error: string }> = [];
  rows.forEach((row, index) => {
    try {
      inserts.push(candidateInputToDb(normalizeCandidateInput(row)));
    } catch (err) {
      errors.push({ index, error: err instanceof Error ? err.message : String(err) });
    }
  });

  if (inserts.length === 0) return jsonError('import-validation-failed', 400, JSON.stringify(errors));

  const { data, error } = await supabase
    .schema('marketa')
    .from('marketa_candidate_agents')
    .insert(inserts)
    .select('*');
  if (error) return jsonError('candidate-import-failed', 500, error.message);

  const candidates = (data ?? []).map((row) => dbToCandidate(row as Record<string, unknown>));
  if (candidates.length > 0) {
    await supabase
      .schema('marketa')
      .from('marketa_activation_events')
      .insert(candidates.map((candidate) => ({
        candidate_agent_id: candidate.id,
        event_type: 'candidate_imported',
        summary: `Candidate imported: ${candidate.name}`,
        actor: 'marketa',
        metadata: { sourceType: candidate.sourceType },
      })));
  }

  return NextResponse.json({ ok: true, imported: candidates.length, errors, candidates }, { headers: { 'Cache-Control': 'no-store' } });
}
