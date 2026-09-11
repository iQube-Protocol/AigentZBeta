/**
 * metaVitruvian — the composable human, canary suite (Canonical Asset 002).
 *
 * Pins the figure's OPERATIONAL contract without a DOM: it carries the eight
 * mobility-stack domains, maps each to a glyph + a colour ROLE (so it is
 * interpretation-agnostic — the SAME figure reskins CCF ↔ High-Contrast),
 * inscribes the Vitruvian circle + square deterministically, overlays the
 * double-spread pose, describes itself for assistive tech, and hardcodes ZERO
 * raw colour literals (the same grep gate the Bearing Instrument enforces).
 *
 * Pure-logic — the geometry + mapping helpers are exported so they drill in node
 * (esbuild + node) with no React/DOM. Mirrors tests/bearing-instrument.test.ts.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  META_VITRUVIAN_DOMAINS,
  domainGlyphKey,
  domainRole,
  domainLabel,
  standingRoleName,
  titleCase,
  polar,
  inscribeGeometry,
  vitruvianPose,
  medallionRingPositions,
  metaVitruvianAriaLabel,
  type MetaVitruvianDomain,
} from "@/components/representation/MetaVitruvian";
import { STANDING_LEVELS } from "@/types/representation";
import { resolveRole } from "@/services/representation/representationResolver";
import {
  constitutionalCivicFuturism,
  highContrastAccessible,
} from "@/services/representation/interpretations";

describe("domains — the figure carries the eight mobility-stack domains", () => {
  it("has exactly the eight canonical domains, in ring order", () => {
    expect(META_VITRUVIAN_DOMAINS.length).toBe(8);
    expect([...META_VITRUVIAN_DOMAINS]).toEqual([
      "mobility",
      "knowledge",
      "social",
      "standing",
      "delegation",
      "civic",
      "jurisdiction",
      "human-potential",
    ]);
  });

  it("maps every domain to a distinct medallion glyph", () => {
    const keys = META_VITRUVIAN_DOMAINS.map(domainGlyphKey);
    expect(keys).toEqual([
      "airplane",
      "book",
      "handshake",
      "scales",
      "agents",
      "passport",
      "globe",
      "star",
    ]);
    expect(new Set(keys).size).toBe(META_VITRUVIAN_DOMAINS.length); // all distinct
  });

  it("human-facing labels expand and title-case the token", () => {
    expect(domainLabel("human-potential")).toBe("Human Potential");
    expect(domainLabel("civic")).toBe("Civic");
  });
});

describe("interpretation-agnostic — domain hues + standing come from ROLES, not literals", () => {
  it("maps every domain to a colour role resolvable under BOTH interpretations", () => {
    for (const domain of META_VITRUVIAN_DOMAINS) {
      const role = domainRole(domain);
      const ccf = resolveRole(role, constitutionalCivicFuturism);
      const hc = resolveRole(role, highContrastAccessible);
      expect(typeof ccf).toBe("string");
      expect(typeof hc).toBe("string");
      expect(ccf).not.toBe(hc); // same semantic slot, reskins per interpretation
    }
  });

  it("borrows field-sector hues for seven domains and the principal for human-potential", () => {
    expect(domainRole("mobility")).toBe("field.action");
    expect(domainRole("knowledge")).toBe("field.knowledge");
    expect(domainRole("civic")).toBe("field.reasoning");
    expect(domainRole("human-potential")).toBe("highlight.principal");
  });

  it("maps every standing level to its standing-scale role, resolvable under both", () => {
    for (const level of STANDING_LEVELS) {
      const role = standingRoleName(level);
      expect(role).toBe(`standing.${level}`);
      expect(typeof resolveRole(role, constitutionalCivicFuturism)).toBe("string");
      expect(typeof resolveRole(role, highContrastAccessible)).toBe("string");
    }
  });
});

describe("geometry — the Vitruvian inscribe + double-pose are deterministic and SSR-safe", () => {
  it("inscribes a centred circle + square deterministically from size", () => {
    const g = inscribeGeometry(400);
    expect(g.cx).toBe(200);
    expect(g.cy).toBe(200);
    expect(g.r).toBeGreaterThan(0);
    expect(g.square.side).toBeGreaterThan(0);
    // Square is centred on the same point as the circle.
    expect(g.square.x + g.square.side / 2).toBeCloseTo(g.cx, 6);
    expect(g.square.y + g.square.side / 2).toBeCloseTo(g.cy, 6);
    // Pure — same input, same output.
    expect(inscribeGeometry(400)).toEqual(g);
  });

  it("polar sanity — east is +x, and the helper is deterministic", () => {
    expect(polar(0, 0, 10, 0)).toEqual({ x: 10, y: 0 });
    const a = polar(50, 50, 20, 37);
    const b = polar(50, 50, 20, 37);
    expect(a).toEqual(b);
  });

  it("overlays the double-spread pose — spread limbs land ON the circle", () => {
    const p = vitruvianPose(400);
    const onCircle = (pt: { x: number; y: number }) =>
      Math.hypot(pt.x - p.cx, pt.y - p.cy);
    // Raised hands + spread feet sit on the Vitruvian circle radius.
    for (const pt of [...p.armsRaised, ...p.legsSpread]) {
      expect(onCircle(pt)).toBeCloseTo(p.r, 4);
    }
    // The two poses are genuinely distinct (horizontal hands are wider than the
    // raised hands are high — an overlay, not a single pose).
    expect(p.armsHorizontal[0].x).toBeLessThan(p.armsRaised[0].x);
    expect(p.legsTogether[0].x).toBeGreaterThan(p.legsSpread[0].x);
    // Deterministic.
    expect(vitruvianPose(400)).toEqual(p);
  });

  it("places the right number of medallions evenly, medallion 0 due north", () => {
    const ring = medallionRingPositions(META_VITRUVIAN_DOMAINS.length, 400);
    expect(ring.length).toBe(8);
    expect(ring[0].angle).toBe(-90);
    // Evenly spaced by 360 / count.
    for (let i = 1; i < ring.length; i++) {
      expect(ring[i].angle - ring[i - 1].angle).toBeCloseTo(45, 6);
    }
    // All medallions sit at the same radius from centre.
    const cx = 200;
    const cy = 200;
    const radius = Math.hypot(ring[0].x - cx, ring[0].y - cy);
    for (const m of ring) {
      expect(Math.hypot(m.x - cx, m.y - cy)).toBeCloseTo(radius, 4);
    }
  });
});

describe("reason / accessibility — the aria-label announces the composition", () => {
  it("names the subject, standing, and lit domains", () => {
    expect(
      metaVitruvianAriaLabel({
        standing: "foundational",
        domains: ["civic", "human-potential"],
        label: "Polity Passport",
      }),
    ).toBe(
      "Polity Passport — metaVitruvian: the composable human inscribed in circle and square, standing Foundational; domains Civic, Human Potential",
    );
  });

  it("degrades honestly when standing-less and domain-less", () => {
    expect(metaVitruvianAriaLabel({})).toBe(
      "metaVitruvian: the composable human inscribed in circle and square",
    );
  });

  it("title-cases standing tokens", () => {
    expect(titleCase("experimental")).toBe("Experimental");
  });
});

describe("zero raw colour literals — the figure is role-driven end to end", () => {
  const source = readFileSync(
    join(process.cwd(), "components/representation/MetaVitruvian.tsx"),
    "utf8",
  );
  const RAW_TAILWIND_COLOR =
    /\b(text|bg|border|ring|from|via|to|fill|stroke|divide|outline|shadow)-(slate|gray|zinc|neutral|stone|emerald|green|sky|blue|indigo|violet|purple|cyan|teal|amber|yellow|orange|rose|red|pink|fuchsia|lime)-[0-9]/g;
  const BARE_HEX = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g;

  it("contains no Tailwind colour utilities", () => {
    expect(source.match(RAW_TAILWIND_COLOR) ?? []).toEqual([]);
  });

  it("contains no bare hex colour literals", () => {
    expect(source.match(BARE_HEX) ?? []).toEqual([]);
  });

  it("consumes roles through the resolver hook", () => {
    expect(source).toContain("useRepresentation()");
    expect(source).toContain("role(domainRole(domain))");
  });
});

// Type-level touch so the domain union stays honest under refactors.
const _domainCheck: MetaVitruvianDomain = "delegation";
void _domainCheck;
