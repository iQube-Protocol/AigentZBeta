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

// Any Tailwind colour utility bound to a numbered palette shade — the exact
// thing the migration replaced with `var(--rep-*)`. Opacity suffixes (`/40`)
// are covered by the trailing match being anchored on the shade digit.
const RAW_TAILWIND_COLOR =
  /\b(text|bg|border|ring|from|via|to|fill|stroke|divide|outline|shadow)-(slate|gray|zinc|neutral|stone|emerald|green|sky|blue|indigo|violet|purple|cyan|teal|amber|yellow|orange|rose|red|pink|fuchsia|lime)-[0-9]/g;

// Arbitrary hex literals — `text-[#fff]`, `bg-[#0b0b0f]`, etc.
const RAW_HEX_LITERAL = /-\[#/g;

describe("CCRL Dashboard — representation-system adoption canary (CFS-021)", () => {
  const source = readFileSync(ADOPTED_SURFACE, "utf8");

  it("contains ZERO raw Tailwind colour utilities — every colour flows through var(--rep-*)", () => {
    const matches = source.match(RAW_TAILWIND_COLOR) ?? [];
    expect(matches).toEqual([]);
  });

  it("contains ZERO arbitrary hex colour literals", () => {
    const matches = source.match(RAW_HEX_LITERAL) ?? [];
    expect(matches).toEqual([]);
  });

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
});
