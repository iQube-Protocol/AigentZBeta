/**
 * GET /api/research/crystal/[experimentId]/instrument-falsification
 *
 * THE RETROSPECTIVE FALSIFICATION HARNESS as a route — the release gate for the
 * hardened crystal readiness instruments (operator direction, 2026-08-26):
 *
 *   > "the retrospective vP1 falsification harness is load-bearing. I would make
 *   >  it a release gate for the hardened instruments. … Do the new gates reject
 *   >  the exact frozen artifact that the independent reviewer rejected? If live
 *   >  vP1 still passes, do not proceed to vP2 extraction yet."
 *
 * ── ⚠ INVERTED SENSE ─────────────────────────────────────────────────────
 *
 * `retrospective.reproducedReviewerObjections === true` means the hardened
 * instruments REJECT the frozen artifact — the SUCCESSFUL outcome. There is no
 * `ok` field on the retrospective, deliberately.
 *
 * ── RETROSPECTIVE SUBSTRATE ADMISSIBILITY (2026-08-30 governance ruling) ────
 *
 * `reproducedReviewerObjections` requires FOUR things, all visible on
 * `retrospective`: (1) `substrateAdmissibility.admissible` — the population
 * scored is either byte-exact (`verifiedAgainstFreeze === true`) or, for the
 * ONE artifact a ratified governance ruling names (EXP-P1 / crystal-vP1),
 * `legacy-scientific-content` (services/research/
 * crystalRetrospectiveSubstrateAdmissibility.ts — never a blanket policy: a
 * different experiment/artifact reaching the identical
 * `legacyContentVerification.state` is NOT automatically admissible); (2) all
 * four mapped concerns independently rejected; (3)
 * `instrumentSuiteMatchesProfile === true` — the CURRENT instrument-suite
 * identity matches the remediation profile's own recorded one, so a stale
 * profile can never license a gate the instruments have since moved past; (4)
 * `blockingGaps.length === 0`. `verifiedAgainstFreeze` is NEVER redefined by
 * any of this — it stays the strict byte-exact answer, disclosed verbatim on
 * both `retrospective` and `frozenArtifact`.
 *
 * ── STRICTLY READ-ONLY ───────────────────────────────────────────────────
 *
 * No write of any kind: no receipt, no artifact mutation, no lifecycle
 * transition, no re-scoring of the historical readiness results that let vP1
 * through. Those results remain the record of what the OLD instruments said.
 * The verdict is recomputed on every call and anchored to the freeze commitment
 * via `buildFrozenCrystalManifest`, which recomputes the same deterministic
 * projection the freeze pinned and compares — so a verdict cannot claim to
 * describe the frozen set while actually describing drifted live rows
 * (CI-2026-08-09-HASH-VERIFIED-FROZEN-PROJECTION-001). A live recompute against
 * a pinned commitment is a stronger durable record than a stored row, which can
 * silently go stale.
 *
 * ── THE CONSUMER CONTRACT (Track 1 / the orchestrator reads this) ─────────
 *
 * Response, on success:
 *
 *   {
 *     ok: true,                        // the ROUTE succeeded — says nothing
 *                                      // about the verdict
 *     experimentId, crystalDomain,
 *     instrumentSuite: { suiteVersion, contractFingerprint, modules },
 *     retrospective: {                 // CrystalRetrospectiveFalsification
 *       reproducedReviewerObjections: boolean,   // ← THE GATE
 *       substrateAdmissibility: { admissible, basis, governingRuling, reason },
 *       instrumentSuiteMatchesProfile: boolean | null,
 *       concerns: [ { concernId, bearsOnCheck, rejected, … } ],
 *       readinessRejectsFrozenCrystal: boolean,
 *       crystalContentHash, verifiedAgainstFreeze,
 *       blockingGaps: string[],
 *       interpretation: string,
 *       …
 *     },
 *     remediationProfile: {            // read in the same breath as the verdict
 *       bound: boolean,
 *       binding: RemediationProfileBinding,
 *       bindingGaps: string[],
 *       profile: CrystalRemediationProfile | null
 *     },
 *     frozenArtifact: { present, lifecycle, verifiedAgainstFreeze }
 *   }
 *
 * A consumer must FAIL CLOSED on: a non-200, `ok: false`,
 * `retrospective === null`, `reproducedReviewerObjections !== true`, or
 * `remediationProfile.bound !== true`. `bound` is presently and correctly false
 * — no authoritative review artifact has been ingested — so a consumer gating on
 * it refuses today, which is the intended state.
 *
 * ── Access ───────────────────────────────────────────────────────────────
 *
 * Admin, or a persona holding an active research-lab grant scoped to THIS
 * experiment — the same admission the sibling readiness route uses
 * (`callerMayReadExperimentReview`, the one place that check lives). No new gate
 * is introduced and none is relaxed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { callerMayReadExperimentReview } from '@/services/passport/participationAccess';
import { getArtifact } from '@/services/research/artifacts';
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';
import { runCrystalReadinessReport } from '@/services/research/crystalReadiness';
import { buildFrozenCrystalManifest } from '@/services/research/crystalFrozenManifest';
import { composeCrystalRetrospectiveFalsification } from '@/services/research/crystalInstrumentFalsification';
import { crystalInstrumentSuiteIdentity } from '@/services/research/crystalInstrumentSuite';
import {
  BOUND_CRYSTAL_REMEDIATION_PROFILES,
  remediationProfileBindingState,
} from '@/types/crystalRemediation';
import type { InvariantRecord } from '@/types/invariants';
import type { LegacyFreezeVerificationEvidence } from '@/services/research/crystalLegacyContentVerification';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ experimentId: string }> },
) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  const { experimentId } = await params;

  if (!persona.cartridgeFlags?.isAdmin) {
    const admin = getSupabaseServer();
    const scoped = admin ? await callerMayReadExperimentReview(admin, persona.personaId, experimentId) : false;
    if (!scoped) {
      return NextResponse.json(
        { ok: false, error: 'Steward or assigned-reviewer access required' },
        { status: 403 },
      );
    }
  }

  const crystalDomain =
    req.nextUrl.searchParams.get('domain') ??
    crystalDomainForExperiment(experimentId)?.domain ??
    'constitutional-reasoning';

  // The frozen artifact, and its hash verification. An absent artifact is NOT
  // an error: the retrospective then honestly reports that its verdict is not
  // anchored to a frozen set, and that lands in `blockingGaps` rather than
  // being quietly treated as a pass.
  const artifact = await getArtifact(experimentId, 'crystal-version').catch(() => null);
  let crystalContentHash: string | null = null;
  let verifiedAgainstFreeze: boolean | null = null;
  let manifestVerificationDetail: string | null = null;
  // Disclosure only (2026-08-30) — a narrowly-versioned, DERIVED legacy
  // classification alongside verifiedAgainstFreeze, never a substitute for
  // it. Does NOT feed composeCrystalRetrospectiveFalsification,
  // reproducedReviewerObjections, or remediation-profile binding — that
  // wiring is a deliberately separate, not-yet-made governance decision.
  let legacyContentVerification: LegacyFreezeVerificationEvidence | null = null;
  // The population the retrospective's four hardened instruments assess.
  // `null` ⇒ fall through to this route's own prior behaviour (an independent
  // `runCrystalReadinessReport` call against the LIVE domain) — the only case
  // that applies to is "no frozen artifact exists at all", where there is no
  // recovered population to assess in the first place.
  let recoveredPopulation: InvariantRecord[] | null = null;
  if (artifact && artifact.lifecycle === 'frozen') {
    const manifest = await buildFrozenCrystalManifest({
      experimentId,
      artifact,
      // `buildFrozenCrystalManifest` reads no clock itself; the observation
      // timestamp is the caller's, and it is stamped onto the manifest's
      // explicitly-current (non-frozen) supplementary fields.
      observedAt: new Date().toISOString(),
    }).catch(() => null);
    if (manifest) {
      crystalContentHash = manifest.frozenContentHash || null;
      verifiedAgainstFreeze = manifest.verifiedAgainstFreeze;
      manifestVerificationDetail = manifest.verificationDetail;
      legacyContentVerification = manifest.legacyContentVerification;
      // Assess EXACTLY the population the manifest recovered from domain
      // membership — including members now `superseded` — never a second,
      // independently-filtered re-query of today's validated|canonical
      // corpus (2026-08-30, EXP-P1 retrospective dataflow fix). This is
      // unconditional on `verifiedAgainstFreeze`: the hash-verification gate
      // (condition 9 below) is enforced separately, by
      // `composeCrystalRetrospectiveFalsification` reading
      // `verifiedAgainstFreeze` itself — it is NOT re-implemented here by
      // withholding the population.
      if (manifest.recoveredInvariants.length > 0) {
        recoveredPopulation = manifest.recoveredInvariants;
      }
    }
  }

  const readiness = await runCrystalReadinessReport({
    experimentId,
    crystalDomain,
    ...(recoveredPopulation ? { invariants: recoveredPopulation } : {}),
  });

  // The profile is resolved BEFORE the retrospective verdict so its recorded
  // instrument-suite identity can be compared against the CURRENT one inside
  // composeCrystalRetrospectiveFalsification — condition 3 of the gate
  // (2026-08-30 governance ruling on retrospective substrate admissibility).
  const stored = BOUND_CRYSTAL_REMEDIATION_PROFILES.find((p) => p.experimentId === experimentId) ?? null;
  const bindingState = stored
    ? remediationProfileBindingState(stored)
    : {
        binding: 'unbound-no-artifact' as const,
        bindingGaps: [
          'no CrystalRemediationProfile is bound for this experiment — no authoritative external review ' +
            'artifact has been ingested (a review pasted into a chat has no locator and no content hash, so ' +
            'it cannot be verified or re-read). Consumers must fail closed.',
        ],
      };

  const retrospective = composeCrystalRetrospectiveFalsification({
    experimentId,
    crystalDomain,
    readiness,
    crystalContentHash,
    verifiedAgainstFreeze,
    artifactId: artifact?.id ?? null,
    legacyContentVerification,
    remediationProfileInstrumentSuite: stored?.instrumentSuite ?? null,
  });

  return NextResponse.json({
    ok: true,
    experimentId,
    crystalDomain,
    instrumentSuite: crystalInstrumentSuiteIdentity(),
    retrospective,
    remediationProfile: {
      bound: bindingState.binding === 'bound',
      binding: bindingState.binding,
      bindingGaps: bindingState.bindingGaps,
      profile: stored,
    },
    frozenArtifact: {
      present: Boolean(artifact),
      lifecycle: artifact?.lifecycle ?? null,
      verifiedAgainstFreeze,
      verificationDetail: manifestVerificationDetail,
      // Never redefines verifiedAgainstFreeze above, which stays the strict
      // byte-exact answer. For the ONE (experimentId, artifactId) pair a
      // ratified governance ruling names (2026-08-30 —
      // crystalRetrospectiveSubstrateAdmissibility.ts), this evidence CAN
      // license retrospective.substrateAdmissibility and, through it,
      // reproducedReviewerObjections — see retrospective.substrateAdmissibility
      // for whether that happened on this call. Never a substitute for
      // byte-exact verification on its own.
      legacyContentVerification,
    },
    readOnlyNote:
      'This route writes nothing. It does not re-score, backfill or correct the historical readiness results ' +
      'that permitted the freeze — those remain the record of what the pre-remediation instruments said. ' +
      'frozenArtifact.legacyContentVerification does not alter verifiedAgainstFreeze. For specifically ratified ' +
      'legacy artifacts, it may contribute to retrospective.substrateAdmissibility under an explicit governing ' +
      'ruling — see retrospective.substrateAdmissibility.governingRuling for whether that applied on this call.',
  });
}
