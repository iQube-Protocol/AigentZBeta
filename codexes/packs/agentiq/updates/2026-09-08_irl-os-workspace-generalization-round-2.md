# IRL OS Workspace — Generalization Round 2: Three Gaps Closed

**Date:** 2026-09-08
**Follows:** `RES-2026-09-08-IRL-OS-WORKSPACE-CONSOLIDATION-001` (Phase A — Workspace
consolidation: Locker moved into Workspace, entitlement-derived nav, role-projected capability
cards, security invariant across eight caller shapes).

Operator instruction (verbatim, abridged): *"The Workspace consolidation is substantially correct.
Close three remaining gaps before we treat the Austin/Ian projection as complete. Do not alter
scientific state or existing grants."* Three gaps, addressed here in order.

## Gap 1 — Generalize capability resolution beyond `experimentId`

**Problem.** `GET /api/participation/workspace-capabilities` gated every capability behind
`resolveExperimentReviewGrant`, which requires `ws.experimentId`. OCSGA (a programme/cohort
workspace with no `EXPERIMENT_REGISTRY` binding) resolved `experimentId: null` and therefore
**zero** capabilities, even for a caller who legitimately holds workspace membership — visibility
without substance, not the generalized projection the operator asked for.

**Fix — a two-tier gating model**, `app/api/participation/workspace-capabilities/route.ts`:

1. **PRIMARY gate — canonical workspace membership.** `getParticipantResearchWorkspaceAccess`
   (the same resolver `/api/participation/my-experiments` and the left rail use) decides whether
   the caller may read this workspace's capabilities AT ALL. `experimentId` plays no role here.
2. **EXPERIMENT-BOUND capabilities** (Reviewer Kit documents, Experimental Readiness, Review &
   Countersignature) — only when the workspace names a registered experiment AND the caller
   separately holds a `resolveExperimentReviewGrant` for it. Workspace membership is necessary but
   not sufficient — strictly more restrictive than the Phase A gate, never less.
3. **WORKSPACE-BOUND capabilities** (Reciprocal Artifact Exchange, PRD-IRL-AX-001) — keyed
   directly off the canonical `workspaceId` via the exchange's existing `parentExperimentId` tag
   and `listMyExchanges` (caller-scoped), with no `experimentId` binding required at all. This is
   what OCSGA actually qualifies for today.

`components/research/WorkspaceCapabilitiesPanel.tsx` renders a new "Reciprocal Artifact Exchange"
card (mounting the existing, already-generic `IRLExchangeTab`, given a `workspaceScopeId` prop)
whenever `exchangeAvailable` is true — composition, not a new viewer.

**No Ian-specific code anywhere in this path** — every check is keyed off `workspaceId`/
`experimentId`, resolved generically for whichever workspace the caller opens.

**Fixed in passing:** `GET /api/research/exchanges` returned the full `ReciprocalExchangeRecord`
including the T0 `initiatorPersonaId`/`counterpartyPersonaId`/`inviteCodeHash` fields, unlike its
sibling `getExchangeView` which already strips them. Since this exact handler was already being
extended (to accept `?parentExperimentId=` for workspace scoping), the response was also narrowed
to the six fields the client actually reads.

## Gap 2 — Remove Stage-0 ambiguity from the EXP-P1 reviewer package

**Mechanical trace.** The unresolved Stage-0/IRE-6 HOLD does not gate EXP-P1 — confirmed in the
prior session and left untouched here (the HOLD itself is not modified or cleared). But
`STAGE-0_HANDOFF.md` was still surfacing in Austin's five `documentResources` purely because it is
**path-colocated** inside `foundation/experiments/exp-p1-representation-runtime-gauntlet/` — the
same folder EXP-P1's own operative material lives in — and the resolver filtered by path prefix
alone.

**Fix.** `services/research/irlExperimentPathScope.ts` adds a named, documented
`HELD_NON_OPERATIVE_PATHS` set and `isHeldNonOperativeIrlPath()`. Both the general-purpose
`listIrlPackDocumentsForExperiment` (used by `/api/participation/workspace-capabilities`) and the
EXP-P1 agent package's `resolveExpP1DocumentResources`
(`app/api/journey/validation-programme/agent-package/route.ts`) now filter through this SAME shared
exclusion — one source, not two divergently-maintained lists.

**Result — the exact final document list** for an EXP-P1 reviewer package (Austin-equivalent),
confirmed by `tests/validation-programme-agent-package.test.ts`:

```
foundation/experiments/exp-p1-representation-runtime-gauntlet/README.md
```

(Down from the prior two-item list that included `STAGE-0_HANDOFF.md`.) The same exclusion is
proven for `/api/participation/workspace-capabilities`'s Reviewer Kit card, for both an admin
caller and a scoped non-admin reviewer, in
`tests/workspace-capabilities-authorization-2026-09-08.test.ts`.

If Stage-0 material is ever needed as reference, it remains reachable through its own package —
this fix only removes it from being presented as **operative EXP-P1** material. Nothing about the
HOLD's resolution status changed.

## Gap 3 — Canonize the Workspace navigation model

**Confirmed and now written down** (SPEC-IRL-WORKSPACE-001 §6A, added this round): left rail = the
entitlement-derived programme/experiment navigator ("My Experiments", built from
`getParticipantResearchWorkspaceAccess`/`GET /api/participation/my-experiments`); Workspace
submenu = the eight views of §7 (+ the Tier-0 Administration space) for the ONE selected workspace.
No redundant "Experiments" submenu was added to restate the left rail's own concept — the left
rail already is the navigator; a second submenu entry duplicating it would repeat the Companion
Menu System's own MS-1 ("one navigation") defect shape in a different surface.

This was not new work — it was already the shipped shape from Phase A — so gap 3 closes by
**confirming and documenting** the existing, already-tested architecture rather than changing code:

- Both cartridges (`irl-cartridge`, `irl-os-cartridge`) build their Workspace tab through the SAME
  `buildResearchWorkspaceTab` call — `tests/research-lab-workspace.test.ts` already asserts this
  is called exactly twice, once per cartridge, never a hand-copied second tab object.
- The left rail is empty for zero-entitlement (no admin, no grant, no public workspace) and
  updates immediately on grant or revocation — already proven by
  `tests/irl-experiment-membership-workspace.test.ts`'s full `getParticipantResearchWorkspaceAccess`
  suite (anonymous → public-only, admin → all, Ian-shaped grant → OCSGA only, Austin-shaped grant →
  EXP-P1 + Validation only, and the explicit revocation case: "removes every private workspace from
  the projection immediately").
- A pre-existing, disabled `Experiments` tab elsewhere in the platform (the admin-only "run the
  Foundational Series live" surface, unrelated to this consolidation) is a different capability —
  not a second workspace navigator — and was not touched.

## Verification

- `tests/workspace-capabilities-authorization-2026-09-08.test.ts` — 20/20 (extended with the
  workspace-BOUND exchange generalization, cross-workspace non-leak, independent experiment-bound
  vs. workspace-bound resolution, and the Stage-0 exclusion for both admin and scoped reviewer).
- `tests/validation-programme-agent-package.test.ts` — 13/13 (the Stage-0 exclusion assertion
  replaces the prior assertion that had encoded the bug as expected behaviour).
- `tests/validation-programme-agent-package-completeness.test.ts` — 19/19 (structural canary
  updated to match the new composed filter, `isExpP1Path(p) && !isHeldNonOperativeIrlPath(p)`).
- `tests/research-lab-workspace.test.ts` — 48/48 (unchanged; the two-call-sites-only navigation
  invariant already passes).
- `tests/irl-experiment-membership-workspace.test.ts` — 16/16 (unchanged; already proves the
  dynamic left-rail properties gap 3 required).

Live re-verification with fresh disposable personas for both acceptance cases, and the final
capability map, follow in a subsequent report per the operator's stop condition.
