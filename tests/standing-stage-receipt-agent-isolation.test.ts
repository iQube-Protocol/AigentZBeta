/**
 * Stand-stage cross-agent receipt contamination (Factor evidence-defect
 * closure, 2026-09-06).
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────
 *
 * The `register` and `claim` stages already opted into
 * `receiptsScopedToSubjectAgent: true` (2026-08-08, RES-2026-08-08-
 * REGISTER-EVIDENCE-CROSS-AGENT-001) so StageReceiptsDrawer's historical/
 * supplementary search passes `agentsInvoked: [subjectAgentRef]` and never
 * shows one agent's receipts under another agent's stage. The `standing`
 * stage was never given the same flag, even though its OWN receipt type
 * (`standing_accrued`) is written with `agentsInvoked: [subjectAgentRef]`
 * whenever a subject agent is supplied (registrationStandingSeedAward.ts,
 * services/crm/standingAccrualService.ts) — the exact precondition the
 * comment on `register`/`claim` requires before opting in. Observed live:
 * Factor's Stand drawer displayed Aigent Z's and MoneyPenny's own
 * `standing_accrued` receipts, because the historical search filtered only
 * by actionType, across every agent the acting principal ever accrued
 * Standing for.
 *
 * Mirrors tests/register-stage-receipt-agent-isolation.test.ts's structure
 * (source-scan — no React render harness in this codebase) plus a
 * behavioral negative test (one principal, two agents) proving the SAME
 * cross-agent isolation contract tests/assistant-receipts-agent-scoping.test.ts
 * already proves for Register, now exercised with `standing_accrued`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockListActivityReceiptsForPersona = vi.fn();
vi.mock('@/services/receipts/activityReceiptService', () => ({
  listActivityReceiptsForPersona: (...args: any[]) => mockListActivityReceiptsForPersona(...args),
}));

function read(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

describe('horizenMoneyPennyJourney.ts — the standing stage opts into receiptsScopedToSubjectAgent', () => {
  const journeySource = read('services/journey/horizenMoneyPennyJourney.ts');

  function stageBlock(stageId: string): string {
    const idx = journeySource.indexOf(`id: '${stageId}',`);
    expect(idx, `stage '${stageId}' must exist`).toBeGreaterThan(-1);
    const nextStageIdx = journeySource.indexOf("id: '", idx + 10);
    return journeySource.slice(idx, nextStageIdx > -1 ? nextStageIdx : undefined);
  }

  it('standing opts in — standing_accrued is written with agentsInvoked: [subjectAgentRef] when supplied', () => {
    expect(stageBlock('standing')).toContain('receiptsScopedToSubjectAgent: true');
  });

  it('standing_accrued is genuinely written with a subject-agent tag by the seed-award and accrual services', () => {
    const seedAwardSource = read('services/journey/registrationStandingSeedAward.ts');
    const accrualSource = read('services/crm/standingAccrualService.ts');
    expect(seedAwardSource).toMatch(/agentsInvoked:\s*\[agent\.runtimeAgentId\]/);
    expect(accrualSource).toMatch(/agentsInvoked\s*=\s*input\.subjectAgentRef\s*\?\s*\[input\.subjectAgentRef\]/);
  });
});

describe('GET /api/assistant/receipts — standing_accrued cross-agent isolation (one principal, two agents)', () => {
  beforeEach(() => {
    mockGetActivePersona.mockReset();
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-one-principal' });
    mockListActivityReceiptsForPersona.mockReset();
  });

  function makeRequest(query: Record<string, string> = {}): NextRequest {
    const searchParams = new URLSearchParams(query);
    return { nextUrl: { searchParams } } as unknown as NextRequest;
  }

  it('one principal who accrued Standing for BOTH aigent-z and aigent-factor: a query scoped to factor never returns aigent-z (or moneypenny) receipts', async () => {
    const { GET } = await import('@/app/api/assistant/receipts/route');

    // Same acting principal (persona-one-principal) accrued Standing for
    // three DIFFERENT subject agents — exactly the live Factor scenario:
    // Stand's historical drawer showed Aigent Z's and MoneyPenny's own
    // standing_accrued receipts under Factor.
    const allReceipts = [
      { id: 'receipt-aigent-z', actionType: 'standing_accrued', agentsInvoked: ['aigent-z'] },
      { id: 'receipt-moneypenny', actionType: 'standing_accrued', agentsInvoked: ['moneypenny'] },
      { id: 'receipt-factor', actionType: 'standing_accrued', agentsInvoked: ['aigent-factor'] },
    ];
    mockListActivityReceiptsForPersona.mockImplementation(async (_personaId: string, options: any) => {
      let rows = allReceipts;
      if (options?.actionTypes?.length) rows = rows.filter((r) => options.actionTypes.includes(r.actionType));
      if (options?.agentsInvoked?.length) {
        rows = rows.filter((r) => r.agentsInvoked.some((a) => options.agentsInvoked.includes(a)));
      }
      return rows;
    });

    const factorRes = await GET(makeRequest({ actionType: 'standing_accrued', agentsInvoked: 'aigent-factor' }));
    const factorJson = await factorRes.json();
    expect(factorJson.receipts.map((r: any) => r.id)).toEqual(['receipt-factor']);
    expect(factorJson.receipts.map((r: any) => r.id)).not.toContain('receipt-aigent-z');
    expect(factorJson.receipts.map((r: any) => r.id)).not.toContain('receipt-moneypenny');
  });
});
