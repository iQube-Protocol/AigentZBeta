/**
 * The record-level governed remedy (operator ruling, 2026-08-02):
 *
 *   > "The contested records need to be clickable to see their detail. This can
 *   > be in a popup modal for review. IN the internal version this modal should
 *   > allow remedy acceptance."
 *
 * Two halves, and the dangerous one is the second. Inspection is additive and
 * fails visibly. A remedy is a governed act that changes what the review says
 * about a subject, so the properties that matter are what it REFUSES:
 *
 *   1. A remedy may only ratify a label a reviewer actually returned. Anything
 *      else is a new finding with no reviewer behind it — strictly worse than
 *      the averaging this capability already forbids, because an average is at
 *      least derived from the evidence.
 *   2. It may only touch a row that is actually in dispute. Re-deciding a
 *      settled row overwrites a reviewer's finding with the steward's.
 *   3. It is unavailable to an external reviewer — enforced by the gate, not by
 *      the client hiding a form.
 *   4. A remedied row's status is derived from the SAME eligibility set an
 *      agreed row uses, so "eligible when both reviewers said it, ineligible
 *      when the steward ratified it" cannot happen.
 *
 * The pure rule is exercised directly; the route and client are checked by
 * source authority, matching this repo's convention for `node`-environment
 * suites with no rendering harness.
 */

import { describe, it, expect } from "vitest";

import { resolveContestedRecord } from "@/services/research/review/adjudication";
import { ReviewRefusal, type ReviewResolution } from "@/services/research/review/types";
import { deriveQueueState } from "@/services/research/independentReviewStore";
import { readSource, stripComments } from "./_lib/sourceAuthority";

const ROUTE = "app/api/research/review/[reviewId]/resolution/route.ts";
const DETAIL_ROUTE = "app/api/research/review/[reviewId]/route.ts";
const PANEL = "components/composer/IndependentReviewPanel.tsx";

const contestedRow = (over: Partial<ReviewResolution> = {}): ReviewResolution => ({
  reviewId: "review.vP1.deadbeef",
  subjectRef: "inv.reasoning.324",
  status: "contested",
  reviewer1Decision: "independent",
  reviewer2Decision: "target-derived",
  resolutionReason: "reviewers disagreed — excluded pending governed resolution",
  resolvedAt: "2026-08-01T00:00:00.000Z",
  ...over,
});

const remedy = {
  remedy: "adopt" as const,
  reason: "R2 cited the task construction date, which postdates the row",
  resolvedByRef: "ref_abc123",
  resolvedAt: "2026-08-02T12:00:00.000Z",
};

describe("resolveContestedRecord — a remedy ratifies, it does not invent", () => {
  it("refuses a label neither reviewer returned, and names both labels that were", () => {
    expect(() =>
      resolveContestedRecord(contestedRow(), { ...remedy, operatorDecision: "outcome-informed" }),
    ).toThrowError(ReviewRefusal);
    try {
      resolveContestedRecord(contestedRow(), { ...remedy, operatorDecision: "outcome-informed" });
    } catch (e) {
      const r = e as ReviewRefusal;
      expect(r.refusalCode).toBe("unsupported-operator-label");
      expect(r.message).toContain("independent");
      expect(r.message).toContain("target-derived");
    }
  });

  it("refuses a remedy on a row that is not contested", () => {
    for (const status of ["agreed", "rejected", "unknown", "accepted", "deferred"] as const) {
      try {
        resolveContestedRecord(contestedRow({ status }), { ...remedy, operatorDecision: "independent" });
        throw new Error(`expected a refusal for status '${status}'`);
      } catch (e) {
        expect((e as ReviewRefusal).refusalCode).toBe("record-not-contested");
      }
    }
  });

  it("refuses an unreasoned remedy and an unattributed one", () => {
    try {
      resolveContestedRecord(contestedRow(), { ...remedy, operatorDecision: "independent", reason: "   " });
    } catch (e) {
      expect((e as ReviewRefusal).refusalCode).toBe("unreasoned-record-resolution");
    }
    try {
      resolveContestedRecord(contestedRow(), { ...remedy, operatorDecision: "independent", resolvedByRef: "" });
    } catch (e) {
      expect((e as ReviewRefusal).refusalCode).toBe("unattributed-record-resolution");
    }
  });

  it("ratifying an eligible label lands on 'accepted'; an ineligible one on 'rejected'", () => {
    const accepted = resolveContestedRecord(contestedRow(), { ...remedy, operatorDecision: "independent" });
    expect(accepted.status).toBe("accepted");
    expect(accepted.operatorDecision).toBe("independent");

    const rejected = resolveContestedRecord(contestedRow(), { ...remedy, operatorDecision: "target-derived" });
    expect(rejected.status).toBe("rejected");
    expect(rejected.operatorDecision).toBe("target-derived");
  });

  it("carries the attribution and the reason into the record, and preserves both reviewers verbatim", () => {
    const out = resolveContestedRecord(contestedRow(), { ...remedy, operatorDecision: "independent" });
    expect(out.resolutionReason).toContain("ref_abc123");
    expect(out.resolutionReason).toContain("R2 cited the task construction date");
    expect(out.resolvedAt).toBe("2026-08-02T12:00:00.000Z");
    // The dispute is not erased by resolving it.
    expect(out.reviewer1Decision).toBe("independent");
    expect(out.reviewer2Decision).toBe("target-derived");
  });

  it("defers without ratifying a label, and without erasing which labels were in contention", () => {
    const out = resolveContestedRecord(contestedRow(), {
      ...remedy,
      remedy: "defer",
      reason: "needs the steward's judgement on the boundary rule",
    });
    expect(out.status).toBe("deferred");
    expect(out.operatorDecision).toBeUndefined();
    expect(out.reviewer1Decision).toBe("independent");
    expect(out.reviewer2Decision).toBe("target-derived");
    expect(out.resolutionReason).toContain("deferred by ref_abc123");
  });

  it("a missing second pass leaves only R1's label ratifiable", () => {
    const row = contestedRow({ reviewer2Decision: undefined });
    expect(resolveContestedRecord(row, { ...remedy, operatorDecision: "independent" }).status).toBe("accepted");
    try {
      resolveContestedRecord(row, { ...remedy, operatorDecision: "target-derived" });
      throw new Error("expected a refusal");
    } catch (e) {
      expect((e as ReviewRefusal).refusalCode).toBe("unsupported-operator-label");
    }
  });

  it("does not mutate the row it is given", () => {
    const row = contestedRow();
    resolveContestedRecord(row, { ...remedy, operatorDecision: "independent" });
    expect(row.status).toBe("contested");
    expect(row.operatorDecision).toBeUndefined();
  });
});

describe("the remedy route is internal-only and derives what it must not assert", () => {
  it("gates on requireReviewAccess, never the read gate a reviewer grant satisfies", () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).toContain("requireReviewAccess(req)");
    expect(
      src,
      "requireReviewReadAccess admits an external reviewer — using it here would hand a reviewer the steward's act",
    ).not.toContain("requireReviewReadAccess");
  });

  it("refuses a superseded review, the same as the review-level action does", () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).toContain("record.supersededBy");
    expect(src).toContain("REVIEW_SUPERSEDED");
  });

  it("delegates the rule to the adjudication service rather than deciding the status inline", () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).toContain("resolveContestedRecord(");
    expect(
      src,
      "an inline eligibility list here would drift from the one resolveDecisions uses for agreed rows",
    ).not.toMatch(/'independent'\s*[,|]/);
  });

  it("derives the queue state from the remaining contested count instead of hardcoding it", () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).toContain("deriveQueueState(contestedRemaining)");
    expect(src, "the derivation must not be hand-copied a fourth time").not.toMatch(
      /contested\w*\s*>\s*0\s*\?\s*'contested'/,
    );
    // And the shared derivation is the one every writer uses.
    expect(deriveQueueState(0)).toBe("completed");
    expect(deriveQueueState(1)).toBe("contested");
  });

  it("states in data that it writes nothing beyond the review record", () => {
    const src = stripComments(readSource(ROUTE));
    for (const claim of ["corpusWritten: false", "standingGranted: false", "lifecycleChanged: false", "assetFrozen: false"]) {
      expect(src).toContain(claim);
    }
    for (const forbidden of ["listInvariants", "upsertInvariant", "grantStanding", "freeze"]) {
      expect(src, `the remedy route must not import or call ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("only 'adopt' and 'defer' are accepted as remedies", () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).toMatch(/body\.remedy === 'adopt' \|\| body\.remedy === 'defer'/);
  });
});

describe("the detail route carries enough evidence to adjudicate a contested row", () => {
  it("attaches each reviewer's full decision to the contested row itself, not as a parallel array", () => {
    const src = stripComments(readSource(DETAIL_ROUTE));
    expect(src).toContain("r1Decisions.map");
    expect(src).toContain("r2Decisions.map");
    // Attached per row — a sibling array could be paired wrongly by the client.
    expect(src).toMatch(/r1:\s*r1By\.get\(r\.subjectRef\)\s*\?\?\s*null/);
    expect(src).toMatch(/r2:\s*r2By\.get\(r\.subjectRef\)\s*\?\?\s*null/);
  });

  it("uses the service's tally so remedied rows stay counted", () => {
    const src = stripComments(readSource(DETAIL_ROUTE));
    expect(src).toContain("tallyResolutions(record.resolutions");
    expect(
      src,
      "the hand-counted tally omitted 'accepted' and 'deferred' — a remedied row would vanish from every count",
    ).not.toMatch(/agreed:\s*record\.resolutions\.filter/);
  });
});

describe("the panel offers inspection to everyone and remedy only internally", () => {
  it("contested rows are buttons that open the record, not inert text", () => {
    const src = stripComments(readSource(PANEL));
    const listAt = src.indexOf("contested.map(");
    expect(listAt).toBeGreaterThan(-1);
    const block = src.slice(listAt, listAt + 800);
    expect(block).toContain("setOpenRecord(c)");
  });

  it("the remedy form is withheld in reviewer mode and on a superseded review", () => {
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/canRemedy=\{!reviewerMode && !isSuperseded\}/);
    // …and the modal renders the read-only notice instead of the form.
    expect(src).toContain("Resolving a contested row is the Research Steward");
  });

  it("the label choices are derived from the row, never a hardcoded rubric list", () => {
    const src = stripComments(readSource(PANEL));
    const labelsAt = src.indexOf("const labels = useMemo(");
    expect(labelsAt).toBeGreaterThan(-1);
    const block = src.slice(labelsAt, labelsAt + 500);
    expect(block).toContain("record.reviewer1Decision");
    expect(block).toContain("record.reviewer2Decision");
    expect(block, "offering a rubric label nobody in this dispute returned invites a refusal").not.toContain(
      "outcome-informed",
    );
  });

  it("a missing decision renders as absent, never as a blank agreement", () => {
    const src = stripComments(readSource(PANEL));
    expect(src).toContain("No decision was returned for this subject.");
  });

  it("the modal reaches the route through personaFetch, like every other call in this file", () => {
    const src = stripComments(readSource(PANEL));
    const callAt = src.indexOf("/resolution`");
    expect(callAt).toBeGreaterThan(-1);
    expect(src.slice(Math.max(0, callAt - 300), callAt)).toContain("personaFetch");
  });

  it("a refused remedy surfaces the server's own words and code, not a generic failure", () => {
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/setRefusal\(\{\s*code:\s*d\?\.refusalCode,\s*message:\s*d\?\.error/);
  });
});
