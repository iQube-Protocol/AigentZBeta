# Invariant-aware gap analysis — backlog item for Aigent Z / DevOn

**Status:** BACKLOG, recorded 2026-08-03. Not started. Recorded now so it is available to the next
agent entering the workstream rather than rediscovered later — which is the same failure this item
exists to prevent.

**Operator framing:** this must not become another heavyweight ceremony. *"It should be an automatic
retrieval and planning step inside the existing flow — making the accumulated development
intelligence available exactly when an agent is about to act."*

---

## Goal

Extend the existing registry-versus-required-state analysis so every development gap is evaluated
against applicable invariants **before implementation begins**.

## The change

Gap analysis currently asks one question:

> What exists, and what still needs to be built?

It must ask three linked questions:

1. **Capability gap** — what exists versus what is missing?
2. **Invariant applicability** — which existing invariants govern the missing work?
3. **Invariant opportunity** — which new candidate invariants may emerge from resolving the gap?

That closes the development loop:

```
Inspect current state
→ identify capability gap
→ retrieve relevant invariants
→ classify applicability
→ build under those constraints
→ observe consequences
→ resolve defects
→ create resolution record
→ derive candidate invariants
→ validate through reuse
→ feed them back into the registry
```

## Extended 2026-08-03 — TWO preflights, not one

The operator extended this item after formalising **Operator Experience (UX) invariants** as a class
distinct from engineering resolution invariants (see `RESOLUTION_RECORDS.md`). DevOn today asks what
code exists and what is missing. It must also ask:

- **Engineering preflight** — what implementation lessons already exist that apply to this work?
- **Operator preflight** — what interaction principles already exist that apply to this operator flow?

> "Those two together become part of the constitutional development process."

So the gap-analysis artifact carries `applicableInvariants` from **both** classes, and a change that
touches an operator-facing surface is not preflighted until both have been stated. The UX class has
its own standard to evaluate against:

> A constitutional system must always reduce operator cognitive load while preserving constitutional
> guarantees. Constitutional safeguards constrain unsafe acts; they must never create unnecessary
> work for safe acts.

**Why this matters for gap analysis specifically:** the Track 2 exception surface passed every
engineering check — it isolated exceptions correctly, receipted them, and blocked nothing it
shouldn't. It still failed the operator, because it stopped at diagnosis and sent the steward to find
a record the system already held. No engineering invariant would have caught that. An operator
preflight would have.

## The gap-analysis artifact gains

```json
{
  "capability": "Horizen registration recovery",
  "currentState": [],
  "requiredState": [],
  "gaps": [],
  "relevantResolutionRecords": [],
  "applicableInvariants": [
    {
      "id": "inv.engineering.actor-subject-owner-separation",
      "status": "validated",
      "application": "Receipt actor and registered agent subject must remain separately addressable."
    }
  ],
  "requiredCanaries": [],
  "candidateInvariantOpportunities": [],
  "repairRisk": {
    "regressionRisk": "high",
    "knownFailureModes": [],
    "protectedResolutions": []
  }
}
```

**An implementation plan with a material gap but no invariant analysis is incomplete and should be
rejected as such.**

## Acceptance criteria

- The gap-analysis flow queries the resolution and invariant registries.
- Relevant invariants are attached to each material gap.
- Existing canaries and protected resolutions are surfaced.
- Plans identify potential invariant conflicts **before** code changes.
- **Missing enforcement points are treated as implementation gaps** — not as documentation debt.
- New candidate invariants are captured after significant resolution.
- The resulting analysis is visible to the next agent entering the workstream.

## What already exists to build on

The registry side is built and does not need re-inventing (2026-08-03,
`2026-08-03_resolution-to-invariant-loop.md`):

| Need | Already provided by |
|---|---|
| `relevantResolutionRecords` | `codexes/packs/agentiq/resolution-records/records/` |
| `applicableInvariants` (id, status, application) | `candidate-invariants/`, statuses on `COMPLETION_LIFECYCLE` |
| `requiredCanaries` | each record's/candidate's `canaries[].path` |
| `candidateInvariantOpportunities` | the loop's own capture step |
| `repairRisk.protectedResolutions` | records whose canaries cover the touched paths |
| query + reporting surface | `services/invariants/resolutionRecords.ts`, `npm run report:resolutions` |

The outstanding work is the **retrieval-and-attachment step inside the Aigent Z / DevOn gap-analysis
flow**, plus the artifact fields above — not a new store.

## Why now

Three defects on 2026-08-03 were each a rediscovery of a lesson the codebase had already learned:
the actor-vs-subject confusion recurred three times in one session; a commit-message rule regressed
because it had no enforcement point; a Stage 2 engine created an impossible prerequisite that a
prior resolution would have flagged. In every case the knowledge existed somewhere and was not
retrieved at the moment of acting. This item is the retrieval.

## Related

- `RESOLUTION_RECORDS.md` — root pointer, preflight, promotion rules
- `CLAUDE.md` → "Resolution-to-Invariant Loop" — the binding rule and mandatory preflight
- `codexes/packs/agentiq/updates/2026-08-03_resolution-to-invariant-loop.md` — the registry build
- `codexes/packs/agentiq/updates/2026-08-03_observer-state-invariants.md` — OS-1..OS-9, incl. OS-9
  (a canary must be written against real evidence)
