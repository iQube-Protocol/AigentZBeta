# EXP-003 — Grounding-Breadth Arm (crystal discoverability → reasoning economy)

**Independent variable:** grounding *breadth*, not grounding *presence*. The base EXP-003 measures cold vs a fixed 18-invariant collection. This arm adds a third regime — **broad** — grounded on a domain-scoped slice drawn LIVE from the whole groundable crystal (`canonical + validated`, constitutional/reasoning/engineering namespaces, top 24 by standing→confidence→reach — mirroring `services/invariants/grounding.ts:buildInvariantSlice`).

**Question it answers (operator, 2026-07-14):** *"It's hard for invariants to achieve standing if they can't be discovered."* Does broadening the discoverable crystal measurably improve reasoning economy over the narrow curated collection — i.e., do more discoverable invariants earn their keep? The **breadth delta** (narrow → broad) is the measured answer.

## Preconditions

The broad slice is drawn from live DB state. **Advance the crystal to `validated` first** (per the IRL-010A recommendation: everything except the self-labeled hypothesis `inv.constitutional.127`), else the broad slice ≈ the narrow collection and the delta is uninformative — the harness prints a warning when it detects this.

```sql
UPDATE invariants SET status = 'validated', updated_at = now()
WHERE status = 'proposed' AND seed_id <> 'inv.constitutional.127';
```

## Run

```bash
cd /Users/hal1/CascadeProjects/AigentZBeta
node scripts/benchmark-rediscovery.mjs --broad --dry-run   # confirm slice size + plan
node scripts/benchmark-rediscovery.mjs --broad             # full run (~5 tasks × 6 calls)
```

Both arms + the judge run on the SAME provider+model at temperature 0 (never mix providers within a run — the comparison would be meaningless). Raw output lands in `results-<UTC>.json` (now carrying `broadSliceSeeds` + `broadNamespaces` + `broadLimit`); the stdout summary is paste-ready below.

## Results — Run 001

| Provider / model | Date | Narrow collection (n) | Broad slice (n) | Crystal state |
|---|---|---|---|---|
| openai / gpt-4o-mini (temp 0) | 2026-07-14 | 18 | 24 | freshly advanced — all standing ≈ 0 |

| Arm | Grounding | Output tokens | Savings vs cold | Grounded share | Contradictions |
|---|---|---|---|---|---|
| cold | none | 2570 | — | 65.8% | 3 |
| initialized | narrow (18-invariant curated collection) | 2247 | **−12.6%** | **96.2%** | **0** |
| broad | live crystal slice (top 24, standing≈0) | 2578 | −0.3% | 96.9% | 0 |

**★ Breadth delta (narrow → broad): −14.7% output-token change (broad used MORE tokens), grounded share 96.2% → 96.9%.**

### Finding (honest, two-part)

1. **Grounding presence is validated and reproducible.** The curated collection cut output tokens ~12.6% AND raised grounded share 65.8% → 96.2% with contradictions 3 → 0. Consistent with an earlier same-day run (11.9%, 65.8% → 96.4%, 8 → 0). This is the core EXP-003 claim, replicated on a small model.
2. **Raw breadth did NOT help — it slightly hurt.** The broad slice used 14.7% more tokens than the narrow collection for a +0.7pt grounded-share gain (already at ceiling). **Breadth-NEGATIVE** by the interpretation contract below.

### Why (and why it supports, not refutes, the thesis)

The broad slice was drawn from a **freshly advanced crystal where every `standing` = 0**, so `buildInvariantSlice` could not rank by merit — it fell back to confidence (near-uniform) + insertion order and surfaced 24 constitutional-but-not-maximally-relevant invariants. More invariants in the prompt → more claims generated (task-1: 12 vs 7) → more tokens, with no fidelity gain because grounding was already saturated at ~96%.

This is the discoverability→standing flywheel caught at **t = 0**: *discoverable → used → earns reach/standing → ranks higher → grounds better.* The curated 18-invariant collection is, in effect, a hand-applied stand-in for earned ranking; the broad slice is raw breadth *before* the crystal has earned anything. The operator thesis ("invariants must be discoverable to earn standing") holds — discoverability pays off on the **standing axis first**, and only later on the **per-task economy axis**, once ranking reflects merit.

**Headline: curation beats un-earned breadth today; an earned crystal beating curation is the hypothesis for the re-run.**

### Deeper reframing (operator + Alethean, 2026-07-14): this is not "narrow vs broad" — it is *curated vs accumulated*

The two arms are better named by their epistemic character, not their size:

- The 18-invariant collection was **curated** — intent-selected for these constitutional-reasoning tasks (it *is* an iQube: intent → curation → invariants).
- The 24-invariant broad slice was **accumulated** — the top-N of a freshly-advanced crystal ranked by confidence (near-uniform), i.e. relevance-blind.

So the real finding generalizes past this experiment: **curation dominates accumulation.** That is the iQube proposition, measured — the platform's differentiator is not context length but *curation quality*. RAG asks "what documents are relevant?"; an iQube asks "what validated invariants should this reasoning begin from?" The broad arm underperformed precisely *because* it accumulated rather than curated.

This also disentangles three orthogonal variables that "better collection" had been conflating — reasoning economy `E` is a function of more than breadth `B`:

```
E = f(G, B, M)     G = grounding quality   B = collection breadth   M = merit weighting (standing)
not
E = f(B)
```

EXP-003 Run 001 isolates them: **G** replicates strongly (grounding helps); **B** alone does not (accumulation ≠ improvement); **M** is the untested lever — standing-weighted retrieval is what should make a broad-but-*earned* crystal curate itself. That makes the decisive re-run below a genuine A/B: **standing-weighted retrieval vs confidence-weighted retrieval**, not narrow vs broad. (These reframings — Reasoning Economics, `E=f(G,B,M)`, minimum-sufficient substrate, and IRL Principle 004 on faithful instruments — are carried into IRL-011; see the follow-on.)

### The decisive follow-on — deferred + redesigned as EXP-006

The re-run idea (does an *earned* crystal beat curation?) has **outgrown this experiment**. Deferred by operator + advisor direction 2026-07-14: a naive re-run now is void — standing is a pure function of `timesValidated`, which is 0 across the freshly-advanced crystal, so a "standing-weighted vs confidence-weighted" A/B would compare two labels for the same ordering and return a null *by construction* (recorded per IRL Principle 004). Earning standing first *is* the flywheel, which makes this the institute's first **longitudinal** experiment, not a static benchmark.

It is now the **EXP-006 Constitutional Knowledge Evolution** series (`experiments/exp-006-constitutional-knowledge-evolution/README.md`): 006A Standing Accrual (H1, receipted) → freeze `Crystal v1` → 006B Standing-weighted Retrieval (H2/P2/F7) → 006C Convergence of Φ (C1/F6) → 006D Cross-domain Transfer (P3) → 006E Crystal Version Comparison. If standing-weighted retrieval beats confidence-weighted on a *frozen, earned* crystal, the flywheel is demonstrated (the crystal improving itself through validated use) — materially stronger than any single-run delta. If not, curation is irreducible for these tasks — itself a real finding.

## Interpretation contract

- **Positive token delta + non-falling grounded share** ⇒ broadening the discoverable crystal improves reasoning economy *without* loss of grounding fidelity. This is the empirical form of "invariants must be discoverable to earn standing" — a richer groundable crystal compresses more rediscovery.
- **Zero/negative delta** ⇒ breadth beyond the curated core does not help these tasks (the 18-invariant collection already saturates the relevant grounding). That is an equally publishable finding — it would say the curated collection, not raw breadth, is what matters, and would argue for curation over blanket advancement.
- **Grounded share falls** ⇒ breadth is injecting off-task invariants that the model mis-grounds against; the domain scoping (`BROAD_NAMESPACES`) or the limit needs tightening. Diagnostic, not failure.

## Publication

On a clean run, publish canonically like the other experiments (serialize-once + sha256 + `experiment_result_published` receipt) via the results route, and record the breadth delta in the base EXP-003 README's results section. The delta is a candidate datum for the IRL-010A traceability matrix (row 1.19, knowledge compression) and for the Austin evidence package — it is exactly the "methods + measured number" the reviewer asked for, on the specific claim that invariant grounding reduces rediscovery.

## Honest limits (carry into any published number)

- Single provider/run unless repeated (the base EXP-003 limitation applies); the harness supports `--tasks N` and re-runs for variance.
- The broad slice ranks by standing→confidence→reach; with a freshly advanced crystal all standings are ~0, so the first run ranks largely by confidence — the slice composition will shift as standing/reach accrue through use. Re-running after the crystal has been in live grounding for a while is itself a measurement (does an *earned* crystal ground better than a freshly-advanced one?).
- Domain scoping is a design choice (`constitutional/reasoning/engineering`); a different task family needs a different scope.
