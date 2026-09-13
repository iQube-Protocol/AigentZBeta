# IRL OS Workspace — Information-Architecture Correction

**Status:** Shipped. Removes the duplicative EXP-P1 "mega-page" the prior pass created and gives
each canonical state/artifact one primary Workspace home, per the operator's governing principle:
**one canonical state/artifact → one primary Workspace home → lightweight status/reference
elsewhere.**

## What was wrong

The prior pass (`2026-09-12_irl-os-workspace-austin-exp-p1-reviewer-dossier.md`) added Instrument
Validation, Track 2 state, and Crystal + Independent Review to `WorkspaceCapabilitiesPanel`, mounted
entirely under the **Overview** surface. This solved visibility but:
- duplicated Experimental Readiness (already in Review, straight from the canonical
  `selectedWorkspaceState` resolver) and Reviewer Kit/Countersignature (same);
- nested IRV-001/IPV-001 (prerequisite Validation Programme v1 evidence) under EXP-P1, where they
  are not children;
- had no Crystal-generation-currency check — the shared `IndependentReviewPanel`/`CrystalPanel`
  component (used by every mount, Laboratory included) had hardcoded "Crystal vP1" headings
  regardless of which generation was actually frozen — a real, pre-existing, now-fixed bug.

## Component/artifact → canonical source → primary home → secondary reference

| Component/artifact | Canonical source | Primary Workspace home | Secondary reference |
|---|---|---|---|
| Protocol, apparatus, frozen-substrate summary, runs, readiness, receipts | `resolveExperimentDossier` (`services/research/experimentDossier.ts`) | **Experiments** (`ExperimentDossierPanel`, unchanged — already correct) | Overview's compact Crystal-generation line |
| Pipeline stage/evidence | `resolveExperimentLifecycleState` / `deriveCompletedTemplateStages` (`services/research/experimentLifecycleState.ts`) | **Pipeline** (`PipelinePanel`, unchanged — already correct; fixed to derive Concept/Protocol/Freeze/Run/Adjudication/Interpretation/Publication/Replication, not just Review/Preregistration/Task Construction) | — |
| Crystal readiness/statistics/freeze-recommendation, Independent Review, Observer Review decision | `GET /api/research/crystal/[experimentId]`, `GET/POST /api/research/observer-review/[experimentId]` | **Review** (`CrystalObserverReviewPanel`, moved here from Overview, replacing the prior full `ExpP1ReadinessTab` mount) | Overview's compact frozen/next-governed-action line |
| Reviewer Kit documents, countersignature | `selectedWorkspaceState` (`liveState`) | **Review** (unchanged — already correct, was never duplicative on its own) | — |
| IRV-001/IPV-001 published evidence | `GET /api/experiments/results` | **Experiments tab of the `irl-validation-programme-vp1` workspace** (new; siblings of EXP-P1 within VP1, never nested under it) | EXP-P1 Overview's "Instrument validation: complete" pointer |
| Track 2 programme state | `loadTrack2ProgrammeState` | **No Workspace home yet** — the Laboratory's Track 2 Programme has no corresponding workspace entity in the research-workspace registry. `Track2StateSummary.tsx` (built last pass) is left in place, unwired, pending that registry addition — named here rather than mis-homed under EXP-P1 again. | — |
| Reciprocal Artifact Exchange | `listMyExchanges`/`listExchangesByParentExperiment` | **Overview** (unchanged, OCSGA-scoped, untouched by this pass — not implicated in the duplication complaint) | — |
| Capability badge, Crystal generation/frozen, next governed action | `GET /api/participation/workspace-capabilities` (trimmed) | **Overview**, one compact card | — |

## Left-tree hierarchy

Unchanged (already correct): `services/research/researchWorkspace.ts`'s `RESEARCH_WORKSPACES`
registry already models `irl-validation-programme-vp1` (Validation Programme v1, `seriesId: 'VP1'`)
and `autonomi-independent-review-programme` (with its three `parentId`-nested experiment children)
as real, separate workspace entities in the `autonomi` `navSection`. IRV-001/IPV-001 have no
workspace entities of their own (they're EXPERIMENT_REGISTRY members with an open, credential-free
results route, not access-grant-scoped resources) — so they render as *content within* Validation
Programme v1's Experiments tab, not as separate left-tree rows. This matches the operator's
instruction ("they are NOT children of EXP-P1") without inventing workspace rows a genuine
access-grant model doesn't need.

## Pipeline evidence/status derivation (the real bug fixed)

`deriveCompletedTemplateStages` (`services/research/experimentLifecycleState.ts`) previously derived
completion for **only** `Review` / `Preregistration` / `Task Construction` — `Concept`, `Protocol`,
`Freeze`, `Run`, `Adjudication`, `Interpretation`, `Publication`, `Replication` were never derivable
at all, regardless of real persisted evidence. Fixed to also derive:
- `Concept`/`Protocol` complete when `isFrozen` or any `protocolPresent` evidence exists (freezing
  presupposes both already happened).
- `Freeze` complete when `isFrozen`.
- `Run`/`Adjudication`/`Interpretation`+`Publication`/`Replication` complete as the published-run
  floor lifecycle (`types/research.ts`'s `EXPERIMENT_LIFECYCLE`) advances past `running`/`evaluated`/
  `published`/`replicated` respectively.

This is a **deliberate, operator-authorized widening** of a 2026-09-11 canary
(`tests/derive-completed-template-stages-2026-09-11.test.ts`), not a silent regression — every new
signal is still real, persisted evidence, and `Review` still requires actual observer acceptance
(nothing here lets a later stage's completion imply an earlier one lacking its own evidence). The
test file was updated in place to assert the new, correct behavior, with the change explained in its
own header.

## Duplicated projections removed

- `ExpP1ReadinessTab` full mount removed from both Overview (`WorkspaceCapabilitiesPanel`) and Review
  (replaced with `CrystalObserverReviewPanel`) — Readiness now renders exactly once, in Experiments'
  `ExperimentDossierPanel`.
- Reviewer Kit documents and Review & Countersignature removed from `WorkspaceCapabilitiesPanel`
  (Overview) — they were always a second copy of Review's own `liveState`-driven rendering.
- Instrument Validation removed from EXP-P1's Overview, moved to Validation Programme v1's own
  Experiments tab.
- Track 2 state summary removed from Overview entirely (no correct home exists yet — see table
  above).

## Current Crystal generation resolution (real bug fixed)

`components/composer/IndependentReviewPanel.tsx`'s shared `CrystalPanel` (used by every mount of
this component, Laboratory included) hardcoded the heading **"Crystal vP1"** regardless of which
generation was actually frozen — stale since EXP-P1 advanced to its `crystal-vP2` internal-pilot
freeze. Fixed to read the real generation from the same `GET /api/research/crystal/[experimentId]`
response already fetched (`frozenArtifact.id`, matched against `/\/crystal-vP(\d+)$/`), falling back
to the generation-neutral "Crystal" when unfrozen or not yet loaded — never a hardcoded or guessed
number. The tab-switcher's own static label (rendered before any fetch) was also changed from
"Crystal vP1" to "Crystal" for the same reason.

## Review-vs-run capability test results

Unchanged from the prior pass's verification (still holds): Austin's real grant carries exactly one
capability row (`review` @ `experiment:EXP-P1`); no `run`/`write`/high-risk row exists anywhere for
it. `CrystalObserverReviewPanel`'s only mutating action (`POST /api/research/observer-review/
[experimentId]/decision`) is Austin's own self-service review decision — a `review`-tier action, not
a `run` one — already gated by the Independent Reviewer Agreement, not by `resolveCapability`. No
run/rerun/groom/freeze control is reachable from any surface this pass touched.

## MCP/machine-readable parity

Unchanged from the prior pass: `GET /api/participation/workspace-capabilities` remains a plain
authenticated JSON endpoint serving both human UI and any programmatic/agent caller identically — no
second MCP-specific authorization path exists or was built. The trimmed response (capability badge +
crystal status only) is a strict subset of the prior one; nothing that was machine-readable before is
now hidden from a machine caller — it is simply also no longer duplicated for a human one.

## Commit / deployment state

See the commit this update doc ships with. Full test run: 69/69 passing across the six directly
touched test files; the four pre-existing, unrelated failures found while running the broader IRL OS
suite (`irl-os-containment.test.ts`, `horizen-evidence-chain.test.ts`,
`lab-tab-restructure-and-locker-ux.test.ts`, `partner-workspace.test.ts`) were confirmed via
`git stash` to fail identically without this pass's changes — not a regression introduced here.
