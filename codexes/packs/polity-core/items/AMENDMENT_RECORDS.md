# Amendment Records

The append-only ledger of constitutional changes. Each entry records what
changed, the resulting version, and the ratification date. Superseded versions
remain readable for audit; agents must bind to the current approved versions.

## Ratified

| Date | Framework | Version | Change |
|---|---|---|---|
| 2026-06-17 | Polity Constitution | 1.0.0 | Initial ratification — sovereignty is human-only; authority is delegable, sovereignty is not; chain of legitimacy Polity → Citizen → Delegation → Agent. |
| 2026-06-17 | Autonomous Agent Charter | 1.0.0 | Initial ratification — ADID class; Phase 1 admin-only; no kybe DID / citizenship / standing / governance; sponsorship, revocation, sub-agent, persistent-agent, economic, and receipt rules. |
| 2026-06-17 | Delegation Framework | 1.0.0 | Initial ratification — bounded on scope/duration/spend/info/domains; permanent and unlimited delegation prohibited; envelope immutable after creation. |
| 2026-06-17 | Standing Charter | 1.0.0 | Initial ratification — Standing = confidence in veracity of declarations (not reputation/status); citizen obligation is veracity, Polity obligation is interpretation; held by citizens, aigents, organizations, institutions; participant agents hold Standing but not citizenship/inalienable rights. |
| 2026-06-17 | metaCommons Charter | 1.0.0 | Initial ratification — the second institution; transforms sovereign signals into collective intelligence; the Commons is a field; aggregates Proof of Work Potential; learns through Proof of Time Saved. |
| 2026-06-17 | Standing Framework | 1.0.1 | Corrected — participant agents DO hold Standing (participatory, revocable rights), not citizenship; reframed as operational companion to the Standing Charter. |
| 2026-06-17 | Founder Office Charter | 1.0.0 | Initial ratification — sub-metaCommons constitutional artefact; capability discovery + opportunity intelligence + venture formation; primary institutional interface between founders and the metaCommons; consumes Commons signals (intent/demand/capability/opportunity/standing + PoWP); Standing calibrates confidence, does not gate opportunity; purpose is venture formation, not extraction. Downstream of the metaCommons Charter; calibrated by the Standing Charter; NOT part of the Agent Passport binding triple. |

## Drafts / Work-in-progress (NOT ratified)

| Date | Primitive | Version | Status | Note |
|---|---|---|---|---|
| 2026-06-21 | VentureQube Specification | 1.0.0-wip | draft_wip | Stubbed constitutional primitive (ClusterQube specialization). Recorded for legibility while the Founder Office / Venture Lab engine is built; NOT in the Agent Passport binding triple; NOT yet published to Autodrive. Engineering SoT: `types/ventureQube.ts` (v1.0). Promote to ratified once the engine is operational and the spec is locked. |
| 2026-07-03 | Invariant Intelligence (Foundational Constitutional Record) | 0.1 | canonical_foundational | Foundational Constitutional Record establishing the constitutional origin of the Invariant Intelligence model within the Polity Canon; project Chrysalis Foundation. Records the first-principle discoveries (seven Constitutional Principles) and the foundational computational objects (Invariant, Invariant Ontology, Invariant Graph, iQube, Registry). Constitutional anchor for the Chrysalis Foundation Specification Bundle. NOT yet published to Autodrive; NOT part of the Agent Passport binding triple. |

## Immutability

The machine-readable counterparts of every ratified framework are published to
Autodrive (Autonomys) for content-addressed immutability. The resulting CIDs are
recorded alongside each version so any party can verify the on-chain copy
matches the in-repo source of legitimacy.

| Framework | Version | Autodrive CID (Autonomys mainnet) |
|---|---|---|
| Polity Constitution | 1.0.0 | `bafkr6ie7xpb76mbi43zcq6bza5u6w7hkoiyzzt6u2dzc77n434khlatvqq` |
| Autonomous Agent Charter | 1.0.0 | `bafkr6ifttkd6vwktjy45aqsxzirap5p7iizyy6ligekmqtgbkmfonxygxq` |
| Delegation Framework | 1.0.0 | `bafkr6ibmhpwihx7ghvalps3a3dk5wf7iq7yl7dwc35b4a2rhkfx5vqenbm` |

Published 2026-06-20 via `POST /api/polity-core/publish`. The CIDs are also
served by `GET /api/polity-core/constitution` and recorded in
`services/polity/frameworks/autodrive-cids.json`.
