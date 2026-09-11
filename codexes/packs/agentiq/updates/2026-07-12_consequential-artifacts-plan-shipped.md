# Consequential-Artifacts Plan — all five increments shipped

**Date:** 2026-07-12
**Workstream:** Chrysalis Homecoming (CFS-023) × Artifact Runtime (CFS-025) × CPS (CFS-026)
**Operator directive:** "Yes. I'd like you to auto execute this whole plan only seeking my input where it's essential."

The plan turned the ratified Artifact Runtime from a research-pilot demo into the platform's
production path for constitutionally consequential artifacts — code, business artifacts, and
studio artifacts — with the Standing flywheel closing the loop back into delegate trust.

## The five increments

### 1. The Standing loop (flywheel)
Every successful non-disposable production accrues standing to the **producing delegate**
through the canonical `accrueStanding` service (delegated lane) — CVS 2 for operational,
5 for constitutional. The trust-band ceiling that standing buys (L2 ≥ 20 · L3 ≥ 50 ·
L4 ≥ 75 · L5 ≥ 100, `trustBandCeilingFor`) is surfaced per delegate on the Homecoming Test.
Files: `services/homecoming/delegateStanding.ts`, accrual wired in
`app/api/homecoming/agent/produce/route.ts` and the promote route; enrichment in
`app/api/constitutional/homecoming-test/route.ts`.

### 2. Studio publish seam
`POST /api/composition/publish` is the ROUTE layer the Composition engine's PUBLISH SEAM
anticipated (`composeArtifact` stays propose-only, untouched). Propose-mode persists the
composition as an **operational** artifact record; publish-mode (admin/spine-gated,
fail-closed on validation) mints **one** anchored `artifact_published` receipt, folds its id
into the returned provenance as a projection, and persists **constitutional**. T0 personaId
resolved only under the gate; the engine/record/response express the T2 `actorCommitment`;
`findForbiddenObjectKey` is the exit guard. Files: `app/api/composition/publish/route.ts`,
`services/artifact/compositionPublish.ts`, canary `tests/composition-publish.test.ts`.

### 3. Business / AgentMe artifact tiering
`classifyBusinessArtifact` (pure) wired **additively** into
`app/api/assistant/create-artifact/route.ts`: gmail drafts classify **disposable** and are
never persisted (their definition); doc/sheet/slides/calendar artifacts classify
**operational** and gain a durable metadata record (delegate `agentme`); unknown kinds
fail safe to disposable; **constitutional is structurally impossible** on this path —
promotion is the only door up. Files: `services/artifact/businessArtifactTiering.ts`,
canary `tests/business-artifact-tiering.test.ts`.

### 4. Software pilot (D1-safe)
`POST /api/artifact/produce-software` — code as a produced artifact. The CFS-015
Implementation Pack **is** the artifact body (`generateImplementationPack` composed, never
forked); the Artifact Runtime tiers it **operational** (no receipt at this tier — the
record is the durable output; constitutionality is earned by promotion). **D1 holds
absolutely**: the pilot executes, pushes, and deploys nothing; `proposeDeployment: true`
returns the documented pointer to `/api/constitutional/deployment-proposal` (the
route-inlined D1 ceremony) rather than forking its receipt logic. Files:
`app/api/artifact/produce-software/route.ts`, `services/artifact/pilots/softwarePilot.ts`,
canary `tests/software-pilot.test.ts`.

### 5. Promotion UX
`POST /api/artifact/records/promote` + Homecoming-workshop Promote chips lift a persisted
record operational → constitutional: `canPromote` enforces up-one-tier-only, the anchored
`artifact_published` receipt is written **before** the lift (no half-promotion), and the
producing delegate earns the constitutional CVS on promotion. Files:
`app/api/artifact/records/promote/route.ts`, `promoteArtifactRecord` in
`services/artifact/artifactRecordStore.ts`, chips in
`components/composer/HomecomingTestTab.tsx`.

## Held decision (essential operator input)

**Grant-gate semantics.** The delegation route still validates the **grantor's** reputation.
Options: (a) keep grantor-gated, (b) gate on the **delegate's earned standing** (the loop
above makes this meaningful), (c) require both. Not taken unilaterally — parked for the
operator.

## Verification discipline

Every agent-built increment was independently verified before commit: esbuild parse gates
with `@/` aliases bundled (missing named exports fail), signature checks against the real
`composeArtifact` / `runArtifact` / `generateImplementationPack`, D1 grep across the
software set (no execute/push/deploy code paths), stub-bundle node drills (24/24 software,
end-to-end studio seam), and line-by-line review of the additive create-artifact diff.
No protected file (DVN pipeline, spine, composeArtifact) was modified.
