# Constitutional Glossary

**Canonical vocabulary of Operation Chrysalis 2.0 and the Human Agency System · v1 · Ratified 2026-07-06**
Companion to CFS-015. **This glossary is runtime-resolved**: the Canonical Ontology Service (`services/constitutional/ontologyResolver.ts`) loads it as a terminology-canon source, so Alethean, Aigent Z, and every specialist agent resolve against ONE constitutional vocabulary. Terms are `## headings`; the first paragraph under each heading is its canonical definition. This ontology deliberately lives outside implementation and is referenced by it.

*(Format contract for the resolver: one term per `## heading`; definitions in prose; forbidden variants, when any, on a line containing `never "…"`.)*

---

## Human Agency System

The platform as a constitutional whole — the environment in which humans and agents reason, develop, operate, and improve under constitutional governance. Operation Chrysalis 2.0's subject and product.

## Constitutional Computing

Computing in which every reasoning surface and every rendering surface is governed by Invariant Intelligence: meaning resolves against canonical ontology before reasoning, composition obeys ratified laws, coherence is validated before rendering, and every consequential act is receipted. Deepened definition (CFS-031, 2026-07-15): Constitutional Computing is a cybernetic system in which every action produces evidence that continuously improves both the operating system and the constitution, allowing evolving code to remain aligned with enduring constitutional principles — a fast loop (code: agents, prompts, models, workflows — intentionally high-variance) continuously reconciled against a slow loop (constitution: invariants, standing, ratified principles — intentionally low-variance), with Standing as the membrane carrying evidence from the fast loop into the slow one. Never reduce this to "AI governed by rules" — the constitution is not a static constraint but the attractor code is continuously reconstituted around.

## Reconstitution

The convergence half of constitutional evolution (CFS-031 §3): capability diverges from the constitution when new code answers a new consequence (the fast loop doing its job), then reconverges when that code's evidence, carried by Standing, ratifies a principle and the constitution reasserts itself over the codebase. Not a one-time gate a build passes through — a continuous process with no final form; the Chrysalis metaphor names this state, not a transition between two stable ones.

## Transaction Reconstitution

Not the same property as Reconstitution above (CRP-003 §7.3, 2026-07-16, distinguished deliberately to avoid a near-collision under one name). Reconstitution is SYSTEM-level: the platform's ongoing convergence of code and constitution. Transaction Reconstitution is per-TRANSACTION: a constitutional receipt trail must, by itself, be sufficient to reconstruct one completed transaction's original intent, Constitutional Agreement, delegated authority, executing agent, outputs, verification, settlement, and standing impact — a replay/audit property, not a claim about platform evolution. A Transaction-Reconstitutable receipt is the unit of evidence that feeds the (unchanged) Reconstitution process; the two terms compose, they are not synonyms.

## Constitutional Agreement

The candidate constitutional primitive (CFI-002, CRP-003 §5/§7.1, added 2026-07-16) that must exist before delegated execution: an explicit, attributable, machine-readable record binding requesting operator, requested capability, selected agent, delegated authority, constraints, verification requirements, and settlement terms. Provider-agnostic by the "primitives are invariant, providers are replaceable" rule (CFS-018 amendment) — `x409` is the first candidate implementation, not the definition. Distinguished from Bounded Delegation (the authority an agreement, once formed, exercises) and from Standing (which qualifies who may be party to an agreement in the first place).

## Constitutional Coherence

Two complementary readings, both ratified. (1) Structural (CFS-022, 2026-07-15): every layer of the stack — a route handler, a capsule, a pipeline stage, a receipt writer — converges on asking the same six questions before acting: what already exists, what authority do I have, what capability is required, what consequence will this produce, what evidence will result, what standing should accrue. (2) Dynamic (CFS-031, 2026-07-15): the continuous alignment of evolving capabilities with enduring constitutional principles through evidence, standing, and reconstitution — the property that makes a system constitutionally COHERENT rather than merely constitutionally CONSTRAINED, and the upstream property that "AI safety" or "AI governance" describe only downstream symptoms of.

## Standing

The constitutional memory of accumulated trust — orthogonal to Reach (Law XII, Appendix A: Standing is accumulated trust from validated outcomes; Reach is adoption/citation; never conflate the two). Standing accrues to more than persons: delegates (`services/homecoming/delegateStanding.ts`, CFS-023), invariants (the crystal's `proposed → validated → canonical` climb, Appendix A), and any ConstitutionalObject's `standing` facet (CFS-025). CFS-031 §2 names the completed scope: Standing evaluates people, agents, capabilities, hypotheses, experiments, and research programmes — and names its structural role as the MEMBRANE by which fast-loop evidence crosses into slow-loop constitutional change (`Action → Evidence → Standing → Confidence → Invariant Candidate → Ratification → Constitution`).

## Signal

An OBSERVATION — e.g. "many Founder Operators need financial agents" (CFS-031 §6). Distinct from a Hypothesis, which EXPLAINS a signal. Conceptual vocabulary as of 2026-07-15; no governing invariant is seeded for this term yet — it does not gate composition or anything else until a future seed-and-ratify pass adds one.

## Hypothesis

An EXPLANATION proposed for a Signal — e.g. "standing-informed agent selection reduces Time-to-Value for financial workflows" (CFS-031 §6). Three proposed sources: market-led (from Founder Operator intents), constitutional-led (from the Institute's own theory — the only source exercised as of 2026-07-15, e.g. every CCE-series experiment), and community-led (from participant submissions). All three are designed to converge on the SAME experimental pipeline (CFS-019 Phase C2.1/C3), never a parallel one. Conceptual vocabulary; no governing invariant seeded yet.

## Constitutional Sovereignty

Operator control over the system's intelligence supply — a SCALE, not a boolean (operator refinement, 2026-07-06). Sovereignty in itself is the operator's ability to choose, switch, and combine providers free of commercial or platform lock-in; no external AI provider is constitutionally indispensable, and external models function solely as interchangeable constitutional inference providers. Maximum sovereignty adds open-weight capability: the operator can run the weights outside any provider entirely. Measured on the Sovereignty Scale.

## Constitutional Cybernetics

The study of constitutionally governed adaptive systems — how a system changes under constitutional feedback while remaining constitutional (Layer III of the constitutional operating model). Invariant Intelligence establishes the substrate; Constitutional Computing operationalises it; Constitutional Cybernetics studies the governed adaptive systems that emerge. Invariants `inv.cybernetics.108`–`111`; institution: the IRL (CFS-019).

## Constitutional Cybernetics Research Laboratory

The IRL — the constitutional scientific institution of the platform (CFS-019), never "research repo" or "experiment module". It houses all constitutional research (experiments, series, programmes, publications, findings, the invariant substrate) and operates by the principles it investigates: its construction runs through the Capability Pipeline and its operation is its first and permanent experiment. Central hypothesis: Invariant Fields constitute measurable structures through which computational behaviour, constitutional coherence and consequence can be predicted, governed and experimentally validated.

## Dynamic Constitutional Interaction Runtime

The DCIR — the interaction substrate of Constitutional Computing (CFS-020): a closed bidirectional cognitive-action loop (Conversation → Inference → Action → Observation → Updated Context → Inference → …) that continuously synchronizes human intent, inference, application state, generated artefacts, recommendations, and next actions into one evolving constitutional state. Three runtime domains: the Conversational Runtime (intent/reasoning), the Action Runtime (deterministic execution → artefacts), and the Observation Runtime (everything becomes observable). Generation is never terminal — it is a state transition: every artefact becomes constitutional context, and the loop remains continuous until the constitutional objective is satisfied. DCIR stands alongside Constitutional Reasoning, Constitutional Order, and Constitutional Action as a canonical runtime capability. Invariants `inv.interaction.112`–`118`.

## Behavioural Invariant

An OBSERVED constitutional pattern discovered by the DCIR Observation Runtime — for example, the pattern that an operator always edits before approving. A behavioural invariant is not a rule and is never auto-canonical: it enters the substrate as a proposed pattern in a distinct class, and ratification stays with the operator (`inv.cybernetics.111` — constitutional adaptation never bypasses ratification). Governed by `inv.interaction.115`; the type contract (`types/dcir.ts`) deliberately cannot express a canonical status.

## Computational Epistemology

The discipline the IRL's foundational validation questions define: the study of how knowledge itself behaves as a computational object — whether knowledge can be preserved (semantic fidelity), whether knowledge can compose (temporal composition), and whether knowledge can reduce reasoning (reasoning compression). Not AI benchmarking, not LLM evaluation, not prompt engineering: the object under study is knowledge, and its preservation, composition, and reasoning-compression are measurable properties (`inv.epistemology.119`). Pursued by the IRL through its research programmes; the platform is the instrument, the research programme the enduring asset (`inv.epistemology.120`). Named by the Aletheon review (operator's co-agent, 2026-07-06 — CFS-019 institute-standing amendment).

## Platform Sovereignty

Platform sovereignty, like identity, is a BUNDLE of capabilities — never a single property or boolean (operator direction, 2026-07-06). Its dimensions: model openness (open weights + open scoring + open access), provider choice (the operator can choose and switch free of commercial or platform lock-in), commercial independence (no credit wall, billing gate, or licence can block constitutional operation — open weights behind a credit wall is an infringement), infrastructure agency (operator control over hosting, storage, and execution), and infrastructure survivability (operation survives the loss of any single infrastructure provider). Assessed dimension by dimension; measured by the Platform Sovereignty Experiment series. Invariants `inv.sovereignty.100`–`107`; full specification CFS-018.

## Platform Sovereignty Experiment Series

The PSE series (CFS-018): the experiments that measure each dimension of the platform-sovereignty bundle — an unmeasured sovereignty claim is a claim, not a capability. EXP-004 (the Sovereignty Drill) is its first member, measuring the model/provider dimension on the Sovereignty Scale; named successors cover commercial independence, infrastructure survivability, hosting posture, and model openness.

## Sovereignty Scale

The ordered rungs of operator control over inference supply: **S0 dependent** (single-provider lock-in — no sovereignty) → **S1 interchangeable** (the operator can choose and switch among providers with no commercial or platform lock-in — the ESSENCE of sovereignty) → **S2 substitutable** (validated substitutes exist and the constitutional battery completes on them) → **S3 open-weight** (maximum: an open-weight provider carries constitutional operation, and in the limit the operator can run the weights themselves). EXP-004's sovereign run tests S3; a rehearsal completion on a substitute provider is a live S2 datum, not a nothing.

## Constitutional Completeness

Maturity Level 5: a self-governing Human Agency System capable of conceiving, reasoning about, consequence-engineering, implementing, validating, deploying, operating, and improving its own evolution within its own constitutional framework.

## Constitutional Capability

What the Human Agency System can constitutionally do. The unit of value the Capability Pipeline produces and the Improvement Loop compounds. A capability may be realized as code, configuration, registry updates, prompt changes, policy, schemas, knowledge, automation, or documentation — the capability, not its mechanism, is the invariant.

## Constitutional Development

Capability development occurring through Aigent Z under constitutional governance — one implementation mechanism (among several) by which the Capability Pipeline's Implementation stage realizes intended capability.

## Constitutional Operations

The operationalization of the Human Agency System as a living constitutional operating environment: operational orchestration, portfolio management, capability deployment, standing evolution, registry interaction, operational telemetry, continuous improvement.

## Constitutional Learning

The principle that every interaction improves the constitutional capability of the Human Agency System — validated experience accumulating as knowledge (the flywheel: Standing on consequence, Reach on citation). Learning is remembering.

## Constitutional Improvement

The principle that every constitutional cycle increases the capability of the Human Agency System. Distinct from Constitutional Learning: learning is remembering; **improvement is becoming better** — the measured increase in what the system can do with what it knows. Satisfied mechanically by the Constitutional Improvement Loop.

## Constitutional Improvement Loop

The self-improvement cycle running alongside the Capability Pipeline: Capability → Operation → Observation → Receipt → Learning → **Improved Capability** (not improved code). Its order is constitutional data.

## Invariant Field

A coherent domain of interacting invariants that governs the behaviour of a system — independently verifiable, composable, and generative of emergent phenomena through interaction with other fields (CFS-002 §2a, ratified 2026-07-06). **An extension of Invariants, not a replacement for them** (operator clarification, 2026-07-16): a field is the functional ROLE one or more invariants occupy during composition, not a container that supersedes the invariants inside it. Invariants remain canonical as atomic statements; fields remain canonical as the organizing role those statements play together. Studying fields (Invariant Field Theory, CFS-019; WP5 Morphogenesis, CRP-002) never demotes the invariants a field composes — both levels stand.

## Invariant Intelligence

Intelligence that reasons over a graph of validated, provenance-bearing invariants rather than rediscovering knowledge per inference: canonical ontology precedes reasoning, composition laws govern rendering, validation establishes Standing, citation accrues Reach.

## Invariant Lineage

The traceable chain of derivation through which an invariant emerges, composes, mutates, or propagates across artifacts, fields, and generations (Aletheon, 2026-07-16, proposed as the missing object that makes versioning meaningful). Not a new mechanism — it names the SINGLE graph that CIRS mutations (`propose · merge · split · retire`, CRP-002), KnowledgeQube versioning (CFS-001 Level 3), WP5 morphogenesis candidates (CRP-002 amendment, 2026-07-16), and constitutional amendments (Law X supersession) already each produce in isolation. An Invariant Lineage is what you'd read off by following one invariant's derivation across all four without them being tracked as a single graph today — this term names the object, it does not yet build the graph. See CRP-002's WP5 amendment for the morphogenesis case this concept is meant to eventually connect to.

## Consequence Engineering

The constitutional reasoning discipline through which intended capability is transformed into predictable constitutional outcomes. Not a service among services — the discipline the constitutional reasoning services collectively execute (operating model: CFS-006a; compositional grounding: Law XV).

## Constitutional Capability Pipeline

The canonical innovation lifecycle: Intent → Context → Capability → Risk → Value → Price → Consequence → Implementation → Validation → Receipt → Learning. It produces capability, not code; the Implementation Pack is the artifact produced immediately before the Implementation stage.
- Always call it the Constitutional Capability Pipeline — never "Constitutional Development Pipeline" (superseded name, 2026-07-06)

## Constitutional Development Router

Chartered CFS-032 (2026-07-16), Chrysalis 2.0 Phase 2B. Routes WHICH EXECUTOR writes code once the Constitutional Decision stage (CFS-029 §4) has already decided the realization mechanism is `code` — a distinct axis from the ModelQube router (which routes the platform's OWN reasoning/inference, CFS-015/018) and from CFS-016's deployment authority ladder (who is allowed to execute the git push, unchanged by this router). **Not the same as the retired "Constitutional Development Pipeline" name** (above) — that name was rejected because the whole pipeline is broader than code; this router is deliberately narrow, firing only on a `code` decision. Candidate executors: Claude Code (the only one built), the Anthropic API directly, OpenAI, Gemini, open-weight models, specialist coding agents. Optimizes for constitutional fitness (sovereignty, privacy, standing, capability, cost, latency, rigor, verification, availability), never merely "best model."

## Constitutional Evaluation

The principle, ratified spec-level by CFS-033 (2026-07-16): **evaluation is a pluggable, receipted, versioned component of every experiment.** An external researcher's judge, a journal's rubric, a regulator's benchmark, and a community replication network's independent receipts are all instances of the same mechanism, never special cases. The target object is the Evaluation Configuration (task · inputs · grounding slice · runtime config · judge config · adjudication strategy · success metrics · receipt schema · export package); its terminal capability is the Research Package (a fully exportable, replayable experiment). Two components exist as of charter (the verbatim slice exporter and the external judge-config artifact, both hash-committed); the rest is named architecture. Judging (scoring) and adjudication (resolving judge disagreement) are architecturally distinct — the seam IRL-010's "internal adjudication" honesty note always implied.

## Constitutional Acceptance

Chartered CFS-032 §4 (2026-07-16; placement and definition refined twice same day — operator, then Aletheon). **Identical to Registry Registration — one event, not two stages**: the admission of a shipped capability into the Registry as a governed constitutional asset IS the acceptance event ("everything before that is engineering; everything after that is constitutional memory" — Aletheon). The pipeline stage immediately following Deployment and its receipt, distinct from Validation: Validation asks *did it work?*; Acceptance asks *does this become part of the constitutional state of the platform?* The act is a registry write: the capability and its metadata (pack id, PR, validation + deployment receipts, governing invariants, version lineage, reuse disposition) recorded as a `ConstitutionalObject`, following the Canonical Asset Registry precedent — the capability-level equivalent of constitutional ratification, and what makes it discoverable by future Gap Analysis (the Registry, not the receipt, closes the self-improvement loop). Registration is also the eligibility gate for Standing: only an accepted capability can accrue Standing, and only upon subsequent operational evidence. A capability may deploy without being accepted (a one-off fix with no reuse value); Acceptance is a decision, not an automatic consequence of deployment. Mechanism unbuilt as of charter.

## Implementation Pack

The hand-off artifact produced immediately before the Implementation stage of the Capability Pipeline: goal, invariant bindings, areas to touch, validation plan, receipt plan. One constitutional service produces it; it is not the pipeline's centrepiece.

## Provider Sovereignty

The constitutional principle that no external AI provider shall become constitutionally indispensable.

## Sovereign Survivability

The constitutional principle that the Human Agency System remains operational in the absence of any frontier AI provider, via a fallback capability on open-weight models — the S3 (maximum) rung of the Sovereignty Scale. Operational quality may degrade; constitutional operation shall not.

## Chrysalis Contract

The program gate: every enhancement to the Human Agency System must improve at least one constitutional capability — Constitutional Computing, Development, Operations, or Learning. If it improves none, it does not belong in Operation Chrysalis. (Law X restated at program level — CFS-009.)

## Deployment Authority Ladder

The ratified scale of deployment authority (CFS-016): D0 operator-manual → D1 pack-proposed (proposal constitutional, execution human — RATIFIED 2026-07-06) → D2 receipts-gated with per-deploy operator approval (unratified; precondition: D1 operating history) → D3 autonomous within bounds (explicitly not proposed). Hard boundaries bind every level: dev-rail only, protected-file diffs individually reviewed, no credential transfer, approval always per-deploy.

## Constitutional Quality Authority

The grown role of the Third Constitutional Agent: the equivalent of a compiler for constitutional change — architectural coherence, ontology governance, invariant validation, capability/continuity/improvement benchmarking, and constitutional regression testing. Nothing integrates that it cannot verify.

## Constitutional Civic Futurism

The discipline responsible for discovering and maintaining Representation Invariants — the visual language of constitutional civilization (CFS-021), never "graphic design" or "the design system" reduced to ornament. It is a peer discipline to constitutional reasoning and to physics: reasoning discovers constitutional invariants, physics discovers natural invariants, Constitutional Civic Futurism composes representation invariants. Its manifesto: it does not seek to predict the future but to reveal the enduring constitutional structures from which better futures emerge; beauty arises not from ornament but from making constitutional order visible. Every artifact is evidence-backed, composable, human-centered, and constitutionally coherent. CFS-011 (Style) and CFS-012 (Narrative) are its first two representation-invariant specifications.

## Representation Invariant

The third canonical family of invariants (CFS-021), after natural invariants (discovered) and constitutional invariants (ratified): representation invariants are COMPOSED, and they preserve identity AND connotation across media. Where knowledge invariants answer "what must always remain true?", representation invariants answer "what must always remain recognizable?" — carrying a constitutional object's sameness across page, animation, film, audio, interaction, spatial, and temporal modalities. Members include visual grammar, narrative grammar, cinematic grammar, interaction grammar, typography, motion language, and the bearing. `inv.representation.121`–`125`.

## Operational Representation Invariant

A representational structure whose purpose is not merely to preserve the identity and connotation of a constitutional object, but to ENABLE reasoning, navigation, and interaction with the Constitutional Field (CFS-021). This is what distinguishes Constitutional Civic Futurism from an ordinary design system: an icon is decorative, a symbol is semantic, an instrument is operational — operational representation invariants are instruments. The Bearing Instrument and the Constitutional Plates are the two primary operational representation invariants. Governed by the instrument law (`inv.representation.124`): every representation should function as an instrument.

## Surface Material

The physical substance a surface is painted WITH — translucency, backdrop blur, a hairline edge, and elevation — carried as a first-class representation role alongside colour, type, and motion (CFS-021 §3; `inv.representation.129`). An interpretation binds material (`material.blur`, `material.tint`, `material.hairline`, `material.elevation`) exactly as it binds colour, and "flat" (opaque tint, no blur, no shadow) is a valid material, exactly as parchment is a valid ground. Material roles are non-colour CSS substance values, so the colour relationship laws (contrast · distinctness · monotonic standing) never run over them — only completeness binds them. The lesson that surfaced it: colour alone cannot express a rendering system. Constitutional Civic Futurism and High-Contrast Accessible bind flat material; the AgentiQ Liquid Glass house-style interpretation binds real glass (translucent slate tint, `blur(16px) saturate(180%)`, white hairline, soft shadow with the signature inset top-highlight).

## Bearing Instrument

The primary operational representation invariant of Constitutional Civic Futurism — the constitutional compass, functionally and not metaphorically (CFS-021), never "the logo". Just as a compass does not tell you where to go but lets you orient yourself, the Bearing Instrument orients the reader within the Constitutional Field. Its three verbs are orient, navigate, and reason — never decorate, brand, or illustrate. It carries five simultaneous functions: orientation (where am I in Constitutional Order — subtle sectors around the mark), navigation (where can I go next — directional bearing ticks toward related plates), projection (which modality — rotate the same object through page → animation → film → interactive → XR → simulation), standing (how mature — Experimental → Validated → Canonical → Foundational), and relationships (what other plates share these invariants). It is the navigation primitive across representations, and after repeated exposure it builds an intuitive mental map of the constitutional field — constitutional UX in which the visual language itself performs reasoning assistance.

## Constitutional Plate

An operational representation invariant that projects a constitutional object into a human-comprehensible form while preserving its identity, connotation, provenance, and relationships within the Constitutional Field (CFS-021), never "infographic", "slide", or "presentation graphic". A plate is a canonical illustration of a discovered principle — the graphical equivalent of a KnowledgeQube, and more precisely a map projection: no single plate perfectly represents Constitutional Order; each emphasizes something different, and together they reveal the field. Plates are visual reasoning compressors: the bearing is the entry point into the graph, the plate is a projection of a region of the graph, and the reader reconstructs the field through repeated exposure. Every plate carries the plate grammar (Canonical Question · Canonical Principle · Primary Diagram · Supporting Notes · Canonical Standing · Related Plates) and introduces exactly ONE new constitutional primitive.

## Constitutional Field

The one unified field of which the invariant graph, invariant fields, ontology, standing, and constitutional order are all manifestations (CFS-021) — not separate things. Every Constitutional Plate is a window into this field; the Bearing Instrument is its coordinate system. Citizens do not interact with Constitutional Order directly, any more than scientists interact with gravity directly — they interact through constitutional instruments: the Bearing Instrument is the compass, the Constitutional Plates are the maps, the Registry is the atlas, Studio is the observatory. The field is navigated through identity, not representation (`inv.representation.123`).

## Constitutional Trinity

The three first principles from which constitutional civilization emerges, composed continuously (CFS-021, `plate.constitutional.trinity`): Constitutional Reasoning discovers enduring invariants; Constitutional Order organizes those invariants into coherent systems; Constitutional Action applies those systems to transform consequences in the real world. Reasoning discovers. Order organizes. Action transforms. It mirrors the applied-research chain (Discovery → Compression → Implementation → Validation → Standing → Canonical Knowledge, CFS-019) and the DCIR loop. The subject of the first Constitutional Plate.

## Constitutional Representation System

The cohesive representation and rendering system whose constant is the representation invariants and whose variables are its interpretations (CFS-021), never "the house style" or "the design theme". The system is the invariant contract — the roles, relationships, and semantics every rendering must satisfy (identity, connotation, provenance, navigability; the plate grammar; the bearing's orient/navigate/reason semantics). An INTERPRETATION is a concrete binding of that contract to specific visual/narrative/interaction values; Constitutional Civic Futurism (ivory parchment · charcoal linework · indigo geometry · muted gold) is interpretation v1, never the definition. A style is an interpretation of the representation invariants as a modality is a projection of them, and identity and connotation are preserved across interpretations exactly as across modalities (`inv.representation.128`). An interpretation binds not only colour but surface material (`inv.representation.129`); it is valid only if it satisfies the invariant contract; the system does not impose a look, it guarantees coherence across looks. It ships three interpretations — AgentiQ Liquid Glass (the platform house style, the DEFAULT, for cohesion), Constitutional Civic Futurism (interpretation v1 / the reference atlas grammar), and High-Contrast Accessible (the accessibility lens) — the default being a cohesion choice, not a canonicity claim (default ≠ canonical-first).
