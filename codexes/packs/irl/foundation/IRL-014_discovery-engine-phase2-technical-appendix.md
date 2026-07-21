# IRL-014 — Technical Appendix: Discovery Engine Phase 2

**Status:** Internal Technical Design Note

## Objective

Phase 2 transforms invariant discovery from isolated extraction into recursive
scientific compression. Rather than discovering invariants in isolation, the
system begins constructing an invariant **topology**.

```
Phase 1                      Phase 2
Evidence                     Evidence
  ↓                            ↓
Candidate Invariants         Domain Discovery
  ↓                            ↓
Registry                     Sub-domain Discovery
                               ↓
                             Compare
                               ↓
                             Earned Domain Invariants
                               ↓
                             Parent-child Topology
                               ↓
                             Invariant Field
```

## Core Principles

**Discovery never canonises.** Discovery *proposes*; validation canonises.

**Compression is earned.** Higher-order invariants emerge only through
independent recurrence across multiple sub-domains — never from model
confidence.

**Graph before ontology.** Relationships are first established through
parent-child topology; only afterwards do constitutional structures emerge.

**Evidence always remains attached.** Every invariant preserves provenance;
compression never loses evidence.

## Compare

Compare performs recursive reasoning compression.

- **Input:** multiple validated sub-domain invariant collections.
- **Output:** candidate higher-order domain invariants.
- **Classification:** Supported · Novel · Specialized · Split (and Equivalent).
- **Confidence:** derived from recurrence across sub-domains, not model
  confidence.

## Parent-Child Topology

Promotion creates explicit graph relationships (`specializes` / `generalizes`
edges), making the graph the scientific representation of invariant evolution:

```
Sub-domain
  ↓ specializes
Domain
  ↓ specializes
Cross-domain
  ↓ specializes
Constitutional
```

## Future Work

Phase 3 extends the same process across independent industries — Financial
Services, Healthcare, Energy, Manufacturing, Government. Only after recurrence
across multiple domains will constitutional invariants be proposed.
