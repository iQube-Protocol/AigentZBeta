/**
 * Apex sovereignty seam — canary (CFS-015, sovereignty apex).
 *
 * Pins the THREE-tier sovereignty ladder: frontier (openai) → open-weight API
 * (venice) → self-hosted apex (our own decentralised node). The seam is a STUB —
 * inert until a node is configured — so this canary proves BOTH states:
 *   - Today (no node): the ladder terminates at the open-weight API floor
 *     (venice), unchanged.
 *   - When an apex node is configured: it is APPENDED as the terminal rung and
 *     TAKES the sovereign floor from venice (venice stays a rung, no longer the
 *     floor) — there is always exactly one floor, and it is the most-sovereign
 *     configured tier.
 */

import { describe, it, expect, afterEach } from "vitest";

import { toolChatLadder } from "@/services/constitutional/sovereignToolChat";
import {
  sovereignNodeConfig,
  sovereignNodeConfigured,
  SOVEREIGN_NODE_ENV,
} from "@/services/constitutional/sovereignNode";

function clearNodeEnv() {
  delete process.env[SOVEREIGN_NODE_ENV.baseUrl];
  delete process.env[SOVEREIGN_NODE_ENV.model];
  delete process.env[SOVEREIGN_NODE_ENV.apiKey];
}

describe("apex sovereignty seam is inert until a node is configured", () => {
  afterEach(clearNodeEnv);

  it("today: no node — ladder terminates at the open-weight API floor (venice)", () => {
    clearNodeEnv();
    expect(sovereignNodeConfigured()).toBe(false);
    expect(sovereignNodeConfig()).toBeNull();

    const ladder = toolChatLadder();
    expect(ladder).toHaveLength(2);
    expect(ladder[0].provider).toBe("openai");
    expect(ladder[0].tier).toBe("frontier");
    expect(ladder[0].sovereignFloor).toBe(false);
    const last = ladder[ladder.length - 1];
    expect(last.provider).toBe("venice");
    expect(last.tier).toBe("open-weight");
    expect(last.sovereignFloor).toBe(true);
    expect(ladder.filter((r) => r.sovereignFloor)).toHaveLength(1);
  });

  it("apex node configured: self-hosted rung is appended and takes the floor", () => {
    process.env[SOVEREIGN_NODE_ENV.baseUrl] = "https://node.iqube.example/v1/";
    process.env[SOVEREIGN_NODE_ENV.model] = "llama-3.3-70b";

    expect(sovereignNodeConfigured()).toBe(true);
    // Trailing slash trimmed so `${base}/chat/completions` is well-formed.
    expect(sovereignNodeConfig()?.baseUrl).toBe("https://node.iqube.example/v1");
    expect(sovereignNodeConfig()?.tier).toBe("self-hosted");

    const ladder = toolChatLadder();
    expect(ladder).toHaveLength(3);
    const apex = ladder[ladder.length - 1];
    expect(apex.provider).toBe("sovereign_node");
    expect(apex.tier).toBe("self-hosted");
    expect(apex.sovereignFloor).toBe(true);
    // Self-hosted servers are commonly keyless — the rung must not be skipped
    // for want of a key.
    expect(apex.keyOptional).toBe(true);
    // venice yields the floor to the more-sovereign apex rung.
    expect(ladder.find((r) => r.provider === "venice")?.sovereignFloor).toBe(false);
    // Still exactly one floor — the most-sovereign configured tier.
    expect(ladder.filter((r) => r.sovereignFloor)).toHaveLength(1);
  });
});
