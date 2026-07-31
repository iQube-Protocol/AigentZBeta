# EXP-003 — Rediscovery Savings

**Chrysalis Foundation · Experiment 003 · Status: first run complete — hypothesis confirmed on all four measures**
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

### Run 1 — 2026-07-04 · provider=venice · model=llama-3.3-70b · temperature=0 · 5 tasks

Raw data: `results-2026-07-04.json` (committed alongside this section).

| Task | Arm | Out tokens | Claims | Consistent | Contradicting | Outside | Cited |
|---|---|---|---|---|---|---|---|
| task-1-delegation-flow | cold | 750 | 12 | 9 | 0 | 3 | 0 |
| task-1-delegation-flow | initialized | 676 | 7 | 7 | 0 | 0 | 11 |
| task-2-reputation-vs-truth | cold | 601 | 7 | 5 | 2 | 0 | 0 |
| task-2-reputation-vs-truth | initialized | 392 | 7 | 7 | 0 | 0 | 5 |
| task-3-permanent-mandate | cold | 430 | 7 | 7 | 0 | 0 | 0 |
| task-3-permanent-mandate | initialized | 286 | 7 | 7 | 0 | 0 | 7 |
| task-4-truthful-harm | cold | 225 | 3 | 2 | 0 | 1 | 0 |
| task-4-truthful-harm | initialized | 123 | 1 | 1 | 0 | 0 | 1 |
| task-5-repealed-rule | cold | 548 | 8 | 6 | 0 | 2 | 0 |
| task-5-repealed-rule | initialized | 396 | 7 | 7 | 0 | 0 | 4 |

**Aggregate:** cold 2554 output tokens, 78.4% grounded share, 2 canon contradictions ·
initialized 1873 output tokens, **100.0%** grounded share, **0** contradictions.

### Reading — hypothesis confirmed on all four measures

1. **Rediscovery savings (a):** 26.7% fewer output tokens overall (2554 → 1873), and
   *every task individually* was cheaper initialized — no task regressed. Task-4 nearly
   halved (225 → 123).
2. **Grounded-claim share (b):** 78.4% → 100%. The cold arm produced 6 claims outside
   the canon; the initialized arm produced none.
3. **Canon contradictions (c):** 2 → 0. The detail worth underlining: **both cold
   contradictions occurred on task-2 (reputation-vs-truth)** — a cold model, unaided,
   conflates reputation weight with truth-weight, which is *precisely the confusion
   Law XII (Truth / Standing / Reach orthogonality) was ratified to prevent*. The
   benchmark independently rediscovered the failure mode the invariant exists to
   foreclose, and the closure eliminated it.
4. **Traceable citations (d):** 0 cold (by construction) vs 28 marker citations across
   the initialized arm; every initialized answer is explainable by retrieval
   (CFS-008 §3).

Secondary observation: initialized answers also carried *fewer* claims (29 vs 37) at
100% grounding — compression showing up as fewer, better-grounded assertions rather
than more prose. Initialization does spend *input* tokens on the closure block (~18
statements per call); input is cheap relative to generated output and the manifest is
cacheable (CFS-006 §3), so the trade runs in the platform's favour.

### Standing caveats for this run

Single model (open-source llama-3.3-70b), single run, five tasks, model-judged claim
decomposition — a strong directional signal, not a universal constant. Cross-model
replication on `claude-sonnet-4-6` and/or `gpt-4o-mini` is the next evidence increment
(separate experiment instances — never merge cross-provider rows).

## Honesty notes (Law XII discipline)

- The judge is itself a model; its claim decomposition is an estimate, not ground
  truth. Contradiction counts matter more than exact claim totals.
- Token counts measure this task set on this model — a compression *signal*, not a
  universal constant.
- A confirmed hypothesis validates the initialization mechanism; it does not by itself
  ratify any individual invariant (standing accrues per-invariant through the
  consequence flywheel, not through benchmark aggregates).
