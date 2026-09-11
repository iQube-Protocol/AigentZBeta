/**
 * domainProfileStore — SPEC-CDR-001 P5. The runtime read path for **promoted**
 * Domain Profiles (`domain_profiles`), plus the presentation/abstention event
 * writer.
 *
 * WHAT THIS IS NOT: a research-workflow reader. The Overlay and the IRE must
 * never query `discovery_candidates` directly (operator, P5-6) — that would
 * couple runtime resolution to the review lifecycle. This module reads only
 * the promoted artifact.
 *
 * SOFT-FAIL, ALWAYS. Every path degrades to "no profile" / "event not
 * recorded": no Supabase, an unapplied migration, or a query error must never
 * break the Overlay. This is the same discipline `listRegisteredCapabilities`
 * and `searchFederation` already use, and it is what lets the runtime deploy
 * before the migration is applied without a broken surface in between.
 *
 * T0/T2: nothing here reads or writes a persona identifier. The presentation
 * event log measures how often the system stayed silent — never at whom.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type {
  AssertionProvenance,
  CapabilityModuleId,
  DomainProfile,
  DomainProfileAuthority,
  DomainProfileEvidence,
  OverlayContext,
  VerificationStatus,
} from '@/services/resolution/domainProfileRegistry';

/** A promoted profile plus the operational fields that live only in storage. */
export interface StoredDomainProfile {
  readonly profile: DomainProfile;
  readonly id: string;
  /** Row-level override; null = use the configured system default. */
  readonly presentationThreshold: number | null;
  /** Lineage back to the discovery candidate, when it came from one. */
  readonly sourceCandidateId: string | null;
}

interface DomainProfileRow {
  id: string;
  subject_type: string;
  subject_id: string;
  aliases: string[] | null;
  overlay_context: string;
  assertion_provenance: string;
  verification_status: string;
  confidence: number | null;
  presentation_threshold: number | null;
  capability_modules: string[] | null;
  verified_by: unknown;
  verified_at: string | null;
  evidence: unknown;
  rationale: string | null;
  source_candidate_id: string | null;
}

/**
 * Map a row to the SAME `DomainProfile` contract the code seeds satisfy
 * (operator, P5-1: "both sources normalize to the same Domain Profile
 * contract so downstream composition does not care where it came from").
 *
 * Returns null for a row that cannot be honestly mapped — a malformed row is
 * skipped, never coerced into a plausible-looking profile.
 */
function toProfile(row: DomainProfileRow): StoredDomainProfile | null {
  if (row.subject_type !== 'hostname') return null; // P5 resolves hostnames; agents are P6.
  if (row.overlay_context !== 'financial-context') return null;

  const provenance = row.assertion_provenance as AssertionProvenance;
  const verification = row.verification_status as VerificationStatus;
  if (!['first-party', 'curated', 'discovered'].includes(provenance)) return null;
  if (!['verified', 'provisional'].includes(verification)) return null;

  // D-6, re-checked on the way in: the SQL constraint enforces it, but a row
  // written before the constraint existed must not become a profile carrying
  // a confidence it is not entitled to.
  if (provenance === 'discovered' && typeof row.confidence !== 'number') return null;
  if (provenance !== 'discovered' && row.confidence !== null) return null;

  const base = {
    schemaVersion: 'cdr-domain-profile/v1' as const,
    profileSource: 'promoted-discovery' as const,
    subjectType: 'hostname' as const,
    subject: row.subject_id.trim().toLowerCase(),
    aliases: (row.aliases ?? []).map((a) => a.trim().toLowerCase()),
    overlayContext: row.overlay_context as OverlayContext,
    capabilityModules: (row.capability_modules ?? []) as CapabilityModuleId[],
    verificationStatus: verification,
    verifiedBy: (row.verified_by ?? {}) as DomainProfileAuthority,
    verifiedAt: row.verified_at ?? '',
    evidence: (Array.isArray(row.evidence) ? row.evidence : []) as DomainProfileEvidence[],
    rationale: row.rationale ?? '',
  };

  const profile: DomainProfile =
    provenance === 'discovered'
      ? { ...base, assertionProvenance: 'discovered', confidence: row.confidence as number }
      : { ...base, assertionProvenance: provenance };

  return {
    profile,
    id: row.id,
    presentationThreshold: row.presentation_threshold,
    sourceCandidateId: row.source_candidate_id,
  };
}

const COLUMNS =
  'id, subject_type, subject_id, aliases, overlay_context, assertion_provenance, ' +
  'verification_status, confidence, presentation_threshold, capability_modules, ' +
  'verified_by, verified_at, evidence, rationale, source_candidate_id';

/**
 * Look a hostname up among promoted profiles, matching the canonical subject
 * OR any alias. Returns null when nothing matches, when the table does not
 * exist yet, or on any error.
 */
export async function loadPromotedProfile(
  hostname: string | null | undefined,
): Promise<StoredDomainProfile | null> {
  if (!hostname) return null;
  const key = hostname.trim().toLowerCase();
  if (key.length === 0) return null;

  try {
    const admin = getSupabaseServer();
    if (!admin) return null;
    const { data, error } = await admin
      .from('domain_profiles')
      .select(COLUMNS)
      .eq('subject_type', 'hostname')
      .or(`subject_id.eq.${key},aliases.cs.{${key}}`)
      .limit(2);
    if (error || !data || data.length === 0) return null;
    // The unique index makes >1 impossible for the canonical subject; an
    // alias collision across two profiles would be a data defect, so abstain
    // rather than pick one arbitrarily.
    if (data.length > 1) {
      console.warn(`[CDR] ${key} matches multiple promoted profiles; abstaining.`);
      return null;
    }
    return toProfile(data[0] as DomainProfileRow);
  } catch (e) {
    console.warn('[CDR] promoted-profile lookup failed; degrading to no profile:', e);
    return null;
  }
}

export type PresentationOutcome = 'offered' | 'silent_abstention' | 'viewed' | 'dismissed';

/**
 * Record a presentation decision. Fire-and-forget: instrumentation must never
 * delay or break the citizen's surface.
 *
 * `appliedPresentationThreshold` is stored as applied, not looked up later —
 * without it, a subsequent change to the row value or the environment default
 * makes every historical event uninterpretable (operator, P5-2).
 */
export async function recordPresentationEvent(input: {
  profileId: string;
  subjectType: string;
  resolutionLevel: 'L1' | 'L2' | 'L3' | 'L4';
  confidence: number | null;
  appliedPresentationThreshold: number | null;
  outcome: PresentationOutcome;
}): Promise<void> {
  try {
    const admin = getSupabaseServer();
    if (!admin) return;
    const { error } = await admin.from('domain_profile_presentation_events').insert({
      profile_id: input.profileId,
      subject_type: input.subjectType,
      resolution_level: input.resolutionLevel,
      confidence: input.confidence,
      applied_presentation_threshold: input.appliedPresentationThreshold,
      outcome: input.outcome,
    });
    if (error) {
      console.warn('[CDR] presentation event not recorded:', error.message);
    }
  } catch (e) {
    console.warn('[CDR] presentation event not recorded:', e);
  }
}
