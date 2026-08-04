/**
 * Executive summary for the Independent Review package — Stage 10's
 * steward-review upgrade (operator direction, 2026-08-05: "Produce: Review
 * package prepared. Executive summary. Strengths. Weaknesses. Open
 * questions.").
 *
 * ── Why this lives OUTSIDE services/research/review/ ───────────────────────
 *
 * That directory is canaried to contain NO database access AND to build the
 * package the blinded reviewers actually receive
 * (services/research/review/reviewPackage.ts's own header: "the hash covers
 * everything the reviewer will see"). This module does neither — it never
 * touches the frozen `pkg`, only the ALREADY-BUILT `summary` object the
 * route already returns to the STEWARD, unredacted, before any reviewer is
 * involved (`corpusRowCount`, the Class-C block decision, reviewer
 * assignments — see app/api/research/review/route.ts's `summary` local).
 *
 * ── The blinding boundary this module MUST NEVER cross ─────────────────────
 *
 * `services/research/review/blinding.ts`'s `assertBlinded` forbids leaking
 * the DESIRED VERDICT (eligibility labels, "at least N must be eligible") —
 * because the package it guards is what BLINDED REVIEWERS see, and telling
 * them the wanted answer defeats the review's independence. This module's
 * output is the OPPOSITE audience: a note FOR THE STEWARD, about whether to
 * send the package at all, generated from data the steward already has.
 * **The caller MUST NEVER fold this module's output into `pkg`, `preview`,
 * or anything passed to `buildReviewRequest`/`runDualReview`** — doing so
 * would hand a blinded reviewer exactly the kind of pre-baked verdict
 * `assertBlinded` exists to keep out. This module has no way to enforce
 * that itself (it never sees `pkg`) — it is a discipline of the CALLER.
 */

import { callSovereign } from '@/services/constitutional/modelRouter';
import { extractJson } from '@/services/invariants/discoveryEngine';

/** Exactly the fields already returned to the steward, unredacted, by POST /api/research/review — never the sealed `pkg`/`preview`. */
export interface ReviewPackageSummaryInput {
  corpusRowCount: number;
  inBoundaryCount: number;
  outOfBoundaryCount: number;
  classC: {
    assessed: number;
    admitted: number;
    extracted: number;
    ruling: string;
  };
  individuallyEnumerated: number;
  mechanicallyFlaggedCount: number;
  reviewerCount: number;
}

export interface ReviewExecutiveSummary {
  strengths: string[];
  weaknesses: string[];
  openQuestions: string[];
}

export type SummarizeReviewPackageResult =
  | { ok: true; summary: ReviewExecutiveSummary }
  | { ok: false; error: string };

const MAX_ITEMS = 5;

function cleanList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((x) => x.trim())
    .slice(0, MAX_ITEMS);
}

export async function summarizeReviewPackage(input: ReviewPackageSummaryInput): Promise<SummarizeReviewPackageResult> {
  const system =
    'You are assisting a human steward who is about to send a package for independent review. You write a short ' +
    'executive summary of the PACKAGE PREPARATION ITSELF (corpus scope, coverage, admissibility ruling) — never a ' +
    'verdict on whether the underlying claims are true, and never a statement of what result the review should ' +
    'reach. Base every statement ONLY on the numbers given; do not invent findings.\n\n' +
    'Respond with ONLY a JSON object of this exact shape, no prose, no markdown fences:\n' +
    '{"strengths":["<up to 5 short sentences on what is solid about this package>"],' +
    '"weaknesses":["<up to 5 short sentences on what is thin, small, or worth reviewer attention>"],' +
    '"openQuestions":["<up to 5 short questions a steward should resolve before sending, if any>"]}';
  const user =
    `Corpus rows: ${input.corpusRowCount} total, ${input.inBoundaryCount} in boundary, ${input.outOfBoundaryCount} out of boundary.\n` +
    `Class C (general constitutional) block: ${input.classC.assessed} assessed, ${input.classC.admitted} admitted, ` +
    `${input.classC.extracted} extracted. Ruling: ${input.classC.ruling}\n` +
    `Individually enumerated (non-Class-C) subjects: ${input.individuallyEnumerated}\n` +
    `Mechanically flagged for extra scrutiny: ${input.mechanicallyFlaggedCount}\n` +
    `Reviewer pair size: ${input.reviewerCount}`;

  let raw: string;
  try {
    const call = await callSovereign('analysis', system, user, 900, 0);
    raw = call.text;
  } catch (e) {
    return { ok: false, error: `executive summary inference failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return { ok: false, error: 'the model did not return parseable JSON — no summary is safer than a guessed one' };
  }

  return {
    ok: true,
    summary: {
      strengths: cleanList(parsed.strengths),
      weaknesses: cleanList(parsed.weaknesses),
      openQuestions: cleanList(parsed.openQuestions),
    },
  };
}
