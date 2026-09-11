/**
 * Research Registry access gate — canary for the CFS-051 widening
 * (operator answered "both": CAS research-lab grant AND token gate, 2026-07-25).
 *
 * Pins four things:
 *   1. The PURE decision core (`decideRegistryAccess`) — the full 2^3 truth
 *      table. Admin keeps every capability; a caller with none of the three
 *      signals gets nothing; the CAS and token paths EACH independently grant
 *      read+propose and NEITHER grants curate.
 *   2. The token-credential validator fails closed on anything that is not the
 *      access spine's own `token:<chain>:<contract>[:<tokenId>]` grammar.
 *   3. The route maps each action to exactly one capability, so `create` is
 *      propose-gated while edit / transition-status / add-review stay curate-
 *      gated — and `create` cannot smuggle a status past the curate gate.
 *   4. STRUCTURAL: the CRUD store (registryStore.ts) contains NO gate logic of
 *      its own. The whole point of the swappable-gate design is that widening
 *      touches one module; a store that learned about admin/grants/tokens would
 *      be a second, drifting gate (CLAUDE.md "Extend, Don't Duplicate").
 *
 * The pure core is imported directly (no I/O, no mocks needed). The I/O shell
 * (`resolveRegistryAccess`) is deliberately NOT exercised here — it composes
 * `getGrantedExperiments` and `resolveExternalCredential`, both of which are
 * covered by their own suites; duplicating them would re-test other modules.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";

import {
  decideRegistryAccess,
  isTokenCredential,
  REGISTRY_TOKEN_CREDENTIAL_ENV,
  type RegistryAccessSignals,
} from "@/services/research/registryAccess";

const NONE: RegistryAccessSignals = {
  isPlatformAdmin: false,
  hasResearchLabGrant: false,
  holdsGateToken: false,
};

const REPO = join(__dirname, "..");
const STORE_SRC = readFileSync(join(REPO, "services/research/registryStore.ts"), "utf8");
const ROUTE_SRC = readFileSync(join(REPO, "app/api/research/registry/route.ts"), "utf8");
const GATE_SRC = readFileSync(join(REPO, "services/research/registryAccess.ts"), "utf8");

describe("decideRegistryAccess — the admin path is never weakened", () => {
  it("grants read + propose + curate to a platform admin", () => {
    const d = decideRegistryAccess({ ...NONE, isPlatformAdmin: true });
    expect(d.canRead).toBe(true);
    expect(d.canPropose).toBe(true);
    expect(d.canCurate).toBe(true);
    expect(d.via).toContain("platform-admin");
  });

  it("still grants an admin everything when the widened signals are absent", () => {
    // The pre-widening world: isAdmin only. Behaviour must be byte-identical.
    const d = decideRegistryAccess({
      isPlatformAdmin: true,
      hasResearchLabGrant: false,
      holdsGateToken: false,
    });
    expect([d.canRead, d.canPropose, d.canCurate]).toEqual([true, true, true]);
  });

  it("grants an admin everything regardless of the other two signals (all 4 combos)", () => {
    for (const hasResearchLabGrant of [false, true]) {
      for (const holdsGateToken of [false, true]) {
        const d = decideRegistryAccess({ isPlatformAdmin: true, hasResearchLabGrant, holdsGateToken });
        expect([d.canRead, d.canPropose, d.canCurate]).toEqual([true, true, true]);
      }
    }
  });
});

describe("decideRegistryAccess — a caller with none of the three passes nothing", () => {
  it("denies read, propose AND curate", () => {
    const d = decideRegistryAccess(NONE);
    expect(d.canRead).toBe(false);
    expect(d.canPropose).toBe(false);
    expect(d.canCurate).toBe(false);
    expect(d.via).toEqual([]);
  });
});

describe("decideRegistryAccess — each widened path grants propose and NOT curate", () => {
  it("CAS research-lab grant alone: read + propose, never curate", () => {
    const d = decideRegistryAccess({ ...NONE, hasResearchLabGrant: true });
    expect(d.canRead).toBe(true);
    expect(d.canPropose).toBe(true);
    expect(d.canCurate).toBe(false); // curation is the operator-withheld capability
    expect(d.via).toEqual(["cas-research-lab-grant"]);
  });

  it("token holding alone: read + propose, never curate", () => {
    const d = decideRegistryAccess({ ...NONE, holdsGateToken: true });
    expect(d.canRead).toBe(true);
    expect(d.canPropose).toBe(true);
    expect(d.canCurate).toBe(false);
    expect(d.via).toEqual(["token-holding"]);
  });

  it("both widened paths together still never confer curate", () => {
    const d = decideRegistryAccess({ ...NONE, hasResearchLabGrant: true, holdsGateToken: true });
    expect(d.canPropose).toBe(true);
    expect(d.canCurate).toBe(false);
    expect(d.via).toEqual(["cas-research-lab-grant", "token-holding"]);
  });

  it("the paths are OR'd — each is INDEPENDENTLY sufficient for propose", () => {
    expect(decideRegistryAccess({ ...NONE, isPlatformAdmin: true }).canPropose).toBe(true);
    expect(decideRegistryAccess({ ...NONE, hasResearchLabGrant: true }).canPropose).toBe(true);
    expect(decideRegistryAccess({ ...NONE, holdsGateToken: true }).canPropose).toBe(true);
  });

  it("curate is true if and only if isPlatformAdmin (full 2^3 truth table)", () => {
    for (const isPlatformAdmin of [false, true]) {
      for (const hasResearchLabGrant of [false, true]) {
        for (const holdsGateToken of [false, true]) {
          const d = decideRegistryAccess({ isPlatformAdmin, hasResearchLabGrant, holdsGateToken });
          expect(d.canCurate).toBe(isPlatformAdmin);
          const anySignal = isPlatformAdmin || hasResearchLabGrant || holdsGateToken;
          expect(d.canRead).toBe(anySignal);
          expect(d.canPropose).toBe(anySignal);
        }
      }
    }
  });
});

describe("token gate — fails closed, invents nothing", () => {
  it("rejects unset / empty / non-token values", () => {
    for (const v of [undefined, null, "", "   ", "admin", "cohort:irl-reviewers", "0xabc"]) {
      expect(isTokenCredential(v as string | undefined)).toBe(false);
    }
  });

  it("rejects a malformed token credential (missing contract)", () => {
    expect(isTokenCredential("token:")).toBe(false);
    expect(isTokenCredential("token:base")).toBe(false);
  });

  it("accepts the spine's ERC-721 and ERC-1155 credential grammar", () => {
    expect(isTokenCredential("token:base:0x1234567890abcdef1234567890abcdef12345678")).toBe(true);
    expect(isTokenCredential("token:ethereum:0x1234567890abcdef1234567890abcdef12345678:7")).toBe(true);
  });

  it("hardcodes NO contract address — the operator names the token via env", () => {
    expect(REGISTRY_TOKEN_CREDENTIAL_ENV).toBe("RESEARCH_REGISTRY_TOKEN_CREDENTIAL");
    // No 40-hex EVM address literal may appear in the gate module.
    expect(GATE_SRC).not.toMatch(/0x[0-9a-fA-F]{40}/);
  });
});

describe("composition — no parallel grant or token system was built", () => {
  it("composes the CAS grant reader instead of querying access_grants itself", () => {
    expect(GATE_SRC).toContain("getGrantedExperiments");
    expect(GATE_SRC).toContain("@/services/passport/participationAccess");
    // A second grant system would mean touching the grant tables directly.
    expect(GATE_SRC).not.toContain("access_grants");
    expect(GATE_SRC).not.toContain("access_invitations");
  });

  it("composes the access spine's token credential resolver, not a new chain read", () => {
    expect(GATE_SRC).toContain("resolveExternalCredential");
    expect(GATE_SRC).toContain("@/services/access/policyResolvers");
    // The ERC balance helpers belong to the spine — the gate may NAME them in
    // its docs, but must never import or re-implement them.
    expect(GATE_SRC).not.toContain("@/services/access/tokenOwnership");
    expect(GATE_SRC).not.toContain("@/services/identity/personaAddressResolver");
    // No JSON-RPC of its own: the gate never talks to a chain directly.
    expect(GATE_SRC).not.toContain("eth_call");
    expect(GATE_SRC).not.toContain("fetch(");
  });
});

describe("STRUCTURAL — the store layer holds no gate logic of its own", () => {
  it("registryStore.ts never imports or references the access gate", () => {
    expect(STORE_SRC).not.toContain("registryAccess");
    expect(STORE_SRC).not.toContain("canManageRegistry");
    expect(STORE_SRC).not.toContain("canProposeToRegistry");
    expect(STORE_SRC).not.toContain("resolveRegistryAccess");
  });

  it("registryStore.ts never reads admin flags, grants, or token holdings", () => {
    for (const forbidden of [
      "cartridgeFlags",
      "isAdmin",
      "getGrantedExperiments",
      "access_grants",
      "resolveExternalCredential",
      "getActivePersona",
    ]) {
      expect(STORE_SRC).not.toContain(forbidden);
    }
  });

  it("the store takes a personaId only to derive the T2-safe reviewerRef", () => {
    // personaPublicRef is the sanctioned use; a raw personaId column would not be.
    expect(STORE_SRC).toContain("personaPublicRef");
    expect(STORE_SRC).not.toContain("persona_id");
  });
});

describe("route — action→capability mapping and the create-status guard", () => {
  it("maps create to propose and every mutating curation action to curate", () => {
    expect(ROUTE_SRC).toMatch(/'create':\s*'propose'/);
    expect(ROUTE_SRC).toMatch(/'edit':\s*'curate'/);
    expect(ROUTE_SRC).toMatch(/'transition-status':\s*'curate'/);
    expect(ROUTE_SRC).toMatch(/'add-review':\s*'curate'/);
  });

  it("resolves access through the gate module only — no inline isAdmin check", () => {
    expect(ROUTE_SRC).toContain("resolveRegistryAccess");
    expect(ROUTE_SRC).not.toContain("cartridgeFlags");
  });

  it("drops a client-supplied create status unless the caller may curate", () => {
    // The gate-bypass guard: without it a propose-only caller could create a row
    // already at 'published'/'promoted'/'ratified'/'canonized'.
    expect(ROUTE_SRC).toMatch(/g\.access\.canCurate && typeof f\.status === 'string'/);
    // and no create branch may pass the raw field through any more.
    expect(ROUTE_SRC).not.toContain("status: typeof fields.status === 'string'");
  });

  it("never returns a raw persona identifier alongside the capabilities (T0/T1)", () => {
    expect(ROUTE_SRC).not.toMatch(/personaId:\s*g\.persona\.personaId/);
    expect(ROUTE_SRC).not.toContain("authProfileId");
  });
});
