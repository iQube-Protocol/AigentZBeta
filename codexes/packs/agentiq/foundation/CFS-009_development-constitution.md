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

---

## Enforcement

- This constitution binds all agents working on the codebase (Claude Code, Codex, Lovable, future agents), alongside `CLAUDE.md` — which functions as the operational rulebook beneath these laws.
- Laws are amended only by constitutional process: proposal → operator ratification → record in `AMENDMENT_RECORDS.md` (polity-core) → DVN anchoring.
- Each law's canonical-invariant form lives in Appendix A and is loaded into agent context at session start once knowledge initialization (CFS-006 §3) ships.
