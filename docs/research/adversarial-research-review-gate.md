# The Adversarial Research Review Gate (ARR Gate)

**Status:** Canonical process. Mandatory before any artifact is marked published/canonical under
the classes named in `CLAUDE.md`/`AGENTS.md`'s ARR Gate rule.

**Origin:** Threshold 007 ("Invariant Intelligence") was drafted, citation-hardened, and then
reviewed by a separate Claude agent acting as an adversarial reader. That review surfaced real
gaps — a namespace collision between two systems both called "Aegis," experiment-framing drift
between the essay's summary and the registered protocol's own scope, and seven internal citations
that resolved to nothing in either this repository or the Supabase content database — without the
paper's central thesis collapsing. **007 got stronger by discovering evidence against its own
presentation, not by accumulating more supportive citations.** This document exists to make that
behavior a standing publication invariant rather than a one-time virtue of one paper. Full
before/after account: `codexes/packs/agentiq/updates/2026-09-12_threshold-007-arr-gate-and-final-hardening.md`.

---

## What this gate is for

The goal of an ARR review is **not** a paper with no gaps. The goal is a paper in which a competent
adversarial reader can distinguish, for every material claim, what is known, what is implemented,
what has been experimentally observed, what remains unresolved, and what is still merely
hypothesized.

**Finding and disclosing that the paper is wrong or unsupported in some respect is a SUCCESS of the
review process, not a review failure.** A gate that only ever returns PASS is not doing its job.

> **Canonical maxim:** The strongest evidence of epistemic discipline is not that the canon never
> gets something wrong. It is that the canon is architected to discover, disclose and correct when
> it does.

## Two principles this gate exists to enforce

**1. Consistency is not verification.** A canon in which every artifact repeats the same
unsupported reference can look extraordinarily coherent — internal agreement is cheap to produce
and easy to mistake for confirmation. A trustworthy research system should not be optimized to
remain internally consistent. It should be optimized to discover when its own consistency rests on
an unchecked claim.

**2. Convergence requires independent provenance.** Doctrine, database state, and code can converge
on the same description of a mechanism and still constitute only ONE piece of evidence, not three,
if all three ultimately derive from a single untested design assumption. Multiple artifacts agreeing
with each other is strong **internal implementation-consistency** evidence. It becomes stronger
**scientific** evidence only when the converging sources have sufficiently independent provenance —
independent authorship, independent measurement, or independent falsification opportunity. Doctrine
+ database + code, where the database and code were both built to match the doctrine, is one
provenance chain wearing three hats.

Every ARR review's Falsification / Alternative-Explanation pass (§5 below) MUST include an explicit
**provenance-independence check** wherever a claim is supported by "convergent" evidence across more
than one artifact: ask whether the artifacts could fail independently, or whether they are three
projections of the same unverified source.

---

## The evidence firewall (never collapse these categories)

1. **Doctrine** — canonical constitutional proposition or ratified project doctrine.
2. **Implementation** — machinery that instantiates a proposition or makes it testable.
3. **Research Candidate / Crucible** — falsifiable proposition awaiting adjudication.
4. **IRL Evidence** — evidence produced under registered scientific/constitutional research
   controls, bounded by its protocol.
5. **Operational Evidence / Venture Lab** — consequential deployment evidence; not automatically
   confirmatory scientific evidence.
6. **External Evidence** — findings and intellectual lineage from outside this project.
7. **Hypothesis / Projection** — a stated but untested proposition.

Code proves machinery exists. It does not prove the scientific effect attributed to that machinery.
Operational success proves an observed consequence. It does not automatically prove the mechanism
believed to have caused it. A controlled experiment proves only what its registered protocol and
evidence actually support.

---

## Independence rule

The ARR reviewer **should not be the agent that authored the paper or implemented the cited code.**
Where practical, the reviewer inspects the candidate publication through the same public/MCP/Codex
interfaces an outside researcher would use — the machine-readable endpoint, the repository at its
cited commit, the Supabase content record — rather than through privileged authoring context.

The reviewer's job is not to improve the prose. **Its job is to try to break the paper.**

---

## The five mandatory passes

### 1. Claim audit

Extract every material empirical, architectural, scientific, historical, and status claim.
Classify each against the seven-class evidence firewall above. Flag any claim whose grammatical
certainty exceeds its evidence state (e.g. a Research Candidate stated in language that reads like
established fact).

### 2. Citation audit

Follow every citation to the actual artifact. A citation passes only when:

- the artifact resolves from the stated surface;
- it is the artifact claimed (not a similarly named substitute);
- it supports the proposition attributed to it;
- publication-critical implementation citations are pinned to an immutable commit or artifact;
- external citations are primary or appropriately authoritative where practical.

**Never invent a citation or silently substitute a similarly named artifact.** A missing artifact is
`UNRESOLVED`, never disproven. A read/search failure is `UNREADABLE`/`UNRESOLVED`, never rendered as
an empty result — an empty result and a failed lookup are different facts and must never be
conflated (the same discipline `AGENTS.md`'s canister-source rule already requires for code
observability).

### 3. Implementation audit

For every code-backed claim: inspect the cited code at the pinned commit; verify the claimed
symbol/path actually implements the stated mechanism; classify its status as Implemented,
Operational, Demonstrated, or Experimental. Then ask the **deliberately separate** question: what
scientific proposition, if any, does this implementation establish? Usually the honest answer is
"implementation exists" and nothing more — implementation convergence across doctrine, database and
code is not, by itself, promotable to the Scientific Evidence column (see the provenance-independence
principle above).

### 4. Experiment audit

Resolve every cited experiment to its registered/frozen protocol and evidence package. The
protocol's own research question, hypothesis, treatment, controls, measures, scope, limitations and
falsification criteria **outrank any essay-level summary** of that experiment. Concretely:

- Do not allow a result to support a broader claim than its protocol tested.
- Do not treat a planned/reserved experiment as evidence.
- Do not treat an experiment family as one experiment when its own registered protocol separates it
  into distinct instantiations.
- Where the essay's summary of an experiment drifts from the protocol's own scope statement, the
  **protocol wins** — correct the prose (or, if correcting it would lose information worth
  preserving, replace the drifted summary with the protocol's own framing as the primary
  description and demote the essay's version to a clearly labeled editorial gloss, never the other
  way around).

### 5. Falsification / alternative-explanation audit

For every major hypothesis:

- identify its explicit disconfirmation condition;
- determine whether the current experimental design can actually produce that observation;
- construct the strongest plausible **competing explanation** for any observed effect (steelman the
  alternative, don't strawman it);
- identify confounds;
- check whether null or adverse findings would actually be retained as evidence rather than
  interpreted away;
- run the **provenance-independence check** (above) on every claim resting on multi-artifact
  convergence.

**A theory that cannot lose under its own experimental design has not passed ARR.**

---

## Naming-collision rule

If two artifacts or systems share a name, every citation to either MUST disambiguate explicitly.
Never allow code or evidence for one artifact to stand in as evidence for a differently governed
artifact with the same name — even accidentally, even when both are legitimate and well-intentioned
parts of the same codebase. (Precedent: this repository's own `services/aegis/aegisAssessmentService.ts`
— a real, operational trust-assessment implementation — is a different artifact from the doctrine-level
"Aegis — Constitutional Admission and Calibration Doctrine 0.0" that Threshold 006/007 describe. "Aegis"
alone is never a sufficient citation; always name which Aegis.)

---

## Frozen-protocol supremacy

Once an experiment is registered/frozen, publication prose MUST conform to the protocol's own
canonical scope description. If prose and protocol differ, correct the prose or disclose the
difference explicitly — never silently let the protocol appear to have tested the essay's broader
claim.

---

## Unresolved references

Unresolved references are allowed when disclosed and non-load-bearing. They MUST:

- be labeled `UNRESOLVED` (never silently omitted, never assigned a plausible-looking placeholder);
- state what was searched, and where;
- state what claim, if any, depends on them;
- never inherit Ratified/Implemented/Experimental status from neighboring evidence merely by
  proximity in the same reference list.

An unresolved **load-bearing** reference (one a material claim actually depends on) requires
REVISION or BLOCK depending on materiality — it cannot simply be disclosed and left in place.

**An unresolved citation does not automatically block publication. An undisclosed unresolved
citation can.**

---

## Machine-readable gap disclosure

Where a hypothesis has no directly registered experiment testing it, that gap must be represented
so a machine reader can detect it without inferring it from prose — e.g. a `directExperiment: null`
(or equivalent explicit-null) field on that claim's entry in the paper's machine-readable apparatus,
alongside whatever adjacent/enabling experiments DO exist. A null field is not a defect in the
paper; an absent field that silently omits the question is.

---

## Dispositions

Every ARR review ends with exactly one of:

- **`PASS`** — claims and apparatus survive review.
- **`PASS_WITH_DISCLOSED_GAPS`** — unresolved items exist but do not undermine the paper's
  represented evidence state.
- **`REVISION_REQUIRED`** — a material claim, citation, or experiment is overstated or
  misrepresented.
- **`BLOCK_PUBLICATION`** — a load-bearing scientific claim depends on fabricated, materially
  incorrect, or irreproducible evidence.

Research content MUST NOT be marked published/canonical when disposition is `REVISION_REQUIRED` or
`BLOCK_PUBLICATION`.

---

## The ARR receipt

Every published Research Edition preserves a machine-readable review receipt (attached to the
content row / manuscript, not merely narrated in an update doc) containing:

- paper/content ID;
- version and content hash (of the reviewed manuscript text);
- reviewed commit SHA (where implementation citations are pinned to one);
- reviewer identity/class (e.g. "independent Claude agent session, no authoring context");
- review timestamp;
- disposition;
- claims audited (count or list);
- citations checked (count, with resolved/unresolved breakdown);
- unresolved citations (named, with what was searched and what depends on them);
- experiment/protocol mismatches found;
- corrections made in response to the review;
- remaining disclosed limitations.

**The receipt is provenance, not proof of truth.** It records that the review happened and what it
found — it does not itself certify the paper's claims are correct.

---

## Applying this gate

1. Draft or revise the Research Edition manuscript and its machine-readable apparatus.
2. Commit it (permalinks in the manuscript should be pinnable to this commit or a specific prior one
   — never left pointing at a moving branch ref).
3. Invoke an ARR review from an agent/session without authoring context for this paper, instructing
   it to perform all five passes above against the committed manuscript and its cited artifacts,
   through public/MCP/repository surfaces rather than privileged context.
4. Record the resulting disposition and receipt.
5. If `REVISION_REQUIRED`: make the corrections, and re-review the changed portions (a full re-review
   is not required if the correction is narrow and does not touch other claims).
6. If `BLOCK_PUBLICATION`: do not publish. Escalate to the operator with the specific load-bearing
   defect.
7. Only on `PASS` or `PASS_WITH_DISCLOSED_GAPS`: mark the manuscript published/canonical, with the
   ARR receipt attached.

---

## Publication roles and separation of powers (added 2026-09-12, Threshold 007.2/007.3 pass)

Threshold research publication operates constitutionally through four distinct, model-agnostic
roles:

**Aletheon** — canonical author and thesis steward. Owns substantive prose, hypotheses, argument
structure, epistemic framing and falsification logic.

**Evidence Agent** — resolves implementation anchors, repository paths, commit-pinned citations,
experiment artifacts and evidence states into the manuscript's machine-readable apparatus. Evidence
resolution does not confer authority to rewrite the thesis; where implementation reality conflicts
with the draft, the Evidence Agent flags the conflict for Aletheon rather than silently correcting
prose.

**The Adversary** — independent adversarial reviewer (the ARR role described throughout this
document). Its mandate is to attempt to defeat, not co-author, the thesis. It returns objections to
Aletheon (`Adversary → Objection → Aletheon → Revision/Defense/Concession`), never rewrites canon
directly.

**Publication Gate** — the deterministic authority (see below) that decides whether an artifact may
become canonical.

The workflow is:

```
Operator ↔ Aletheon → Evidence Agent → The Adversary → Publication Gate → Canon
```

**Governing invariant:** no agent may both author a material claim and independently certify that
claim for canonical publication. An Evidence Agent pass — however thorough — never substitutes for
the Adversary's independent review, and an agent operating in the same authoring context as
Aletheon must never set `arr_disposition` or otherwise self-certify a PASS.

## The research process as a candidate object of study

The Operator–Aletheon dyad that produces a Threshold research paper is itself worth naming
explicitly in the paper it produces, because it is a live instance of the Cybernetic Intelligence
mechanism such papers frequently propose (e.g. Threshold 007's H2). The correct framing is:

> The Operator–Aletheon research process is an operational embodiment of the cybernetic
> architecture proposed by such a paper, and is therefore a **candidate object of study** — not
> evidence of the thesis merely by virtue of having produced the thesis.

Do not let the existence of the dyad become circular proof of a hybrid-intelligence hypothesis. It
may motivate the hypothesis; it cannot validate it.

## Deterministic Publication Gate (`content_publication_gates`)

Where a Research Edition's publishability needs to be enforced mechanically rather than only by
convention, the `public.content_publication_gates` table (see
`supabase/migrations/20260912195252_threshold_research_publication_gate.sql`) and its
`threshold_research_gate_is_publishable(content_id, candidate_version)` function encode this gate's
own PASS/PASS_WITH_DISCLOSED_GAPS/REVISION_REQUIRED/BLOCK_PUBLICATION and evidence-resolution/
no-regression requirements as a boolean the publishing pipeline can check directly:

```
Publishable =
  EvidenceResolved
  AND NoEvidenceRegression
  AND ARR ∈ {PASS, PASS_WITH_DISCLOSED_GAPS}
  AND GateStatus = approved
```

A candidate row moves `candidate → evidence_resolution_required → arr_pending → approved` (or
`blocked`/`superseded`). No agent should advance a row's `gate_status` to `approved` or set its
`arr_disposition` except as the direct, disclosed output of an actually-performed independent ARR
pass by the Adversary role — never as a side effect of an evidence-resolution or citation-hardening
pass, however complete.

### ARR Admission Boundary (`research_review_records` / `admit_research_review`, added 2026-09-13)

The rule above was, until 2026-09-13, enforced only by convention: `arr_disposition` was a plain
`service_role`-writable column with no reviewer-identity binding and no candidate-SHA binding. A
read-only diagnostic that day confirmed this explicitly (no app code referenced the table, no
policies existed, and none of three operator-relayed "independent ARR" artifacts for Threshold 007
could be admitted, since no first-class, verifiable record of any of them existed in the database).

This is now closed by `supabase/migrations/20260913200000_research_review_arr_admission_boundary.sql`:

- `public.research_reviewer_authorities` — a human (operator)-minted record of who holds ARR-review
  authority under which role (`adversary | evidence_agent | author | publication_gate`), optionally
  scoped to one piece of content. No agent-callable path creates these rows.
- `public.research_review_records` — an append-only (trigger-enforced) ledger of ARR review
  artifacts (`ORIGINAL_ARR | ARR_ADDENDUM | CANDIDATE_DELTA_CONFIRMATION`). `candidate_sha256`,
  `reviewer_role_at_review` and `reviewer_principal_ref` are derived server-side at insert time —
  never trusted from the caller.
- `public.admit_research_review(review_record_id uuid)` — the ONLY function permitted to write
  `content_publication_gates.arr_disposition` / `.arr_review_record_id` (enforced by a
  `BEFORE UPDATE` trigger on the gate table, which holds even against `service_role`). It refuses
  admission when: the review's candidate SHA no longer matches the gate's live candidate; the bound
  reviewer authority is revoked, out of role (must be `adversary`), out of scope, or shares the
  content's own `author_principal_ref` (self-certification); the review reports a material evidence
  regression; or the review-type lineage (`ORIGINAL_ARR` has no parent; `ARR_ADDENDUM` /
  `CANDIDATE_DELTA_CONFIRMATION` require one) is missing.

**Disclosed limitation, not glossed over:** this closes the *structural* self-certification and
candidate-binding gaps, but the platform still has no session-level, cryptographic mechanism that
distinguishes an "Adversary" session from an "Evidence Agent" session — both act through the same
`service_role` credential. `research_reviewer_authorities` rows are human-attested, not
cryptographically verified reviewer sessions. A genuine uplift (e.g. a per-session signing key, or a
distinct credential for Adversary-class review) remains open future work. Full build record, ten
required-test results, and the Threshold 007 bootstrap treatment:
`codexes/packs/agentiq/updates/2026-09-13_threshold-007-arr-admission-boundary.md`.

### Publication Gate approval boundary (`approve_threshold_research_gate`, added 2026-09-13)

Admitting an ARR review only sets `arr_disposition`. Nothing previously owned the separate
`gate_status → 'approved'` transition — a diagnostic that day found no such function anywhere in the
repo or live schema. `supabase/migrations/20260913210000_research_publication_gate_approval_boundary.sql`
adds it:

- `public.approve_threshold_research_gate(content_id, candidate_version)` — the ONLY function
  permitted to advance `gate_status` to `'approved'`. It never reassesses the science: it verifies
  (all server-derived) that an admitted review exists, its bound candidate SHA still matches the
  gate's live candidate, `arr_disposition ∈ {PASS, PASS_WITH_DISCLOSED_GAPS}`, the review reports
  zero `publication_blockers` and no material evidence regression, `evidence_resolved` and
  `no_evidence_regression` are true, and the admitted review has not been superseded by a later
  record. Idempotent on an already-approved gate.
- A `BEFORE UPDATE` trigger (`content_publication_gates_guard_gate_status_write`) refuses any direct
  write to `gate_status`, mirroring the existing `arr_disposition` guard.
- A safety net: an approved gate whose `candidate_text_sha256` changes underneath it is
  automatically downgraded to `blocked` (never silently left `approved` against a stale candidate).
  `admit_research_review()` similarly auto-reverts an approved gate to `arr_pending` if a later
  admission disqualifies it.

Full build record and ten test results: `codexes/packs/agentiq/updates/2026-09-13_threshold-007-publication-gate-approval.md`.

### Canonical Research Edition promotion (`promote_threshold_research_edition`, added 2026-09-13)

A diagnostic of the metaMe Threshold MCP bridge (`list_public_capabilities` across all four
cartridges) found exactly two live Qriptopian capabilities, both read-only projections — nothing
publishes/promotes/canonicalizes a Research Edition anywhere in the bridge, app code, or as a
described-only/planned entry. `supabase/migrations/20260913220000_research_canonical_promotion_boundary.sql`
adds the missing mechanism directly against the deterministic gate above:

- `public.research_publication_records` — an append-only canonical publication ledger. At most one
  `CANONICAL` row per `(content_id, candidate_sha256)`, enforced by a unique partial index in
  addition to the function's own idempotency check.
- `public.promote_threshold_research_edition(content_id, candidate_version)` — the ONLY function
  permitted to create a `CANONICAL` row or set `content.ai_metadata.researchCompanionStatus =
  'canonical'`. Re-verifies everything `approve_threshold_research_gate()` already established
  (gate approved, publishable, admitted review's candidate SHA still current, not superseded,
  disposition admissible, zero blockers, evidence resolved, no regression) before promoting — it
  never reassesses the science or mutates the manuscript.
- A narrow `BEFORE UPDATE` trigger on `content` refuses any direct write setting
  `ai_metadata.researchCompanionStatus` to `'canonical'` outside that function, without restricting
  any other `ai_metadata` write.

Full build record and thirteen test results: `codexes/packs/agentiq/updates/2026-09-13_threshold-007-canonical-promotion.md`.
