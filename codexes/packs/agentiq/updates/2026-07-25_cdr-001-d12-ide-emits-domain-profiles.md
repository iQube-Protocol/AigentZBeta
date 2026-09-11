# SPEC-CDR-001 D-12 ratified — the IDE emits Candidate Domain Profiles

**Date:** 2026-07-25 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha` · **Spec:** `codexes/packs/irl/foundation/SPEC-CDR-001_constitutional-domain-resolution.md` · **Docs-only**

## A correction first — the spec was asserting something the codebase contradicts

§8.2 said the operator's directive used "IDE" while *"the codebase has IRE (Resolution), IPE (Projection), KRE (Knowledge), CFO (Observatory)"* — implying no Invariant Discovery Engine existed and the name had to be mapped onto one of the other four.

**That was false.** `services/invariants/discoveryEngine.ts` **is** the IDE — CFS-048 Phase 0, live behind `/api/invariants/discovery`, with a five-stage pipeline (Evidence Collection → Candidate Extraction → Synthesis → Validation → Canonical Publication), a `discovery_evidence` store, `DiscoveryScopeLevel` of `'domain' | 'sub-domain' | 'capability'`, cross-evidence convergence, sub-domain comparison, and a `promoteCandidate` path that lands candidates at `proposed` and never auto-canonises.

The error survived into a ratified document because the earlier survey enumerated the four engines with CFS numbers and stopped there. It is corrected in place rather than quietly patched, because a spec that misstates what exists will produce a build that reimplements it.

## The reframing that unlocked the decision

The operator's shift, which is the substance of the ratification:

> The question is no longer *"which engine should generate Domain Profiles?"* It becomes *"which existing constitutional pipeline should emit Domain Profiles as one of its artifacts?"*

Those are materially different questions, and only the second has a clean answer.

## D-12 — RATIFIED

**The IDE emits Candidate Domain Profiles as discovery artifacts.** Not replaced, not duplicated, and **not renamed**.

### The pipeline stays one-directional (§13.1)

```text
Evidence → Invariant Discovery Engine → Candidate Invariants
        → Candidate Constitutional Structure → Provisional Domain Profile
        → Human Verification → Verified Domain Profile → IRE consumes → IPE projects
```

**Nothing downstream generates structure.** That constraint is what keeps the four responsibilities clean:

| Engine | Responsibility | Prohibition |
|---|---|---|
| **IDE** | Produces constitutional knowledge — candidate invariants, relationships, governance constraints, Domain Profiles | — |
| **IRE** | Consumes it; resolves the correct field for an intent | Never produces it |
| **IPE** | Consumes resolved fields; produces projections | Never discovers, never resolves |
| **KRE** | Decides whether to reuse; **may request** discovery | **Cannot perform** it — "recommend, never silently create" (Law XI) is untouched |

Routing generation into IRE or IPE would put a cycle in a deliberately one-directional pipeline — the resolver producing what it resolves. Routing it into KRE would break the rule that exists to prevent the CS-001 duplicate-capability defect at the knowledge level.

### The IDE is not renamed (§13.2)

I had raised renaming, on the grounds that producing constitutional structure is a larger remit than "discovery" implies. **The operator ruled against it and the reasoning is adopted:**

> The IDE is still discovering invariants. The Domain Profile is not an independent discovery — it is a **projection of discovered invariants into an operational artifact.**

`Evidence → Invariant Discovery → Constitutional Structure → Operational Artifact`. The profile lives in boxes three and four; it doesn't redefine box two. The correct statement is *"the IDE becomes the constitutional-structure producer **because** constitutional structure is derived from discovered invariants"* — not *"the IDE is now a constitutional modelling engine."* The spec records the second framing as a bridge too far, so it doesn't re-enter the corpus later.

### Discovery Artifacts — the missing abstraction (§13.3)

Rather than "the IDE produces Domain Profiles", which makes profiles special, the output set is formalised as one class:

```text
IDE → Discovery Artifacts { Candidate Invariants · Candidate Relationships
                          · Candidate Governance Constraints · Candidate Domain Profiles }
    → Verification → Canonical Publication
```

Everything the IDE produces follows the same governance lifecycle. Profiles are a member of it, not an exception to it.

### The binding wording (§13.4, operator's text verbatim)

> **The IDE emits Candidate Domain Profiles as discovery artifacts. Candidate Domain Profiles follow the same verification and promotion lifecycle as other IDE outputs and SHALL NOT become canonical without verification.**

Any doc or surface saying "the IDE generates Domain Profiles" is using the wrong terminology and should be corrected to this.

### Abstention binds the generator too (§13.5)

Where confidence is insufficient the IDE does not fabricate, infer, or best-guess — it returns **unknown**, or **provisional — verification required**. A generated profile enters at `assertionProvenance: 'discovered'` with a mandatory `confidence` (D-6, already enforced by the type union shipped in P2) and `verificationStatus: 'provisional'`; only human verification reaches `verified`. That mirrors the IDE's own `proposed`-until-validated discipline (`inv.reasoning.337`) instead of inventing a second governance path.

## Register effects

| Decision | Before | After |
|---|---|---|
| **D-12** | Open — blocking P5, P6 | **RATIFIED** |
| **D-13** (Horizen pilot) | Ratified as *deferred until D-2/D-3/D-12 resolved* | **Deferral discharged** — all three resolved, so it reverts to a live operator call |
| **D-8** (`ire://` resolvable or documentary) | Open, soft | Unchanged — the only decision still open, and nothing depends on it under the documentary interim ruling |

**No decision now blocks any remaining CDR phase.** P5 (L3 provisional discovery + abstention UI) and P6 (agent classification) are unblocked; P6 additionally wants D-13's pilot authorisation. Per §10.3, the Horizen pilot's subjects are likely **agents rather than hostnames**, which puts P6 nearer the critical path than its phase number suggests.

## Review

- Spec §8.2 (correction), §13.1–§13.5 (the ratified pipeline): `codexes/packs/irl/foundation/SPEC-CDR-001_constitutional-domain-resolution.md`
- In-app: `https://dev-beta.aigentz.me/triad/embed/codex/agentiq-codex?tab=updates`

No code, no SQL — this ratification changes what the next build may do, not what the current build does.
