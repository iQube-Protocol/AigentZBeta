# IRL-017 — Recursive Invariant Capture (the Invariant Retrospective)

**metaMe IRL — Invariant Research Laboratory · Standing-practice specification · Status: DESIGN (docs-first, ratify-before-build)**
**Origin:** operator + Aletheon dialogue, 2026-07-22, reflecting on the EXP-P1 infrastructure/corpus programme (`PRD-EPI-001`, `PRD-ICA-001`, `CRYSTAL-CANON_source-material-charter.md`).
**Governs:** how IRL captures, classifies, and operationalizes the operational/methodological invariants a programme surfaces about *how it does its own work* — as distinct from the scientific/domain invariants that programme is investigating.

> **The operator's framing, verbatim (2026-07-22):** *"we should... understand what are the invariants for setting up an experiment or setting up a corpus of knowledge for a particular domain... this recursive loop should be something that we bake into our operations continually... constitutional invariants[' value] is less debatable. It's the scientific structural ones that is where the real sort of debate lies."* This document operationalizes that observation as a standing practice, and keeps the two evidential registers Aletheon names — operational/constitutional vs. scientific/structural — from ever being conflated.

---

## 0. Reconciliation — this names a practice; it does not mint new doctrine

Before the substance: two things Aletheon's dialogue invoked are already ratified, and this document must not re-derive or duplicate them.

1. **The "compression / orchestration / governance" three-function lens is already ratified** — `CFS-019`'s 2026-07-18 amendment, "The three functions of Invariant Intelligence." It is explicitly a **lens, not new doctrine**: it mints no invariant IDs and is grounded in already-existing canon (`inv.reasoning.081–085`, `inv.epistemology.132/133`, CRP-002). Aletheon's message today applies this existing lens to a new object (corpus formation + experimental design) — that is a legitimate, useful application, but this document cites CFS-019 rather than re-stating the lens as if newly discovered.

2. **This is not the Convergence Log.** `CONVERGENCE_LOG.md` records when the *same structure* is independently rediscovered from two directions — a narrow, specific evidentiary device. What this document names is broader: a systematic practice of extracting *candidate* operational invariants from a programme's recurring decisions and constraints, most of which will be genuinely new observations rather than rediscoveries. A Convergence Log entry may result from a retrospective (§3) finding that a candidate was already independently stated elsewhere — the two mechanisms compose; neither replaces the other.

3. **Nothing here bypasses the standard invariant lifecycle.** Every candidate this practice surfaces enters at `proposed` and only reaches `validated`/`canonical` through the same lifecycle as any other invariant (CFS-019 §4; the hypothesis-vs-canon discipline, CLAUDE.md). A retrospective is a *discovery method*, not a ratification shortcut.

## 1. Three recursive layers

The EXP-P1 infrastructure programme surfaced meta-invariants at three altitudes. None of these are domain invariants (they say nothing about financial risk, medicine, or any other subject-matter crystal) — they are invariants about *how IRL constructs the substrate and tests it*.

### 1.1 Layer 1 — invariants of corpus/domain-substrate construction

Candidate observations from building `CRYSTAL-CANON_source-material-charter.md` and `PRD-ICA-001` (all `proposed` — none of these are validated or canonical; they are listed here as candidates for the register in §2):

- define the domain boundary before collecting material;
- seek structural diversity, not merely document volume;
- separate authoritative, empirical, platform-derived, and hypothetical provenance;
- verify the underlying artifact, not just the link (a URL ending in a file extension is not evidence of content);
- preserve original material and provenance alongside any normalized derivative;
- distinguish discovery, acquisition, human approval, and invariant derivation as four separate functions, never collapsed into one judgment;
- prevent one source class from dominating a corpus by convenience rather than by structural need;
- validate both coverage and derivational headroom, not document count alone;
- freeze the corpus before constructing confirmatory tasks against it;
- preserve exclusions explicitly (a rejected/excluded source stays a recorded, reasoned decision — never a silent omission).

This is genuinely new territory for IRL — no existing register captures these as a class, though several are already embodied piecemeal in `CRYSTAL-ENLARGEMENT_plan.md` and `PRD-ICA-001`. Since Corpus Scout (`PRD-ICA-001`) is explicitly designed to be reusable across future domain crystals, this layer's candidates are exactly the ones worth validating first — they'll govern every future domain acquisition, not only EXP-P1's.

### 1.2 Layer 2 — invariants of experimental construction

Candidate observations about designing an experiment whose object under test is itself an invariant-reasoning system:

- pre-register success, failure, and interpretation criteria before execution;
- separate disposable pilots from confirmatory evidence;
- freeze protocol artifacts before execution, not during or after;
- make every treatment mechanically observable (log what actually happened, not just what was intended);
- verify the treatment was actually administered before interpreting a null result as a finding about the mechanism;
- distinguish scientific nulls from substrate, task, implementation, and measurement failures — classified before data exists, not after;
- blind judging from arm identity and expected outcome;
- bind answer keys to the exact task-set version they answer;
- preserve raw results independently of their interpretation;
- allow an experiment to generate successor hypotheses, but never let it redefine its own success criteria after observation;
- require independent verification and reproducible execution.

**This layer is not hypothetical — it is already substantially operationalized**, and it is worth naming that fact plainly: every item above is *already* a concrete section of `IRL-016` (freeze/lifecycle governance) or `PRD-EPI-001` (the object model, the Treatment Integrity Check, the analysis-config artifact, the answer-key hash-binding fixed earlier today). The retrospective this document formalizes already ran once, informally, over the last 24 hours of this programme — this document is what makes that repeatable on purpose rather than by accident.

### 1.3 Layer 3 — invariants of invariant research itself

The deepest recursive level is a reading, not a new claim: `IRL-016` (governance) + `CFS-019`'s three-function lens (compression/orchestration/governance) already say that the substrate, its assembly, and its permissible change must each be governed. Layers 1–2 are that reading applied to two concrete objects — corpus formation and experimental design. No new doctrine is proposed at this layer; it is the observation that the pattern generalizes, stated once so it doesn't need re-deriving next time.

## 2. The two registers

Per Aletheon's proposal, two living registers, each entry carrying: the candidate statement, its provenance (which programme/incident surfaced it), an existing-canon reuse check (does an invariant already cover this — if so, cite it and do not duplicate), a classification (`constitutional` | `structural` | `procedural`), and validation status (`proposed` until the normal lifecycle promotes it).

- **Corpus Construction Invariant Register** — seeded from §1.1's candidates.
- **Experimental Design Invariant Register** — seeded from §1.2's candidates, cross-referenced against `IRL-016`/`PRD-EPI-001` wherever a candidate is already captured there (most of them are — see §1.2).

These registers live as sections of this document until volume justifies a dedicated pack file; do not build new infrastructure for them prematurely.

## 3. The Invariant Retrospective — a standing practice

Formalized as a closing stage for every major IRL research or engineering programme (charter, PRD, or experiment), not a one-off exercise for EXP-P1:

```
perform the work
→ observe repeated constraints and decisions
→ extract candidate operational invariants
→ compare against existing canon (reuse check — never duplicate)
→ classify: constitutional | structural | procedural
→ validate or reject via the normal proposed → validated → canonical lifecycle
→ operationalize validated invariants
→ use them to govern the next iteration
```

Eight questions frame the retrospective at the close of a programme phase:

1. Which decisions recurred?
2. Which constraints remained true across cases?
3. Which failures resulted from violating them?
4. Which candidates were merely local preferences, not invariants at all?
5. Which candidates are structural, constitutional, or procedural?
6. Which existing invariants already cover them (cite; do not duplicate)?
7. Which genuinely new candidates warrant validation?
8. How should a validated invariant change the operating system — a lifecycle gate, a schema, an automated check, an agent instruction, a reviewer protocol, a dashboard condition, a reusable capability?

Item 8 is the point of the whole practice: a validated invariant is not a lessons-learned bullet point. It becomes something the platform *enforces*, through the same mechanisms every other invariant already uses — never a parallel, retrospective-only enforcement path.

## 4. The safeguard (binds this practice to IRL-016, not around it)

**Meta-invariants discovered while building an experiment may govern future operations, but they must never alter that experiment's frozen protocol after ratification.** This is not a new rule — it is `IRL-016` §2's successor-experiment principle (new hypotheses and protocol changes are carried into the *next* protocol, never back into the current one), applied recursively to the meta-level. A retrospective finding about EXP-P1's own construction is itself exactly the kind of "successor experiment" input IRL-016 already knows how to route: it becomes a candidate for the *next* programme's charter, never a backdoor amendment to EXP-P1's already-signed protocol.

## 5. Application to this programme (Track 0)

`PRD-EPI-001` gains a bounded **Track 0 — Recursive Invariant Capture** (see the companion edit to that document): running the retrospective at each of its major milestones (infrastructure build-out, crystal freeze, task-set freeze, confirmatory run), populating the two registers in §2, and explicitly NOT treating any candidate surfaced this way as evidence for EXP-P1's own structural hypothesis (§6 name the boundary this crosses if blurred).

## 6. Constitutional vs. structural evidence — keep these two claims separate

Aletheon's distinction, adopted as a standing discipline for how IRL talks about its own results:

- **The constitutional claim** ("stable, explicit, consistently enforced governing rules improve coordination and reduce uncontrolled variation in complex systems") already has strong *operational* evidence from this platform's own development — drift between implementations, ambiguous authority, post-hoc reinterpretation, lost provenance, and parallel forks of canon are all problems this session alone has repeatedly hit and fixed by invariant-governance means. That evidence is real and worth citing, but it is evidence for *governance effectiveness*, not for the structural-reasoning hypothesis.
- **The structural claim** ("a compact, reusable set of causal invariants can improve reasoning performance, efficiency, transfer, or reliability beyond ordinary contextual prompting") is what `EXP-P1` exists to test, and remains scientifically unresolved.
- **Strong operational evidence for the constitutional claim is never presented as evidence for the structural claim, and a null result on the structural claim never invalidates the demonstrated operational value of constitutional governance.** They are related — both invariant-governed — but independently testable, and this programme's public communications should keep them separate.

A future, separately-chartered **Constitutional Invariant Experiment** — comparing coordination outcomes (protocol drift, unauthorized state transitions, time-to-resolve ambiguity, auditability, rework, reproducibility, recovery from exceptions) under implicit prose guidance vs. explicit-unenforced rules vs. machine-readable invariants vs. a machine-enforced constitutional runtime — is a plausible next research line implied by §1's distinction. It is **noted here as a candidate, not chartered**: it tests a different hypothesis from EXP-P1 (governance effectiveness, not reasoning improvement) and should stay a separate programme so neither contaminates the other's evidence.

---

## Ratification record

- [ ] Operator ratification of this document (status: DESIGN, awaiting sign-off)
- [ ] Companion `PRD-EPI-001` amendment (Track 0) — see accompanying edit, ratified alongside this document
- [ ] The two registers (§2) begin populating once ratified; no candidate is validated/canonical until it independently clears the normal invariant lifecycle
