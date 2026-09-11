/**
 * Constitutional Object Model — the keystone contract canary (CFS-022 §4, P0).
 *
 * Pins the unified object contract without a DB or DOM: every object carries the
 * eight facets, the standing ladder is contrast-ordered, lifecycle transitions
 * are one-step-forward-or-re-enter, and T0 identifiers are STRUCTURALLY
 * inexpressible (a leak fails the build). Pure-logic — drills in node.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  STANDING_BANDS,
  FORBIDDEN_OBJECT_KEYS,
  objectRef,
  standingBandFor,
  bandAtLeast,
  isLegalObjectTransition,
  findForbiddenObjectKey,
  isTierSafeObject,
  type ConstitutionalObject,
} from "@/types/constitutionalObject";

function sampleObject(): ConstitutionalObject {
  return {
    identity: { id: "bearing-instrument", kind: "canonical_asset", ref: "a1b2c3d4", displayLabel: "Bearing Instrument v1" },
    version: { version: 1, status: "published" },
    standing: { standing: 0.9, band: "foundational", reach: 3 },
    authority: { minStandingToCompose: "canonical", ratificationRequired: true, governingInvariants: ["inv.representation.129"] },
    ownership: { ownerCommitment: "deadbeefcafe0001" },
    provenance: { receiptIds: ["rcpt_001"], contentCommitment: "9f8e7d", source: "authored" },
    lifecycle: { state: "published", order: ["draft", "active", "published", "superseded"] },
    dependencies: [objectRef("inv.representation.129", "invariant")],
    payload: { note: "the atlas dial" },
  };
}

describe("the object model unifies eight facets on every object", () => {
  it("carries identity / version / standing / authority / ownership / provenance / lifecycle / dependencies", () => {
    const o = sampleObject();
    for (const facet of [
      "identity", "version", "standing", "authority", "ownership", "provenance", "lifecycle", "dependencies",
    ] as const) {
      expect(o[facet]).toBeDefined();
    }
  });

  it("references are T2-safe object refs — id + kind, never a subject id", () => {
    const r = objectRef("inv.reasoning.001", "invariant");
    expect(r).toEqual({ id: "inv.reasoning.001", kind: "invariant" });
  });
});

describe("standing — the contrast-ordered maturity ladder + Reach", () => {
  it("orders experimental < validated < canonical < foundational", () => {
    expect([...STANDING_BANDS]).toEqual(["experimental", "validated", "canonical", "foundational"]);
  });

  it("bands a 0..1 score monotonically", () => {
    expect(standingBandFor(0.1)).toBe("experimental");
    expect(standingBandFor(0.4)).toBe("validated");
    expect(standingBandFor(0.7)).toBe("canonical");
    expect(standingBandFor(0.95)).toBe("foundational");
    // Monotonic across the range.
    let prev = -1;
    for (let s = 0; s <= 1.0001; s += 0.05) {
      const idx = STANDING_BANDS.indexOf(standingBandFor(Math.min(s, 1)));
      expect(idx).toBeGreaterThanOrEqual(prev);
      prev = idx;
    }
  });

  it("bandAtLeast enforces the compose floor", () => {
    expect(bandAtLeast("foundational", "canonical")).toBe(true);
    expect(bandAtLeast("canonical", "canonical")).toBe(true);
    expect(bandAtLeast("validated", "canonical")).toBe(false);
  });
});

describe("lifecycle — one step forward or re-enter (the flywheel)", () => {
  const order = ["draft", "active", "published", "superseded"] as const;

  it("allows a single forward step", () => {
    expect(isLegalObjectTransition(order, "draft", "active")).toBe(true);
    expect(isLegalObjectTransition(order, "active", "published")).toBe(true);
  });

  it("allows re-entering the current state (re-run / re-publish)", () => {
    expect(isLegalObjectTransition(order, "active", "active")).toBe(true);
  });

  it("rejects skips and backward jumps and unknown states", () => {
    expect(isLegalObjectTransition(order, "draft", "published")).toBe(false);
    expect(isLegalObjectTransition(order, "published", "active")).toBe(false);
    expect(isLegalObjectTransition(order, "draft", "bogus")).toBe(false);
  });
});

describe("T0 inexpressibility — a leak fails the build", () => {
  it("names the exact forbidden identifier tier", () => {
    expect([...FORBIDDEN_OBJECT_KEYS].sort()).toEqual(
      ["authProfileId", "fioHandle", "kybeAttestation", "personaId", "rootDid"].sort(),
    );
  });

  it("passes a clean object", () => {
    expect(isTierSafeObject(sampleObject())).toBe(true);
    expect(findForbiddenObjectKey(sampleObject())).toBeNull();
  });

  it("catches a T0 key at any nesting or casing", () => {
    expect(findForbiddenObjectKey({ payload: { personaId: "x" } })).toBe("payload.personaId");
    expect(findForbiddenObjectKey({ a: [{ RootDid: "x" }] })).toBe("a[0].RootDid");
    expect(findForbiddenObjectKey({ ownership: { authProfileId: "x" } })).toBe("ownership.authProfileId");
  });
});

describe("the source contract stays a contract — no implementation leaks in", () => {
  const source = readFileSync(
    join(__dirname, "../types/constitutionalObject.ts"),
    "utf8",
  );
  it("is isomorphic — no fs / db / react imports in the contract", () => {
    expect(source).not.toMatch(/from ['"]fs['"]/);
    expect(source).not.toMatch(/from ['"]@supabase/);
    expect(source).not.toMatch(/from ['"]react['"]/);
  });
});
