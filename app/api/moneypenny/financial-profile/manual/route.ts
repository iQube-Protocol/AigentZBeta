/**
 * POST /api/moneypenny/financial-profile/manual — MoneyPenny MPY2-2c
 * (SPEC-MPY-002 §5, 2026-09-02, operator direction: "financial-profile
 * preparation... a reviewed financial profile or supported manual
 * preparation — not navigation").
 *
 * A second, sibling INPUT PATH for the same Financial Profile capability
 * the upload/compute route already serves — never a second financial-state
 * model. A person with no bank-statement export handy can still describe
 * their own monthly income/expenditure (and optionally an estimated
 * liquidity buffer) well enough to be "prepared." The derivation
 * (computeManualFinancialProfile), the risk-envelope pass, and the
 * canonical writer (upsertFinancialProfileQube) are all the SAME functions
 * the upload path uses — only the input differs.
 *
 * Validation is intentionally minimal and honest: finite, non-negative
 * numbers for income/expenditure (a self-reported negative income or
 * expenditure is not a value this capability can make sense of), and an
 * optional finite liquidityBufferDays. No further "sanity" bounds are
 * imposed — this is the person's own estimate, not a fact this service can
 * independently verify.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { computeManualFinancialProfile } from '@/services/financialServices/financialProfileAggregation';
import { assessRisk, deriveRiskLimits } from '@/services/financialServices/riskEnvelope';
import { upsertFinancialProfileQube } from '@/services/iqube/financialProfileQube';

export const dynamic = 'force-dynamic';

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const incomeMonthly = body?.incomeMonthly;
  const expenditureMonthly = body?.expenditureMonthly;
  const liquidityBufferDaysRaw = body?.liquidityBufferDays;

  if (!isFiniteNonNegative(incomeMonthly) || !isFiniteNonNegative(expenditureMonthly)) {
    return NextResponse.json(
      { ok: false, error: 'invalid-input', detail: 'incomeMonthly and expenditureMonthly are required and must be non-negative numbers.' },
      { status: 400 },
    );
  }
  const liquidityBufferDays =
    liquidityBufferDaysRaw === undefined || liquidityBufferDaysRaw === null
      ? null
      : isFiniteNonNegative(liquidityBufferDaysRaw)
        ? liquidityBufferDaysRaw
        : undefined;
  if (liquidityBufferDays === undefined) {
    return NextResponse.json(
      { ok: false, error: 'invalid-input', detail: 'liquidityBufferDays, when provided, must be a non-negative number.' },
      { status: 400 },
    );
  }

  const result = computeManualFinancialProfile({ incomeMonthly, expenditureMonthly, liquidityBufferDays });

  // MPY2-3 — Risk Envelope, same derivation the upload path uses, over the
  // same aggregates shape.
  const riskAssessment = result.aggregates ? assessRisk(result.aggregates) : undefined;
  const riskLimits = result.aggregates && riskAssessment ? (deriveRiskLimits(result.aggregates, riskAssessment) ?? undefined) : undefined;

  const record = await upsertFinancialProfileQube(persona.personaId, {
    sourceUploadCount: 0,
    unreadableUploadCount: 0,
    blak: {
      ...(result.aggregates ? { aggregates: result.aggregates } : {}),
      ...(result.envelope ? { envelope: result.envelope } : {}),
      ...(riskAssessment ? { riskAssessment } : {}),
      ...(riskLimits ? { riskLimits } : {}),
      sourceUploadIds: [],
      computedFromMonths: [],
      inputSource: 'manual_entry',
    },
  });

  // Owner self-view (CLAUDE.md "Owner self-view exception") — same pattern
  // as the compute/GET routes.
  return NextResponse.json({
    ok: result.ok,
    meta: record.meta,
    aggregates: record.blak.aggregates ?? null,
    envelope: record.blak.envelope ?? null,
    riskAssessment: record.blak.riskAssessment ?? null,
    riskLimits: record.blak.riskLimits ?? null,
    computedFromMonths: record.blak.computedFromMonths ?? [],
    inputSource: record.blak.inputSource ?? 'manual_entry',
    notes: result.notes,
  });
}
