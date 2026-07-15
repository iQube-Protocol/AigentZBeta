# CFS-030 — Constitutional Reconciliation

**Chrysalis Foundation Specification · v1.0 · Status: RATIFIED by operator direction 2026-07-15.**
Companions: CFS-020 (Constitutional Development Environment, ICE stages 6–8: Validate → Remediate → Deploy Auth), CFS-025 (Artifact Runtime), CFS-029 (Constitutional Capability Pipeline — Evidence + Decision, the stages upstream of this one).
Named per Alethean's framing, 2026-07-15: *"the platform observes a constitutional inconsistency, proposes reconciliation, reconciles, revalidates."*

## 1. What this spec names

The Dev Command Center already had a validate/remediate fork (CFS-020 §7, "the CDE fork gate"): a failing Constitutional Validation forks to a Remediation stage instead of terminating. Until 2026-07-15 that fork produced a **specification of remedies** — a plan with a description, a remedy, and a captured lesson per failed consequence — and stopped there. Approving the plan recorded it and returned the loop to Validation, but **nothing implemented the remedies**: re-validation judged the same unchanged build and failed identically, an observe-without-correct loop the operator caught live.

This spec names and ratifies the closed mechanism built the same day: a **Constitutional Reconciliation** is the complete cycle —

```
Constitutional Validation (a consequence fails or partially fails)
   ↓
Remediation Plan (a remedy + a captured lesson per failed item — the specification)
   ↓
Dispatch Remedies (the specification becomes an instruction to Claude Code in CI,
                    on the SAME pack branch — never a fresh implementation)
   ↓
CI Amends (the existing PR updates, or — if already merged — a new PR carries
           only the remediation changes)
   ↓
Constitutional Validation, again (PR-aware: judges the AMENDED work, not the
                                   stale brief — the loop must see what actually changed)
```

A reconciliation is not "remediation" alone (a plan) and not "redeployment" alone (new code) — it is the whole arc from detected inconsistency to revalidated correction, receipted at every step.

## 2. Why this is a distinct primitive, not a bigger Remediation

Remediation (CFS-020 §7) is one STAGE of the cycle: it produces the specification. Reconciliation is the CYCLE itself, spanning stages the platform previously treated as unconnected:

- The Remediation stage's plan was receipted (`remediation_recorded`) but had no path to become code.
- The Implementation stage's dispatch mechanism (`implementation_dispatched`, CFS-025-adjacent) existed for FIRST implementations only — it had no concept of "amend an existing branch."
- The Validation stage judged only the static implementation brief — it had no way to see a PR's actual diff, so a corrected build re-failed identically.

Closing the loop required three coordinated changes, none of which is "more remediation":
1. **Branch continuity** — the CI dispatch receiver checks out and AMENDS an existing `aigentz/pack-*` branch when one exists, rather than recreating it from `dev` (which would discard the first implementation the remedies build on). If the branch's PR was already merged, a fresh PR carries only the remediation diff.
2. **Remedy dispatch** — the Remediation capsule's approved plan becomes a dispatch payload (the same `/api/dev-command-center/implement` seam software already used for first dispatch), receipted as `implementation_dispatched` a second time under the same pack.
3. **PR-aware revalidation** — the validation runner, given the pack id, folds the dispatched PR's body and changed-file list into what it judges. Without this, "re-validate" is a lie: it re-reads brief text that never changed.

## 3. The reconciliation loop generalizes beyond code

The mechanism — detect inconsistency → specify remedy → dispatch correction → observe the corrected artifact → revalidate — has no dependency on the artifact being source code. The same shape applies wherever a constitutional check can fail and a correction can be dispatched to an executor:

- **Registry** — a capability graph entry drifts from what's actually deployed; reconciliation dispatches a registry correction, revalidates against the live graph.
- **Documentation** — a spec falls out of sync with the code it describes; reconciliation dispatches a doc amendment, revalidates against the current implementation.
- **Ontology / schemas** — a canonical term or schema shape is inconsistently used across cartridges; reconciliation dispatches the alignment, revalidates usage.
- **VentureQubes / Experience Guides** — a guide's steps no longer match the runtime's actual affordances; reconciliation dispatches the guide correction, revalidates against the live surface.

Each of these swaps the EXECUTOR (Claude Code in CI is one instance, not the definition) and the VALIDATOR (consequence-canvas judging is one instance) while keeping the cycle shape identical. This spec ratifies the shape; wiring a second executor/validator pair is its own future increment, not implied by this ratification.

## 4. What was built (2026-07-14/15, same day as the fork gate's first live failure)

- `.github/workflows/claude-implement.yml` — branch-continuity check (existing branch → checked out + amended; PR updates or a fresh PR opens if the prior one merged).
- `components/devcommandcenter/layouts/RemediationLayout.tsx` — "Dispatch remedies to Claude," reusing the dispatch route/branch-minting seam.
- `app/api/dev-command-center/validate/route.ts` — PR-aware validation: given a pack id, fetches the dispatched PR's body + changed files and folds them into the judged summary.
- Flow-through UX: a successful dispatch pulses the Validate chip and deep-links into the Validate capsule; a decoupled stage→capsule reconciliation effect (named independently of this spec, same day) keeps the pane following the loop through every transition, not just this one.

## 5. Receipts across a reconciliation

Every stage of the cycle already writes its own receipt (no new receipt type needed — this spec composes existing ones): `constitutional_validation_recorded` (first validation, fails) → `remediation_recorded` (plan approved) → `implementation_dispatched` (remedies dispatched — the SAME action type as first dispatch; reconciliation is a redispatch, not a new act) → `constitutional_validation_recorded` again (revalidation, pack-tagged, judged against the amended PR). The merge gate (CFS-020's Deploy Auth capsule) reads the LATEST passing validation receipt for the pack — a reconciled build's second, passing receipt supersedes the first failing one for gate purposes, since the gate scan is `some(...)` over all receipts for the pack, not "the first one."

## 6. Honest limits

- **Reconciliation is code-scoped today.** §3's generalization is a design claim, not a built capability — no second executor/validator pair exists yet.
- **Revalidation depth is the PR's diff + body, not a live re-run.** The validator reads what Claude Code reported changed; it does not execute the amended code. Runtime confirmation remains a human/CI test-suite concern, unchanged from before this spec.
- **No cap on reconciliation rounds.** A remedy that itself fails re-validation forks to Remediation again — this is correct (the loop is meant to be re-enterable) but nothing yet flags "N reconciliation rounds on the same pack" as a signal worth surfacing to the operator (e.g., a design that keeps failing the same way). Named follow-on, not built here.

## Ratification record

- [x] **RATIFIED 2026-07-15 by operator direction**, in response to Alethean's review naming the mechanism. "You remain the observer and witness… I expect you to keep a handle on numberings, names and titles… your corrections are completely good and stand accordingly."
