/**
 * researchWorkspaceRoles — WHAT each Research Workspace role may DO
 * (SPEC-IRL-WORKSPACE-001 §8, §9), as data.
 *
 * SEPARATE FROM `researchWorkspaceViews.ts` ON PURPOSE. That module decides what
 * RENDERS; this one decides what a role may DO once it is looking at it. The
 * two must never be folded together — `participationTabGate`'s header makes the
 * same point for the domain gate, and the reason is that a render decision fails
 * safe by hiding a control while an authority decision fails dangerous by
 * allowing an act.
 *
 * THE `false`s ARE TYPES, NOT VALUES. Every authority a role must never hold is
 * declared as the literal type `false`, so granting it is a COMPILE error rather
 * than a data edit that passes review. This copies `REVIEW_ROLE_AUTHORITY` in
 * `services/research/review/types.ts` verbatim in shape — the ratified precedent
 * for "a reviewer may not write to the corpus" being a type error rather than a
 * paragraph.
 *
 * WHAT IS NOT HERE. Nothing in this file grants anything. Workspace membership
 * confers no freeze, canonisation or publication authority at all (SPEC §9), so
 * the table's job is to say which of those a role is REFUSED, and to be read by
 * the surfaces and canaries that must not offer them.
 */

import type { ResearchWorkspaceRoleId } from './researchWorkspaceViews';

/**
 * The four powers SPEC §9 withholds from workspace membership entirely, plus
 * the three that distinguish the six roles from each other.
 *
 * `maySelfReviewConfirmatoryWork` is `false` on EVERY role including the
 * Principal Investigator — the spec names it as the PI's one explicit refusal
 * ("Cannot self-review confirmatory work"), and no other role has any claim to
 * it either, so a literal `false` on all seven is the honest encoding rather
 * than a PI-only special case.
 */
export interface ResearchRoleAuthority {
  role: ResearchWorkspaceRoleId;

  // ─── What distinguishes the roles ──────────────────────────────────────────
  /** Define experiments, submit artefacts, request freezes, initiate runs. */
  mayDefineExperiments: boolean;
  /** Administer access: issue and scope invitations within their own scope. */
  mayAdministerAccess: boolean;
  /** Submit a structured independent-review decision (IRL-REVIEW-001). */
  maySubmitReviewDecision: boolean;
  /** Edit the workspace's mutable Working Materials. */
  mayEditWorkingMaterials: boolean;
  /** Award an institutional GRADE. Distinct from Standing — see below. */
  mayAwardGrade: boolean;
  /** Earn attributable Standing from verified contributions. */
  mayEarnStanding: boolean;

  // ─── What workspace membership NEVER confers (SPEC §9) ─────────────────────
  /** Literal `false` on every role. "Workspaces … do not confer authority to
   *  freeze, canonise or publish." */
  mayFreeze: false;
  mayCanonize: false;
  mayPublish: false;
  /** Literal `false` on every role — SPEC §8, the PI's named refusal. */
  maySelfReviewConfirmatoryWork: false;
  /**
   * Literal `false` on every role. GRADING AND STANDING ARE NOT THE SAME ACT
   * (operator ruling, 2026-07-29): a grade is an institutional judgement,
   * Standing is a constitutional one. They may correlate; they must not
   * collapse. So NO role — not even the Faculty Lead who awards the grade —
   * may write Standing directly. Standing is reached only by a verified
   * contribution passing the V-10 admission gate
   * (`services/research/studentContribution.ts`), never by an act of authority.
   */
  mayGrantStanding: false;
  /** Literal `false` on every role — a reviewer, and everyone else, writes to
   *  their own decisions and never to the source assets under review. */
  mayEditSourceAssets: false;
}

const NEVER = {
  mayFreeze: false,
  mayCanonize: false,
  mayPublish: false,
  maySelfReviewConfirmatoryWork: false,
  mayGrantStanding: false,
  mayEditSourceAssets: false,
} as const;

export const RESEARCH_WORKSPACE_ROLE_AUTHORITY: Record<ResearchWorkspaceRoleId, ResearchRoleAuthority> = {
  // SPEC §8 — "defines experiments, submits artefacts, requests freezes,
  // initiates runs, proposes findings. Cannot self-review confirmatory work."
  // REQUESTS a freeze; `mayFreeze` stays false, because requesting and doing
  // are the distinction the whole boundary rests on.
  'principal-investigator': {
    role: 'principal-investigator',
    mayDefineExperiments: true,
    mayAdministerAccess: false,
    maySubmitReviewDecision: false,
    mayEditWorkingMaterials: true,
    mayAwardGrade: false,
    mayEarnStanding: true,
    ...NEVER,
  },
  // "administers access, verifies required artefacts, coordinates review.
  // Cannot canonise or publish unilaterally."
  'research-steward': {
    role: 'research-steward',
    mayDefineExperiments: false,
    mayAdministerAccess: true,
    maySubmitReviewDecision: false,
    mayEditWorkingMaterials: true,
    mayAwardGrade: false,
    mayEarnStanding: true,
    ...NEVER,
  },
  // "inspects assigned packages, comments, submits structured decisions, raises
  // objections. Cannot alter, freeze, canonise, grant Standing or publish."
  // `mayEditWorkingMaterials: false` is acceptance criterion 5's "cannot
  // mutate" in its navigable form, and matches the reviewer's exclusion from
  // the Working Materials view.
  reviewer: {
    role: 'reviewer',
    mayDefineExperiments: false,
    mayAdministerAccess: false,
    maySubmitReviewDecision: true,
    mayEditWorkingMaterials: false,
    mayAwardGrade: false,
    mayEarnStanding: true,
    ...NEVER,
  },
  // Institutional Observer — "views agreed materials and comments; changes
  // nothing." Every capability flag is false; commenting is QubeTalk, which is
  // deliberation and not a governed-state change (SPEC §9).
  'research-participant': {
    role: 'research-participant',
    mayDefineExperiments: false,
    mayAdministerAccess: false,
    maySubmitReviewDecision: false,
    mayEditWorkingMaterials: false,
    mayAwardGrade: false,
    mayEarnStanding: false,
    ...NEVER,
  },
  // "administers one capstone/cohort, approves participation, reviews
  // milestones." Their administrative authority is bounded to their own grant's
  // scope by `resolveInvitationAuthority` — server-side, from their own grants.
  'faculty-lead': {
    role: 'faculty-lead',
    mayDefineExperiments: false,
    mayAdministerAccess: true,
    maySubmitReviewDecision: true,
    mayEditWorkingMaterials: true,
    // The ONE role that grades — and still `mayGrantStanding: false`.
    mayAwardGrade: true,
    mayEarnStanding: false,
    ...NEVER,
  },
  // "works only in assigned projects, submits artefacts, receives attributable
  // contribution receipts."
  'student-researcher': {
    role: 'student-researcher',
    mayDefineExperiments: false,
    mayAdministerAccess: false,
    maySubmitReviewDecision: false,
    mayEditWorkingMaterials: true,
    mayAwardGrade: false,
    mayEarnStanding: true,
    ...NEVER,
  },
  // The pre-existing general research role. Full workspace participation, no
  // administrative or adjudicative authority.
  researcher: {
    role: 'researcher',
    mayDefineExperiments: false,
    mayAdministerAccess: false,
    maySubmitReviewDecision: false,
    mayEditWorkingMaterials: true,
    mayAwardGrade: false,
    mayEarnStanding: true,
    ...NEVER,
  },
};

/**
 * SPEC §8 procedural role names, mapped onto the substrate role ids. The spec
 * speaks in procedural language ("External Reviewer"); the access model speaks
 * in grant ids ('reviewer'). This table is the ONE place the two vocabularies
 * meet, so a canary can assert the spec's six roles all resolve rather than
 * trusting that they do.
 */
export const SPEC_ROLE_TO_SUBSTRATE: Record<string, ResearchWorkspaceRoleId> = {
  'Principal Investigator': 'principal-investigator',
  'Research Steward': 'research-steward',
  'External Reviewer': 'reviewer',
  'Institutional Observer': 'research-participant',
  'Faculty Lead': 'faculty-lead',
  'Student Researcher': 'student-researcher',
};
