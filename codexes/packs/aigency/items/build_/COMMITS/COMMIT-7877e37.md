# Commit Brief: `7877e37` — Distinguish source-declared vs ledger-confirmed ratification status for Polity Core

| Field | Value |
|-------|-------|
| SHA | [`7877e37`](https://github.com/iQube-Protocol/AigentZBeta/commit/7877e3740ff049a3c30414435fa81d9c350271be) |
| Author | Claude |
| Date | 2026-09-03T06:21:03Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Distinguish source-declared vs ledger-confirmed ratification status for Polity Core

A document's self-declared header ("status: ratified") is not sufficient
proof of ratification — checked every Polity Core document's status
against the actual canonical mechanism, codexes/packs/polity-core/items/
AMENDMENT_RECORDS.md (the append-only ratification ledger), rather than
trusting each document's own prose.

Finding: every entry checks out EXCEPT CONSTITUTION_OF_AGENTIC_POLITY.md.
Its own header reads "status: ratified", and services/polity/
constitution.ts repeats "elevated to ratified status" in a comment — but
AMENDMENT_RECORDS.md has zero entries for it anywhere (searched the full
ledger), and it is confirmed NOT part of the Agent Passport binding triple
(CURRENT_CONSTITUTIONAL_VERSIONS lists only Constitution + Agent Charter +
Delegation Framework). The other 22 allowlisted documents are
independently confirmed: the 9 charters/frameworks either have a dated
row in the ledger's Ratified table or an Autodrive on-chain CID entry (a
stronger form of confirmation); VentureQube's "proposed" status matches
its ledger row exactly (draft_wip); the 10 commentary papers correctly
carry no ledger entry, matching the series' own "not ratified law" framing.

Added `statusVerification: 'ledger-confirmed' | 'source-declared-only'`
to every Polity Core document summary/page, surfaced through the public
MCP tools — this is a flag, not a silent downgrade: the operator's
ratification of that document may simply be missing from the ledger, and
that gap is itself the finding to report rather than resolve unilaterally.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

A document's self-declared header ("status: ratified") is not sufficient
proof of ratification — checked every Polity Core document's status
against the actual canonical mechanism, codexes/packs/polity-core/items/
AMENDMENT_RECORDS.md (the append-only ratification ledger), rather than
trusting each document's own prose.

Finding: every entry checks out EXCEPT CONSTITUTION_OF_AGENTIC_POLITY.md.
Its own header reads "status: ratified", and services/polity/
constitution.ts repeats "elevated to ratified status" in a comment — but
AMENDMENT_RECORDS.md has zero entries for it anywhere (searched the full
ledger), and it is confirmed NOT part of the Agent Passport binding triple
(CURRENT_CONSTITUTIONAL_VERSIONS lists only Constitution + Agent Charter +
Delegation Framework). The other 22 allowlisted documents are
independently confirmed: the 9 charters/frameworks either have a dated
row in the ledger's Ratified table or an Autodrive on-chain CID entry (a
stronger form of confirmation); VentureQube's "proposed" status matches
its ledger row exactly (draft_wip); the 10 commentary papers correctly
carry no ledger entry, matching the series' own "not ratified law" framing.

Added `statusVerification: 'ledger-confirmed' | 'source-declared-only'`
to every Polity Core document summary/page, surfaced through the public
MCP tools — this is a flag, not a silent downgrade: the operator's
ratification of that document may simply be missing from the ledger, and
that gap is itself the finding to report rather than resolve unilaterally.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `services/threshold/publicKnowledge.ts` |
| Modified | `tests/threshold-public-knowledge-bridge.test.ts` |

## Stats

 2 files changed, 83 insertions(+), 26 deletions(-)
