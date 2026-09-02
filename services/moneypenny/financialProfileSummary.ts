/**
 * fetchFinancialProfileSummary — single, shared read of the owner
 * self-view financial-profile summary (`GET /api/moneypenny/
 * financial-profile`), extracted 2026-09-02 (Bridge spec B2 Prepare
 * rebuild) so `MoneyPennyCopilotWorkspace.tsx`'s groundContext snapshot
 * and `FinancialSovereigntyPrepareCrossStage.tsx`'s Prepare-stage review
 * both read the SAME canonical profile through ONE fetch shape — never a
 * second, parallel read path (CLAUDE.md source-of-truth parity;
 * Cartridge spec SC-03: "One canonical financial profile is referenced
 * across Prepare, Operate, direct cartridge entry... no copied bridge
 * profile").
 *
 * Client-side only. MUST use `personaFetch` — this route resolves the
 * caller through the identity spine (`getActivePersona`), so a raw
 * `fetch` silently 401s (CLAUDE.md's Identity & Access Spine section).
 */

import { personaFetch } from '@/utils/personaSpine';

export interface FinancialProfileSummary {
  hasProfile: boolean;
  inputSource: 'uploaded_statements' | 'manual_entry' | null;
  incomeMonthly: number | null;
  expenditureMonthly: number | null;
  availableSurplusMonthly: number | null;
  /** Which months' statements/entries the current aggregates were computed from — the coverage signal Prepare surfaces as a limitation. */
  computedFromMonths: string[];
}

interface FinancialProfileApiResponse {
  ok?: boolean;
  meta?: { hasProfile?: boolean };
  aggregates?: { incomeMonthly?: number; expenditureMonthly?: number; availableSurplusMonthly?: number } | null;
  inputSource?: string | null;
  computedFromMonths?: string[];
}

/** Returns null on any failure (unauthenticated, network error, malformed response) — never fabricates a profile. */
export async function fetchFinancialProfileSummary(): Promise<FinancialProfileSummary | null> {
  try {
    const res = await personaFetch('/api/moneypenny/financial-profile', { cache: 'no-store' });
    const json = (await res.json().catch(() => null)) as FinancialProfileApiResponse | null;
    if (!res.ok || !json?.ok) return null;
    return {
      hasProfile: json.meta?.hasProfile === true,
      inputSource: (json.inputSource as FinancialProfileSummary['inputSource']) ?? null,
      incomeMonthly: json.aggregates?.incomeMonthly ?? null,
      expenditureMonthly: json.aggregates?.expenditureMonthly ?? null,
      availableSurplusMonthly: json.aggregates?.availableSurplusMonthly ?? null,
      computedFromMonths: json.computedFromMonths ?? [],
    };
  } catch {
    return null;
  }
}
