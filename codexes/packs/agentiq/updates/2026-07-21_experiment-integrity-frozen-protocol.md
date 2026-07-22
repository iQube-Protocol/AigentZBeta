# Experiment Integrity — the Frozen-Protocol Discipline (Aletheon actions from the Austin review)

**Date:** 2026-07-21 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha` · **Type:** ratification (docs + canon)
**Origin:** Austin's agent's review of the IRL results report → Aletheon's response → operator direction ("take Aletheon's actions").

## Why

Austin's reviewer paid the lab the strongest possible compliment — *"the lab is behaving more like a lab"* (it published its own failures under its own hashes: EXP-005 constitutional-portability broken, EXP-001 cross-model degradation, EXP-006 F1 41%). But he named a real cultural risk, now visible twice: **every disappointing result gets reframed as a discovery** (EXP-006's low F1 → "a lower bound, not a competence score", with a successor metric designed *after* seeing the number). Generative — and epistemically corrosive — in equal measure.

Aletheon's resolution, adopted: the behaviour isn't wrong (an experiment *may* inspire the next), but the danger is when the interpretation changes **inside the same experiment**. Formalise the separation and the concern mostly dissolves.

## Ratified — four canonical method-invariants (`inv.reasoning.346–349`)

These are **method / governance doctrine** (how the Institute runs experiments), ratified `canonical` by operator direction — not empirical hypotheses.

- **`inv.reasoning.346` — Frozen success criteria.** An experiment may generate new hypotheses, but it may not redefine its own success criteria after observation. A result feeds the NEXT protocol; it never rewrites the criteria of the protocol under which it was produced.
- **`inv.reasoning.347` — The three constitutional objects of an experiment.** OBSERVATION (immutable), INTERPRETATION (frozen at the protocol's signature), HYPOTHESIS GENERATION (free to evolve). Keeping them distinct preserves integrity and creativity at once.
- **`inv.reasoning.348` — Freeze the instrument before the result.** Judge, target model, and interpretation table are frozen before any result exists; outcomes move materially across models and judges, so an unfrozen instrument measures the instrument, not the claim.
- **`inv.reasoning.349` — Derived-domain honesty.** A runtime evaluated against the corpus it was derived from validates internal coherence, not domain generality; the affinity is reported as a pre-registered limitation with domain-independent validation sequenced as a later phase.

Added to `canonical-invariants.seed.json` (now 354) and `appendix-a_canonical-invariants.md`.

## EXP-P1 protocol updates (pre-registered, before freeze)

- **§12 Interpretation Table** — pre-registered the **crystal-domain limitation** (`inv.reasoning.349`): Phase 1 evaluates against the platform's own doctrine collection = internal-coherence validation, **not** a generality claim; no EXP-P1 outcome may be read as domain-independent generalisation; neutral-domain validation is a distinct later phase. Plus an explicit interpretation-freeze note (`346–348`).
- **§3 Materials/Freezing** — added the **collection-size guard** (Austin's design concern): the fixed Arm C slice must be **⊆ 40% of `Crystal vP1`**, else Arm B's live selection can't differ from Arm C's fixed slice and the comparison degenerates (Arm C ≈ Arm B). If the 18-invariant doctrine collection is too small, enlarge it or substitute a neutral-domain collection *before* freeze.

## Posture (operator direction)

The collaboration is framed as **"this independent review is valuable precisely because neither side controls the outcome"** — a shared constitutional experiment, not a negotiation. The "leverage" framing from the reviewer's note is explicitly not adopted. Austin is becoming part of the research method, not an add-on to the programme — which is exactly what makes the review credible.

## Operator action — sync the canon (so the resolver + public canon serve the new invariants)

The four invariants are in the seed; the live canon (`/api/public/irl/*`, `explain_primitive`, the resolver) reads the DB. Run the idempotent ingest to upsert them (dry-run first):

```bash
node scripts/ingest-canonical-invariants.mjs --dry-run
node scripts/ingest-canonical-invariants.mjs
```

(Run against the canonical `iQube-Protocol` DB, not a stale clone — see CLAUDE.md "Canonical Repo vs local clone". The ingest is idempotent on `seed_id`; it never duplicates or touches rows it didn't seed.)

## Review

- Invariants: `codexes/packs/irl/foundation/appendix-a_canonical-invariants.md` (§ Experiment Integrity) + `canonical-invariants.seed.json`.
- EXP-P1 protocol: `codexes/packs/irl/foundation/experiments/exp-p1-representation-runtime-gauntlet/README.md` (§3, §12).
- In-app once ingested + deployed: IRL OS → Foundation (Appendix A / Invariant Registry) + Laboratory → Experiments → EXP-P1.
