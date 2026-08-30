/**
 * Retrospective Substrate Admissibility — 2026-08-30, operator governance
 * ruling on the EXP-P1 / crystal-vP1 legacy freeze.
 *
 * ── What this answers ─────────────────────────────────────────────────────
 *
 * `composeCrystalRetrospectiveFalsification` scores a retrospective over a
 * POPULATION. Before this file existed, the only substrate ever admitted was
 * the byte-exact one (`verifiedAgainstFreeze === true`) — anything else
 * blocked the gate outright. The operator's ruling admits a SECOND, narrower
 * substrate for ONE named artifact: EXP-P1 / crystal-vP1, whose
 * `legacyContentVerification.state === 'scientific-content-verified'` (see
 * crystalLegacyContentVerification.ts) demonstrates every scientifically
 * material hash-covered field unmutated since freeze, with the only drift
 * confined to `status` (a field no readiness check reads as content).
 *
 * ── The one thing this module must never become ─────────────────────────
 *
 * A blanket policy of "scientific-content-verified is always admissible."
 * That would silently license every FUTURE crystal that reaches the same
 * classification, with no separate governance act for each — precisely the
 * failure mode the operator's ruling is scoped against ("narrowly and
 * versionedly"). `RATIFIED_RETROSPECTIVE_SUBSTRATE_LEGACY_RULINGS` is
 * therefore keyed on the EXACT (experimentId, artifactId) pair the ruling
 * names, never on the classification alone — admitting a new
 * experiment/artifact requires adding a NEW, separately-ratified entry here,
 * never inferring one from this one.
 *
 * Pure, derived, read-only. Never trusts a stored assertion — the same
 * discipline as `remediationProfileBindingState` and
 * `deriveLegacyFreezeVerification`.
 */

import type { LegacyFreezeVerificationEvidence } from '@/services/research/crystalLegacyContentVerification';

export type RetrospectiveSubstrateAdmissibilityBasis = 'byte-exact' | 'legacy-scientific-content' | 'inadmissible';

/**
 * ONE governance ruling admitting a specific legacy-verification state for a
 * SPECIFIC (experimentId, artifactId) pair. Never a generic policy.
 */
export interface RetrospectiveSubstrateLegacyRuling {
  rulingId: string;
  /** Narrowly versioned — a future ruling that changes scope is a NEW entry
   *  with a new rulingId/version, never an edit that silently widens this one. */
  version: string;
  experimentId: string;
  artifactId: string;
  admissibleLegacyState: 'scientific-content-verified';
  rationale: string;
}

/**
 * THE ONE RATIFIED RULING — EXP-P1 / crystal-vP1 only (operator governance
 * ruling, 2026-08-30). Adding a second experiment or artifact here is a
 * SEPARATE governance act — never a natural extension of this one.
 */
export const RATIFIED_RETROSPECTIVE_SUBSTRATE_LEGACY_RULINGS: readonly RetrospectiveSubstrateLegacyRuling[] = [
  {
    rulingId: 'GOV-2026-08-30-EXP-P1-VP1-LEGACY-SUBSTRATE-001',
    version: '1.0.0',
    experimentId: 'EXP-P1',
    artifactId: 'EXP-P1/crystal-vP1',
    admissibleLegacyState: 'scientific-content-verified',
    rationale:
      'Operator governance ruling, 2026-08-30: for EXP-P1 / crystal-vP1 specifically, ' +
      "scientific-content-verified is admissible as the historical substrate for the Austin Review #001 " +
      'retrospective, on the legacy verification evidence returned by the canonical endpoint (2026-08-30 ' +
      'live audit: 15/15 members carry no seed-ingest evidence and no post-freeze provenance ' +
      'reclassification; the only observed drift is status, a field no readiness check reads as content). ' +
      'This is NOT a reinterpretation of verifiedAgainstFreeze, which remains false for this artifact.',
  },
];

export interface RetrospectiveSubstrateAdmissibility {
  admissible: boolean;
  basis: RetrospectiveSubstrateAdmissibilityBasis;
  /** The specific ruling that admitted this substrate — null when the
   *  substrate is byte-exact (no ruling needed) or inadmissible (no ruling
   *  applies). Carried so the governing rule/version is VISIBLE in the
   *  retrospective evidence, never merely implied by a boolean. */
  governingRuling: RetrospectiveSubstrateLegacyRuling | null;
  reason: string;
}

export interface DeriveRetrospectiveSubstrateAdmissibilityInput {
  experimentId: string;
  /** null when no frozen artifact exists to name. */
  artifactId: string | null;
  verifiedAgainstFreeze: boolean | null;
  /** null when the manifest was never built, or built without this field
   *  (a caller predating 2026-08-30). Absence is never treated as success. */
  legacyContentVerification: LegacyFreezeVerificationEvidence | null;
}

export function deriveRetrospectiveSubstrateAdmissibility(
  input: DeriveRetrospectiveSubstrateAdmissibilityInput,
): RetrospectiveSubstrateAdmissibility {
  if (input.verifiedAgainstFreeze === true) {
    return {
      admissible: true,
      basis: 'byte-exact',
      governingRuling: null,
      reason: 'the live domain corpus reproduces the frozen contentHash exactly — no legacy ruling is needed',
    };
  }

  if (!input.artifactId || !input.legacyContentVerification) {
    return {
      admissible: false,
      basis: 'inadmissible',
      governingRuling: null,
      reason:
        'verifiedAgainstFreeze is not true, and no legacyContentVerification evidence was supplied to consider ' +
        'a legacy ruling against',
    };
  }

  const ruling = RATIFIED_RETROSPECTIVE_SUBSTRATE_LEGACY_RULINGS.find(
    (r) => r.experimentId === input.experimentId && r.artifactId === input.artifactId,
  );
  if (!ruling) {
    return {
      admissible: false,
      basis: 'inadmissible',
      governingRuling: null,
      reason:
        `no ratified legacy substrate ruling covers experiment '${input.experimentId}' / artifact ` +
        `'${input.artifactId}' — a scientific-content-verified classification for one artifact never ` +
        'admits another, however identical the classification looks',
    };
  }

  if (input.legacyContentVerification.state !== ruling.admissibleLegacyState) {
    return {
      admissible: false,
      basis: 'inadmissible',
      governingRuling: ruling,
      reason:
        `ruling '${ruling.rulingId}' admits legacyContentVerification.state === '${ruling.admissibleLegacyState}', ` +
        `but the current state is '${input.legacyContentVerification.state}'`,
    };
  }

  if (input.legacyContentVerification.blockingGaps.length > 0) {
    return {
      admissible: false,
      basis: 'inadmissible',
      governingRuling: ruling,
      reason:
        `ruling '${ruling.rulingId}' applies, but legacyContentVerification carries ` +
        `${input.legacyContentVerification.blockingGaps.length} blocking gap(s): ` +
        input.legacyContentVerification.blockingGaps.join('; '),
    };
  }

  return {
    admissible: true,
    basis: 'legacy-scientific-content',
    governingRuling: ruling,
    reason: `admitted under ruling '${ruling.rulingId}' (v${ruling.version}) — ${ruling.rationale}`,
  };
}
