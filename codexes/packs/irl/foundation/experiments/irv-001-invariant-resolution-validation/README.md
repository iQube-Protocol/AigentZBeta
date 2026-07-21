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

## Thesis positioning (ratified 2026-07-18 — `inv.reasoning.324–328`)

IRV-001 is a **Track-B (Invariant Discovery) calibration**, never Track-A (Structural Intelligence) evidence. The Institute's thesis is NOT that the IRE identifies invariants better than human experts — quite the opposite: the corpus exists to *capture* humanity's accumulated expert reasoning as machine-operational invariants (`inv.reasoning.327`). Coverage against the expert baseline measures only whether the instrument approximates expert identification well enough to **bootstrap a growing corpus** that standing, ratification, and supersession improve over time. The IRE is an instrument, not the discovery (`inv.reasoning.326`); structural performance is provenance-independent (`inv.reasoning.324`). The original "coverage ≥ 0.7" target is retired as a pass/fail notion — outperforming the SEB was never the objective.

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

## What "passing" looks like — STABILITY is the gate, coverage is a proxy

The 2026-07-18 shakedown (below) taught a sharp lesson: **stability is the hard, model-independent signal; coverage is a noisy SEB-relative proxy that must not be treated as a pass/fail threshold.**

- **HARD GATE — Stability ≥ 0.9** mean seed-set Jaccard across reps (the engine is near-deterministic for a fixed intent). *If low, that is the first kink to iron out.* **Achieved: 1.0 on every run, every model config.**
- **HARD GATE — No pathologies:** no empty fields, no runaway over-selection, no oscillation, no irrelevant-domain floor pollution. *(One found & fixed — see below.)*
- **REPORTED PROXY — Coverage** of expert consensus properties. Report it *with its exact SEB model config*; do NOT gate on a fixed number. It swung 0.13 → 0.57 across model choices on identical (byte-stable) engine output — so a single coverage figure certifies nothing. Chasing a coverage threshold by swapping judge models is p-hacking the instrument. Interpret coverage qualitatively + as a range.
- **REPORTED PROXY — Compression / Novelty** — same caveat; SEB-relative, model-sensitive.

These are calibration signals, not scientific claims. The GO decision to clear the IRE for the live experiments rests on **stability + no-pathology + qualitative on-domain relevance**, not on hitting a coverage bar.

## Stage-0 shakedown findings (2026-07-18, operator-run)

1. **Discovery-node pollution (found & FIXED).** On corpus-desert domains (finance) the v0 perception vocabulary matched no domain, so the resolver grounded *unscoped* → the global highest-standing slice, dominated by the `inv.discovery.*` engine-node invariants. Every unrelated intent (creditworthiness, fraud) surfaced discovery-ranking invariants. Fixed in `services/invariants/resolution.ts`: empty perception now grounds the constitutional/epistemology baseline, never the global top. Coverage on finance fell to an *honest* 0.07 (corpus genuinely lacks finance-domain invariants) with the pollution gone.
2. **Band the test to the corpus (DONE).** Intents split into `anchored` (constitutional/delegation/standing/personhood/consequence/governance/reasoning/evaluation — corpus-dense, measures engine quality) vs `breadth` (cross-domain deserts — measures corpus breadth). The anchored band lifted coverage 0.07 → 0.38 → **0.57**.
3. **Judge/persona/consensus must be un-confounded.** `--judge-model` moves ONLY the SEB↔IRE overlap scorer; the consensus (SEB baseline) stays on the persona model. Routing consensus through the judge model changed the baseline and *lowered* coverage to 0.13 (baseline drift, not judging). Corrected. Clean config (persona `gpt-4o-mini`, judge `gpt-4o`) → coverage 0.57 on the densest 3 intents; **0.21 mean across the full 10-intent anchored band** (coverage tracks corpus density), stability 1.0 throughout.
4. **Record run (10 intents × 3 reps):** stability 1.0 · compression 0.65 · coverage 0.21 mean · novelty 0.75. **IPV (10 × 5 reps): 100% reproducible** (standing + coordinate weights). **Verdict:** the IRE is a deterministic instrument with meaningful on-domain alignment that has survived adversarial calibration of its measurement methodology; its one pathology is fixed. **Instrument validated for EXP-P1** on the stability + no-pathology + relevance basis (coverage a reported proxy, not the gate). Reviewer note: `../exp-p1-representation-runtime-gauntlet/STAGE-0_HANDOFF.md`.

## Honest limits

- SEB personas are correlated models; coverage/novelty are *relative to a synthetic baseline*, not to truth.
- IRE Phase-0 qualification uses a v0 keyword heuristic (`perception.ts`); low coverage may reflect the perception layer, not resolution — diagnose which.
- Constitutional-class coordinates are null in Phase 0 (never faked); stability is measured on the resolved seed set + operational coordinates.

## Ratification record

- [x] READY TO RUN — chartered 2026-07-17 (operator direction; Stage-0 shake-down before the science).
- [x] Small shake-down (3 intents) reviewed; pathologies triaged — 2026-07-18. Discovery-node pollution found & fixed; test banded to the corpus; judge/persona/consensus un-confounded. Stability 1.0; anchored-band coverage 0.57 (persona gpt-4o-mini, judge gpt-4o).
- [x] Full anchored-band record run (10 intents × 3 reps) — 2026-07-18, frozen config (persona gpt-4o-mini, judge gpt-4o). **Stability 1.0 · compression 0.65 · coverage 0.21 mean (0.57 on densest delegation/sovereignty/standing) · novelty 0.75.** `irv-results-2026-07-18.json` sha256 `258b64fda9aa9686…`.
- [x] Instrument **validated for EXP-P1** — on the stability (1.0) + no-pathology + qualitative-relevance basis. Coverage is a reported proxy that tracks corpus density (0.07 desert → 0.21 anchored mean → 0.57 densest), never the gate. Reviewer-facing summary: `foundation/experiments/exp-p1-representation-runtime-gauntlet/STAGE-0_HANDOFF.md`.
