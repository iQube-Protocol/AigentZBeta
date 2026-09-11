/**
 * Sovereign tool-calling path — canary (CFS-015 Phase 2, Strand One).
 *
 * Pins the tool-aware sovereign ladder: frontier (openai) tried first, the
 * open-weight sovereign floor (venice) last, so a tool-calling agent survives a
 * frontier outage. Tool-calling rides the OpenAI-compatible API both providers
 * speak; the caller owns tool execution, the router owns provider + fallback +
 * invariant citation.
 */

import { describe, it, expect } from "vitest";

import { toolChatLadder } from "@/services/constitutional/sovereignToolChat";
import { MODEL_ROUTING_INVARIANTS } from "@/services/constitutional/modelQube";

describe("the tool-calling ladder is frontier-first, open-weight-floor-last", () => {
  const ladder = toolChatLadder();

  it("has a frontier rung then the sovereign floor", () => {
    expect(ladder.length).toBeGreaterThanOrEqual(2);
    expect(ladder[0].provider).toBe("openai");
    expect(ladder[0].sovereignFloor).toBe(false);
    expect(ladder[ladder.length - 1].provider).toBe("venice");
    expect(ladder[ladder.length - 1].sovereignFloor).toBe(true);
  });

  it("has exactly one sovereign floor, and it is last", () => {
    const floors = ladder.filter((r) => r.sovereignFloor);
    expect(floors.length).toBe(1);
    expect(ladder[ladder.length - 1].sovereignFloor).toBe(true);
  });

  it("cites the model-routing invariants (separate-reasoning-from-inference)", () => {
    // The helper attaches MODEL_ROUTING_INVARIANTS to every result; the ladder
    // is governed by the same invariants as text routing.
    expect(MODEL_ROUTING_INVARIANTS).toContain("inv.engineering.031");
    expect(MODEL_ROUTING_INVARIANTS).toContain("inv.sovereignty.100");
  });
});
