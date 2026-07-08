/**
 * CCRL Dashboard adoption canary — Constitutional Representation System (CFS-021).
 *
 * The CCRL Dashboard is the FIRST adopted surface / reference environment for
 * the representation system (CFS-021 §3.1). The adoption pattern is:
 *   (a) ONE tab-level `<RepresentationProvider>` wraps the whole dashboard,
 *   (b) every colour/type flows through a ROLE via `var(--rep-*)` (or role()),
 *   (c) the interpretation switcher reskins the WHOLE surface coherently,
 *   (d) ZERO raw colour literals remain — enforced HERE.
 *
 * This canary greps the adopted file for raw Tailwind colour utilities and hex
 * literals and fails on any match. It is the mechanical guarantee that no
 * element on the reference surface hardcodes a look — the pattern every future
 * surface copies. Mirrors the canary discipline in tests/access-spine.test.ts
 * and tests/representation-system.test.ts.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ADOPTED_SURFACE = join(
  process.cwd(),
  "components/composer/CCRLDashboardTab.tsx",
);

// The zero-literals gate travels with every object mounted on the reference
// surface. The Bearing Instrument (CFS-021 §5) operates WITHIN this environment
// and MUST be equally role-driven — so it is held to the SAME canary here.
const ZERO_LITERAL_FILES: Array<[string, string]> = [
  ["CCRL Dashboard", ADOPTED_SURFACE],
  [
    "Bearing Instrument",
    join(process.cwd(), "components/representation/BearingInstrument.tsx"),
  ],
];

// Any Tailwind colour utility bound to a numbered palette shade — the exact
// thing the migration replaced with `var(--rep-*)`. Opacity suffixes (`/40`)
// are covered by the trailing match being anchored on the shade digit.
const RAW_TAILWIND_COLOR =
  /\b(text|bg|border|ring|from|via|to|fill|stroke|divide|outline|shadow)-(slate|gray|zinc|neutral|stone|emerald|green|sky|blue|indigo|violet|purple|cyan|teal|amber|yellow|orange|rose|red|pink|fuchsia|lime)-[0-9]/g;

// Arbitrary hex literals — `text-[#fff]`, `bg-[#0b0b0f]`, etc.
const RAW_HEX_LITERAL = /-\[#/g;

// A bare hex colour literal anywhere (the Bearing draws SVG from role() values,
// so it must carry NO `#rrggbb`/`#rgb` either — inline SVG can't hide behind a
// Tailwind class). Excludes the dashboard file, which legitimately references
// `var(--rep-*)` only. Applied to the whole ZERO_LITERAL_FILES set below.
const BARE_HEX = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g;

describe("Representation reference surface — zero raw colour literals (CFS-021)", () => {
  for (const [name, file] of ZERO_LITERAL_FILES) {
    const source = readFileSync(file, "utf8");

    it(`${name}: ZERO raw Tailwind colour utilities — every colour flows through a role`, () => {
      expect(source.match(RAW_TAILWIND_COLOR) ?? []).toEqual([]);
    });

    it(`${name}: ZERO arbitrary hex colour literals`, () => {
      expect(source.match(RAW_HEX_LITERAL) ?? []).toEqual([]);
    });

    it(`${name}: ZERO bare hex colour literals`, () => {
      expect(source.match(BARE_HEX) ?? []).toEqual([]);
    });
  }
});

describe("CCRL Dashboard — representation-system adoption canary (CFS-021)", () => {
  const source = readFileSync(ADOPTED_SURFACE, "utf8");

  it("consumes representation roles via the injected CSS variables", () => {
    // Proof the migration is present, not merely absent of literals.
    expect(source).toContain("var(--rep-surface-base)");
    expect(source).toContain("var(--rep-ink-body)");
    expect(source).toContain("var(--rep-border-subtle)");
  });

  it("wraps the whole dashboard in ONE tab-level RepresentationProvider", () => {
    expect(source).toContain("<RepresentationProvider className=");
    // Exactly one provider element at the tab root — no double-wrapping. Count
    // the JSX closing tag (unambiguous — prose mentions never carry one).
    const providerCloses = source.match(/<\/RepresentationProvider>/g) ?? [];
    expect(providerCloses.length).toBe(1);
  });

  it("mounts the Bearing Instrument oriented to the CCRL's home sector", () => {
    expect(source).toContain("<BearingInstrument");
    expect(source).toContain('activeSector="intelligence"');
    expect(source).toContain('standing="foundational"');
  });
});
