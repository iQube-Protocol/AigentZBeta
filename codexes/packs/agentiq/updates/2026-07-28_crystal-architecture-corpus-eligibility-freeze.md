# Crystal architecture — corpus membership, experimental eligibility, freeze and canonicality

**Date:** 2026-07-28 · **Commit:** `3fb8f411d` · **Status:** operator-ratified 2026-07-28
**Occasioned by:** a wrong conclusion of mine about the finance invariants, and the operator ruling
that corrected it.

---

## The error this corrects

Asked whether the crystal was ready to freeze, I answered no, on the grounds that the newly-promoted
finance invariants were `proposed` with zero validations and therefore zero Standing.

That collapsed four different questions into one word:

| # | Question |
|---|---|
| 1 | Is an invariant in the platform's corpus? |
| 2 | Is it eligible for **this** experiment? |
| 3 | Has the experimental population been frozen? |
| 4 | Has the invariant become **canonical**? |

The Seed Corpus refutes my reading on its own: **144 of its 373 members are `proposed`**. So *"proposed
invariants cannot be in the crystal"* was never the governing rule. I read EXP-P1 §3.6(a)'s "never
bulk-authored to hit a number" as a **prerequisite** (reach `validated` before participating) when it
is a prohibition on **filler** (don't fake counts to pad a population).

The asymmetry I identified was real. The remedy I proposed was backwards: it belongs in the
**selection rule**, not the population.

---

## The clean model

**1. Corpus membership.** An invariant may exist in the Live Invariant Corpus as `proposed`,
`validated`, `canonical` or another permitted lifecycle state. Standing is not required for
membership.

**2. Experimental eligibility.** Decided per experiment: inside the declared domain boundary,
acceptable provenance, represented in the authoritative corpus, and satisfying that experiment's
inclusion criteria. **Eligibility is not canonicality.**

**3. Freeze.** An immutable snapshot of the eligible corpus at a moment, preserving the status and
evidence values each invariant actually had.

> Freezing a `proposed` invariant does not validate it. Freezing a zero-Standing invariant does not
> grant it Standing. **The snapshot records reality; it does not repair or promote it.**

**4. Canonicalization.** A later governance outcome from validation, Standing and ratification. The
experiment may generate contributing evidence; the freeze canonizes nothing.

---

## Vocabulary (mandatory — most of the confusion was terminological)

| Term | Meaning |
|---|---|
| **Live Invariant Corpus** | the authoritative, mutable **database** state |
| **Seed Corpus** | `codexes/packs/irl/foundation/canonical-invariants.seed.json` — bootstrap/import material only |
| **Crystal vP1** | the immutable experimental snapshot exported from the database |
| **Fixed Slice vP1** | the exact subset supplied to an arm, built **after** the freeze |

The seed file is **one-way input** — `ingest-canonical-invariants.mjs` writes file → DB and nothing
writes back — so it drifts the moment the IDE creates an invariant. It is **not** retired (it remains
a reproducible bootstrap source) but it now carries an `authority_note` saying it is not the
authoritative corpus and must never be used directly as an experimental freeze. **Do not call the
seed file "the crystal" after ingestion.**

---

## Ruling on the promoted invariants

They were created expressly to enlarge the crystal for EXP-P1, so `finance` and `commercialisation`
are **inside the declared EXP-P1 domain boundary** and their members enter Crystal vP1 exactly as
they are:

```text
Included in Crystal vP1
Status:            proposed
Validation count:  actual value
Standing:          actual value
Canonical:         no
```

They must **not** be bulk-promoted, and must **not** be excluded for not yet having earned Standing.

*(The declaration is experiment-scoped: it does not admit all future finance invariants to every
experiment.)*

---

## Exclude self-reference, not internal knowledge

The demarcation is **not** `external = admissible / internal = inadmissible`. It is:

```text
independent of the experimental target
  vs
derived from, tailored to, or contaminated by the experimental target
```

Internal origin is not disqualifying — much of the constitutional corpus is internally derived, and a
blanket internal exclusion would make constitutional invariants **untestable by construction**. What
is excluded is the circular loop: MoneyPenny doctrine → MoneyPenny-specific invariants → MoneyPenny
experiment → "evidence" that MoneyPenny performs well.

### Two classifications — and only one of them was new

**Source provenance already existed** as `ProvenanceClass` (`services/corpusScout/types.ts`, ratified
2026-07-27, five values, canary-enforced, carried on every record). Minting a second seven-value
vocabulary for the same question would be the `inv.engineering.037` parallel-implementation defect, so
the ruling's names are recorded **against** the shipped ones:

| Ruling name | Shipped `ProvenanceClass` |
|---|---|
| external-normative | `external-established` |
| external-empirical | `external-empirical` |
| internal-constitutional | `platform-doctrine` |
| internal-operational | `platform-derived` |
| experimental-derived | `platform-hypothesized` |
| observational-derived | **null — unmapped** |
| synthetic | **null — unmapped** |

The two nulls draw distinctions the shipped vocabulary does not. A forced mapping would silently
assign them an experimental population; adding a sixth and seventh class is a ratification, not an
inference. **Open for operator decision.**

**Experiment-relative relationship is genuinely new** —
`services/research/experimentRelation.ts`:

`independent` · `domain-adjacent` · `target-derived` · `task-derived` · `outcome-informed` · `unknown`

It is a property of the **pair** (invariant, experiment) — the same invariant is `independent` of one
experiment and `target-derived` for another — so it is never a column on the invariant and never
collapses into source provenance. Computed per freeze and recorded in that freeze's manifest.

- **Eligible for confirmatory use:** `independent`, `domain-adjacent`.
- **`unknown` fails closed.** An unreviewed corpus yields a small, visibly-incomplete crystal rather
  than a large, quietly-contaminated one.
- **Contamination is checked before source**, so a clean origin cannot launder a self-referential
  relationship.

### Provenance strata

| Stratum | Meaning |
|---|---|
| **C** | general constitutional invariants |
| **D** | external domain invariants |
| **I** | internal domain invariants, target-independent |
| **T** | target-derived — excluded from confirmatory use, **retained in the corpus** |

Computed from (relation × evidence provenance × namespace), never stored. Strata let a result
distinguish what general constitutional doctrine contributed from what external domain material
contributed, instead of blending them and calling the mixture evidence.

**Excluded material is not deleted** — it stays in the Live Invariant Corpus, marked ineligible for
this confirmatory freeze, and may be tested later under a new versioned freeze with independently
constructed tasks.

---

## What shipped

| Artifact | Role |
|---|---|
| `services/research/experimentRelation.ts` | the new axis, strata, eligibility decision objects |
| `scripts/export-crystal-snapshot.mjs` | DB → immutable `crystal-vP1.{json,manifest.json,sha256}` |
| `tests/experiment-relation.test.ts` | 18 canaries, 8 mutations |
| `canonical-invariants.seed.json` | `authority_note` — bootstrap only, never a freeze |
| EXP-P1 README §3.6(a) | amended (below) |

The exporter pages the corpus read (a silent 1000-row cap would hash a partial corpus), copies
`status` / `times_validated` / `standing` **as observed** with no flag that could repair them, and
records **every** decision — inclusions *and* exclusions with their reason and stratum, because an
exclusion that leaves no trace is indistinguishable from an oversight.

### Mutation table

| # | Mutation | Caught |
|---|---|---|
| M1 | internal doctrine excluded (the ruling's central error) | ✓ 5 canaries |
| M2 | source checked before contamination — clean origin launders a loop | ✓ |
| M3 | `unknown` fails **open** | ✓ 4 canaries |
| M4 | `finance` dropped from the P1 boundary | ✓ |
| M5 | exporter writes back to the corpus (promotion path) | ✓ |
| M6 | exclusions not recorded, only inclusions | ✓ |
| M7 | unpaged corpus read (silent truncation) | ✓ |
| M8 | seed `authority_note` removed | ✓ |

One canary was **too broad on first write** — a blanket `/\.update\(/` matched `createHash().update()`.
Narrowed to Supabase writes specifically rather than loosened: a canary that cries wolf gets ignored.

---

## EXP-P1 §3.6(a) — amended

> New invariants may enter the experimental crystal **in their actual lifecycle state, including
> `proposed`**. They must not be bulk-promoted, assigned synthetic validation counts, or granted
> synthetic Standing to satisfy an experimental population target. The freeze **records status,
> validation counts and Standing as observed**. All experimental arms must draw from the same declared
> eligible population unless lifecycle status or Standing is an explicitly pre-registered experimental
> variable.

---

## Open — two items deliberately not actioned

**1. Standing-primary suppression in P1 (ruling 7).** `rankByStanding`
(`services/invariants/grounding.ts:98`) is the **live runtime** selection path, and Arm B is defined as
"IRL's complete pipeline" — so changing it changes the product, not only the experiment. The correct
shape is an experiment-scoped selection mode, not a mutation of the live default. Recorded in the
§3.6(a) amendment; the runtime is untouched pending its own change and canaries.

**2. Collision with the ratified A/B/C population model.** `services/research/experimentalPopulations.ts`
(2026-07-27) sets EXP-P1 primary = **Population A only** (external evidence), with platform-doctrine as
Population C and the note *"C = a separate experimental population, never in either."* The new ruling
admits general constitutional invariants — which are platform-doctrine, i.e. C — when they predate task
construction and pass independence review.

Both models are coherent; they **disagree about the same crystal**. The new one is right on the merits.
But A/B/C carries canaries and a report format, so this needs an explicit supersession — the old model
retired or re-scoped to a different question — rather than two live partitions giving different answers.
Flagged rather than unilaterally retired.

---

## The order, restated

```text
enlarge live corpus
        ↓
declare eligibility boundary
        ↓
export and hash Crystal vP1
        ↓
construct fixed slice from the frozen snapshot
        ↓
hash fixed slice
        ↓
construct tasks
```

Task construction never precedes the freeze. The experiment never changes Crystal vP1; new evidence
updates the **live corpus** and may contribute to a future Crystal vP2.

**To produce the count:**

```bash
node scripts/export-crystal-snapshot.mjs --version=vP1 --dry-run
```
