# Commit Brief: `e84c019` — consolidate the three acquisition-required Freeze blockers into one brief

| Field | Value |
|-------|-------|
| SHA | [`e84c019`](https://github.com/iQube-Protocol/AigentZBeta/commit/e84c019863a58a11b4b5cb15ac13f2f967953c6a) |
| Author | Claude |
| Date | 2026-08-27T13:12:20Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
consolidate the three acquisition-required Freeze blockers into one brief

Audit finding: the "Go acquire" links (Track2ProgrammePanel's "Finish
Crystal — remaining work" banner) did not open Corpus Scout or carry any
targeting context at all — they only ran scrollToAnchor(destAnchor), a
same-page smooth-scroll to the "Discover Sources" stage's anchor id.
selection-space, derivation-headroom and boundary-coverage all share the
identical remediationStageAnchor ('discover-sources' — see
crystalInstrumentSuite.ts's CRYSTAL_READINESS_CHECK_CONTRACT), so all three
"Go acquire" links did the exact same generic scroll with zero information
about which namespaces, structures, or quantities acquisition should target.

Fix: services/research/crystalAcquisitionBrief.ts's CrystalAcquisitionBrief
— a pure builder that performs NO readiness arithmetic of its own; every
figure (requiredNetNewDistinctMembers, missingNamespaces,
deficientRelationalStructures, entailment-chain targets, admissibility
constraints) is read off an already-computed CrystalReadinessReport, so it
can never disagree with the readiness the operator is looking at
(inv.engineering.036/037). Exposed read-only via
GET /api/research/crystal/[experimentId]/acquisition-brief.

Track2ProgrammePanel.tsx: replaces the three independent per-check links
with ONE "Build targeted acquisition plan" action (CrystalAcquisitionPlan)
rendered once, showing the brief's missing namespaces, deficient relational
structures, entailment-chain deficit, admissibility constraints, and a
recommendation tooltip explaining why one combined pass is preferred over
three separate runs. "Approve & start acquisition" reuses the EXISTING
Corpus Scout automation entry point (POST /api/corpus-scout/
institution-discovery/domain — the same route and single-click governance
pattern as DomainConstitutionPanel's runDomainDiscovery) rather than forking
a parallel pipeline. The remaining per-check links in the summary banner now
route to this same consolidated plan instead of a bare scroll.

Capability gap (reported, not silently worked around — see the file's own
header): runDiscoveryForDomain/runDiscoveryForInstitution
(services/corpusScout/discoveryOrchestrator.ts) accept only a domain string
— there is no way to target specific missing namespaces or relational
structures within a domain crawl. The brief surfaces those as operator
priorities; the automated crawl itself stays domain-wide and uniform,
exactly as everywhere else this route is already used. Closing that gap
means changing how each ratified institution is queried (external-HTTP
crawl/seed logic) and is out of scope for this pass.

structural-diversity (DiversityCandidateQueue): Close now reads "collapses
only — resolves nothing"; the zero-candidate message states plainly that
Freeze is unaffected and offers the combined brief as the next real place
the signal can be acted on.

tests/crystal-acquisition-brief.test.ts behaviorally proves the deficit is
COMPUTED (11/60 = deficit 49, verified against the real
deriveCrystalPopulationRequirement() output, not a literal), missing
namespaces are read from the real 15-namespace INVARIANT_NAMESPACES
registry, derivational-structure targets are preserved, already-admitted
invariants are excluded for dedup, and structural-diversity is proven never
counted among the three freeze-blocking completion criteria.
```

## Body

Audit finding: the "Go acquire" links (Track2ProgrammePanel's "Finish
Crystal — remaining work" banner) did not open Corpus Scout or carry any
targeting context at all — they only ran scrollToAnchor(destAnchor), a
same-page smooth-scroll to the "Discover Sources" stage's anchor id.
selection-space, derivation-headroom and boundary-coverage all share the
identical remediationStageAnchor ('discover-sources' — see
crystalInstrumentSuite.ts's CRYSTAL_READINESS_CHECK_CONTRACT), so all three
"Go acquire" links did the exact same generic scroll with zero information
about which namespaces, structures, or quantities acquisition should target.

Fix: services/research/crystalAcquisitionBrief.ts's CrystalAcquisitionBrief
— a pure builder that performs NO readiness arithmetic of its own; every
figure (requiredNetNewDistinctMembers, missingNamespaces,
deficientRelationalStructures, entailment-chain targets, admissibility
constraints) is read off an already-computed CrystalReadinessReport, so it
can never disagree with the readiness the operator is looking at
(inv.engineering.036/037). Exposed read-only via
GET /api/research/crystal/[experimentId]/acquisition-brief.

Track2ProgrammePanel.tsx: replaces the three independent per-check links
with ONE "Build targeted acquisition plan" action (CrystalAcquisitionPlan)
rendered once, showing the brief's missing namespaces, deficient relational
structures, entailment-chain deficit, admissibility constraints, and a
recommendation tooltip explaining why one combined pass is preferred over
three separate runs. "Approve & start acquisition" reuses the EXISTING
Corpus Scout automation entry point (POST /api/corpus-scout/
institution-discovery/domain — the same route and single-click governance
pattern as DomainConstitutionPanel's runDomainDiscovery) rather than forking
a parallel pipeline. The remaining per-check links in the summary banner now
route to this same consolidated plan instead of a bare scroll.

Capability gap (reported, not silently worked around — see the file's own
header): runDiscoveryForDomain/runDiscoveryForInstitution
(services/corpusScout/discoveryOrchestrator.ts) accept only a domain string
— there is no way to target specific missing namespaces or relational
structures within a domain crawl. The brief surfaces those as operator
priorities; the automated crawl itself stays domain-wide and uniform,
exactly as everywhere else this route is already used. Closing that gap
means changing how each ratified institution is queried (external-HTTP
crawl/seed logic) and is out of scope for this pass.

structural-diversity (DiversityCandidateQueue): Close now reads "collapses
only — resolves nothing"; the zero-candidate message states plainly that
Freeze is unaffected and offers the combined brief as the next real place
the signal can be acted on.

tests/crystal-acquisition-brief.test.ts behaviorally proves the deficit is
COMPUTED (11/60 = deficit 49, verified against the real
deriveCrystalPopulationRequirement() output, not a literal), missing
namespaces are read from the real 15-namespace INVARIANT_NAMESPACES
registry, derivational-structure targets are preserved, already-admitted
invariants are excluded for dedup, and structural-diversity is proven never
counted among the three freeze-blocking completion criteria.

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/research/crystal/[experimentId]/acquisition-brief/route.ts` |
| Modified | `components/research/Track2ProgrammePanel.tsx` |
| Added | `services/research/crystalAcquisitionBrief.ts` |
| Added | `tests/crystal-acquisition-brief.test.ts` |

## Stats

 4 files changed, 1068 insertions(+), 11 deletions(-)
