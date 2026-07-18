# IRV-001 — Invariant Resolution Validation

**Chrysalis Foundation · Stage 0 (Instrument Validation) · Status: READY TO RUN**
**Hypothesis class:** Operational (instrument validation — see `foundation/IRL_VALIDATION_ROADMAP.md`). **This validates the INSTRUMENT, not a scientific claim.**
**Constitutional anchor:** `foundation/CFS-033_constitutional-evaluation.md`; validates the IRE (`services/invariants/resolution.ts`, CFS-037).

## Why this runs first

You validate the instrument before you do the science. Nobody calibrates a telescope while collecting astronomical data. The Institute has just introduced the **Invariant Resolution Engine (IRE)** and **Invariant Projection Engine (IPE)** as first-class components — before they carry a live experiment (EXP-P1/P2/P3), they get an engineering shake-down. Running Stage 0 first also lets us honestly tell an external reviewer: *"the engineering validation completed before the science began"* — and, if a science result later surprises, distinguishes an immature engine from a real finding.

## The question (engineering, not scientific)

Given an intent, does the IRE resolve a **sensible, stable, reproducible** governing-invariant field? Concretely, measured against a **Synthetic Expert Baseline (SEB)**:
- **Coverage** — does the IRE field cover what independent domain experts consider the load-bearing properties of the task?
- **Compression** — does the IRE select *fewer* than the experts while covering their concerns? (The interesting result — experts name 12, IRE names 6 that cover them — is compression, not agreement.)
- **Novelty** — does the IRE surface structural properties the experts did not name?
- **Stability** — does the IRE resolve the *same* field for the *same* intent across repeated runs?

## Honest framing — SEB is NOT a Delphi study

The "experts" are LLM personas (correlated models), not independent humans, so this is **engineering calibration, not scientific validation** (per Aletheon, 2026-07-17). We do not claim the SEB is ground truth. Two disciplines make it useful anyway: (1) the personas run **independently** then a **consensus** round forms the baseline; (2) the personas are **forbidden the word "invariant"** — they are asked for *"the smallest set of properties that fundamentally determine successful reasoning… the structural properties that cannot change without changing the answer"* — so they cannot drift toward the Institute's terminology. Human validators are the down-the-road upgrade; the SEB is the weekend-runnable proxy. The most informative outcomes are **disagreement patterns**: IRE stable where experts vary is a signal the engine may be tracking a deeper regularity than any single expert lens (a signal to investigate, never a proof of correctness).

## The decomposed pipeline this enables

```
Experience → Synthetic Expert Extraction → IRE → IPE → Runtime → LLM
```
Every transition becomes measurable. IRV-001 measures **Synthetic Expert Extraction → IRE**; IPV-001 measures **IRE → IPE**.

## Method

| Step | What runs | Seam |
|---|---|---|
| SEB extract | N expert personas per intent independently name governing properties (JSON), then a consensus round | one provider (your key), `services/experiments/instrument-validation-intents.json` |
| IRE resolve | POST the intent to the IRE `--reps` times; take the field; measure seed-set Jaccard across reps (stability) | `POST /api/public/irl/resolve` (persona-free, no creds) |
| Overlap judge | map SEB consensus properties ↔ IRE invariant statements → matched / omitted / discovered | one provider |
| Score | coverage = matched/|SEB|; compression = |IRE|/|SEB|; novelty = discovered/|IRE|; stability = mean Jaccard | mechanical |

Statements for the IRE's resolved seed ids are read from `GET /api/public/irl/invariants` (public). 20 intents across finance / legal / governance / medical / engineering / science / media / commerce / identity / operations / education / environment / supply-chain (config).

## How to run

```
# free preview (no API calls, no host needed to see the flow)
node scripts/run-instrument-validation.mjs --host=https://dev-beta.aigentz.me --dry-run

# small live shake-down first (3 intents, 3 personas each), independent provider
VENICE_API_KEY=... node scripts/run-instrument-validation.mjs \
  --host=https://dev-beta.aigentz.me --exp irv --limit 3 --personas 3 --reps 3

# full IRV-001
VENICE_API_KEY=... node scripts/run-instrument-validation.mjs \
  --host=https://dev-beta.aigentz.me --exp irv --reps 3
```
Writes `results/irv-results-<date>.json` + a `.manifest.json` (sha256, provider, model, tokens) into this experiment dir — the same hash-committed publication discipline as the other experiments. Prefer a non-Anthropic provider for the personas/judge (independence).

## What "passing" looks like (pre-agreed, engineering thresholds)

- **Stability ≥ 0.9** mean seed-set Jaccard across reps (the engine is near-deterministic for a fixed intent). *If low, that is the first kink to iron out.*
- **Coverage ≥ 0.7** of expert consensus properties (the engine isn't missing what experts consider load-bearing).
- **Compression ≤ 1.0** (the engine selects no more than the experts, ideally fewer) — the encouraging signal.
- **No pathologies:** no empty fields, no runaway over-selection, no oscillation across reps.
These are calibration targets, not scientific claims. A miss on any is a bug to fix before the live experiments, not a result to publish.

## Honest limits

- SEB personas are correlated models; coverage/novelty are *relative to a synthetic baseline*, not to truth.
- IRE Phase-0 qualification uses a v0 keyword heuristic (`perception.ts`); low coverage may reflect the perception layer, not resolution — diagnose which.
- Constitutional-class coordinates are null in Phase 0 (never faked); stability is measured on the resolved seed set + operational coordinates.

## Ratification record

- [x] READY TO RUN — chartered 2026-07-17 (operator direction; Stage-0 shake-down before the science).
- [ ] Small shake-down (3 intents) reviewed; pathologies triaged.
- [ ] Full run; results + manifest published hash-committed.
- [ ] Stability/coverage/compression thresholds met → IRE cleared for EXP-P1/P2/P3.
