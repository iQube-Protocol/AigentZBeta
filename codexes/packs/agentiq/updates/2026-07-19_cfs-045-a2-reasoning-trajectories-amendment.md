# CFS-045-A2 — Reasoning Trajectories Amendment (Remember How, Not Just What)

**Status: `ratified` (operator, 2026-07-19 — all six checklist items). v1.2 BUILT the same day: migration `20260801000000_reasoning_trajectories.sql` (trajectory table + `evidence` jsonb on memory_invariants — operator must run it with the earlier memory SQL), trajectory capture folded into the existing compilation pass (intent digest + cited/discarded in the same model call, one row per compiled turn incl. 'none'), typed evidence events (`runtime_reuse` on confirm/strengthen, `human_validation` on A1 validate), 500-row retention prune, opaque client session marker, and `GET /api/memory/trajectories` (recent + recurrence summary). EXP-013 remains chartered-not-run.**
Source: operator direction ("what's also important was the process that it took to generate the invariants") + Aletheon's three-artifact framing (2026-07-19), following the A1 partnership-memory build.

---

## The missing piece

CFS-045 + A1 preserve *what was learned* (the invariant substrate) and *who
ratified it* (the validation tier). This amendment adds the third dimension:
**how it was learned** — without falling back to storing conversation. The
compression discipline holds: we store the trajectory through reasoning
space, not the transcript.

Every reasoning session produces **three distinct artifacts**:

| Artifact | Question it answers | Memory |
|---|---|---|
| **Invariants** | What survived? | Constitutional Memory — `memory_invariants` (built: v1 + A1) |
| **Reasoning Trajectories** | How did we get there? | Reasoning Memory — `reasoning_trajectories` (**this amendment**) |
| **Evidence** | Why do we trust it? | Evidence Memory — provenance, typed (this amendment formalizes) |

Together the three form a session's **Reasoning Receipt** — a far more
complete representation of hybrid intelligence than either a transcript or a
summary.

## Naming and shape (ratified terminology)

**"Trajectory," not "path."** Reasoning is branching, recursive, and
convergent — a trajectory through an invariant field naturally accommodates
divergence, convergence, loops, revisitation, and alternative successful
routes. A trajectory is a **first-class research object**, not metadata.

A trajectory records (all T1/T2-safe — seed ids, memory-row ids, labels):

- **intent digest** — a compressed statement of what the operator was trying
  to do (never the raw message; the compilation model produces the digest)
- **activation sequence** — which platform invariants the IRE resolved for
  the turn, in order (seed ids)
- **memory activations** — which memory invariants were retrieved into the
  ground truth (row ids), and which the reasoning actually leaned on
- **discarded considerations** — v1.2 approximation: resolved-but-uncited
  invariants (activated by the IRE, not cited in the conclusion)
- **outcome** — the compilation taxonomy result
  (none/confirmed/…/merged/split) + the produced/affected invariant id
- **convergence marker** — whether this turn extended, branched from, or
  converged with the session's prior trajectory

## Why this matters (the feedback loop)

Today a system can only answer "why is X so" with "because that's what the
database contains." A trajectory-aware system can answer: *"across 143
reasoning sessions, this ordering consistently reduced the invariant set
needed to reach a coherent conclusion."* Stored across many sessions,
trajectories become **data for discovering higher-order invariants about
reasoning itself** — recurring trajectories are candidate *canonical
reasoning strategies*, the bridge from Invariant Intelligence to a science
of reasoning dynamics. Future reasoning inherits not just conclusions but
successful reasoning strategies.

## The evidence layer (formalized)

Much of the evidence layer already exists implicitly; this amendment makes
it typed and appendable rather than scattered:

| Evidence kind | Where it lives today | A2 change |
|---|---|---|
| Constitutional grounding | `source_seed_ids` | unchanged |
| Repeated successful reuse | `support_count` / `last_confirmed_at` | unchanged |
| Human/expert validation | `human_validated` / `validated_at` (A1) | unchanged |
| Empirical experiment | — | typed event in new `evidence` jsonb |
| Runtime reproducibility | — | typed event in new `evidence` jsonb |
| DVN receipt | deferred (CFS-045 v2 question) | still deferred — flagged, not assumed |

`evidence` is an append-only jsonb array of `{ kind, at, ref? }` events on
`memory_invariants` — provenance travels with the invariant, so a stored
conclusion is never detached from why it is trusted.

## v1.2 build scope (on ratification)

1. **Migration** — new table `reasoning_trajectories` (persona-keyed T0
   server-side, RLS service-role only): `id`, `persona_id`, `cartridge_id`,
   `intent_digest` (T1-safe, model-produced, ≤200 chars), `activated_seed_ids
   text[]` (ordered), `memory_ids_cited uuid[]`, `discarded_seed_ids text[]`,
   `outcome text`, `produced_invariant_id uuid`, `session_marker text`
   (opaque per-session grouping, client-generated random token — NOT a
   persona-derived value), `created_at`. Plus `evidence jsonb NOT NULL
   DEFAULT '[]'` on `memory_invariants`.
2. **Capture** — the existing compilation pass (already post-response via
   `after()`) writes one trajectory row per compiled turn. The compilation
   prompt additionally produces the intent digest and identifies which
   grounded invariants the reply actually leaned on (cited vs discarded).
   No new model call — one extra field set in the same review.
3. **Evidence events** — compilation outcomes append typed evidence to the
   affected invariant (`{kind:'runtime_reuse'}` on confirmed/strengthened);
   A1 validation appends `{kind:'human_validation'}`; experiment publication
   can append `{kind:'experiment', ref:<experiment id>}` later.
4. **Study affordance** — `GET /api/memory/trajectories` (owner self-view):
   recent trajectories + a recurrence summary (most frequent activation
   sequences). This is the seed of the reasoning-dynamics research surface,
   not a full analytics product.
5. **Retention** — trajectories are episodic-adjacent: cap per (persona,
   cartridge) at 500 rows, oldest pruned on write. The compressed knowledge
   lives in the invariants; trajectories are study material, not substrate.

### T-discipline

Same rules as the substrate: `persona_id` never serialised; intent digests
are model-produced compressions that must pass the same T1-safety guard as
statements (no UUIDs/emails); seed ids are T2-safe; `session_marker` is an
opaque random token, never derived from any identifier. Owner self-view only.

## EXP-013 — Recurring reasoning trajectories (chartered, not run)

- **Hypothesis (proposed):** across sessions, a small set of reasoning
  trajectories recurs, and turns following recurrent trajectories reach
  coherent conclusions with smaller activated-invariant sets than novel
  trajectories — i.e., reasoning strategies themselves are compressible.
- **Method:** once ≥100 trajectories exist, cluster activation sequences;
  measure recurrence rate, activated-set size vs outcome quality, and
  stability of recurrent trajectories over time.
- **Discipline:** canonical experiment pipeline; the "canonical reasoning
  strategies" claim stays `proposed` until this evidence exists. Results
  feed the trajectory-aware retrieval question (v2: should recurrent
  trajectories PRIME retrieval?) — which is a separate ratification, not an
  automatic consequence.

## Ratification checklist (operator)

1. Ratify the three-artifact model (Invariants / Trajectories / Evidence) and the "Reasoning Receipt" composite as CFS-045 doctrine.
2. Ratify "trajectory" as the canonical term (not "path"); trajectories are first-class research objects.
3. Approve v1.2 build scope §1–5 (trajectory table + capture, evidence jsonb + typed events, self-view study affordance, 500-row retention).
4. Confirm trajectories carry no transcript content — intent digests + id sequences only, T1-guarded.
5. Register the EXP-013 hypothesis as `proposed`; approve chartering EXP-013.
6. Note the deferred questions: DVN receipts for memory (unchanged from v1), and trajectory-primed retrieval (v2, separate ratification).
