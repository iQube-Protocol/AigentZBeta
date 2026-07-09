/**
 * Deployment as a Constitutional Object — canary (CFS-016, Chrysalis Phase 3).
 *
 * Pins: the Deployment is a fully-faceted, tier-safe ConstitutionalObject; its
 * lifecycle transitions are legal-only (proposed→authorized→executed; skips and
 * backward jumps refused); provenance carries the CFS-016 receipt ids; and the
 * object can NEVER reach `executed` without an `authorized` predecessor. The
 * module RECORDS lifecycle/ownership — it executes nothing (asserted by the
 * absence of any deploy/receipt/network import in the source). Pure — drills in
 * node.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  findForbiddenObjectKey,
  isTierSafeObject,
  isLegalObjectTransition,
} from "@/types/constitutionalObject";
import {
  DEPLOYMENT_LIFECYCLE,
  AIGENT_Z_DEPLOYMENT_STEWARD_COMMITMENT,
  buildDeploymentObject,
  advanceDeployment,
  deploymentStateFor,
  type DeploymentObjectInput,
} from "@/services/constitutional/deploymentObject";

function proposedInput(): DeploymentObjectInput {
  return {
    deploymentId: "pack-2026-07-09-deploy-object",
    displayLabel: "Deployment object prep",
    packId: "pack-2026-07-09-deploy-object",
    commitRange: "abc1234..def5678",
    goal: "ship deployment-as-object",
    proposedReceiptId: "rcpt_proposed_001",
    constitutionalThresholdMet: false,
  };
}

function authorizedInput(): DeploymentObjectInput {
  return {
    ...proposedInput(),
    authorizedReceiptId: "rcpt_authorized_002",
    constitutionalThresholdMet: true,
  };
}

function executedInput(): DeploymentObjectInput {
  return {
    ...authorizedInput(),
    executedReceiptId: "rcpt_executed_003", // human-executed at D1; recorded only
  };
}

describe("the Deployment is a fully-faceted, tier-safe ConstitutionalObject", () => {
  it("carries all eight facets", () => {
    const o = buildDeploymentObject(authorizedInput());
    for (const facet of [
      "identity", "version", "standing", "authority", "ownership", "provenance", "lifecycle", "dependencies",
    ] as const) {
      expect(o[facet]).toBeDefined();
    }
    expect(o.identity.kind).toBe("deployment");
  });

  it("is T0-tier-safe — no forbidden identifier anywhere (findForbiddenObjectKey null)", () => {
    for (const input of [proposedInput(), authorizedInput(), executedInput()]) {
      const o = buildDeploymentObject(input);
      expect(findForbiddenObjectKey(o)).toBeNull();
      expect(isTierSafeObject(o)).toBe(true);
    }
  });

  it("owns via a steward COMMITMENT, never a personaId", () => {
    const o = buildDeploymentObject(authorizedInput());
    expect(o.ownership.ownerCommitment).toBe(AIGENT_Z_DEPLOYMENT_STEWARD_COMMITMENT);
    expect(o.ownership).not.toHaveProperty("personaId");
    // A 16-char hex commitment — one-way, deterministic.
    expect(o.ownership.ownerCommitment).toMatch(/^[0-9a-f]{16}$/);
  });

  it("reflects the consequence-test gate: ratification is always required", () => {
    const o = buildDeploymentObject(authorizedInput());
    expect(o.authority.ratificationRequired).toBe(true);
    expect(o.authority.governingInvariants).toContain("CFS-016");
    expect(o.payload).toMatchObject({ constitutionalThresholdMet: true });
  });
});

describe("provenance carries the CFS-016 receipt ids, in lifecycle order", () => {
  it("proposed carries the proposed receipt", () => {
    const o = buildDeploymentObject(proposedInput());
    expect(o.provenance.receiptIds).toEqual(["rcpt_proposed_001"]);
    expect(o.provenance.source).toBe("composed");
    expect(o.provenance.contentCommitment).toMatch(/^[0-9a-f]{16}$/);
  });

  it("authorized carries proposed + authorized receipts", () => {
    const o = buildDeploymentObject(authorizedInput());
    expect(o.provenance.receiptIds).toEqual(["rcpt_proposed_001", "rcpt_authorized_002"]);
  });

  it("executed carries all three receipts", () => {
    const o = buildDeploymentObject(executedInput());
    expect(o.provenance.receiptIds).toEqual([
      "rcpt_proposed_001",
      "rcpt_authorized_002",
      "rcpt_executed_003",
    ]);
  });
});

describe("lifecycle state is derived from which receipts exist", () => {
  it("maps receipts → state", () => {
    expect(deploymentStateFor(proposedInput())).toBe("proposed");
    expect(deploymentStateFor(authorizedInput())).toBe("authorized");
    expect(deploymentStateFor(executedInput())).toBe("executed");
  });

  it("the lifecycle order is proposed→authorized→executed", () => {
    expect([...DEPLOYMENT_LIFECYCLE]).toEqual(["proposed", "authorized", "executed"]);
  });
});

describe("advanceDeployment — legal-only, records but never executes", () => {
  it("allows a single forward step", () => {
    const proposed = buildDeploymentObject(proposedInput());
    const authorized = advanceDeployment(proposed, "authorized");
    expect(authorized.lifecycle.state).toBe("authorized");
    // Original is untouched (pure).
    expect(proposed.lifecycle.state).toBe("proposed");
  });

  it("allows re-entering the current state (idempotent re-record)", () => {
    const authorized = buildDeploymentObject(authorizedInput());
    expect(advanceDeployment(authorized, "authorized").lifecycle.state).toBe("authorized");
  });

  it("REFUSES the skip proposed→executed (no authorized predecessor)", () => {
    const proposed = buildDeploymentObject(proposedInput());
    expect(() => advanceDeployment(proposed, "executed")).toThrow(/illegal deployment transition/);
  });

  it("REFUSES a backward move executed→authorized", () => {
    const executed = buildDeploymentObject(executedInput());
    expect(() => advanceDeployment(executed, "authorized")).toThrow(/illegal deployment transition/);
  });

  it("the object cannot reach 'executed' without an 'authorized' predecessor", () => {
    // Structural guarantee via isLegalObjectTransition over the shared order.
    expect(isLegalObjectTransition(DEPLOYMENT_LIFECYCLE, "proposed", "executed")).toBe(false);
    expect(isLegalObjectTransition(DEPLOYMENT_LIFECYCLE, "authorized", "executed")).toBe(true);
    // And end-to-end: proposed→authorized→executed is the only legal path.
    const proposed = buildDeploymentObject(proposedInput());
    const authorized = advanceDeployment(proposed, "authorized");
    const executed = advanceDeployment(authorized, "executed");
    expect(executed.lifecycle.state).toBe("executed");
  });
});

describe("the module RECORDS — it never executes, deploys, or writes a receipt", () => {
  const source = readFileSync(
    join(__dirname, "../services/constitutional/deploymentObject.ts"),
    "utf8",
  );
  it("does no I/O — no receipt service, no dvn, no fs, no fetch, no child_process", () => {
    expect(source).not.toMatch(/activityReceiptService/);
    expect(source).not.toMatch(/from ['"].*dvn/);
    expect(source).not.toMatch(/from ['"]fs['"]/);
    expect(source).not.toMatch(/child_process/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    // crypto is the only permitted import (for T2-safe commitments).
  });
});
