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

## Law XIII — Individualization
*(Amendment, ratified by operator direction 2026-07-03.)*

Personhood establishes existence. **Individualization establishes constitutional continuity.** Identity establishes recognizability. Standing establishes constitutional capability. These are four distinct constitutional primitives — not four names for one thing — and the chain of legitimacy is bifurcated at the point personhood resolves into a constitutional subject:

```
                 PERSONHOOD
                       │
                       ▼
              INDIVIDUALIZATION
                (constitutional subject)
                  ╱             ╲
                 ╱               ╲
                ▼                 ▼
          STANDING            IDENTITY
               │                  │
               ▼                  ▼
          AUTHORITY         REPUTATION
               │
               ▼
        BOUNDED DELEGATION
               │
               ▼
             AGENCY
```

**Individualization** is the missing primitive this bundle had been dancing around: the establishment of a constitutional subject capable of accruing Standing *without* that subject being identifiable. Standing must attach to *someone* — but "someone," constitutionally, does not require "someone named."

### Corollary I — Continuity, not identifiability, is what Standing requires
Individualization is what makes Standing possible, and individualization is defined by **continuity**, not by disclosure. A constitutional subject persists across time and across interactions — the same subject today as yesterday — and it is exactly that persistence, and nothing else, that lets validated action accumulate into Standing. Identifiability is a separate, optional property layered on top; it is never a prerequisite for constitutional participation.

> Personhood precedes individualization. Individualization precedes standing. Identity is an optional derivative of individualization rather than a prerequisite for constitutional participation.

### Corollary II — Identity is a branch, not a gate
Identity is not what the Constitutional Internet is built on top of; it is one optional branch of individualization, alongside Standing:

```
Individualization
      │
      ├── Standing   (constitutional capability)
      └── Identity   (recognizability → Reputation)
```

This inverts the current internet's model, where identity gates everything else:

```
current internet:            constitutional internet:

Identity                     Personhood
   │                             ↓
   ▼                        Individualization
Everything else                  ↓
                             Standing → Authority → Delegation → Agency
                             (Identity branches off, optional)
```

The Polity Passport is legible under this law: it was never proving identity — it establishes constitutional individualization. Identity is one possible credential *inside* that, not its precondition.

### Corollary III — The re-identification boundary is a target, not a fixed grant
Individualization's continuity must be maintained without requiring re-identification by *any* party — including the server that hosts the constitutional subject's records. The current engineering tier (T0: `creator_persona_id` and equivalents, server-internal, never serialised to browser or chain — see the Identity & Access Spine) is an **operational necessity of the present implementation**, not the constitutional ceiling. The constitutional target is a cryptographic (zero-knowledge) continuity layer under which even server-side operators cannot reverse a constitutional subject's continuity signal to a real-world identity, while the *same subject* remains verifiably the same subject across every interaction. Standing accrues on that continuity; re-identification — by the network, by the server, by anyone but the citizen — is never required to make it accrue. Implementation of the T0 tier converges toward this target; it does not define its limit.

### Implementation consequence
`creator_persona_id` / `curator_persona_id` (T0) on the invariant substrate, and `persona_id` across the platform generally, are the current engineering approximation of individualization: continuity maintained server-side, pending the ZK continuity layer that removes even that reversibility. No code introduced under this law may treat T0 server-visibility as constitutionally required — it is scaffolding. Standing computations (Law XII) already depend only on validation signals attached to a continuous subject reference, never on that subject's identity — this law names why that separation was correct.

*(Amendment note, 2026-07-04: the Constitutional Subject Model diagram above is the canonical constitutional ordering — it strengthens and supersedes the shorthand "personhood precedes identity" as the ordering statement. Identity is one possible manifestation of an individual; Standing is another; the two branches never collapse into one another. That non-collapse is what makes anonymous constitutional participation possible.)*

## Law XIV — Constitutional Coherence
*(Amendment, ratified by operator direction 2026-07-04. Full executable specification: CFS-014.)*

**Every constitutional experience shall be rendered as a coherent composition of multiple invariant classes operating simultaneously within a shared constitutional context.**

Ontology defines meaning. Graph defines relationships. Composition Laws (CFS-013) define local computation. **Constitutional Coherence ensures they collectively express a single constitutional reality.**

Individual invariant classes may compose correctly in isolation while failing collectively — the failure living in no invariant but in the interaction between them. Coherence is therefore evaluated over the complete experience as a field, never as a sum of independently validated layers. No renderer executes until Constitutional Coherence succeeds (fail-closed; operator waiver per Law XI). Knowledge composes locally; experiences succeed globally through coherence.

## Law XV — Compositional Fields
*(Ratified 2026-07-04 — discovered by the implementation teaching the theory: EXP-002's first production brief. Law XIV governs the judgment of a composed experience; this law names the object being judged. Generalized 2026-07-06 — operator + agent co-authored: the original statement scoped the law to constitutional experience; the same compositional mathematics turned out to govern biology, engineering, operating systems, civilization, and intelligence, so the statement below is now the universal form. The ontological definition of "field" itself — what it is, not merely how it behaves — now lives in CFS-002 §2a; it was the missing layer this generalization exposed.)*

**Every coherent system is the composition of independently verifiable invariant fields, and the composition is multiplicative, not additive: changing any field changes the whole system. Constitutional experiences are one expression of this general principle.**

*(The original 2026-07-04 statement — "every constitutional experience is the composition of independently verifiable invariant fields" — remains constitutionally recorded as `inv.experience.072` and stays true: it is the constitutional-scoped instance of the universal law above, not superseded content, only superseded scope.)*

```
Semantic × Style × Narrative × Experience × Context  =  Experience
(what may   (how it is  (when it is   (to whom it    (under which
be expressed) expressed)  expressed)    is expressed)   conditions)
```

Fields are **locally independent and globally dependent** — each verifiable in isolation, none inert in composition. The invariant substrate is therefore not only a graph (relationships) but a **constraint field**: the composition engine does not concatenate the fields, it solves them simultaneously. The graph is the substrate; composition is the operation; the Composition Engine (today: the brief generator executing CFS-013's per-namespace laws) is the named orchestrator over it.

Because every field can be locally correct while the failure lives only in an interaction (evidence at ratification: EXP-002's terminal-beat defect — semantic, style, and narrative each individually correct; the arc's resolution lost in the mapping between the narrative field and segmentation — caught by CFS-014, fixed same day), correctness of a composition **cannot be evaluated locally**. This law entails Law XIV rather than duplicating it.

**Corollary — class purity.** A composed block that spans invariant families is scaffolding. The v1 Continuity Block mixes four: style (lighting, camera, palette), identity continuity (same protagonist, world, timeline), semantic constraint (visual metaphors correspond to grounding invariants), and state continuity (each segment begins from the prior segment's final state). Such blocks dissolve into their constituent classes as those classes are ratified (Law X); no code may treat the mixed block as constitutionally final.

The experience and context fields are named slots, not yet implemented — experience-namespace invariants will govern *to whom*, context invariants *under which conditions*. Naming them before building them is Law IV applied to this law itself.

**Corollary — Constitutional Sequencing.**
*(Amendment, ratified by operator direction 2026-07-05. A sub-law of composition, not a new primitive: it lives inside Law XV, beneath Law XIV's judgment.)*

**Constitutional fields shall compose according to a constitutionally valid sequence. Correct components arranged in an invalid sequence do not constitute a coherent experience.**

Composition answers *what belongs together*; sequencing answers *in what order it must unfold*; coherence (Law XIV) answers *whether the resulting whole faithfully expresses the constitutional intent*. These are three distinct kinds of correctness — local (is each field internally valid?), relational (do the fields agree with each other?), and temporal (do they occur in constitutional order?) — and a composition may satisfy any two while violating the third. Evidence at ratification: the EXP-002 terminal-beat defect, re-read. Nothing was wrong with any narrative beat, any style rule, any semantic grounding, or the rendering — every component was locally and relationally correct. The failure was purely temporal: completion never appeared, so transformation was left ungrounded. The full sequence specification lives in CFS-013 §7; the executable check is CFS-014's sequencing layer (first instance: the narrative monotonicity/endpoint validator that caught the defect, regression-pinned in `tests/video-invariant-brief.test.ts`).

The progression this corollary completes:

```
Fields → Composition → Sequencing → Coherence → Experience
```

## Constitutional principle — Constitutional Evolution
*(Ratified by operator direction 2026-07-04. A principle, not a law: it describes how laws come to be, so it stands above the numbered sequence rather than inside it.)*

**Constitutional evolution occurs when the constitutional system detects a coherent pattern that no individual field reveals, and that pattern is subsequently ratified by human constitutional authority.**

This is neither autonomous legislation nor autonomous governance. It is autonomous
constitutional *discovery* followed by human ratification: the system reveals; humans
ratify; the constitution evolves. First instance: Law XV itself — the Coherence Engine
(CFS-014) detected an interaction pattern (the terminal-beat defect) that no individual
field revealed, and the pattern it exposed was ratified into law the same day. The
validator did not legislate. It revealed. The division of authority is Law XI's:
humans define semantics — including, and especially, the semantics of new laws.

---

## Constitutional principle — Constitutional Emergence
*(Ratified by operator direction 2026-07-05. A principle, not a law: it names the bridge between Law XV and Law XIV rather than adding a rung between them.)*

**Constitutional coherence is not merely the presence of correct components, but the emergence of a valid whole through correct composition and correct sequence.**

No individual field contains the final experience — and even the correct fields placed together are insufficient if they are assembled in the wrong order, because some constraints become unsatisfiable once others are fixed (the terminal-beat defect: once segmentation consumed the arc without anchoring its endpoint, no amount of local correction could restore completion). The valid whole emerges only when identity, relationship, and sequence are simultaneously respected. Law XV tells us what composes. Constitutional Sequencing (its corollary) tells us how it must unfold. Law XIV judges whether the resulting whole constitutes a coherent constitutional experience. Together they complete the logic of consequence engineering (CFS-006a §7): not just what exists, but how it comes into being.

---

## The canonical paragraph

> Information becomes knowledge through reasoning. Reasoning discovers invariants. Validation establishes their standing. Civilization advances by preserving, composing, and extending them.

---

## Enforcement

- This constitution binds all agents working on the codebase (Claude Code, Codex, Lovable, future agents), alongside `CLAUDE.md` — which functions as the operational rulebook beneath these laws.
- Laws are amended only by constitutional process: proposal → operator ratification → record in `AMENDMENT_RECORDS.md` (polity-core) → DVN anchoring.
- Each law's canonical-invariant form lives in Appendix A and is loaded into agent context at session start once knowledge initialization (CFS-006 §3) ships.
