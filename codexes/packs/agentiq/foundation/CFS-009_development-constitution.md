# CFS-009 — The Chrysalis Development Constitution

**Chrysalis Foundation Specification · v0.1 · Status: draft**
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`

Not coding standards. **Architectural laws.** These govern every evolution of the AgentiQ platform under the Chrysalis programme, by every agent and every human. Each law is itself a canonical invariant in the `engineering` namespace (Appendix A).

---

## Law I — Preserve before Replace
No working system is discarded while it works. Evolution wraps, extends, and supersedes; it does not delete. (Precedent: the canonical registry plane was laid *alongside* the legacy surface, not over its ruins.)

## Law II — Extend before Recreate
Before building, search. The terminology bridge (CFS-000 §7) exists because most concepts in this bundle already have living ancestors. A parallel implementation of an existing capability is a defect, not a contribution.

## Law III — Compose before Specialize
New capability is first attempted as composition of validated primitives. Specialization is justified only when composition demonstrably cannot express the need. (Precedent: VentureQube as a ClusterQube specialization; SkillQube/ConnectorQube/WorkflowQube collapsed into ToolQube + subtype.)

## Law IV — Discover Invariants before Designing Abstractions
Abstractions encode invariants. Designing the abstraction before discovering the invariant produces speculative architecture. Extract what is true from the working system first; then name it.

## Law V — Compress Expertise before Automating It
Automation without compression hard-codes one path through un-understood territory. First compress the expertise (what is invariant about this work?); then automate over the invariants.

## Law VI — Separate Architecture from Rendering
The experience architecture is canonical; its rendering is contextual (CFS-007). No architectural decision may live inside a renderer adapter, and no renderer concern may leak into canonical contracts.

## Law VII — Separate Reasoning from Inference
The system must always know whether it is discovering knowledge (expensive, provenance-recorded, validation-bound) or applying it (cheap, citation-bound). Conflating the two destroys both explainability and the economics of compression.

## Law VIII — Treat Invariants as First-Class Computational Primitives
Invariants have identity, lifecycle, provenance, confidence, standing, and versioning (CFS-001). They are not comments, docs, or prompt fragments — they are addressable objects the runtime loads, cites, and evolves.

## Law IX — Adaptive Systems Render. Canonical Systems Govern.
The runtime adapts; the Registry governs. State that must be true lives in canonical systems and is loaded by adaptive ones — never the reverse. An adaptive surface that accumulates ungoverned truth is a constitutional leak.

## Law X — Every Evolution Must Strengthen the Invariant Ontology
Each change either adds validated invariants, raises confidence in existing ones, or refines the ontology. A change that weakens or bypasses the ontology is regression regardless of the feature it ships. (Review question for every PR under the programme: *which invariants does this strengthen?*)

## Law XI — Humans define semantics. AI should optimize implementation.
Meaning is ratified by humans (canonization queue, operator approval, the Polity). Agents propose, extract, compare, and optimize — they do not decide what is true or what words mean. This law is the bridge to the Polity's own constitution: authority may be delegated; sovereignty may not.

## Law XII — Truth, Standing and Reach
*(Amendment, ratified by operator direction 2026-07-03.)*

Truth is not established by Standing. Standing is established through the repeated validation of truth within its domain of applicability. Reach measures adoption, not validity.

Standing shall never be interpreted as a measure of popularity, consensus, commercial success, or frequency of use. It represents the accumulated constitutional confidence earned through evidence, reasoning, validation, successful consequence, and durable application.

Accordingly, every invariant possesses three independent constitutional dimensions:

- **Truth** — the extent to which the invariant accurately represents reality, constitutional principle, or operational law within its stated domain of applicability.
- **Standing** — the constitutional confidence earned through repeated validation, successful composition, consequence, and enduring coherence over time.
- **Reach** — the extent to which the invariant has been adopted, referenced, implemented, or utilized across systems, communities, or applications.

These dimensions are orthogonal and shall never be conflated. High Reach does not imply Truth. High Standing does not imply universal applicability. Low Reach does not diminish foundational truth. Emerging invariants may possess profound truth before they have accumulated Standing, while established invariants may retain high Standing within a limited domain of applicability even as broader invariants are subsequently discovered.

### Corollary I — Domains of Applicability
Every invariant exists within one or more domains of applicability. The discovery of a broader or more general invariant does not invalidate narrower invariants operating within their appropriate domains — broader invariants generalize, contextualize, or extend prior understanding. Scientific progress proceeds through progressive generalization rather than wholesale replacement (classical mechanics remains operationally valid within its domain after relativity).

### Corollary II — Constitutional Evolution
Invariant Intelligence treats knowledge as an evolving constitutional system. Candidate invariants emerge through reasoning; validation establishes constitutional confidence; Standing accumulates through durable validation; knowledge evolves through refinement, contextualization, and generalization. No invariant is immutable solely by virtue of historical standing; no newly discovered invariant is dismissed solely because it has not yet accumulated standing. The constitutional process exists to let knowledge mature without conflating novelty, popularity, authority, or utility with truth.

### Corollary III — Constitutional Responsibility
Constitutional actors — humans, organizations, and agents — may contribute to the discovery, refinement, validation, and composition of invariants. Once established, an invariant stands independently of its discoverer. Its provenance shall always be preserved. Its contributors shall always be acknowledged. Its Standing shall accrue through constitutional validation rather than authorship. Knowledge belongs to civilization; provenance belongs to its contributors.

### Implementation consequence
The substrate separates the dimensions structurally: Standing is computed only from validation-class signals (`times_validated`, `times_contradicted`); **Reach** is a distinct computed dimension over adoption-class signals (`times_referenced`, `times_used`). See `services/invariants/lifecycle.ts` (`computeStandingScore`, `computeReachScore`) and migration `20260703230000_law_xii_truth_standing_reach.sql`. Truth is never a stored number — it is what validation estimates, bounded by confidence and domain.

---

## The canonical paragraph

> Information becomes knowledge through reasoning. Reasoning discovers invariants. Validation establishes their standing. Civilization advances by preserving, composing, and extending them.

---

## Enforcement

- This constitution binds all agents working on the codebase (Claude Code, Codex, Lovable, future agents), alongside `CLAUDE.md` — which functions as the operational rulebook beneath these laws.
- Laws are amended only by constitutional process: proposal → operator ratification → record in `AMENDMENT_RECORDS.md` (polity-core) → DVN anchoring.
- Each law's canonical-invariant form lives in Appendix A and is loaded into agent context at session start once knowledge initialization (CFS-006 §3) ships.
