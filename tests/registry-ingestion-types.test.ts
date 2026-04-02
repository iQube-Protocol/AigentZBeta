import { describe, it, expect } from "vitest";
import {
  trustBandFromScore,
  applyTrustCaps,
  TRUST_BAND_ORDER,
  type TrustBand,
} from "@/types/registryIngestion";

// ─────────────────────────────────────────────────────────────────────────────
// trustBandFromScore
// ─────────────────────────────────────────────────────────────────────────────

describe("trustBandFromScore", () => {
  it("maps scores >= 90 to L5_CORE_SOVEREIGN", () => {
    expect(trustBandFromScore(90)).toBe("L5_CORE_SOVEREIGN");
    expect(trustBandFromScore(100)).toBe("L5_CORE_SOVEREIGN");
    expect(trustBandFromScore(95.5)).toBe("L5_CORE_SOVEREIGN");
  });

  it("maps scores 75–89 to L4_PRODUCTION_APPROVED", () => {
    expect(trustBandFromScore(75)).toBe("L4_PRODUCTION_APPROVED");
    expect(trustBandFromScore(89)).toBe("L4_PRODUCTION_APPROVED");
    expect(trustBandFromScore(82)).toBe("L4_PRODUCTION_APPROVED");
  });

  it("maps scores 55–74 to L3_PRODUCTION_CANDIDATE", () => {
    expect(trustBandFromScore(55)).toBe("L3_PRODUCTION_CANDIDATE");
    expect(trustBandFromScore(74)).toBe("L3_PRODUCTION_CANDIDATE");
    expect(trustBandFromScore(65)).toBe("L3_PRODUCTION_CANDIDATE");
  });

  it("maps scores 30–54 to L2_VERIFIED_COMMUNITY", () => {
    expect(trustBandFromScore(30)).toBe("L2_VERIFIED_COMMUNITY");
    expect(trustBandFromScore(54)).toBe("L2_VERIFIED_COMMUNITY");
    expect(trustBandFromScore(42)).toBe("L2_VERIFIED_COMMUNITY");
  });

  it("maps scores below 30 to L1_EXPERIMENTAL", () => {
    expect(trustBandFromScore(0)).toBe("L1_EXPERIMENTAL");
    expect(trustBandFromScore(29)).toBe("L1_EXPERIMENTAL");
    expect(trustBandFromScore(-10)).toBe("L1_EXPERIMENTAL");
  });

  it("respects exact boundary values", () => {
    // Each threshold uses >=, so boundary belongs to the higher band
    expect(trustBandFromScore(90)).toBe("L5_CORE_SOVEREIGN");
    expect(trustBandFromScore(89.99)).toBe("L4_PRODUCTION_APPROVED");
    expect(trustBandFromScore(75)).toBe("L4_PRODUCTION_APPROVED");
    expect(trustBandFromScore(74.99)).toBe("L3_PRODUCTION_CANDIDATE");
    expect(trustBandFromScore(55)).toBe("L3_PRODUCTION_CANDIDATE");
    expect(trustBandFromScore(54.99)).toBe("L2_VERIFIED_COMMUNITY");
    expect(trustBandFromScore(30)).toBe("L2_VERIFIED_COMMUNITY");
    expect(trustBandFromScore(29.99)).toBe("L1_EXPERIMENTAL");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyTrustCaps
// ─────────────────────────────────────────────────────────────────────────────

describe("applyTrustCaps", () => {
  it("returns computed band unchanged when caps array is empty", () => {
    expect(applyTrustCaps("L4_PRODUCTION_APPROVED", [])).toBe("L4_PRODUCTION_APPROVED");
    expect(applyTrustCaps("L5_CORE_SOVEREIGN", [])).toBe("L5_CORE_SOVEREIGN");
  });

  it("returns computed band unchanged when all caps are undefined", () => {
    expect(applyTrustCaps("L4_PRODUCTION_APPROVED", [undefined, undefined])).toBe("L4_PRODUCTION_APPROVED");
  });

  it("applies strictest cap when cap is lower than computed band", () => {
    expect(applyTrustCaps("L4_PRODUCTION_APPROVED", ["L2_VERIFIED_COMMUNITY"])).toBe("L2_VERIFIED_COMMUNITY");
    expect(applyTrustCaps("L5_CORE_SOVEREIGN", ["L3_PRODUCTION_CANDIDATE"])).toBe("L3_PRODUCTION_CANDIDATE");
  });

  it("does not elevate band when cap is higher than computed band", () => {
    expect(applyTrustCaps("L2_VERIFIED_COMMUNITY", ["L4_PRODUCTION_APPROVED"])).toBe("L2_VERIFIED_COMMUNITY");
    expect(applyTrustCaps("L1_EXPERIMENTAL", ["L5_CORE_SOVEREIGN"])).toBe("L1_EXPERIMENTAL");
  });

  it("selects the strictest (lowest) cap when multiple caps are present", () => {
    const result = applyTrustCaps("L5_CORE_SOVEREIGN", [
      "L3_PRODUCTION_CANDIDATE",
      "L2_VERIFIED_COMMUNITY",
      "L4_PRODUCTION_APPROVED",
    ]);
    expect(result).toBe("L2_VERIFIED_COMMUNITY");
  });

  it("applies a single cap that matches the computed band (no change)", () => {
    expect(applyTrustCaps("L3_PRODUCTION_CANDIDATE", ["L3_PRODUCTION_CANDIDATE"])).toBe("L3_PRODUCTION_CANDIDATE");
  });

  it("applies L1 cap forcing minimum band regardless of computed", () => {
    expect(applyTrustCaps("L5_CORE_SOVEREIGN", ["L1_EXPERIMENTAL"])).toBe("L1_EXPERIMENTAL");
  });

  it("ignores undefined entries in a mixed caps array", () => {
    const result = applyTrustCaps("L5_CORE_SOVEREIGN", [
      undefined,
      "L3_PRODUCTION_CANDIDATE",
      undefined,
    ]);
    expect(result).toBe("L3_PRODUCTION_CANDIDATE");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TRUST_BAND_ORDER integrity
// ─────────────────────────────────────────────────────────────────────────────

describe("TRUST_BAND_ORDER", () => {
  it("contains exactly 5 bands in ascending order", () => {
    expect(TRUST_BAND_ORDER).toHaveLength(5);
    expect(TRUST_BAND_ORDER[0]).toBe("L1_EXPERIMENTAL");
    expect(TRUST_BAND_ORDER[4]).toBe("L5_CORE_SOVEREIGN");
  });

  it("is consistent with trustBandFromScore output", () => {
    const scores = [0, 30, 55, 75, 90];
    const bands = scores.map(trustBandFromScore);
    // Each derived band must exist in TRUST_BAND_ORDER
    for (const band of bands) {
      expect(TRUST_BAND_ORDER).toContain(band);
    }
    // Bands should be in ascending order by score
    const indices = bands.map((b) => TRUST_BAND_ORDER.indexOf(b));
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThanOrEqual(indices[i - 1]);
    }
  });
});
