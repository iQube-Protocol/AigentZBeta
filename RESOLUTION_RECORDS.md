# Resolution Records — read this before you build

**Every agent working on the AgentiQ stack must consult this registry before
material work, and must add to it when a resolution qualifies.** This file is
the stable root-level pointer; the binding rule lives in `CLAUDE.md`
("Resolution-to-Invariant Loop").

The principle:

> A resolved problem is not complete until the resolution has been converted
> into reusable development knowledge.

Merging a fix records *what changed*. It does not preserve why the defect
happened, which assumption proved false, what evidence found the root cause,
which tempting fixes were rejected, what rule prevents recurrence, or what
canary detects regression. **That is the information agents repeatedly lose** —
this registry is where it stops being lost.

---

## Where the registry lives

```
codexes/packs/agentiq/resolution-records/
  records/                  # RES-YYYY-MM-DD-<CAPABILITY>-NNN.json
  candidate-invariants/     # CI-YYYY-MM-DD-<RULE>-NNN.json
```

One file per record — concurrent sessions would otherwise contend on a single
registry file. It sits in the AgentiQ pack because that is already this repo's
single home for "what changed and why" (`CLAUDE.md` → Codebase Update
Documentation), and these records are mined from the update docs beside them.
It is **not** registered in `collections.json`: this is governed data, not
Updates-tab markdown.

| | |
|---|---|
| Schema + the ten triggers + ladder helpers | `types/resolutionRecords.ts` |
| Validators, referential integrity, milestone-close check | `services/invariants/resolutionRecords.ts` |
| Dashboard | `npm run report:resolutions` (exits non-zero on a blocker) |
| Canaries | `tests/resolution-records.test.ts` |

## How to search it

```bash
npm run report:resolutions          # open resolutions, candidates, validated, recurrence risks
```

Records carry `capability`, `subsystem`, `failureMode` and invariant tags so
the preflight below is a lookup, not a read-everything exercise. Grep is a
legitimate second tool: `grep -rl "<subsystem>" codexes/packs/agentiq/resolution-records/`.

## When it MUST be consulted — the preflight

Before any material implementation, repair, migration, refactor, or governed
workflow change:

1. Read `CLAUDE.md`.
2. Read the applicable capability and registry state.
3. Query this registry by subsystem, capability, route, data model, failure
   mode, invariant tags.
4. List the relevant existing invariants.
5. State which of them constrain the planned work.
6. Identify any unresolved prior incident in the same area.
7. **Only then** produce or execute the implementation plan.

State what you found. An unstated preflight is an unperformed one.

## When a new record MUST be created

Any of the ten triggers (enumerated in `types/resolutionRecords.ts`), the most
common being: a problem needed **multiple repair cycles**; a resolved defect
**reappeared**; a **canary encoded the defect instead of detecting it**; two
subsystems **disagreed about the same canonical state**; a local anomaly
**blocked an unaffected batch**; a successful implementation established a
**reusable pattern**; a milestone became **demonstrably complete**.

Not per commit. Not per push. Milestone- and resolution-triggered.

Each record needs **three outputs**: the resolution record, the candidate
invariant (the compressed reusable rule), and the canary or enforcement point.
*Without the canary the invariant is advisory prose; without the invariant the
canary is an isolated test whose purpose will be forgotten.*

## How candidate invariants enter the invariant registry

```
observed → candidate → validated → ratified → canonical
```

This reuses `COMPLETION_LIFECYCLE` (`types/capabilityCompletion.ts`) — it is
not a second ladder. `validated` requires **≥2 occurrences at distinct sites**,
each with its own evidence, so one anecdote cannot inflate itself. A ratified
candidate graduates into a `ReproductionInvariant` inside a Capability
Completion Artifact; this registry never becomes a second canon.

## What may NOT be promoted automatically

**An agent must never ratify a candidate invariant.** `ratified` and
`canonical` require a named operator act recorded in `ratifiedSource`; a
self-promoted candidate is refused by the validator, and there is a canary for
it. A fix working once is not evidence that a rule generalises.

---

## Why this exists — the case that proved it

The **same** actor-vs-subject defect recurred **three times in one session**
(2026-08-03): the Horizen binding resolver, Claim's surface, and the journey
`/state` route each looked receipts up under the agent's own persona when
receipts are written against the acting operator's persona. The lesson from
the first fix was not carried into the next piece of work, so it was rediscovered
twice more. Commits `4c5859882`, `feeee0194`.

A second instance the same day: a CLAUDE.md rule about commit messages had been
restated repeatedly and kept regressing — because it existed only as prose, and
prose does not fail a build (`tests/dev-merge-message-discipline.test.ts`).

Both are recorded here. Both are why the preflight is mandatory rather than
encouraged.
