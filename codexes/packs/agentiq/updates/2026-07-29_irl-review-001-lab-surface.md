# IRL-REVIEW-001 §12 — the Independent Review Lab surface

**Date:** 2026-07-29
**Capability:** `IRL-REVIEW-001` — Independent Review
**Spec:** `codexes/packs/irl/foundation/SPEC-IRL-REVIEW-001_independent-review-capability.md` §12
**Builds on:** `codexes/packs/agentiq/updates/2026-07-29_irl-review-001-phase-1-adjudication-workflow.md`
**Status:** built, canary-covered. No live review has been run — the operator triggers that.

---

## 1. The surface

**Where it lives:** metaMe IRL cartridge → Laboratory → **Experiments** → Validation Programme →
**Independent Review** (`components/composer/InvariantExperimentLab.tsx`, tab id
`independent-review`).

Inside the experiments navigator, not beside it. The review is preparation *for* the experiment, so
the person preparing one should not have to leave it to adjudicate its inputs.

Three views and no more, exactly as SPEC §12 allows — this is deliberately not a review-management
product:

| View | What it does |
|---|---|
| **New Review** | Choose reviewers (model or human per slot), freeze + hash the package, **preview the redacted package**, then run. |
| **Review Queue** | planned · running · completed · **contested — awaiting resolution** · resolved. |
| **Review Result** | Agreement tally, contested items with both labels verbatim, stated limitations, requested/resolved model ids, hashes, and the four governed resolutions. |

| Concern | Where |
|---|---|
| UI | `components/composer/IndependentReviewPanel.tsx` |
| Access gate (shared by all routes) | `app/api/research/review/_lib/gate.ts` |
| Server-side reviewer resolution + family guard | `app/api/research/review/_lib/resolveSelection.ts` |
| Model catalogue endpoint | `app/api/research/review/models/route.ts` |
| Queue + New Review | `app/api/research/review/route.ts` |
| Review Result + governed resolution | `app/api/research/review/[reviewId]/route.ts` |
| Persistence (reuses `research_objects`) | `services/research/independentReviewStore.ts` |
| Corpus → frozen package (shared with the CLI) | `services/research/independentReviewPlan.ts` |
| Canaries (33) | `tests/independent-review-lab-surface.test.ts` |

**No new primitives.** Persistence reuses `research_objects` with `object_kind: 'review'` — the same
table the PRD-EPI-001 artifact rows already ride in. The gate reuses the resolution
`/api/research/lifecycle` and `/api/research/objects` already use. The package construction is the
*same function* the CLI runner calls (`buildReviewPlan`), so the preview a human approves and the
package a shell dispatches cannot drift.

---

## 2. The server-side family guard

**The dropdown is a courtesy. The refusal is the control.**

```
client  →  { reviewers: { R1: { modelId }, R2: { modelId } } }
server  →  GET provider catalogue
        →  derive family per id (parseCatalogueEntry — same derivation as the CLI)
        →  assertReviewerIndependence(r1, r2)   ← the one decision
        →  409 { refusalCode: 'shared-model-family', … }
```

Three properties, each canaried:

1. **A client cannot assert a family.** `ReviewerSlotSelection` carries `modelId` and, for a human
   slot, `humanReviewerRef`. There is no family field, so the lie is unrepresentable rather than
   merely ignored. A selection object smuggling `modelFamily` is dropped by the resolver's typing,
   and the assignment's family still comes from the catalogue (canary S1b).
2. **One decision function.** `assertReviewerIndependence` — the same one the CLI runner uses, with
   the same refusals: identical requested ids, aliases resolving to one model, shared family,
   unresolved id, unknown lineage. The route does not reimplement any of it (canaried: no
   `modelFamily ===` comparison exists in the route).
3. **The UI's disabled set is derived from the server's metadata.**
   `GET /api/research/review/models` returns `{ id, family, familyEvidence, offline,
   deprecationDate, selectable, unselectableReason }` per model. The panel's `familyOf()` reads that
   response and `optionsFor()` disables any option whose `family` equals the other slot's. **There
   is no model list in the client file** — canaried by asserting neither pinned model id nor any
   family string appears in the panel source. So the dropdown and the refusal cannot disagree, and
   nobody ends up "fixing" the mismatch on the wrong side.

**Defaults stay the ratified pair** (`llama-3.3-70b` R1 / `qwen3-235b-a22b-instruct-2507` R2,
`exp-p1-reviewer-pair-v1`). A changed slot is reported as `isPairAmendment: true` with
`amendedFrom` — visible **as a change**, never absorbed. The manifest and receipt record requested
**and** resolved ids either way.

---

## 3. The human slot reuses the model-reviewer schema

Not a separate code path — a different `ReviewProvider` behind the same seam:

```
model slot  → createVeniceProvider()      → adjudicate() → raw decisions
human slot  → createFileBackedProvider()  → adjudicate() → raw decisions
                                             ↑ same DECISION_OUTPUT_SCHEMA
```

The runner cannot tell the difference. Both slots carry the same `promptVersion` and
`rubricVersion`; both are parsed by the same `parseAdjudication`, signed by the same rule, and
resolved by the same `resolveDecisions`.

What a human slot does **not** get: a fabricated model lineage. `humanReviewerRef` is required (an
unattributable human reviewer is refused), the role is recorded as `independent-review-steward`, and
`modelFamily`/`resolvedModelId` stay undefined so a human can never satisfy a distinct-family check
by accident (canary S11). Two humans cannot occupy both slots.

Interim-operator sign-off for the first run is a **role assignment on this surface**, not a code
path: leaving the steward field blank records `interim: true` with a stated reason, and an interim
steward with no reason is refused.

---

## 4. Nothing here writes to the corpus

**accept · revise · defer · reject** record a governed resolution *on the review*. The response says
so as data, and the panel renders it:

```json
{ "action": "accept", "corpusWritten": false, "standingGranted": false,
  "lifecycleChanged": false, "assetFrozen": false }
```

`accept` is the one a reader will assume means admitted, so `REVIEW_ACTION_EFFECT.accept` spells it
out: *"The review is accepted as evidence. This does NOT ratify, freeze or admit the reviewed asset —
the freeze remains a separate governed act."*

A resolution with no stated reason is refused (400) — an unexplained resolution is a stray click in
the audit trail. Canaries assert that no route, store, gate or panel in this surface matches
`from('invariants')`, `grantStanding(`, `setStanding(`, `canonize…(`, `freeze…(` or
`updateLifecycle(`, and that the store writes to **exactly one table**.

`lifecycle_state` on the stored row is the **review's** queue state, never the asset's. The two
sharing a column name is a coincidence of the reused table, not a coupling; canaried by asserting no
queue state is a corpus lifecycle value.

---

## 5. The redacted preview is the package

`redactedPreview(pkg)` returns the sealed object itself — same reference, same `packageHash`, plus
the server's recomputation of it as `hashVerified`. The panel renders `preview.package` and computes
no hash of its own.

A preview built as a second projection is the classic two-things-describing-one-thing defect, and it
fails in the worst possible place: a human looks at the preview *in order to trust the thing they
are not looking at*. Canaries S3/S3b turn either half of that into a build failure — the create
route must call `redactedPreview(plan.pkg)` and dispatch `plan.pkg`, and the detail route must
re-verify the stored package on every read.

---

## 6. The gate — denials and positive reachability

**Not a new gate.** `requireReviewAccess` resolves the caller through `getActivePersona` and
requires the server-resolved `cartridgeFlags.isAdmin` — the same resolution
`/api/research/lifecycle` already makes. All four handlers across three route files await the *same*
function and return its refusal, so the surface cannot be half-open.

The gate is **exercised**, not only grepped:

| Caller | Outcome |
|---|---|
| unauthenticated | 401 |
| authenticated, `isAdmin: false` | 403 |
| authenticated, no `cartridgeFlags` | 403 |
| authenticated admin | **admitted**, `callerRef === personaPublicRef(personaId)` |

That last row is the positive-reachability canary (Composed Liveness corollary 6): a gate canary made
only of refusals passes just as happily on a surface nobody can reach. Two more properties ride with
it — routes must gate **before** any other `await` (a gate that runs after the work it protects is a
log line), and the caller is attributed by **commitment**; no route may reference a raw `personaId`.

The behavioural canary exists because a source grep did not survive mutation testing: neutering the
check to `if (false && !persona.cartridgeFlags?.isAdmin)` left every grep green while admitting
every authenticated citizen (S5c). That is now caught by driving the real gate.

Transport is `personaFetch` throughout; `/api/research/review` is registered in
`tests/persona-spine-fetch.test.ts`'s allowlist with its route and gate proof. While adding it, that
canary's gate-name derivation was found to be a hand-maintained ternary that would have asserted the
wrong function name for any third gate — it now derives the name from the gate module's own exports
intersected with what the route actually calls.

House style: `bg-slate-900/40` + `border-slate-800` throughout, canaried against `border-white/…`
and any `rgba(255,255,255,…)` hairline.

---

## 7. Mutation table

20 mutations, each **verified applied on disk** before the run and **verified reverted** after, each
run with the full 38-test set collected.

| # | Mutation | Result | Canary that caught it |
|---|---|---|---|
| S1 | same-family pair accepted server-side | **CAUGHT** | refuses a same-family pair chosen through the API |
| S1b | route trusts a client-asserted family | **CAUGHT** | a client cannot assert a family |
| S2 | UI keeps its own model list | **CAUGHT** | the panel holds NO model list of its own |
| S2b | UI stops reading the server's family field | **CAUGHT** | the disabled logic reads the family the server sent |
| S3 | preview becomes a separate projection | **CAUGHT** | the route returns `redactedPreview(pkg)` |
| S3b | detail route stops re-verifying | **CAUGHT** | the detail route re-verifies on read |
| S4 | a resolution path writes to the corpus | **CAUGHT** | no route/store touches corpus, Standing or freeze |
| S4b | response drops its negative facts | **CAUGHT** | the four negative facts are stated as data |
| S4c | `accept` stops saying what it does not do | **CAUGHT** | each action states what it does NOT do |
| S5 | a route reachable by an ungated caller | **CAUGHT** | positive reachability |
| S5b | a route gates AFTER the work it protects | **CAUGHT** | positive reachability (ordering) |
| S5c | admin gate weakened to any authenticated caller | **CAUGHT** | DENIES an authenticated non-admin with 403 |
| S5d | gate replaced by a same-named local stub | **CAUGHT** | DENIES an unauthenticated caller with 401 |
| S6 | a white hairline appears | **CAUGHT** | slate hairlines only |
| S7 | raw `fetch` for a spine endpoint | **CAUGHT** | personaFetch only (+ the repo-wide spine canary) |
| S8 | caller attributed by raw persona id | **CAUGHT** | attributed by commitment, not by id |
| S9 | store writes to a second table | **CAUGHT** | the store writes to exactly one table |
| S10 | a changed pair absorbed silently | **CAUGHT** | a changed slot is visible AS a change |
| S11 | human slot given a fabricated lineage | **CAUGHT** | the human slot reuses the model schema |
| S12 | the panel offers a fourth view | **CAUGHT** | exactly the three views SPEC §12 allows |

**20 / 20 caught. 0 survived** (S5c survived the first pass and drove the behavioural gate canary
above), **0 not-applied, 0 vacuous runs.**

Suite: **183 files / 3252 tests green**. `npx tsc --noEmit`: only the two pre-existing config errors.

---

## 8. SQL to run — paste this into the Supabase SQL editor

File: `supabase/migrations/20260930000100_research_objects_allow_review.sql`

```sql
ALTER TABLE public.research_objects
  DROP CONSTRAINT IF EXISTS research_objects_object_kind_check,
  ADD CONSTRAINT research_objects_object_kind_check
    CHECK (object_kind IN ('experiment', 'finding', 'publication', 'artifact', 'review'));

COMMENT ON TABLE public.research_objects IS
  'CCRL working research objects (experiments/findings/publications/artifacts/reviews) persisted from operator-approved copilot proposals (CFS-019 C2.2), PRD-EPI-001 frozen artifacts (§2), and IRL-REVIEW-001 independent reviews (SPEC §12). Upsert key: (object_kind, object_id). receipt_id = the lifecycle/review receipt recorded on approve/freeze/review-completion.';
```

The workflow migration from the previous change must also be applied if it has not been —
`supabase/migrations/20260930000000_independent_review_receipt_type.sql` (complete SQL is inline in
`2026-07-29_irl-review-001-phase-1-adjudication-workflow.md` §8).

---

## 9. Operator steps

1. Run both SQL blocks above (this doc §8, and §8 of the workflow doc).
2. Set **`VENICE_API_KEY`** in Amplify — **server scope only**. Never `NEXT_PUBLIC_`, never
   committed. Without it the surface shows an explicit refusal rather than an empty model list; that
   is deliberate, because an empty list reads like a provider outage and invites a retry loop
   against a problem no retry fixes.
3. Open metaMe IRL → Laboratory → Experiments → **Independent Review**, choose reviewers, and click
   **Freeze & preview the redacted package**. Read the target statement and the first rows. Nothing
   is dispatched.
4. **Run the review** when the preview looks right.

---

## 10. Flagged rather than decided

1. **Venice's `/models` payload shape is still unverified** (carried from the workflow doc). If
   `family` comes back `null` for the pinned models, every option renders unselectable with
   "lineage cannot be determined". The fix is to add the real field name to `FAMILY_FIELDS` in
   `services/research/review/reviewerIndependence.ts` — **not** to relax the check.
2. **The surface is admin-gated**, matching the other research routes. If the Independent Review
   Steward is meant to be a non-admin role, that is a gate change and needs written operator
   consent; I have not widened it.
3. **The New Review view builds the EXP-P1 package specifically.** The generic capability supports
   other assets, but no second template exists yet, so the surface offers one. Adding a template
   selector is Phase 2 work and would not change any route.
4. **A `run` is synchronous inside the POST.** A dual review over hundreds of rows may exceed a
   Lambda timeout. The CLI is the reliable path for a full run today; the surface is the right place
   for preview, queue and resolution. If the operator wants in-app full runs, that needs a job
   record and a poll — flagged, not built.
