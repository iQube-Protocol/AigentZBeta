/**
 * Capability Registry — Constitutional Acceptance canary (CFS-032 §4/§5,
 * built 2026-07-16). Pins the PURE surface: the capability ConstitutionalObject
 * builder (T2-safe by construction, registration enters at the experimental
 * floor) and the Standing accrual policy (registration is the eligibility
 * gate — enforced in the service; accrual is +0.1 capped at the canonical
 * floor, never past it by accrual alone).
 */

import { describe, it, expect } from "vitest";

import {
  buildCapabilityObject,
  accrueCapabilityStanding,
  REGISTRATION_STANDING,
  OPERATIONAL_VALIDATION_DELTA,
  ACCRUAL_STANDING_CAP,
} from "@/services/constitutional/capabilityRegistry";
import { findForbiddenObjectKey, standingBandFor } from "@/types/constitutionalObject";

const INPUT = {
  capabilityId: "video-article-skill-abc",
  displayLabel: "Video + Article skill",
  description: "Generates a 24s video brief + companion article from one invariant seed",
  packId: "pack-2026-07-15-video-article",
  prNumber: 90,
  validationReceiptIds: ["11111111-aaaa-bbbb-cccc-222222222222"],
  deploymentReceiptId: "33333333-dddd-eeee-ffff-444444444444",
  governingInvariants: ["inv.engineering.031"],
};

describe("buildCapabilityObject — the acceptance object (CFS-032 §4)", () => {
  it("is a kind='capability' ConstitutionalObject entering at the experimental floor", () => {
    const o = buildCapabilityObject(INPUT);
    expect(o.identity.kind).toBe("capability");
    expect(o.identity.id).toBe(INPUT.capabilityId);
    expect(o.standing.standing).toBe(REGISTRATION_STANDING);
    expect(o.standing.band).toBe(standingBandFor(REGISTRATION_STANDING));
    expect(o.standing.band).toBe("experimental"); // registration NEVER confers standing
    expect(o.lifecycle.state).toBe("published");
  });

  it("carries provenance: validation + deployment receipt ids and a content commitment", () => {
    const o = buildCapabilityObject(INPUT);
    expect(o.provenance.receiptIds).toContain(INPUT.validationReceiptIds[0]);
    expect(o.provenance.receiptIds).toContain(INPUT.deploymentReceiptId);
    expect(o.provenance.contentCommitment).toMatch(/^[0-9a-f]{16}$/);
    expect(o.provenance.source).toBe("capability-pipeline");
    expect(o.authority.governingInvariants).toContain("inv.engineering.031");
  });

  it("is deterministic: same input → same ref and content commitment (idempotent re-registration)", () => {
    const a = buildCapabilityObject(INPUT);
    const b = buildCapabilityObject(INPUT);
    expect(a.identity.ref).toBe(b.identity.ref);
    expect(a.provenance.contentCommitment).toBe(b.provenance.contentCommitment);
  });

  it("is T2-safe by construction: no forbidden identifier key anywhere in the object", () => {
    const o = buildCapabilityObject(INPUT);
    expect(findForbiddenObjectKey(o as unknown as Record<string, unknown>)).toBeNull();
  });

  it("ownership is a commitment, never a persona id shape", () => {
    const o = buildCapabilityObject(INPUT);
    expect(o.ownership.ownerCommitment).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("accrueCapabilityStanding — the accrual policy (CFS-032 §5)", () => {
  it("accrues +delta from the registration floor", () => {
    expect(accrueCapabilityStanding(REGISTRATION_STANDING)).toBeCloseTo(
      REGISTRATION_STANDING + OPERATIONAL_VALIDATION_DELTA,
      5,
    );
  });

  it("caps BELOW the canonical band floor — accrual alone never mints canonical standing", () => {
    expect(accrueCapabilityStanding(ACCRUAL_STANDING_CAP)).toBe(ACCRUAL_STANDING_CAP);
    expect(accrueCapabilityStanding(0.5)).toBe(ACCRUAL_STANDING_CAP);
    expect(standingBandFor(ACCRUAL_STANDING_CAP)).toBe("validated"); // never 'canonical' by accrual
  });

  it("repeated validations from the floor converge at the cap in the validated band", () => {
    let s = REGISTRATION_STANDING;
    for (let i = 0; i < 6; i++) s = accrueCapabilityStanding(s);
    expect(s).toBe(ACCRUAL_STANDING_CAP);
    expect(standingBandFor(s)).toBe("validated");
  });
});
