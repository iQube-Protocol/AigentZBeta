# Two invariants from the 2026-07-28 Companion + IDE unblocking

**Status:** proposed (operator/Aletheon ratification pending)
**Occasioned by:** two days in which every component passed its own canaries while the composed systems were unusable end to end.

---

## Background — what actually happened

On 2026-07-27/28 the Companion Passport flow and the Invariant Discovery Engine were both
reported as "completely broken." Neither was. In both cases every constituent mechanism was
correct, individually canaried, and green. What was missing was, in one case, a reachable path
through the composed gates; in the other, an observable outcome at the end of a completed act.

The defects found, in order:

| # | Defect | Shape |
|---|---|---|
| 1 | `passport_pending_auth` / `address_fingerprint` migrations never run | mechanism cannot fire (CB-1) |
| 2 | aigentMe agent persona won the implicit persona fallback in **three** independent resolvers | two invariants cancelling |
| 3 | `evidenceDomainsFor` omitted a horizontal domain's own plain key | read model excluded its own writes |
| 4 | Passport door mounted ONLY in the Companion iframe, where wallet providers cannot inject | mechanism cannot fire (CB-1) |
| 5 | Candidate list route returned full `normalized_text` → 413 over the Lambda cap | the only approval surface was unreachable |
| 6 | Assign transition matched 0 rows after its own pre-checks passed → 500 for work that landed | outcome misreported |
| 7 | Assigned capture vanished from the inbox with no outcome and no route to it | outcome unobservable |
| 8 | `applyProvenanceReclassification` has zero callers — the steward checklist has no write path | mechanism cannot fire (CB-1) |

Defects 1, 4 and 8 are CB-1. Defects 6 and 7 are a distinct shape not previously named.
Defect 2 is the composition shape. Hence the two invariants below.

---

## Invariant A — Terminal Outcome Observability

> **A completed act must leave an observable outcome on the surface that performed it, and a
> route to what it produced. A surface that removes the thing it acted on, without naming the
> result, has made success and silent failure indistinguishable.**

Corollaries:

1. **Disappearance is not confirmation.** An item leaving a list because it changed state is
   correct behaviour, but it is not evidence the state change succeeded. The surface must say
   what happened.
2. **Name the destination, and link to it.** If an act produces or attaches to an object, the
   outcome must carry a route to that object. "It worked, somewhere" is not an outcome.
3. **A failure response must not contradict persisted state.** Where a write may have landed
   despite an error path being taken, the handler re-reads and answers with the truth. Reporting
   a 500 for work that persisted is worse than a plain failure: it sends the operator into a
   retry loop against a system that already did the thing.
4. **Verifiable-only-by-database is unobservable.** If confirming an outcome requires a SQL
   query, the surface has not reported it.

**The defect this prevents (7):** "when an action is assigned to an intent it disappears but
there's no way of knowing if it was assigned… I don't see it in myWorkspace either so not sure
if it's making it through." The captures *were* assigned — all 15 of them, back to 2026-07-24,
with valid destination refs. The pipeline was working the whole time and the surface never said
so. Cost: multiple days of assumed regression.

**The defect this prevents (6):** `assign-persist-failed` returned 500 while the capture was
genuinely assigned underneath (a concurrent double-fire won the transition, or the update count
was unusable). Every retry hit the same wall *because it had succeeded*.

**Canaries:** `tests/companion-capture.test.ts` — the assign route's recovery re-read must live
inside the `assignError` branch, and the already-assigned pre-check must return the destination
and refId rather than a bare error. Mutation-tested.

**Implementation:** `app/api/companion/capture/[captureId]/assign/route.ts` (recovery re-read +
409 with destination/refId), `components/companion/CaptureInboxPanel.tsx` (assign-outcome banner
with a `buildCodexUrl` route to metaMe → myCluster → myWorkspace).

---

## Invariant B — Composed Liveness

> **When an invariant lands, it must name the invariants it composes with, and the composition
> must ship a liveness canary: one demonstrated end-to-end path through every gate the composed
> system creates. Alignment is never achieved by weakening an invariant — only by proving
> reachability through all of them.**

Corollaries:

1. **Per-piece verification is blind to joint deadlock.** CB-1 names a single mechanism that
   cannot fire. This is different: every mechanism fires locally, and the *whole* cannot. Every
   invariant involved in defects 1–5 and 8 had its own passing canary.
2. **Two invariants can cancel without either being wrong.** "A citizen's aigentMe is a real,
   owned, switchable persona" and "the active persona is never silently a delegate" are both
   correct. Composed at a default-pick site, the first cancels the second — which is why the
   same defect appeared in three independent resolvers, each having composed them freshly.
3. **A gate must be reachable from the state its own pipeline produces.** A migration that seeds
   `pending_verification` when nothing can legally transition out of it, or an approval gate
   whose only surface 413s, is a gate that cannot be passed.
4. **A checklist with no write path is doctrine, not machinery.** `CLASSIFICATION_CHECKS`
   describes six checks and names `applyProvenanceReclassification` as the way to satisfy one —
   a function with zero callers anywhere in the codebase. The queue can only ever be rendered,
   never cleared.
5. **Storage-world boundaries are composition boundaries.** The Companion iframe, the top-level
   application, and the extension worker are three worlds. An invariant proven in one is not
   proven across them; the crossing is where composition fails.

6. **A denial-only canary suite proves exclusion, not availability** *(operator ruling, 2026-07-28,
   ratified from the Research Workspace increment)*.

   > Every access-controlled constitutional surface must have both denial canaries and at least
   > one positive reachability canary. A denial-only suite proves exclusion, not availability.
   > This is part of the **capability-completion invariants** for any new workspace, route or
   > role-gated surface.

   A denial suite passes at its **maximum** when the surface is reachable by nobody: every
   assertion of the form "X is refused" is *most* satisfied by a surface that refuses everyone.
   So the failure mode it cannot see is the one the operator actually reports — "I still don't see
   it." Amendment G shipped four composed gates (domain, role, scope, admin) on the Partner
   Workspace with seven denial canaries and zero reachability canaries; canary 8 in
   `tests/venture-lab-cohort-isolation.test.ts` closed that, and canary R1 in
   `tests/research-lab-workspace.test.ts` is the same shape for the Research Workspace.

   Three requirements make the reachability canary real rather than decorative:

   - **Assert EXACT sets, never counts.** `expect(tabs.length).toBeGreaterThan(0)` stays green
     while the wrong tabs survive — a read-only path collapsing into full participation, or a
     Tier-0 view leaking into a Tier-2 set, are both invisible to a count. Compare sorted slug
     sets.
   - **Drive the REAL filter, not just the predicate.** A gate predicate returning `true` is
     necessary and not sufficient: the surface is `getEnabledTabs` plus the "a group with no
     visible tabs does not render" rule (MS-9). Both must be exercised for the same caller.
   - **Every separate decision must admit the same caller.** Domain/role (the tab gate) and scope
     (the workspace-open decision) are different checks. Passing the tabs and then finding an
     empty picker is the same invisible surface from the operator's seat.

   **A surface can also be unreachable with every gate behaving perfectly.** A workspace that
   exists in the model with no door in any cartridge, or a grantable role with no assignable
   scope, denies nobody — there is nothing to deny — and reads to the operator exactly like a
   gate failure. `tests/venture-lab-cohort-isolation.test.ts` canary 9 (every workspace on the
   spine resolves to a domain-gated entrance) and `tests/research-lab-workspace.test.ts` canary R5
   (every workspace is assignable as an invitation scope) are the two canaries for that class.

**The defect this prevents (4):** the Passport door existed, was correct, was canaried — and was
mounted only where wallet providers cannot inject. The panel's own charter already named this an
infraction ("preferred, never exclusive"); no canary checked it, because no canary spanned the
composition. Fixed by `app/passport-connect/page.tsx` + canary 13 in
`tests/passport-first-connection.test.ts`.

**What a composed-liveness canary looks like here:** a single assertion walking
*wallet → challenge → proof → persona choice → session → partition crossing → pairing → action*.
Such a canary would have caught defects 1, 2 and 4 on the day they landed, while every per-piece
canary was green.

---

## Registration

Both invariants belong in the canonical register once ratified. Per the epistemic-honesty
discipline (CLAUDE.md), they enter as **proposed** — they are engineering doctrine derived from
one incident sequence, and their claim ("this class of defect stops recurring") is exactly the
kind of assertion that should be tested by whether it does.

Parity canaries for these live with their subjects, indexed in
`tests/source-of-truth-parity.test.ts` per the existing convention.
