# CFS-051A — Prospective Evolution Roadmaps

**Status:** DESIGN / operating proposal  
**Extends:** `CFS-051_experiment-constitutional-registry.md`  
**Purpose:** give IRL / AgentiQ / metaMe one consistent pre-formal place for discoveries that emerge through research, development, conversation, exploration and experimentation without confusing proposals with ratified canon or shipped capability.

## 1. Why this extension is needed

CFS-051 already provides a pre-formal pipeline for candidate experiments, candidate constitutional principles, candidate invariants and research backlog. As the programme has matured, two additional proposal classes recur continuously:

- **architectural refinements** — changes to how the sovereign runtime, iQube plane, constitutional spines, control planes or service boundaries should be structured;
- **capability proposals** — capabilities the platform may need to research, design, develop or integrate before they can enter the shipped Constitutional Capability Registry.

These should not be buried in prose, scattered update notes, or prematurely promoted into canonical specifications / shipped registries.

The operating model should therefore present four persistent prospective roadmaps.

## 2. The four roadmaps

### Roadmap A — Proposed Invariants

**Question:** What must remain true?

Existing home: `research_candidate_invariants` under CFS-051.

Lifecycle:

`candidate → proposed-for-canonization → canonized | rejected`

Promotion target: the existing canonical invariant corpus and its human canonization ceremony.

Examples include structural, epistemic, constitutional, engineering, sovereignty and representation invariants.

### Roadmap B — Proposed Experiments

**Question:** What must we test?

Existing home: `research_candidate_experiments` under CFS-051.

Lifecycle:

`proposed → scoped → protocol-ratified → running → evaluated → published → promoted | archived`

Promotion target: the existing formal `EXPERIMENT_REGISTRY` / formal experimental protocol process.

An invariant proposal does not automatically require an experiment. Experiments are created only where an empirical or falsifiable test is warranted.

### Roadmap C — Proposed Architectural Refinements

**Question:** How might the system need to change?

Examples:

- sovereign-runtime state custody;
- new constitutional seams between existing components;
- iQube extension blocks or new composition patterns;
- privacy / identifiability envelopes;
- control-plane boundaries;
- authority and mandate representation;
- connector architecture for Constitutional Service Providers.

**Interim home:** CFS-051 `research_backlog_items`, with explicit `architecture` source notes / references. This avoids creating a parallel registry before the lifecycle is ratified.

**Proposed future lifecycle:**

`observed → framed → architecture-candidate → design-reviewed → specified → implemented | rejected`

Promotion target: a real CFS / SPEC / PRD architecture document and, where appropriate, implementation work.

Architecture proposals must state what existing substrate they extend and must not silently create a competing primitive, spine, registry or runtime.

### Roadmap D — Proposed Capabilities

**Question:** What new ability may the system need?

A capability proposal is not a shipped capability. It may arise from research, an architectural refinement, a partner need, an operational gap or a newly demonstrated invariant.

**Interim home:** CFS-051 `research_backlog_items`, cross-referenced to relevant invariant / experiment / architecture candidates.

**Proposed future lifecycle:**

`idea → scoped → capability-brief → build-candidate → validated → shipped → constitutionally-accepted`

Promotion target: the existing Constitutional Capability Pipeline and ultimately `services/constitutional/capabilityRegistry.ts` only after the capability is actually shipped and accepted. The shipped capability registry must never be used as an ideas backlog.

## 3. One discovery may populate multiple roadmaps

A single research conversation may legitimately produce several distinct objects. They should be captured separately rather than collapsed.

Example: authority provenance and privacy.

**Invariant proposal:** authority must not be inferred from personhood alone.

**Architecture proposal:** attach independently revocable Authority Credentials / AuthorityQubes to a constitutional subject inside a privacy-preserving iQube/DIDQube envelope.

**Experiment proposal:** only if a falsifiable uncertainty needs testing, e.g. whether authority-provenance verification rejects illegitimate mandates that identity-only authorization accepts.

**Capability proposal:** later, a concrete Authority Credential Resolver or Mandate Authority Inspector.

The dependency graph therefore runs in both directions:

`Invariant ↔ Experiment ↔ Architecture ↔ Capability`

but none of these classes automatically promotes another.

## 4. Promotion discipline

The four roadmaps are **prospective**, not canonical.

- A proposed invariant is not an invariant in canon.
- A proposed experiment is not a ratified experiment.
- A proposed architecture is not a platform architecture decision.
- A proposed capability is not a shipped or constitutionally accepted capability.

Every roadmap must preserve provenance, dependencies, review history and the artifact into which a proposal is eventually promoted.

The four roadmaps should eventually be rendered together in the IRL research surface as one **Evolution Pipeline** with four views rather than four disconnected registries.

## 5. Extend-don't-duplicate boundaries

This proposal composes existing authorities:

- CFS-051 remains the pre-formal research pipeline.
- `types/research.ts::EXPERIMENT_REGISTRY` remains the ratified/shipped experiment authority.
- the canonical invariant corpus remains the invariant authority.
- CFS / SPEC / PRD documents remain the architecture/specification authority.
- `services/constitutional/capabilityRegistry.ts` remains the registry for **shipped, constitutionally accepted capabilities**, not speculative capability ideas.
- CFS-004 remains the governing reference for iQube evolution; terms such as `DIDQube` and `AuthorityQube` are candidate architectural language until reconciled with that substrate.

## 6. Near-term implementation recommendation

Do **not** create new schema merely to satisfy the conceptual four-roadmap model in this turn.

Use the existing CFS-051 candidate-invariant and candidate-experiment tables immediately. Capture architecture and capability proposals in the existing research backlog with explicit type/provenance notes until enough real proposals exist to validate their lifecycle and fields.

After several real entries have accumulated, inspect the evidence and decide whether CFS-051 should evolve either by:

1. adding first-class `research_candidate_architecture` and `research_candidate_capabilities` tables; or
2. generalising the proposal substrate into one typed `research_proposals` model while preserving the existing formal promotion targets.

That choice should be evidence-led rather than guessed now.

## 7. Current candidate architecture — AuthorityQube / privacy-preserving authority

The current authority-provenance discussion is the first explicit architecture entry under this model.

Working proposition:

**Polity Passport** anchors constitutional personhood.  
**Authority Credentials / AuthorityQubes** represent independently issued, scoped, delegable, expiring and revocable authority.  
**iQube / candidate DIDQube envelope** manages privacy, identifiability, disclosure policy and confidential evidence.  
**Mandate** delegates a specific subset of valid authority.  
**Execution control** verifies sufficient authority provenance and consequence before consequential action.

Candidate privacy principle:

> A verifier should receive the minimum sufficient proof of authority required for an act rather than unnecessary identity or institutional disclosure.

The exact AuthorityQube / DIDQube shape is intentionally unresolved. It must first be reconciled with CFS-004's existing `metaQube / blakQube / tokenQube` architecture and staged extension discipline.
