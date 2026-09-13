# IRL Stewardship — Capability Wiring, Round 2

**Status:** 2 of 7 outstanding high-risk capabilities wired into real enforcement points. 2 more identified but deliberately NOT wired (would reverse an explicit prior operator ruling). 3 more identified but blocked on a scope-design decision.

**Follows on from:** `codexes/packs/agentiq/updates/2026-09-11_irl-stewardship-access-capability-handoff.md`, Outstanding Work item 2 ("Only the `run` capability is wired into a real enforcement point").

---

## What was wired this round

### `invariant_registry_mutate` → `POST /api/research/track2/[experimentId]/duplicate-pairs/merge/route.ts`

Merging two invariants (`mergeInvariants`, `services/invariants/lifecycle.ts`) mutates the registry — unions contexts/edges onto the survivor, marks the merged row `superseded`. No prior ruling excludes a non-admin role from this act, so it is wired with the identical pattern `run` already uses: platform admin keeps unconditional authority; a non-admin caller needs the resource-bound `invariant_registry_mutate` capability at `scopeType: 'experiment'`, `scopeRef: experimentId`.

### `protocol_ratify` → `POST /api/research/objects/route.ts`, `kind: 'protocol_draft'` only

This route handles 4 proposal kinds through one handler (`experiment_proposal`, `protocol_draft`, `finding`, `publication_draft`). Only `protocol_draft` (the `designed → protocol-ratified` transition) is `protocol_ratify` territory — the other three keep their existing unconditional admin gate, now checked immediately once `kind` is known (before, instead of after, since the gate previously ran before `kind` was even parsed).

The `protocol_ratify` check itself runs **after** `applyResearchProposal`'s pure computation resolves the real `objectId` (the experiment being ratified) — never trusted from the raw request body, matching the existing "server re-derives everything, client only supplies survivorId/mergedId-class inputs" discipline this route already follows elsewhere. `scopeType: 'experiment'`, `scopeRef: objectId`.

Both changes pass `npx tsc --noEmit` (no new errors) and their existing test coverage (`tests/track2-duplicate-pairs-merge-route.test.ts`, `tests/irl-stewardship-access-capability.test.ts`, `tests/irl-research-proposals.test.ts` — 53 tests, all passing).

---

## Deliberately NOT wired — would reverse an explicit prior ruling

### `freeze_unfreeze` → `POST /api/research/crystal/[experimentId]/freeze/route.ts`, `action: "freeze"`

The route's own header says, verbatim: *"Every Review-workspace role carries `mayFreeze: false` by construction... this route admits the platform steward only, and is NOT extended to the assigned-reviewer path the read-only readiness route admits."*

`resolveCapability`'s role-ceiling intersection (`HIGH_RISK_ROLE_CEILING.freeze_unfreeze: 'mayFreeze'`) only refuses a capability for a **research-lab-domain** grant — a capability granted under a different `access_domain` would bypass that ceiling entirely. Wiring `resolveCapability` here would therefore open a real, new delegation path this exact route's own comment says was deliberately closed. That is a policy decision, not a mechanical gap-closing — per CLAUDE.md's Security section ("NEVER remove, weaken, or bypass any access control gate without explicit written consent from an admin"), this needs the operator's explicit sign-off before it ships, not an agent's initiative.

### `crystal_groom` → `POST /api/research/crystal/[experimentId]/assign/route.ts` (real write, `dryRun: false`)

Same shape, same explicit comment: *"Corpus construction is steward work. The Review workspace's reviewer roles are deliberately NOT admitted here... admitting material to a governed boundary sits on the same side of that line as freezing it."* Same recommendation: needs an explicit operator decision, not a default extension.

**Question for the operator on both:** was Part 2's intent to make freeze/crystal-grooming delegable via the new capability system (superseding these two routes' existing "steward only, no exceptions" rulings), or should these two capabilities stay permanently un-delegable — i.e. `HIGH_RISK_CAPABILITIES` entries that exist for completeness/documentation but whose enforcement point is, and remains, "admin only, full stop," with `resolveCapability` never actually gating them anywhere?

---

## Blocked on a scope-design decision (not wireable without one)

### `canonize` → `POST /api/invariants/[id]/advance/route.ts`, `action: "canonize"`

Keyed by invariant `id`, not by any of the 6 existing `CAPABILITY_SCOPE_TYPES` (`programme`, `experiment`, `review_package`, `crystal_generation`, `run_family`, `artifact`). An invariant is not owned by exactly one experiment or one crystal generation — it can carry multiple `contexts` across domains. Wiring this cleanly needs either a new `invariant` scope type (schema change) or an explicit rule for which of an invariant's several contexts becomes "the" scope at canonize time. Not something to guess at.

### `ide_ingest` → `POST /api/invariants/discovery/route.ts`, `action: "add-evidence"`

Keyed by discovery `domain`/`subDomain` (e.g. `financial-services`), never by `experimentId` or any existing scope type. Discovery domains are shared across multiple experiments/programmes — no clean 1:1 mapping exists today. Same "needs a scope-design decision first" conclusion as `canonize`.

### `standing_admin` — no real enforcement point exists

Searched `services/journey/standingEvidenceProjection.ts` (read-only projection), `services/crm/standingAccrualService.ts` (system-driven accrual from ordinary activity, never a persona "administering" another's Standing), and the `/api/ops/journey/*` maintenance routes (gated by a `CRON_TRIGGER_TOKEN`, not a persona at all — `resolveCapability` cannot attach to a route with no persona in its auth path). Also: every research-lab role carries a literal `mayGrantStanding: false` type (`researchWorkspaceRoles.ts`), so the role-ceiling intersection would refuse this capability for any research-lab grant regardless of what a steward configures — this looks like an intentional, permanent "not delegable via research-lab roles" design, not a gap. **Conclusion: there is nothing to wire.** If Standing administration is meant to become a real, gateable act, a new route/service needs to be built first — this is a capability-scoping question for the operator, not an implementation task today.

---

## Current state of all 8 high-risk capabilities

| capability | status |
|---|---|
| `run` *(ordinary, not high-risk, wired for reference)* | wired (rehearsal + execution-rehearsal routes) |
| `invariant_registry_mutate` | wired (duplicate-pairs merge route) |
| `protocol_ratify` | wired (research/objects, `protocol_draft` only) |
| `freeze_unfreeze` | identified, NOT wired — pending operator decision (would reverse existing ruling) |
| `crystal_groom` | identified, NOT wired — pending operator decision (would reverse existing ruling) |
| `canonize` | blocked — needs a scope-design decision |
| `ide_ingest` | blocked — needs a scope-design decision |
| `standing_admin` | no real action exists to gate |
| `access_admin` | not investigated this round (handoff item 4 already documents it as an intentional two-tier design: capability-granting routes gate on domain steward authority, not on holding `access_admin` itself) |
