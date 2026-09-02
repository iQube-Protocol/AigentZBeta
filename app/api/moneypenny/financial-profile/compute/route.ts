/**
 * POST /api/moneypenny/financial-profile/compute — MoneyPenny MPY2-2
 * (SPEC-MPY-002 §5). Recomputes the persona's Financial Profile from their
 * `financial_document`-kind uploads.
 *
 * Reuses, never duplicates:
 *   - services/uploads/* — the existing generic per-persona upload facility
 *     already parses CSV/PDF statements into `persona_upload_index`
 *     (contentJson/contentMd). This route reads that index; it never
 *     re-parses raw bytes itself.
 *   - services/financialServices/financialProfileAggregation.ts — the pure
 *     derivation (income/expenditure/surplus/volatility/liquidity/
 *     concentration + candidate envelope). This route only assembles its
 *     input and persists its output.
 *   - services/financialServices/riskEnvelope.ts (MPY2-3, 2026-09-01) — the
 *     Risk Envelope assessment/limits, derived from the SAME aggregates in
 *     the SAME compute pass (no extra I/O, no second "did you remember to
 *     recompute" surface). Persisted alongside `aggregates`/`envelope` in
 *     the same qube upsert.
 *   - services/iqube/financialProfileQube.ts — the ONE canonical writer.
 *
 * The raw statement text/rows are read here ONLY to feed the pure
 * aggregator in-process; nothing raw is written back out, logged, or
 * forwarded to any external provider (SPEC-MPY-002 §5 hard constraint 4).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getPersonaUploadService } from '@/services/uploads/supabaseUploadAdapter';
import { computeFinancialProfile, type StatementSourceRows } from '@/services/financialServices/financialProfileAggregation';
import { assessRisk, deriveRiskLimits } from '@/services/financialServices/riskEnvelope';
import { upsertFinancialProfileQube, FinancialProfileTableMissingError } from '@/services/iqube/financialProfileQube';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function extractCsvRows(contentJson: unknown): Array<Record<string, string>> | null {
  if (!contentJson || typeof contentJson !== 'object') return null;
  const rows = (contentJson as { rows?: unknown }).rows;
  if (!Array.isArray(rows)) return null;
  return rows as Array<Record<string, string>>;
}

export async function POST(req: NextRequest) {
  try {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  const service = getPersonaUploadService();
  const uploads = await service.list(persona.personaId, { useKind: 'financial_document', status: 'ready', limit: 200 });

  if (uploads.length === 0) {
    return NextResponse.json({
      ok: false,
      error: 'no-financial-documents',
      detail: 'No bank statements have been uploaded yet — upload one or more (useKind: financial_document) before computing a profile.',
    });
  }

  const sources: StatementSourceRows[] = [];
  for (const upload of uploads) {
    const full = await service.get(upload.id, persona.personaId);
    sources.push({ uploadId: upload.id, rows: extractCsvRows(full?.index?.contentJson) });
  }

  const result = computeFinancialProfile(sources);

  // MPY2-3 — Risk Envelope, derived from the SAME aggregates, in the same
  // pass. Only meaningful when aggregates exist; a failed/empty compute
  // carries no risk assessment (never a fabricated one over absent data).
  const riskAssessment = result.aggregates ? assessRisk(result.aggregates) : undefined;
  const riskLimits = result.aggregates && riskAssessment ? (deriveRiskLimits(result.aggregates, riskAssessment) ?? undefined) : undefined;

  const record = await upsertFinancialProfileQube(persona.personaId, {
    sourceUploadCount: uploads.length,
    unreadableUploadCount: result.unreadableUploadIds.length,
    blak: {
      ...(result.aggregates ? { aggregates: result.aggregates } : {}),
      ...(result.envelope ? { envelope: result.envelope } : {}),
      ...(riskAssessment ? { riskAssessment } : {}),
      ...(riskLimits ? { riskLimits } : {}),
      sourceUploadIds: result.readableUploadIds,
      ...(result.computedFromMonths ? { computedFromMonths: result.computedFromMonths } : {}),
      inputSource: 'uploaded_statements',
    },
  });

  // Owner self-view (CLAUDE.md "Owner self-view exception") — the caller IS
  // the persona this profile is about, so the full derived result (never
  // the raw statement) returns directly rather than only the T1 meta slice.
  return NextResponse.json({
    ok: result.ok,
    meta: record.meta,
    aggregates: record.blak.aggregates ?? null,
    envelope: record.blak.envelope ?? null,
    riskAssessment: record.blak.riskAssessment ?? null,
    riskLimits: record.blak.riskLimits ?? null,
    computedFromMonths: record.blak.computedFromMonths ?? [],
    inputSource: record.blak.inputSource ?? 'uploaded_statements',
    readableUploadCount: result.readableUploadIds.length,
    unreadableUploadCount: result.unreadableUploadIds.length,
    notes: result.notes,
  });
  } catch (err) {
    if (err instanceof FinancialProfileTableMissingError) {
      return NextResponse.json({ ok: false, error: 'financial-profile-unavailable', detail: err.message }, { status: 503 });
    }
    return NextResponse.json(
      { ok: false, error: 'internal-error', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
