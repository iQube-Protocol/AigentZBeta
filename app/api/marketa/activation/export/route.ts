import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { dbToCandidate } from '@/services/marketa/activation/normalizers';

export const dynamic = 'force-dynamic';

function jsonError(error: string, status = 400, detail?: string) {
  return NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function csvEscape(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return jsonError('DB unavailable', 503);

  const format = request.nextUrl.searchParams.get('format') ?? 'json';
  const { data, error } = await supabase
    .schema('marketa')
    .from('marketa_candidate_agents')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1000);

  if (error) return jsonError('candidate-export-failed', 500, error.message);
  const candidates = (data ?? []).map((row) => dbToCandidate(row as Record<string, unknown>));

  if (format === 'csv') {
    const headers = ['id', 'name', 'sourceType', 'activationStatus', 'outreachStatus', 'legalTrack', 'mobilityReferenceTag', 'overallPriorityScore'];
    const lines = [
      headers.join(','),
      ...candidates.map((candidate) => [
        candidate.id,
        candidate.name,
        candidate.sourceType,
        candidate.activationStatus,
        candidate.outreachStatus,
        candidate.legalTrack,
        candidate.topBottomRelevance.mobilityReferenceTag,
        candidate.scores.overallPriorityScore,
      ].map(csvEscape).join(',')),
    ];
    return new NextResponse(lines.join('\n'), {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="marketa-activation-candidates.csv"',
      },
    });
  }

  return NextResponse.json({
    ok: true,
    exportedAt: new Date().toISOString(),
    count: candidates.length,
    candidates,
  }, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Disposition': 'attachment; filename="marketa-activation-candidates.json"',
    },
  });
}
