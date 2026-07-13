/**
 * Bearing Instrument — the constitutional compass, canary suite (CFS-021 §5).
 *
 * Pins the instrument's OPERATIONAL contract without a DOM: it draws all seven
 * Constitutional Field sectors, reads sector/standing values from ROLES (so it
 * is interpretation-agnostic — the SAME instrument reskins CCF ↔ High-Contrast),
 * emits navigation INTENT with the clicked sector (never routes), describes
 * itself for assistive tech (aria-label names the active sector + standing), and
 * hardcodes ZERO raw colour literals (the same grep gate the reference surface
 * enforces).
 *
 * Pure-logic — the geometry + mapping helpers are exported so they drill in node
 * (esbuild + node) with no React/DOM. Mirrors tests/representation-system.test.ts.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  sectorRole,
  standingRoleName,
  titleCase,
  sectorAngle,
  polar,
  wedgePath,
  bearingAriaLabel,
  emitNavigate,
  ATLAS_TRINITY,
  ATLAS_POLES,
  ATLAS_ARTEFACTS,
  ATLAS_LAYERS,
  atlasHeadingDegrees,
  atlasStandingShort,
} from "@/components/representation/BearingInstrument";
import {
  FIELD_SECTORS,
  STANDING_LEVELS,
  type FieldSector,
} from "@/types/representation";
import { resolveRole } from "@/services/representation/representationResolver";
import {
  constitutionalCivicFuturism,
  highContrastAccessible,
} from "@/services/representation/interpretations";

describe("orientation — the bearing draws all seven Constitutional Field sectors", () => {
  it("has exactly the seven canonical sectors", () => {
    expect(FIELD_SECTORS.length).toBe(7);
    expect([...FIELD_SECTORS]).toEqual([
      "reasoning",
      "intelligence",
      "order",
      "action",
      "knowledge",
      "experience",
      "consequence",
    ]);
  });

  it("maps every sector to its field colour role", () => {
    for (const sector of FIELD_SECTORS) {
      expect(sectorRole(sector)).toBe(`field.${sector}`);
    }
  });

  it("places sector 0 at due north and spaces the rest evenly clockwise", () => {
    expect(sectorAngle(0, 7)).toBe(-90);
    expect(sectorAngle(7, 7)).toBe(-90 + 360); // full turn back to north
    // Monotonic increasing around the rose.
    for (let i = 1; i < 7; i++) {
      expect(sectorAngle(i, 7)).toBeGreaterThan(sectorAngle(i - 1, 7));
    }
  });

  it("produces a closed annular wedge path for each sector", () => {
    const d = wedgePath(50, 50, 17, 35, -115, -65);
    expect(d.startsWith("M ")).toBe(true);
    expect(d.trim().endsWith("Z")).toBe(true);
    expect(d).toContain("A 35 35"); // outer arc
    expect(d).toContain("A 17 17"); // inner arc
  });
});

describe("interpretation-agnostic — sector/standing values come from ROLES, not literals", () => {
  it("resolves every sector role under BOTH interpretations, same key, different value", () => {
    for (const sector of FIELD_SECTORS) {
      const role = sectorRole(sector);
      const ccf = resolveRole(role, constitutionalCivicFuturism);
      const hc = resolveRole(role, highContrastAccessible);
      expect(typeof ccf).toBe("string");
      expect(typeof hc).toBe("string");
      expect(ccf).not.toBe(hc); // same semantic slot, reskins per interpretation
    }
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

describe("navigation — the bearing emits INTENT with the clicked sector, it does not route", () => {
  it("calls onNavigate with the clicked sector and reports the emission", () => {
    const seen: FieldSector[] = [];
    const emitted = emitNavigate("knowledge", (s) => seen.push(s));
    expect(emitted).toBe(true);
    expect(seen).toEqual(["knowledge"]);
  });

  it("is a no-op when no onNavigate is provided (pure orientation)", () => {
    expect(emitNavigate("reasoning", undefined)).toBe(false);
  });
});

describe("reason / accessibility — the aria-label announces the orientation", () => {
  it("names the active sector and standing", () => {
    expect(
      bearingAriaLabel({ activeSector: "reasoning", standing: "foundational", label: "IRL" }),
    ).toBe("IRL bearing: oriented to Reasoning, standing Foundational");
  });

  it("degrades honestly when unoriented or standing-less", () => {
    expect(bearingAriaLabel({ activeSector: null, standing: null })).toBe(
      "Bearing: unoriented",
    );
    expect(bearingAriaLabel({ activeSector: "order" })).toBe("Bearing: oriented to Order");
  });

  it("title-cases sector/standing tokens", () => {
    expect(titleCase("intelligence")).toBe("Intelligence");
    expect(polar(0, 0, 10, 0)).toEqual({ x: 10, y: 0 }); // east is +x, sanity
  });
});

describe("zero raw colour literals — the instrument is role-driven end to end", () => {
  const source = readFileSync(
    join(process.cwd(), "components/representation/BearingInstrument.tsx"),
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
    expect(source).toContain("role(sectorRole(sector))");
  });
});

describe("atlas variant — Canonical Asset 001 (Bearing Instrument v1.0)", () => {
  it("names the Constitutional Trinity as the three primary octants", () => {
    expect([...ATLAS_TRINITY]).toEqual(["order", "reasoning", "action"]);
    // The trinity octants are a subset of the seven field sectors — same roles.
    for (const sector of ATLAS_TRINITY) expect(FIELD_SECTORS).toContain(sector);
  });

  it("flanks the needle with the Invariant Intelligence / Consequence Engineering poles", () => {
    expect(ATLAS_POLES.map((p) => p.sector)).toEqual(["intelligence", "consequence"]);
    expect(ATLAS_POLES.map((p) => p.side)).toEqual(["left", "right"]);
    // Poles are field sectors too — no invented vocabulary.
    for (const p of ATLAS_POLES) expect(FIELD_SECTORS).toContain(p.sector);
  });

  it("carries exactly six artefact modalities and five constitutional layers", () => {
    expect(ATLAS_ARTEFACTS.length).toBe(6);
    expect(ATLAS_LAYERS.length).toBe(5);
    expect(ATLAS_LAYERS[4]).toContain("STANDING RING");
  });

  it("derives the HDG heading from the sector's field-ring position (Reasoning ≡ due-north 360)", () => {
    expect(atlasHeadingDegrees("reasoning")).toBe(360);
    // Monotonic, in-range, and never fabricated when unoriented.
    for (const sector of FIELD_SECTORS) {
      const h = atlasHeadingDegrees(sector);
      expect(h).not.toBeNull();
      expect(h as number).toBeGreaterThan(0);
      expect(h as number).toBeLessThanOrEqual(360);
    }
    expect(atlasHeadingDegrees(null)).toBeNull();
    expect(atlasHeadingDegrees("nonsense" as FieldSector)).toBeNull();
  });

  it("renders the TRK register from the standing level, honest dash when absent", () => {
    for (const level of STANDING_LEVELS) {
      expect(atlasStandingShort(level)).toBe(level.slice(0, 5).toUpperCase());
    }
    expect(atlasStandingShort(null)).toBe("—");
  });

  it("keeps the compact variant the default — atlas is opt-in", () => {
    // The dispatcher renders CompactBearing unless variant === "atlas"; the
    // atlas anatomy never leaks into the default inline dial.
    expect(source).toContain('props.variant === "atlas" ? <AtlasBearing');
  });
});
