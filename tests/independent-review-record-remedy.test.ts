/**
 * The record-level governed RESOLUTION (operator ruling, 2026-08-02):
 *
 *   > "The contested records need to be clickable to see their detail. This can
 *   > be in a popup modal for review. IN the internal version this modal should
 *   > allow remedy acceptance."
 *
 * Two halves, and the dangerous one is the second. Inspection is additive and
 * fails visibly. A resolution is a governed act that changes what the review
 * says about a subject, so the properties that matter are what it REFUSES:
 *
 *   1. It may only ADOPT an assessment a reviewer actually submitted. Anything
 *      else is a new finding with no reviewer behind it — strictly worse than
 *      the averaging this capability already forbids, because an average is at
 *      least derived from the evidence.
 *   2. It may only touch a row that is actually in dispute. Re-deciding a
 *      settled row overwrites a reviewer's finding with the steward's.
 *   3. It is unavailable to an external reviewer — enforced by the gate, not by
 *      the client hiding a form.
 *   4. A resolved row's status is derived from the SAME eligibility set an
 *      agreed row uses, so "eligible when both reviewers said it, ineligible
 *      when the steward adopted it" cannot happen.
 *   5. It does NOT ratify. See the vocabulary canary at the foot of this file.
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

describe("resolveContestedRecord — a resolution adopts a submitted assessment, it does not invent one", () => {
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

  it("adopting an eligible label lands on 'accepted'; an ineligible one on 'rejected'", () => {
    const accepted = resolveContestedRecord(contestedRow(), { ...remedy, operatorDecision: "independent" });
    expect(accepted.status).toBe("accepted");
    expect(accepted.operatorDecision).toBe("independent");

    const rejected = resolveContestedRecord(contestedRow(), { ...remedy, operatorDecision: "target-derived" });
    expect(rejected.status).toBe("rejected");
    expect(rejected.operatorDecision).toBe("target-derived");
  });

  it("carries the attribution and the reason into the record, and preserves both reviewers verbatim", () => {
    const out = resolveContestedRecord(contestedRow(), { ...remedy, operatorDecision: "independent" });
    // "adopted", never "ratified" — see the vocabulary canary below.
    expect(out.resolutionReason).toContain("adopted by ref_abc123");
    expect(out.resolutionReason).not.toContain("ratified");
    expect(out.resolutionReason).toContain("R2 cited the task construction date");
    expect(out.resolvedAt).toBe("2026-08-02T12:00:00.000Z");
    // The dispute is not erased by resolving it.
    expect(out.reviewer1Decision).toBe("independent");
    expect(out.reviewer2Decision).toBe("target-derived");
  });

  it("defers without adopting a label, and without erasing which labels were in contention", () => {
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

  it("a missing second pass leaves only R1's label adoptable", () => {
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
    // (The copy wraps across lines in the JSX, so match a contiguous fragment.)
    expect(src).toContain("disagreement between assessments is the Research Steward");
  });

  it("each option names WHOSE assessment it adopts, derived from the row and never a rubric list", () => {
    const src = stripComments(readSource(PANEL));
    // Anchor on the declaration, not on the call punctuation — an explicit type
    // argument (`useMemo<Array<…>>(`) is a correctness improvement and must not
    // break the canary that guards WHAT the options contain.
    const optionsAt = src.indexOf("const options = useMemo");
    expect(optionsAt).toBeGreaterThan(-1);
    const block = src.slice(optionsAt, optionsAt + 700);
    expect(block).toContain("record.reviewer1Decision");
    expect(block).toContain("record.reviewer2Decision");
    // A resolution is a choice between two parties' submitted positions; a
    // button reading only "independent" hides which reviewer said it.
    expect(block).toContain("Reviewer 1");
    expect(block).toContain("Reviewer 2");
    expect(block, "offering a rubric label nobody in this dispute returned invites a refusal").not.toContain(
      "outcome-informed",
    );
    // The surface must not CLAIM which reviewer is internal and which
    // external — it does not know, and blinding means it cannot.
    expect(src.slice(optionsAt, optionsAt + 700)).not.toMatch(/\bIRL\b|\bExternal Review\b/);
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

  it("a refused resolution surfaces the server's own words and code, not a status code", () => {
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/setRefusal\(\{\s*code:\s*d\?\.refusalCode,\s*message:\s*explainFailedRequest\(/);
  });

  /**
   * A STATUS CODE IS NOT AN EXPLANATION (operator report, 2026-08-02:
   * "Crystal freezing page is giving HTTP 200 error").
   *
   * `d?.error ?? \`HTTP ${res.status}\`` printed the transport code whenever a
   * body carried no reason — and for a 200 that is not just unhelpful but
   * FALSE: 200 means the request succeeded, so it cannot be why anything
   * failed. Worse, it sent the reader hunting a transport fault when the real
   * situation was "something other than this endpoint answered".
   */
  it("no surface in this panel prints a bare HTTP status as the reason for a failure", () => {
    const src = stripComments(readSource(PANEL));
    const bad = src.match(/\?\?\s*`HTTP \$\{res\.status\}`/g) ?? [];
    expect(bad, "a status code is evidence about a failure, never its explanation").toHaveLength(0);
  });

  it("the explainer separates a server refusal, a transport failure, and an unrecognised body", () => {
    const src = stripComments(readSource(PANEL));
    const at = src.indexOf("function explainFailedRequest");
    expect(at).toBeGreaterThan(-1);
    const fn = src.slice(at, at + 900);
    // 1. the server's own words win outright
    expect(fn).toMatch(/typeof b\?\.error === "string"[\s\S]{0,60}return b\.error/);
    // 2. a non-2xx is the one case where the status IS the fact
    expect(fn).toContain("if (!res.ok)");
    // 3. a 2xx with no result field is named as such — never as a refusal
    expect(fn).toContain("did not understand");
    expect(fn).toContain("This is not a refusal");
  });
});

/**
 * ── RESOLVE ≠ RATIFY (operator ruling via Al, 2026-08-02) ──────────────────
 *
 * The first cut of this feature called the steward's act "ratify". Al caught
 * it, and the objection is constitutional rather than stylistic:
 *
 *   > "'ratify' has a constitutional meaning in your platform … Then the word
 *   > Ratify is reserved for the constitutional act that happens after review
 *   > resolution."
 *
 * Three acts, three authorities, three verbs:
 *
 *     reviewer                  REVIEWS   — submits a signed assessment
 *     independent-review-steward RESOLVES — adopts one of the submitted ones
 *     constitutional authority  RATIFIES  — freezes the resulting crystal
 *
 * Spending "ratify" on the middle act leaves the third with no word, and makes
 * settling a review queue read like admitting an invariant to the corpus. The
 * ladder lives in `services/research/crystalLifecycle.ts`; these canaries stop
 * the word leaking back into the review layer.
 *
 * A NOTE ON WHO THE TWO REVIEWERS ARE: `blinding.ts` strips current
 * eligibility labels and prior decisions before a package is sealed, so BOTH
 * reviewers are blinded and neither is "the platform's own position". The
 * surface therefore names them by SLOT, and must never assert which is
 * internal and which external — it does not know.
 */
describe("resolve ≠ ratify — the constitutional verb is reserved", () => {
  const LIFECYCLE = "services/research/crystalLifecycle.ts";
  const ADJUDICATION = "services/research/review/adjudication.ts";

  it("the ladder puts resolution strictly before readiness, and readiness before freeze", async () => {
    const { CRYSTAL_LIFECYCLE, lifecycleIndex } = await import("@/services/research/crystalLifecycle");
    expect(lifecycleIndex("review-resolved")).toBeLessThan(lifecycleIndex("ready-for-freeze"));
    expect(lifecycleIndex("ready-for-freeze")).toBeLessThan(lifecycleIndex("frozen"));
    expect(lifecycleIndex("frozen")).toBeLessThan(lifecycleIndex("canonical"));
    // Exactly one step names the constitutional act, and it is the freeze.
    const ratifying = CRYSTAL_LIFECYCLE.filter((s) => s.act.includes("ratify"));
    expect(ratifying).toHaveLength(1);
    expect(ratifying[0].stage).toBe("ready-for-freeze");
    expect(ratifying[0].authority).toBe("constitutional-authority");
  });

  it("the steward resolves and the constitutional authority ratifies — never the same role", async () => {
    const { CRYSTAL_LIFECYCLE } = await import("@/services/research/crystalLifecycle");
    const resolveStep = CRYSTAL_LIFECYCLE.find((s) => s.act === "resolve");
    expect(resolveStep?.authority).toBe("independent-review-steward");
    // …and the review-layer authority table agrees: the steward may resolve
    // the contested queue and may NOT approve a freeze.
    const { REVIEW_ROLE_AUTHORITY } = await import("@/services/research/review/types");
    expect(REVIEW_ROLE_AUTHORITY["independent-review-steward"].mayResolveContested).toBe(true);
    expect(REVIEW_ROLE_AUTHORITY["independent-review-steward"].mayApproveFreeze).toBe(false);
    expect(REVIEW_ROLE_AUTHORITY.reviewer.mayResolveContested).toBe(false);
  });

  it("'ratify' is not in the review layer's own vocabulary", async () => {
    const { REVIEW_LAYER_VERBS, CONSTITUTIONAL_RATIFICATION_VERB } = await import(
      "@/services/research/crystalLifecycle"
    );
    expect(REVIEW_LAYER_VERBS).not.toContain("ratify");
    expect(REVIEW_LAYER_VERBS).toContain("resolve");
    expect(REVIEW_LAYER_VERBS).toContain("adopt");
    expect(CONSTITUTIONAL_RATIFICATION_VERB).toBe("ratify");
  });

  it("the RESOLUTION act writes no ratification wording — scoped to that act, not to the file", () => {
    // Scope matters, and getting it wrong the first time proved the point: a
    // whole-file grep flagged two CORRECT uses — the operator-ratified default
    // reviewer pair, and `ratifiedAt` on the freeze call, which is the one act
    // the word belongs to. The rule is about the resolution ACT, so the check
    // is too. Comments may DISCUSS the reservation; the act may not enact it.
    const adjudication = stripComments(readSource(ADJUDICATION));
    const fnAt = adjudication.indexOf("export function resolveContestedRecord");
    expect(fnAt).toBeGreaterThan(-1);
    const fn = adjudication.slice(fnAt);
    const fnStrings = fn.match(/["'\`][^"'\`]*[Rr]atif[^"'\`]*["'\`]/g) ?? [];
    expect(fnStrings, `resolveContestedRecord emits: ${fnStrings.join(" | ")}`).toHaveLength(0);

    // The whole resolution route is in scope — it does nothing else.
    const route = stripComments(readSource(ROUTE));
    const routeStrings = route.match(/["'\`][^"'\`]*[Rr]atif[^"'\`]*["'\`]/g) ?? [];
    expect(routeStrings, `the resolution route emits: ${routeStrings.join(" | ")}`).toHaveLength(0);

    // In the panel, only the contested-record modal is in scope.
    const panel = stripComments(readSource(PANEL));
    const modalAt = panel.indexOf("function ContestedRecordModal");
    expect(modalAt).toBeGreaterThan(-1);
    const modal = panel.slice(modalAt);
    // The modal MAY say the word while explaining what it is NOT doing; what
    // it must not do is label its own control with it.
    expect(modal, "the adopt button must not be labelled a ratification").not.toMatch(/Ratify \{/);
    expect(modal).toContain("Adopt an assessment");
    expect(modal).toContain("Resolve this disagreement");
  });

  it("the lifecycle module states what resolution does NOT do", () => {
    const src = stripComments(readSource(LIFECYCLE));
    expect(src).toContain("grants no Standing");
    expect(src).toContain("makes nothing canonical");
  });

  it("the resolution route reports where the candidate now sits, and never claims freeze-readiness", () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).toContain("lifecycleStage:");
    expect(src).toContain("reviewResolutionComplete(contestedRemaining)");
    // A settled review is 'review-resolved' — one rung BELOW ready-for-freeze.
    expect(src).toContain("'review-resolved'");
    expect(src).toContain("readyForFreeze: false");
    expect(src, "the review layer must never assert readiness").not.toContain("ready-for-freeze");
  });
});
