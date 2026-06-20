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

| Framework | Version | Autodrive CID |
|---|---|---|
| Polity Constitution | 1.0.0 | _published via `scripts/publish-polity-core.mjs`_ |
| Autonomous Agent Charter | 1.0.0 | _published via `scripts/publish-polity-core.mjs`_ |
| Delegation Framework | 1.0.0 | _published via `scripts/publish-polity-core.mjs`_ |
