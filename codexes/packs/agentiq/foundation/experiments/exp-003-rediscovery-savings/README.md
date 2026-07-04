# EXP-003 — Rediscovery Savings

**Chrysalis Foundation · Experiment 003 · Status: harness shipped, first run pending**
Domain: **The Constitutional Internet** (same collection as EXP-001/002)
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`
Spec: CFS-008 §2 (*Rediscovery savings — tokens/steps an agent spends solving a problem cold vs. initialized with the relevant invariant closure*).

## Hypothesis

Knowledge initialization (CFS-006 §3) converts reasoning into inference: a model
initialized with the relevant validated invariant closure answers the same task with
(a) **fewer output tokens spent re-deriving principles**, (b) **higher grounded-claim
share** (claims consistent with the collection), (c) **fewer contradictions of the
canon**, and (d) **traceable citations** — compared with the same model, same
temperature, answering cold.

If confirmed, this is the direct production measurement of the compression theory's
central claim: a validated invariant amortises reasoning cost. ("Compressed expertise
in, rediscovery out.")

## Method

The harness is `scripts/benchmark-rediscovery.mjs`. Fixed inputs so runs are comparable
over time:

- **Collection** — EXP-001's 18-invariant "Constitutional Internet" set
  (`inv.constitutional.011–024, 059–062`), fetched live from the substrate (so the
  benchmark always measures the *current* canon).
- **Task set** — five fixed design/assessment tasks, each answerable from the
  collection: delegation flow, reputation-vs-truth, permanent mandate, truthful-harm
  responsibility, repealed-rule memory.
- **Arms** — same provider + model for both arms AND the judge (never mixed within a
  run), temperature 0, same max tokens. Providers mirror the platform's LLM chain
  (`llmDraftHelper.ts`) — `anthropic` (`claude-sonnet-4-6`), `openai` (`gpt-4o-mini`),
  or `venice` (`llama-3.3-70b`), selected by `--provider` or by the first available key
  in platform order:
  - **A (cold):** task only.
  - **B (initialized):** knowledge-initialization block (the closure with `[C-NNN]`
    markers + the citation instruction) prepended to the same task.
- **Judge** — an independent evaluation pass decomposes every answer into claims and
  scores each CONSISTENT / CONTRADICTING / OUTSIDE against the collection (EXP-001's
  evaluation-protocol shape). Citation density in Arm B is counted mechanically from
  the markers.

## Measures (per task and aggregate)

| Measure | CFS-008 §2 mapping |
|---|---|
| Output tokens per arm | rediscovery cost |
| Grounded-claim share (consistent / total) | grounding accuracy |
| Contradictions of the canon | consequence-risk proxy |
| Distinct invariants cited (Arm B) | reuse count, in-answer |

## How to run (operator environment — the sandbox has no outbound HTTPS)

```bash
cd /Users/hal1/CascadeProjects/AigentZBeta && git pull && \
node scripts/benchmark-rediscovery.mjs --dry-run && \
node scripts/benchmark-rediscovery.mjs --provider openai
```

Requires ONE provider key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `VENICE_API_KEY`)
plus Supabase env in `.env.local` (already present for the seed ingest). Omit
`--provider` to auto-pick the first available key in platform order. Full run ≈ 20
answer/judge calls. Raw results land in this directory as `results-<date>.json`; the
script prints a markdown summary table to paste below. Note the run's provider+model
alongside the table — cross-provider runs are separate experiments, not comparable rows.

## Results

*(pending first run — paste the summary table here and commit the results JSON)*

## Honesty notes (Law XII discipline)

- The judge is itself a model; its claim decomposition is an estimate, not ground
  truth. Contradiction counts matter more than exact claim totals.
- Token counts measure this task set on this model — a compression *signal*, not a
  universal constant.
- A confirmed hypothesis validates the initialization mechanism; it does not by itself
  ratify any individual invariant (standing accrues per-invariant through the
  consequence flywheel, not through benchmark aggregates).
