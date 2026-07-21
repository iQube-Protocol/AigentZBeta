/**
 * Constitutional Representation System — contract + resolver validation suite
 * (CFS-021).
 *
 * Pure-logic, no network, no Supabase. Pins the invariant contract and the
 * validation gate: the roles are complete, BOTH shipped interpretations
 * satisfy the contract, an incomplete interpretation is REJECTED, the standing
 * scale is ordered, resolveRole is interpretation-agnostic, and no T0
 * identifier leaks into any representation artifact.
 *
 * Mirrors the canary pattern in tests/access-spine.test.ts.
 */

import { describe, it, expect } from "vitest";

import {
  ALL_ROLES,
  STANDING_ROLES,
  MATERIAL_ROLES,
  COLOR_ROLES,
  CONSTITUTIONAL_REPRESENTATION_CONTRACT as CONTRACT,
  roleCssVar,
  type Interpretation,
} from "@/types/representation";
import {
  validateInterpretation,
  resolveRole,
  emitCssVariables,
  surfaceStyle,
  contrastRatio,
  parseHex,
} from "@/services/representation/representationResolver";
import {
  INTERPRETATIONS,
  agentiqLiquidGlass,
  constitutionalCivicFuturism,
  highContrastAccessible,
  DEFAULT_INTERPRETATION_ID,
} from "@/services/representation/interpretations";

describe("the contract", () => {
  it("declares a complete, de-duplicated role set as required", () => {
    expect(ALL_ROLES.length).toBeGreaterThan(0);
    expect(new Set(ALL_ROLES).size).toBe(ALL_ROLES.length);
    expect(CONTRACT.requiredRoles).toEqual(ALL_ROLES);
  });

  it("carries the four canonical relationship laws", () => {
    const ids = CONTRACT.rules.map((r) => r.id);
    expect(ids).toEqual([
      "law.completeness",
      "law.standing-monotonic",
      "law.principal-distinct",
      "law.body-legibility",
    ]);
  });

  it("orders the standing scale experimental → foundational", () => {
    expect(CONTRACT.standingOrder).toEqual(STANDING_ROLES);
    expect([...STANDING_ROLES]).toEqual([
      "standing.experimental",
      "standing.validated",
      "standing.canonical",
      "standing.foundational",
    ]);
  });
});

describe("the shipped interpretations satisfy the contract", () => {
  it("registers the house style (AgentiQ Liquid Glass) as the default for cohesion", () => {
    // Default ≠ canonical-first: the house style is the DEFAULT (platform
    // cohesion); CCF remains interpretation v1 / the reference atlas grammar.
    expect(DEFAULT_INTERPRETATION_ID).toBe(agentiqLiquidGlass.id);
    expect(INTERPRETATIONS).toContain(agentiqLiquidGlass);
    expect(INTERPRETATIONS).toContain(constitutionalCivicFuturism);
    expect(INTERPRETATIONS).toContain(highContrastAccessible);
    expect(INTERPRETATIONS.length).toBeGreaterThanOrEqual(3);
  });

  for (const interp of INTERPRETATIONS) {
    it(`"${interp.id}" is valid with zero violations`, () => {
      const result = validateInterpretation(interp);
      expect(result.violations).toEqual([]);
      expect(result.valid).toBe(true);
    });

    it(`"${interp.id}" binds every required role`, () => {
      for (const role of ALL_ROLES) {
        expect(typeof interp.roles[role]).toBe("string");
        expect(interp.roles[role].trim()).not.toBe("");
      }
    });

    it(`"${interp.id}" binds every MATERIAL role (blur · tint · hairline · elevation)`, () => {
      for (const role of MATERIAL_ROLES) {
        expect(typeof interp.roles[role]).toBe("string");
        expect(interp.roles[role].trim()).not.toBe("");
      }
    });

    it(`"${interp.id}" has a strictly increasing standing scale`, () => {
      const base = parseHex(interp.roles["surface.base"])!;
      const emphases = STANDING_ROLES.map((r) => contrastRatio(parseHex(interp.roles[r])!, base));
      for (let i = 1; i < emphases.length; i++) {
        expect(emphases[i]).toBeGreaterThan(emphases[i - 1]);
      }
    });
  }
});

describe("surface material — colour alone cannot express a rendering system (inv.representation.129)", () => {
  it("material roles are NOT colour roles (the contrast laws never touch them)", () => {
    for (const role of MATERIAL_ROLES) {
      expect(COLOR_ROLES as readonly string[]).not.toContain(role);
    }
    // …yet they ARE required (completeness still binds them).
    for (const role of MATERIAL_ROLES) {
      expect(CONTRACT.requiredRoles as readonly string[]).toContain(role);
    }
  });

  it("the glass interpretation binds a REAL (non-'none') blur + elevation", () => {
    expect(agentiqLiquidGlass.roles["material.blur"]).not.toBe("none");
    expect(agentiqLiquidGlass.roles["material.blur"]).toContain("blur(");
    expect(agentiqLiquidGlass.roles["material.elevation"]).not.toBe("none");
    expect(agentiqLiquidGlass.roles["material.elevation"]).toContain("inset");
    // …grounded in the real house token (styles/drawer.css glass fill).
    expect(agentiqLiquidGlass.roles["material.tint"]).toBe("rgba(15, 23, 42, 0.6)");
  });

  it("the flat interpretations (CCF, High-Contrast) bind material.blur: 'none' — unchanged look", () => {
    expect(constitutionalCivicFuturism.roles["material.blur"]).toBe("none");
    expect(constitutionalCivicFuturism.roles["material.elevation"]).toBe("none");
    expect(highContrastAccessible.roles["material.blur"]).toBe("none");
    expect(highContrastAccessible.roles["material.elevation"]).toBe("none");
    // Flat tint === the interpretation's opaque raised surface (pre-material look).
    expect(constitutionalCivicFuturism.roles["material.tint"]).toBe(
      constitutionalCivicFuturism.roles["surface.raised"],
    );
    expect(highContrastAccessible.roles["material.tint"]).toBe(
      highContrastAccessible.roles["surface.raised"],
    );
  });

  it("resolveRole for a material role differs glass vs flat — same slot, different substance", () => {
    for (const role of MATERIAL_ROLES) {
      const glass = resolveRole(role, agentiqLiquidGlass);
      const flat = resolveRole(role, constitutionalCivicFuturism);
      expect(glass).not.toBe(flat);
    }
  });

  it("surfaceStyle composes a matte panel for flat and a liquid-glass panel for the house style", () => {
    const flat = surfaceStyle(constitutionalCivicFuturism);
    expect(flat.backdropFilter).toBe("none");
    expect(flat.boxShadow).toBe("none");
    expect(flat.background).toBe(constitutionalCivicFuturism.roles["surface.raised"]);

    const glass = surfaceStyle(agentiqLiquidGlass);
    expect(glass.backdropFilter).toContain("blur(");
    expect(glass.backdropFilter).toBe(glass.WebkitBackdropFilter);
    expect(glass.boxShadow).toContain("inset");
    expect(glass.border).toContain("rgba(255, 255, 255, 0.10)");
  });
});

describe("the validation gate rejects a non-conforming interpretation", () => {
  it("rejects an interpretation missing a required role", () => {
    const broken: Interpretation = {
      id: "broken-incomplete",
      label: "Broken (incomplete)",
      connotation: "intentionally invalid",
      roles: { ...constitutionalCivicFuturism.roles },
    };
    // remove a required role
    delete (broken.roles as Record<string, string>)["ink.body"];
    const result = validateInterpretation(broken);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("ink.body"))).toBe(true);
  });

  it("rejects an interpretation whose standing scale is not ordered", () => {
    const broken: Interpretation = {
      id: "broken-standing",
      label: "Broken (standing)",
      connotation: "intentionally invalid",
      roles: {
        ...constitutionalCivicFuturism.roles,
        // foundational lighter than base-contrast of experimental → not increasing
        "standing.foundational": constitutionalCivicFuturism.roles["surface.base"],
      },
    };
    const result = validateInterpretation(broken);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("law.standing-monotonic"))).toBe(true);
  });

  it("rejects an interpretation with illegible body-on-base contrast", () => {
    const broken: Interpretation = {
      id: "broken-contrast",
      label: "Broken (contrast)",
      connotation: "intentionally invalid",
      roles: {
        ...constitutionalCivicFuturism.roles,
        "ink.body": constitutionalCivicFuturism.roles["surface.base"], // no contrast
      },
    };
    const result = validateInterpretation(broken);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("law.body-legibility"))).toBe(true);
  });
});

describe("resolveRole is interpretation-agnostic", () => {
  it("returns different values for the same role under each interpretation, same key", () => {
    for (const role of ["ink.body", "surface.base", "highlight.principal"] as const) {
      const ccf = resolveRole(role, constitutionalCivicFuturism);
      const hc = resolveRole(role, highContrastAccessible);
      expect(typeof ccf).toBe("string");
      expect(typeof hc).toBe("string");
      expect(ccf).not.toBe(hc); // same semantic slot, different concrete value
    }
  });

  it("throws when asked to resolve a role an interpretation does not bind", () => {
    const partial: Interpretation = {
      id: "partial",
      label: "partial",
      connotation: "x",
      roles: { ...constitutionalCivicFuturism.roles },
    };
    delete (partial.roles as Record<string, string>)["type.mono"];
    expect(() => resolveRole("type.mono", partial)).toThrow();
  });
});

describe("CSS variable binding", () => {
  it("emits one --rep-* variable per required role", () => {
    const vars = emitCssVariables(constitutionalCivicFuturism);
    expect(Object.keys(vars).length).toBe(ALL_ROLES.length);
    expect(vars[roleCssVar("ink.body")]).toBe(constitutionalCivicFuturism.roles["ink.body"]);
    expect(roleCssVar("surface.base")).toBe("--rep-surface-base");
  });
});

describe("T0-leak canary — no identifiers in any representation artifact", () => {
  const FORBIDDEN = ["personaId", "authProfileId", "rootDid", "kybeAttestation", "fioHandle"];
  it("no interpretation, role key, or contract carries a T0 identifier", () => {
    const haystack = JSON.stringify({
      contract: CONTRACT,
      roles: ALL_ROLES,
      colorRoles: COLOR_ROLES,
      interpretations: INTERPRETATIONS,
    });
    for (const forbidden of FORBIDDEN) {
      expect(haystack.includes(forbidden)).toBe(false);
    }
  });
});
