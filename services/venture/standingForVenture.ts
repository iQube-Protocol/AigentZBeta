/**
 * standingForVenture — read a persona's Standing + reputation + verified VSP
 * facts in a shape the VentureQube auto-populator consumes.
 *
 * This is the wiring the operator described: "use the Standing system that's
 * already established (declarations / extracted facts / verification) to
 * auto-populate the VentureQube." Standing does NOT rank founders — it
 * CALIBRATES confidence in venture inputs (per the Standing + Founder Office
 * charters).
 *
 * Reads from the LIVE Standing substrate:
 *   - crm_persona_reputation (standing_* + the 5-axis reputation vector)
 *   - vsp_facts (verified declarations, grouped by domain) via vsp_profiles
 *
 * Everything is best-effort: if a Standing migration is not yet applied, the
 * corresponding block is returned null/empty rather than throwing. The output
 * is T1-safe (no raw persona/passport ids — caller passes personaId in, only
 * derived/aggregate values come out).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { computeStandingScore, type StandingScoreBreakdown } from '@/services/standing/standingScore';

export interface StandingSnapshot {
  personal: number;
  delegated: number;
  stewardship: number;
  overall: number;
  bucket: number; // 0..4
}

export interface ReputationSnapshot {
  technical: number;
  creative: number;
  entrepreneurial: number;
  dataArch: number;
  community: number;
  overall: number;
  lifetimeCvs: number;
}

export interface VerifiedFact {
  domain: string;
  field: string | null;
  label: string | null;
  value: string | null;
  confidence: string | null;
  status: string | null;
}

/** A capability claim from the citizen's Standing Graph (vsp_profiles.standing_graph). */
export interface CapabilityClaim {
  label: string;
  category: string | null;
  confidenceLevel: string | null;
  supportingEvidenceCount: number | null;
}

export interface StandingForVenture {
  standing: StandingSnapshot | null;
  reputation: ReputationSnapshot | null;
  /** Verified declarations grouped by domain (identity, capability, etc.). */
  factsByDomain: Record<string, VerifiedFact[]>;
  /** Capability claims from the Standing Graph — the richer capability signal. */
  capabilityClaims: CapabilityClaim[];
  /** Reconciled Standing score (veracity + contribution) — calibration input. */
  score: StandingScoreBreakdown | null;
  /** True when ANY Standing signal was found (drives confidence calibration). */
  hasStandingSignal: boolean;
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : 0;
  return Number.isFinite(n) ? n : 0;
}

export async function readStandingForVenture(
  admin: SupabaseClient,
  personaId: string,
): Promise<StandingForVenture> {
  const out: StandingForVenture = {
    standing: null,
    reputation: null,
    factsByDomain: {},
    capabilityClaims: [],
    score: null,
    hasStandingSignal: false,
  };

  // Reconciled Standing score (veracity-led) — the calibration signal.
  try {
    out.score = await computeStandingScore(admin, personaId);
    if (out.score.score > 0) out.hasStandingSignal = true;
  } catch {
    /* score unavailable */
  }

  // 1. Standing + reputation vector.
  try {
    const { data, error } = await admin
      .from('crm_persona_reputation')
      .select(
        'standing_personal, standing_delegated, standing_stewardship, standing_overall, standing_bucket, rep_technical, rep_creative, rep_entrepreneurial, rep_data_arch, rep_community, rep_overall, lifetime_cvs',
      )
      .eq('persona_id', personaId)
      .maybeSingle();
    if (!error && data) {
      out.standing = {
        personal: num(data.standing_personal),
        delegated: num(data.standing_delegated),
        stewardship: num(data.standing_stewardship),
        overall: num(data.standing_overall),
        bucket: num(data.standing_bucket),
      };
      out.reputation = {
        technical: num(data.rep_technical),
        creative: num(data.rep_creative),
        entrepreneurial: num(data.rep_entrepreneurial),
        dataArch: num(data.rep_data_arch),
        community: num(data.rep_community),
        overall: num(data.rep_overall),
        lifetimeCvs: num(data.lifetime_cvs),
      };
      if (out.standing.overall > 0 || out.reputation.lifetimeCvs > 0) {
        out.hasStandingSignal = true;
      }
    }
  } catch {
    /* migration pending — leave standing/reputation null */
  }

  // 2. Verified declarations (VSP facts) grouped by domain + the Standing Graph.
  try {
    const { data: profiles } = await admin
      .from('vsp_profiles')
      .select('id, standing_graph')
      .eq('owner_persona_id', personaId);
    const profileIds = (profiles ?? []).map((p: { id: string }) => p.id);

    // Standing Graph capability claims — the richer capability signal.
    for (const p of profiles ?? []) {
      const graph = (p as { standing_graph?: { capability_claims?: unknown[] } | null }).standing_graph;
      const claims = graph?.capability_claims ?? [];
      for (const c of Array.isArray(claims) ? claims : []) {
        const claim = c as {
          label?: string;
          category?: string;
          confidence_level?: string;
          supporting_evidence_count?: number;
        };
        if (!claim?.label) continue;
        out.capabilityClaims.push({
          label: String(claim.label),
          category: claim.category ?? null,
          confidenceLevel: claim.confidence_level ?? null,
          supportingEvidenceCount:
            typeof claim.supporting_evidence_count === 'number' ? claim.supporting_evidence_count : null,
        });
        out.hasStandingSignal = true;
      }
    }

    if (profileIds.length > 0) {
      const { data: facts } = await admin
        .from('vsp_facts')
        .select('domain, field, label, extracted_value, principal_value, confidence, status')
        .in('profile_id', profileIds);
      for (const f of facts ?? []) {
        const domain = String((f as { domain?: string }).domain ?? 'other');
        const row: VerifiedFact = {
          domain,
          field: (f as { field?: string }).field ?? null,
          label: (f as { label?: string }).label ?? null,
          value:
            (f as { principal_value?: string }).principal_value ??
            (f as { extracted_value?: string }).extracted_value ??
            null,
          confidence: (f as { confidence?: string }).confidence ?? null,
          status: (f as { status?: string }).status ?? null,
        };
        (out.factsByDomain[domain] ??= []).push(row);
        out.hasStandingSignal = true;
      }
    }
  } catch {
    /* VSP migration pending — leave factsByDomain empty */
  }

  return out;
}
