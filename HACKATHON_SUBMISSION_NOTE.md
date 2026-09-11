# Hackathon Submission Note — Build Provenance

**The next Amplify deploy will appear monolithic. It is not.**

Seven discrete sprints, each landed as its own commit on `dev` between 2026-06-13 14:30Z and 19:50Z UTC, with full per-sprint commit messages. The five prior Amplify builds failed at the same webpack step because Sprint 2 introduced a literal `dynamic import('@worldcoin/idkit')` while the npm package was deliberately not yet installed (stub-mode is the demo cut). Webpack resolves dynamic imports at build time regardless of the surrounding `.catch()`, so every subsequent push died at the same error before any of the later sprints could be exercised.

Commit `841a64e7` removed the literal import; the wallet drawer now always emits a `dev-worldid-orb` token that the server-side `verifyWorldIdProof` accepts in stub mode. With that fix on the dev tip, the next Amplify build picks up the cumulative state of seven prior sprint commits in one green deploy. That is an artifact of the build-failure backlog, not a bundled commit.

## Discrete sprint commits (git log proof)

```
554aab04 sprint 1 step 2 — complete PersonaQube mint to Sui+Walrus (stub mode pending packages)
25260ebb sprint 2 — world id strong verification for citizen passports
88194cc4 sprint 3 — agent genesis + sponsored agents wallet surface
69905ac5 sprint 3 — agent genesis wizard inside the passport bureau apply tab
9a7e4e9f sprint 4 — polity passport locker + qubetalk channel bridge
e86dfe4a sprint 5 — delegation tab in passport + agentkit attestation bridge
16d854f4 sprint 6 — partial provekit zk for personhood + delegation authority
23713004 sprint 7 — ens subnames for personas + lockers via namestone
841a64e7 fix amplify build — remove literal @worldcoin/idkit dynamic import
```

Each row above is browsable on GitHub at:
`https://github.com/iQube-Protocol/AigentZBeta/commit/<sha>`

## Per-sprint scope (one line each)

| Sprint | What shipped |
|---|---|
| 1 | UI tier-3 badge move + PersonaQube mint to Sui+Walrus |
| 2 | World ID strong verification for Citizen Passports |
| 3 | Agent Genesis (polity-bound RootDID) + sponsored-agents wallet surface + Apply-tab wizard |
| 4 | Polity Passport Locker + QubeTalk channel bridge |
| 5 | Delegation tab in Passport + AgentKit attestation bridge (operates within bounded delegation, not replacing) |
| 6 | Partial ProveKit: proof_of_personhood + proof_of_delegation_authority (3 Phase-B circuits return shaped placeholders) |
| 7 | ENS subname minting via Namestone for personas + lockers |

## Full session doc

`codexes/packs/agentiq/updates/2026-06-13_hackathon-submission-sprints-1-7-complete.md` — captures architecture decisions (Sui+Walrus rail, AgentKit-within-framework, agent RootDID binding, human↔agent flow asymmetry), the six SQL migrations, env vars, smoke-test path, and the Phase-B backlog.
