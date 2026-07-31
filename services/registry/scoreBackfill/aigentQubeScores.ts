/**
 * AigentQube score derivation (v1).
 *
 * Backlog rules:
 *   - sensitivity from identifiability_floor + must_disclose_as_agent:
 *     anonymous→8, semi_anonymous→6, semi_identifiable→4, identifiable→2
 *   - risk from payment_authority + cartridge_scopes breadth:
 *     null→2; non-null with max<100 Q¢→4; >=100→7
 *   - accuracy proportional to trust_band: 0→3, 4→10
 *   - verifiability from charter + lineage: accepted+DB→9, accepted+code→7,
 *     no_charter→4
 *
 * For the 5 code-only canonical aigents (RUNTIME_AGENT_IDS), the
 * canonical adapter populates the iqube_id_map row with synthetic UUID
 * during Stage 2 backfill. This deriver reads those rows + the
 * aigentQubeAdapter's defaultGovernance() (since there's no DB table
 * for aigent governance yet — legibility fast-follow #3) to compute
 * baseline scores.
 *
 * Once the aigent_qubes table promotion lands, this deriver swaps to
 * reading real per-aigent governance data; the strategy version bumps
 * to v2 and re-running the backfill repopulates.
 */

import { createClient } from '@supabase/supabase-js';
import type { DerivationResult } from './types';
import { clampAxis } from './types';

const STRATEGY = 'aigent_qube_v1';

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// Per-aigent override map for the 5 canonical aigents. Aigent Me is the
// orchestrator (broadest scope → highest risk); Marketa has cartridge
// scopes (mid risk); Kn0w1 / MoneyPenny / Nakamoto are specialists (low
// risk). These mirror the role+scope intent of the
// services/iqube/legibility/sources/aigentQubeSource.ts profile map.
const CODE_AIGENT_OVERRIDES: Record<string, Partial<{ scopes_breadth: number; charter_accepted: boolean }>> = {
  'aigent-me':         { scopes_breadth: 8, charter_accepted: true },
  'aigent-marketa':    { scopes_breadth: 5, charter_accepted: true },
  'aigent-kn0w1':      { scopes_breadth: 2, charter_accepted: true },
  'aigent-moneypenny': { scopes_breadth: 4, charter_accepted: true },
  'aigent-nakamoto':   { scopes_breadth: 2, charter_accepted: true },
};

function sensitivityFromIdentifiability(floor: string, must_disclose: boolean): number {
  // disclosure-required pulls sensitivity up by 1 (operator-facing
  // disclosure is itself an attention signal)
  const bump = must_disclose ? 1 : 0;
  switch (floor) {
    case 'anonymous':         return clampAxis(8 + bump);
    case 'semi_anonymous':    return clampAxis(6 + bump);
    case 'semi_identifiable': return clampAxis(4 + bump);
    case 'identifiable':      return clampAxis(2 + bump);
    default:                  return 5;
  }
}

function riskFromPaymentAndScope(
  payment_authority_qc: number | null,
  scopes_breadth: number,
): number {
  // Base risk from payment authority
  let base: number;
  if (payment_authority_qc === null) base = 2;
  else if (payment_authority_qc < 100) base = 4;
  else base = 7;
  // Broader scope adds up to 2 points
  return clampAxis(base + Math.min(scopes_breadth / 4, 2));
}

function accuracyFromTrustBand(band: 0 | 1 | 2 | 3 | 4): number {
  // Linear progression: 0→3, 1→5, 2→6, 3→8, 4→10
  const map: Record<number, number> = { 0: 3, 1: 5, 2: 6, 3: 8, 4: 10 };
  return clampAxis(map[band] ?? 5);
}

function verifiabilityFromCharterAndProvenance(
  charter_accepted: boolean,
  is_db_backed: boolean,
): number {
  if (charter_accepted && is_db_backed) return 9;
  if (charter_accepted && !is_db_backed) return 7;
  return 4;
}

export async function deriveAigentQubeScores(): Promise<DerivationResult[]> {
  const sb = client();

  const { data } = await sb
    .from('iqube_id_map')
    .select('iqube_id, source, source_id')
    .eq('primitive_type', 'AigentQube');
  if (!data || data.length === 0) return [];

  return data.map((entry) => {
    const e = entry as { iqube_id: string; source: string; source_id: string };
    const isCode = e.source === 'code:aigentQubeSource';
    const overrides = isCode ? CODE_AIGENT_OVERRIDES[e.source_id] ?? {} : {};
    const scopes_breadth = overrides.scopes_breadth ?? 3;
    const charter_accepted = overrides.charter_accepted ?? false;

    // Code-only aigents use defaultGovernance from the adapter:
    // identifiability_floor = 'semi_anonymous', must_disclose = true,
    // trust_band = 0, payment_authority = null
    const sensitivity = sensitivityFromIdentifiability('semi_anonymous', true);
    const risk = riskFromPaymentAndScope(null, scopes_breadth);
    const accuracy = accuracyFromTrustBand(0);
    const verifiability = verifiabilityFromCharterAndProvenance(charter_accepted, !isCode);

    return {
      iqube_id: e.iqube_id,
      strategy: STRATEGY,
      scores: { sensitivity, accuracy, verifiability, risk },
      notes: isCode ? 'derived from code-source defaults; refresh after aigent_qubes promotion' : undefined,
    };
  });
}
