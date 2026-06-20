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
