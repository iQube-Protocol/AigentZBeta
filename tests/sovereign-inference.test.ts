/**
 * Sovereign inference entry point — canary (CFS-015 Phase 2, Strand One).
 *
 * Pins that `callSovereign` gives any task PURPOSE an invariant-aware, sovereign
 * route: every purpose maps to a real reasoning stage, and the mapped stage's
 * route is ModelQube-driven (source 'modelqube') and cites the governing model-
 * routing invariants. The enabling entry point — the migration off direct
 * provider calls routes through here.
 */

import { describe, it, expect } from "vitest";

import { PURPOSE_STAGE, routeFor, type InferencePurpose } from "@/services/constitutional/modelRouter";
import { REASONING_STAGES } from "@/types/constitutional";
import { MODEL_ROUTING_INVARIANTS } from "@/services/constitutional/modelQube";

const ALL_PURPOSES: InferencePurpose[] = [
  "extraction", "classification", "draft", "analysis", "reasoning", "validation",
];

describe("callSovereign — every purpose inherits an invariant-aware, sovereign route", () => {
  it("maps every inference purpose to a real reasoning stage", () => {
    for (const p of ALL_PURPOSES) {
      expect(PURPOSE_STAGE[p]).toBeDefined();
      expect(REASONING_STAGES).toContain(PURPOSE_STAGE[p]);
    }
    // The map covers exactly the declared purposes — no orphan / missing.
    expect(Object.keys(PURPOSE_STAGE).sort()).toEqual([...ALL_PURPOSES].sort());
  });

  it("routes each purpose's stage through the ModelQube policy, citing its invariants", () => {
    for (const p of ALL_PURPOSES) {
      const route = routeFor(PURPOSE_STAGE[p]);
      expect(route.source).toBe("modelqube");
      for (const inv of MODEL_ROUTING_INVARIANTS) {
        expect(route.governingInvariants).toContain(inv);
      }
    }
  });
});
