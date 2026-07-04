# Appendix A — The Canonical Invariants

**Chrysalis Foundation Specification · v0.1 · Status: living document**
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`

The seed crystal for the Invariant Ontology. Where philosophy becomes engineering, where research becomes implementation, and where every future capability ultimately traces its lineage.

Each invariant is expressed in its simplest canonical form. The machine-readable twin of this document is `canonical-invariants.seed.json` (same directory) — the file the Phase 1 ontology ingestion loads. **The two must be kept in lockstep**; the JSON is the ingestion source of truth, this document is the human canon.

Status at seed time is `proposed` for all entries; `canonical` status requires ratification through the canonization process (Law XI). Entries drawn verbatim from ratified Polity documents are marked ★ — their ratification precedes this appendix.

---

## Reasoning (`reasoning`)

1. Reasoning discovers invariants.
2. Invariants constitute knowledge.
3. Knowledge precedes inference.
4. Compressed expertise is a reusable computational primitive.
5. Adaptive systems compose validated primitives rather than rediscover them.
6. Civilizational progress is the progressive accumulation of validated invariants.
7. Reasoning is a process; knowledge is the product.
8. An invariant does not change with its domain; its context does.
9. Explainability is retrieval of provenance, not post-hoc rationalisation.
10. A superseded belief's provenance is itself knowledge.

## Constitution (`constitutional`)

11. Personhood precedes identity.
12. Standing follows action.
13. Authority follows standing.
14. Delegation never removes accountability.
15. ★ Authority may be delegated; sovereignty may not.
16. ★ Sovereignty remains exclusively with human citizens.
17. ★ An agent may exercise delegated authority but may never create new authority.
18. ★ Standing is confidence in the veracity of declarations, not reputation.
19. ★ Citizens are responsible for veracity, not for predicting consequences of truthful information.
20. ★ Permanent and unlimited delegation is prohibited.
21. Humans define semantics; AI optimizes implementation.
22. Canonical status requires human ratification.
23. Constitutional memory is append-only; supersession replaces deletion.
24. Identifiers that re-identify a subject never leave the server.

## Engineering (`engineering`)

25. Preserve before replace.
26. Extend before recreate.
27. Compose before specialize.
28. Discover invariants before designing abstractions.
29. Compress expertise before automating it.
30. Separate architecture from rendering.
31. Separate reasoning from inference.
32. Treat invariants as first-class computational primitives.
33. Adaptive systems render; canonical systems govern.
34. Every evolution must strengthen the invariant ontology.
35. Three similar lines of code beat a premature abstraction.
36. One authoritative location per concern.
37. A parallel implementation of an existing capability is a defect.
38. Never guess a value that cannot be verified from source.
39. Additive schema change precedes destructive schema change.
40. Every state transition of record emits a receipt.
41. A failure in the provenance chain is escalated, never silent.

## Experience (`experience`)

42. Agency increases through progressive disclosure.
43. Experience should adapt while architecture remains invariant.
44. Rendering is contextual; primitives are constitutional.
45. Experience depth ascends one step at a time.
46. Derivative content renders inside the context that produced it.
47. The operator reads posture at a glance; state must be legible before it is precise.

## Capability (`capability`)

48. Capability is composition over validated primitives.
49. A capability's trust is bounded by its least-trusted member.
50. Consequence forecasting precedes irreversible action.
51. Repair cost, uncertainty, and reversibility bound permissible autonomy.
52. Observed consequence is the final validator of forecast capability.
53. Standing converts consequence into constitutional capital.
54. New knowledge from consequence feeds the next intent.

## Additions — v0.1 amendment (the Manifesto + the Three Orders)

55. *(reasoning)* Civilization accumulates invariants, not information.
56. *(reasoning)* Knowledge enables capability.
57. *(capability)* Capability creates consequence.
58. *(engineering)* The Polity defines why; AgentiQ defines how; Chrysalis defines how it evolves.
59. *(constitutional)* Invariants themselves accrue Standing.

## Additions — Law XII amendment (Truth, Standing and Reach)

*Semantic type `epistemic` ratified with this amendment. (Proposed as INV-055–057; issued as 060–062 — ids 055–059 were already taken and the append-only rule forbids renumbering.)*

60. *(constitutional · epistemic)* Truth is established through validation within a domain of applicability, not by popularity.
61. *(constitutional · epistemic)* Standing expresses constitutional confidence in an invariant and shall never be interpreted as a measure of truth.
62. *(constitutional · epistemic)* Reach measures adoption rather than validity; constitutional knowledge preserves the distinction between Truth, Standing, and Reach.

## Additions — Law XIII amendment (Individualization)

63. *(constitutional · principle)* Personhood precedes individualization. Individualization precedes standing. Identity is an optional derivative of individualization rather than a prerequisite for constitutional participation.
64. *(constitutional · definition)* Individualization is the establishment of a constitutional subject capable of accruing Standing without that subject being identifiable.
65. *(constitutional · principle)* Individualization is defined by continuity, not disclosure — a constitutional subject's persistence across time and interaction is what allows validated action to accumulate into Standing, independent of whether that subject is ever identified.
66. *(constitutional · principle)* Identity is a branch of individualization, not its gate; it yields reputation, not standing.
67. *(constitutional · principle)* Individualization's continuity shall be maintained without requiring re-identification by any party, including the server — a target which current server-internal (T0) implementations approximate but do not define the limit of.

---

## Maintenance

- Add entries by appending — renumbering is forbidden once an id is issued (ids are `inv.<namespace>.<nnn>` in the JSON).
- Every addition updates both files in the same commit.
- Promotion to `canonical` is recorded here (★ or a ratification note) and DVN-anchored.
- When the Phase 1 substrate lands, this appendix remains the human-readable canon; the database becomes the operational source, re-exportable to the JSON.
