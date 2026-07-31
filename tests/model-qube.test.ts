/**
 * ModelQubes — the Phase 2 constitutional orchestration canary (CFS-015 Strand
 * One/Two). Pins that model routing is now object-model-driven, invariant-aware,
 * and provider-sovereign — WITHOUT changing which model runs (behaviour-
 * preserving: the seed registry mirrors the router's former DEFAULT_ROUTES).
 */

import { describe, it, expect } from "vitest";

import {
  resolveModelQubeRoute,
  describeModelQubeRoutes,
  CONSTITUTIONAL_MODEL_QUBES,
  MODEL_ROUTING_INVARIANTS,
} from "@/services/constitutional/modelQube";
import { findForbiddenObjectKey } from "@/types/constitutionalObject";
import { REASONING_STAGES } from "@/types/constitutional";

// The router's FORMER hardcoded table — the policy must reproduce it exactly.
const FORMER_DEFAULTS: Record<string, string> = {
  intent: "anthropic/claude-haiku-4-5-20251001",
  context: "anthropic/claude-haiku-4-5-20251001",
  capability: "openai/gpt-4o-mini",
  risk: "anthropic/claude-sonnet-4-6",
  value: "anthropic/claude-sonnet-4-6",
  price: "openai/gpt-4o-mini",
  consequence: "anthropic/claude-sonnet-4-6",
  validation: "anthropic/claude-sonnet-4-6",
};

describe("Phase 2 routing is behaviour-preserving — same model, new mechanism", () => {
  it("resolves every stage to its former default provider/model", () => {
    for (const stage of REASONING_STAGES) {
      const r = resolveModelQubeRoute(stage);
      expect(r).not.toBeNull();
      expect(`${r!.provider}/${r!.model}`).toBe(FORMER_DEFAULTS[stage]);
    }
  });

  it("is deterministic", () => {
    expect(JSON.stringify(describeModelQubeRoutes(REASONING_STAGES))).toBe(
      JSON.stringify(describeModelQubeRoutes(REASONING_STAGES)),
    );
  });
});

describe("routing is invariant-intelligent — the decision cites its governing invariants", () => {
  it("cites separate-reasoning-from-inference + the sovereignty bundle on every route", () => {
    expect(MODEL_ROUTING_INVARIANTS).toContain("inv.engineering.031");
    expect(MODEL_ROUTING_INVARIANTS).toContain("inv.sovereignty.100");
    expect(MODEL_ROUTING_INVARIANTS).toContain("inv.sovereignty.102");
    expect(MODEL_ROUTING_INVARIANTS).toContain("inv.constitutional.015");
    for (const stage of REASONING_STAGES) {
      const r = resolveModelQubeRoute(stage)!;
      for (const inv of MODEL_ROUTING_INVARIANTS) {
        expect(r.governingInvariants).toContain(inv);
      }
    }
  });
});

describe("routing is sovereign — reasoning survives loss of every frontier provider", () => {
  it("resolves to the open-weight floor for EVERY stage when frontier is unavailable", () => {
    for (const stage of REASONING_STAGES) {
      const r = resolveModelQubeRoute(stage, CONSTITUTIONAL_MODEL_QUBES, { frontierUnavailable: true });
      expect(r).not.toBeNull();
      expect(r!.provider).toBe("venice");
      expect(r!.model).toBe("llama-3.3-70b");
      expect(r!.sovereignFloor).toBe(true);
    }
  });

  it("prefers a fit frontier qube while available (the floor is the fallback, not the default)", () => {
    for (const stage of REASONING_STAGES) {
      expect(resolveModelQubeRoute(stage)!.sovereignFloor).toBe(false);
    }
  });
});

describe("ModelQubes are constitutional objects — tier-safe, fully-faceted", () => {
  it("carry the eight object facets and NO T0 identifier", () => {
    for (const q of CONSTITUTIONAL_MODEL_QUBES) {
      for (const facet of [
        "identity", "version", "standing", "authority", "ownership", "provenance", "lifecycle", "dependencies", "payload",
      ] as const) {
        expect((q as Record<string, unknown>)[facet]).toBeDefined();
      }
      expect(findForbiddenObjectKey(q)).toBeNull();
    }
  });

  it("carry exactly one open-weight sovereign floor", () => {
    const floors = CONSTITUTIONAL_MODEL_QUBES.filter((q) => q.payload.sovereignFloor);
    expect(floors.length).toBe(1);
    expect(floors[0].payload.tier).toBe("open-weight");
  });
});
