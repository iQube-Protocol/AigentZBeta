/**
 * EXP-P1 CrystalRemediationProfile v1 — authored 2026-08-29 from the
 * authoritative IRL Review #001 (Austin) material and the frozen EXP-P1
 * protocol. Proves the profile is well-formed, internally consistent with
 * the live instrument suite / population-formula functions it was derived
 * from, and — critically — still correctly UNBOUND pending the live
 * retrospective run (see types/crystalRemediation.ts's own doc comment on
 * `EXP_P1_REMEDIATION_PROFILE_CONTENT` for the exact completion step).
 *
 * Does NOT attempt to run the retrospective itself (requires a live read of
 * the frozen Crystal vP1 artifact via Supabase) — that is deliberately out
 * of scope for a hermetic test and is the one remaining live step.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BOUND_CRYSTAL_REMEDIATION_PROFILES,
  remediationProfileBindingState,
} from '@/types/crystalRemediation';
import {
  deriveCrystalPopulationRequirement,
  ARM_C_SLICE_FRACTION_OF_CRYSTAL,
} from '@/services/research/crystalPopulationRequirement';
import {
  crystalInstrumentSuiteIdentity,
  crystalReadinessCheckNames,
} from '@/services/research/crystalInstrumentSuite';
import { INVARIANT_NAMESPACES } from '@/types/invariants';

const REPO_ROOT = join(__dirname, '..');

function sha256OfFile(relativePath: string): string {
  const bytes = readFileSync(join(REPO_ROOT, relativePath));
  return createHash('sha256').update(bytes).digest('hex');
}

const profile = BOUND_CRYSTAL_REMEDIATION_PROFILES.find((p) => p.experimentId === 'EXP-P1');

describe('EXP-P1 CrystalRemediationProfile v1', () => {
  it('exists, exactly once, for EXP-P1', () => {
    expect(profile).toBeDefined();
    expect(BOUND_CRYSTAL_REMEDIATION_PROFILES.filter((p) => p.experimentId === 'EXP-P1')).toHaveLength(1);
  });

  it('is still correctly UNBOUND — the retrospective has not been run, and the profile does not claim otherwise', () => {
    expect(profile!.retrospective).toBeNull();
    const derived = remediationProfileBindingState(profile!);
    expect(derived.binding).toBe('unbound-retrospective-not-reproduced');
    expect(derived.bindingGaps).toEqual([
      'the retrospective falsification against the frozen crystal has not been run',
    ]);
    // The profile's OWN stored binding/bindingGaps must agree with the
    // derivation — never a stored assertion the derivation disagrees with.
    expect(profile!.binding).toBe(derived.binding);
    expect(profile!.bindingGaps).toEqual(derived.bindingGaps);
  });

  it('is NOT source-incomplete — the gate is closed on the retrospective alone, not on any other gap', () => {
    // Distinguishes "everything else is fine, only the live retrospective is
    // missing" from "the profile itself is unfinished" — the two report
    // different binding states (unbound-retrospective-not-reproduced vs
    // unbound-incomplete) and a reader must be able to tell them apart.
    expect(profile!.sourceRefs.length).toBeGreaterThan(0);
    expect(profile!.checkMappings.length).toBeGreaterThan(0);
    expect(profile!.checkMappings.every((m) => m.executable)).toBe(true);
    expect(profile!.populationFormula.insufficientInputs).toEqual([]);
    expect(profile!.populationFormula.minimumCollectionSize).not.toBeNull();
    expect(profile!.boundaryRequirement.requiredRepresentedNamespaceCount).not.toBeNull();
  });

  describe('sourceRefs — every locator resolves and every contentHash is real and current', () => {
    it('has 3 source refs, each with a non-null, re-derivable contentHash', () => {
      expect(profile!.sourceRefs.length).toBe(3);
      for (const ref of profile!.sourceRefs) {
        expect(ref.locator.length).toBeGreaterThan(0);
        expect(ref.contentHash).not.toBeNull();
        expect(ref.contentHash).toMatch(/^[0-9a-f]{64}$/);
      }
    });

    it('each contentHash matches a live sha256 of the file at its locator RIGHT NOW', () => {
      // Proves the refs are re-readable and re-hashable, not merely present —
      // the exact property `BoundSourceRef`'s own doc comment requires ("a
      // reader can go and read it, and a hash mismatch is detectable").
      for (const ref of profile!.sourceRefs) {
        const live = sha256OfFile(ref.locator);
        expect(live, `content hash drift for ${ref.locator}`).toBe(ref.contentHash);
      }
    });

    it('names Austin\'s review, the resolution record, and the frozen protocol README — nothing else', () => {
      const refIds = profile!.sourceRefs.map((r) => r.refId).sort();
      expect(refIds).toEqual(
        [
          'EXP-P1-README',
          'IRL-REVIEW-001',
          'RES-2026-08-26-CRYSTAL-INSTRUMENT-MEASUREMENT-LAYER-001',
        ].sort(),
      );
      const kinds = profile!.sourceRefs.map((r) => r.kind).sort();
      expect(kinds).toEqual(['external-review', 'operator-ruling', 'protocol-section'].sort());
    });
  });

  describe('checkMappings — the four Austin findings, each bound to the check that measures it', () => {
    it('maps each finding onto exactly the check names the live instrument suite actually emits', () => {
      const liveCheckNames = new Set(crystalReadinessCheckNames());
      for (const mapping of profile!.checkMappings) {
        for (const name of mapping.bearsOnChecks) {
          expect(liveCheckNames.has(name), `check '${name}' is not in the live contract`).toBe(true);
        }
      }
    });

    it('covers all four remediated concerns — duplicates, statement quality, size, coverage — with no gaps', () => {
      const bearsOn = profile!.checkMappings.flatMap((m) => m.bearsOnChecks).sort();
      expect(bearsOn).toEqual(
        ['boundary-coverage', 'derivation-headroom', 'duplicate-detection', 'selection-space'].sort(),
      );
      expect(profile!.checkMappings.every((m) => m.gap === null)).toBe(true);
    });
  });

  describe('populationFormula — matches the LIVE deriveCrystalPopulationRequirement({}) output exactly', () => {
    it('is byte-for-byte the registered-minimum-task-design derivation, not hand-computed', () => {
      const live = deriveCrystalPopulationRequirement({});
      expect(live.derivable).toBe(true);
      expect(profile!.populationFormula.sliceFractionOfCrystal).toBe(ARM_C_SLICE_FRACTION_OF_CRYSTAL);
      expect(profile!.populationFormula.sliceDemandBasis).toBe(live.sliceDemandBasis);
      expect(profile!.populationFormula.requiredEvaluationSliceSize).toBe(live.requiredEvaluationSliceSize);
      expect(profile!.populationFormula.minimumCollectionSize).toBe(live.minimumCollectionSize);
      // Every real derivation line the live function produces must appear,
      // verbatim, among the profile's stored lines — the profile may carry
      // one additional cross-check line, never fewer of the live ones.
      for (const line of live.derivation) {
        expect(profile!.populationFormula.derivationLines).toContain(line);
      }
    });

    it('derives 24 → 60 (not the reviewer\'s illustrative 50–75), consistent with §6\'s own worked example', () => {
      expect(profile!.populationFormula.requiredEvaluationSliceSize).toBe(24);
      expect(profile!.populationFormula.minimumCollectionSize).toBe(60);
      expect(
        profile!.populationFormula.derivationLines.some((l) => l.includes('CONSISTENT') && l.includes('18 invariants')),
      ).toBe(true);
    });
  });

  describe('boundaryRequirement — the full ratified 15-namespace ontology, never narrowed', () => {
    it('names all 15 INVARIANT_NAMESPACES, requires all 15 represented, and cannot narrow', () => {
      expect(profile!.boundaryRequirement.declaredNamespaces.length).toBe(INVARIANT_NAMESPACES.length);
      expect([...profile!.boundaryRequirement.declaredNamespaces].sort()).toEqual([...INVARIANT_NAMESPACES].sort());
      expect(profile!.boundaryRequirement.requiredRepresentedNamespaceCount).toBe(INVARIANT_NAMESPACES.length);
      expect(profile!.boundaryRequirement.mayNarrowBoundary).toBe(false);
      expect(profile!.boundaryRequirement.remedy).toBe('extend-corpus');
    });
  });

  describe('instrumentSuite — matches the LIVE crystalInstrumentSuiteIdentity() at v2.0.0', () => {
    it('carries the exact live suiteVersion, contractFingerprint and modules', () => {
      const live = crystalInstrumentSuiteIdentity();
      expect(profile!.instrumentSuite.suiteVersion).toBe(live.suiteVersion);
      expect(profile!.instrumentSuite.contractFingerprint).toBe(live.contractFingerprint);
      expect([...profile!.instrumentSuite.modules].sort()).toEqual([...live.modules].sort());
      // Explicit v2.0.0 pin — the HARDENED suite, never the pre-remediation
      // v1.x.x lexical/label-only instruments this profile exists to move
      // past.
      expect(profile!.instrumentSuite.suiteVersion).toBe('2.0.0');
    });
  });
});
