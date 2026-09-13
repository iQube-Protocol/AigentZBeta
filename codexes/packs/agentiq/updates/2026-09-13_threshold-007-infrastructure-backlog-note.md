# Threshold 007 — Infrastructure Implications Note (Backlog, Not Evidence)

**Status:** Infrastructure/architecture backlog note. Not research evidence, not part of the Evidence-Resolution Pass, not a claim about Threshold 007's scientific maturity. Kept separate per operator instruction: "the Evidence Access ClusterQube is backlog/architecture, not research evidence, so it shouldn't go into the evidence-resolution prose."

Both items below are also recorded as real rows in `research_backlog_items` (CFS-051's existing backlog home — see `codexes/packs/irl/foundation/CFS-051A_prospective-evolution-roadmaps.md` Roadmap C), so they persist as structured backlog, not only as prose.

## 1. Evidence Access ClusterQube (general infrastructure)

A future Evidence Access ClusterQube / IRL Invitation mechanism has been discussed as a way to give authorized reviewers governed access to private evidence associated with each Threshold essay, rather than evidence being either fully public or fully inaccessible. This is a proposed architectural refinement — **not implemented**, and it must not be classified as existing evidence unless independently found to already exist in code (it was not, per the evidence-resolution sweep).

Candidate eventual shape (operator-supplied):

```
Threshold 007 → Evidence ClusterQube → Lehigh Corpus
IRL Invitation → ClusterQube entitlement → authorized artifact resolution
```

`research_backlog_items` row: `threshold-007-evidence-access-clusterqube`.

## 2. Lehigh corpus constitutionalization (specific, time-bound backlog item)

**Artifact integrity and availability: established. Constitutional asset registration: pending.**

The 8 dense Lehigh REIT Risk corpus artifacts (`DATA_RISK_FOR_MARKETPLACES_V2.md`, `Pricng_Data_and_Risk_Final_Project_Paper.pdf`, `Plan_v.02.pdf`, `Final_Report_metaMe1.pdf`, `PoTS_Protocol_Integration_Pack_v0.1.pdf`, `Value_engine_Logic.docx`, `Book4.xlsx`, `Dhrunal_Belani_Final_Report_MetaMe_2.pdf`) are now durably hosted with verified sha256 integrity and repository-manifested locations (`codexes/packs/agentiq/resources/lehigh-reit-risk-corpus/README.md`). They are presently direct Supabase Storage objects (public bucket `content-assets`, `research/lehigh-reit-risk-corpus/` prefix) rather than assets registered through the normal content-asset / iQube-trinity provenance pipeline. This affects constitutional registration and governed-access status, **not** the evidentiary contents of the artifacts themselves — the Evidence Agent should treat them as primary-source verified artifacts regardless of their current registration state.

Their being in a public bucket resolved today's evidence-availability problem but is not the intended end state for internal research materials, and conflicts with the access architecture item 1 describes above.

**Backlog item — Lehigh corpus constitutionalization:** migrate/attach the eight currently public Supabase Storage artifacts to the canonical content-asset/iQube provenance system once Threshold MCP OAuth is restored; preserve existing sha256 fingerprints as continuity anchors; associate them with the Threshold 007 Evidence ClusterQube (once item 1 exists); move governed/internal artifacts behind IRL Invitation access; verify byte-identical resolution after migration before retiring public exposure.

`research_backlog_items` row: `threshold-007-lehigh-corpus-constitutionalization`.

**Do not block the Evidence Agent on this.** Registration is infrastructure; evidence resolution proceeds now against the Storage-hosted artifacts as-is.

## Status summary

| Concern | Status |
|---|---|
| Content integrity (sha256 fingerprints) | Resolved |
| Primary-source accessibility (durable URLs) | Resolved |
| Evidence analysis | Proceed now — see the Evidence-Resolution Pass and its v1.1 addendum |
| iQube registration/provenance | Backlog (item 2 above) |
| IRL-governed reviewer access | Backlog (item 1 above) |
| Public exposure of internal corpus | Temporary state, to retire once item 2 completes |
